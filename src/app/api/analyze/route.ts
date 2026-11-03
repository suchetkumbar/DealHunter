import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeWebsite } from "@/lib/analyze";
import { errorJson, guardRequest } from "@/lib/guard";
import { recordAudit } from "@/lib/history";
import { BlockedUrlError } from "@/lib/safe-fetch";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 25;

const Body = z.object({
  url: z.string().trim().max(2048).nullable(),
  // Optional context so signed-in users get the audit in their history.
  leadId: z.string().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(200).optional(),
});

export async function POST(req: Request) {
  const blocked = await guardRequest(req, { name: "analyze", limit: 60, maxBodyBytes: 4096 });
  if (blocked) return blocked;

  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return errorJson('Send a JSON body like {"url": "https://example.com"}.', 400);
  }
  if (!parsed.success) {
    return errorJson("The url field must be a web address or null.", 400);
  }

  try {
    const report = await analyzeWebsite(parsed.data.url || null);
    const { leadId, name } = parsed.data;
    if (leadId && name) {
      // Best effort: history must never break the audit itself.
      try {
        const user = await getUser();
        if (user) {
          await recordAudit(user.id, {
            leadId,
            businessName: name,
            url: report.url,
            opportunity: report.opportunity,
            verdict: report.verdict,
            missing: report.signals.filter((s) => !s.passed).map((s) => s.label),
          });
        }
      } catch (err) {
        console.error("[analyze] could not record audit history", err);
      }
    }
    return NextResponse.json(report, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof BlockedUrlError) return errorJson(err.message, 400);
    console.error("[analyze] unexpected failure", err);
    return errorJson("The analyzer hit an unexpected problem. Try this lead again.", 500);
  }
}
