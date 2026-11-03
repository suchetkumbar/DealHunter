import { NextResponse } from "next/server";

/**
 * Request guards shared by the API routes. These are a second line of defence: the Vercel WAF
 * (see scripts/firewall.sh) does the primary, cross-region rate limiting at the edge.
 */

export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-real-ip") ??
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Reject browser requests made from other websites. Browsers always send Sec-Fetch-Site and, for
 * cross-origin requests, Origin — so another site can't use our API through its visitors.
 * Non-browser clients can omit these headers; the rate limiter and WAF cover those.
 */
export function isCrossSite(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

type Bucket = { tokens: number; updated: number };
const buckets = new Map<string, Bucket>();

/**
 * Token bucket per key: `limit` requests per `windowMs`, refilled continuously.
 * In-memory and per instance, so it's a soft limit — enough to stop a single noisy client.
 */
export function takeToken(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterS: number } {
  const refillPerMs = limit / windowMs;
  const b = buckets.get(key) ?? { tokens: limit, updated: now };
  b.tokens = Math.min(limit, b.tokens + (now - b.updated) * refillPerMs);
  b.updated = now;
  if (b.tokens >= 1) {
    b.tokens -= 1;
    buckets.set(key, b);
    if (buckets.size > 5000) buckets.delete(buckets.keys().next().value!);
    return { ok: true, retryAfterS: 0 };
  }
  buckets.set(key, b);
  return { ok: false, retryAfterS: Math.ceil((1 - b.tokens) / refillPerMs / 1000) };
}

export function resetRateLimits() {
  buckets.clear();
}

const NO_STORE = { "cache-control": "no-store" };

export function errorJson(message: string, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json({ error: message }, { status, headers: { ...NO_STORE, ...headers } });
}

/**
 * Runs the common checks for an API route. Returns a response to send if the request should be
 * rejected, or null to continue.
 */
export async function guardRequest(
  req: Request,
  opts: { name: string; limit: number; windowMs?: number; maxBodyBytes?: number },
): Promise<Response | null> {
  if (isCrossSite(req)) {
    return errorJson("This API only accepts requests from the SaleCrawler site.", 403);
  }

  if (opts.maxBodyBytes !== undefined) {
    const length = Number(req.headers.get("content-length") ?? "0");
    if (length > opts.maxBodyBytes) return errorJson("Request body is too large.", 413);
  }

  const { ok, retryAfterS } = takeToken(`${opts.name}:${clientIp(req)}`, opts.limit, opts.windowMs ?? 60_000);
  if (!ok) {
    return errorJson(`Too many requests. Wait ${retryAfterS}s and try again.`, 429, { "retry-after": String(retryAfterS) });
  }

  // BotID only works on Vercel deployments; locally (dev or `next start`) there's nothing to verify.
  if (process.env.VERCEL === "1") {
    try {
      const { checkBotId } = await import("botid/server");
      // "basic" is free on every plan; Deep Analysis is a paid add-on and deliberately not used.
      const verdict = await checkBotId({ advancedOptions: { checkLevel: "basic" } });
      if (verdict.isBot && !verdict.isVerifiedBot) {
        return errorJson("Automated requests aren't allowed. Use the SaleCrawler website.", 403);
      }
    } catch (err) {
      // Fail open: a BotID outage shouldn't take the app down; WAF + rate limits still apply.
      console.error("[guard] BotID check failed", err);
    }
  }

  return null;
}
