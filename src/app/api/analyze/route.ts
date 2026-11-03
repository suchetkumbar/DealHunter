import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeWebsite } from "@/lib/analyze";
import { BlockedUrlError } from "@/lib/safe-fetch";

export const runtime = "nodejs";

const Body = z.object({
  url: z.string().trim().max(2048).nullable(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Send a JSON body like {\"url\": \"https://example.com\"}." }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "The url field must be a web address or null." }, { status: 400 });
  }

  try {
    const report = await analyzeWebsite(parsed.data.url || null);
    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof BlockedUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[analyze] unexpected failure", err);
    return NextResponse.json({ error: "The analyzer hit an unexpected problem. Try this lead again." }, { status: 500 });
  }
}
