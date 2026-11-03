import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeWebsite } from "@/lib/analyze";
import { errorJson, guardRequest } from "@/lib/guard";
import { BlockedUrlError } from "@/lib/safe-fetch";

export const runtime = "nodejs";
export const maxDuration = 25;

const Body = z.object({
  url: z.string().trim().max(2048).nullable(),
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
    return NextResponse.json(report, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof BlockedUrlError) return errorJson(err.message, 400);
    console.error("[analyze] unexpected failure", err);
    return errorJson("The analyzer hit an unexpected problem. Try this lead again.", 500);
  }
}
