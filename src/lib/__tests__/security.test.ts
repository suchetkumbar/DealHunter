import { afterEach, describe, expect, it } from "vitest";
import { buildCsp } from "../../proxy";
import { guardRequest, isCrossSite, resetRateLimits, takeToken } from "../guard";
import { assertPublicUrl, BlockedUrlError, safeLookup } from "../safe-fetch";

const req = (headers: Record<string, string>, method = "POST") =>
  new Request("https://salecrawler.example/api/analyze", { method, headers: { host: "salecrawler.example", ...headers } });

afterEach(() => resetRateLimits());

describe("same-origin guard", () => {
  it("allows same-origin and header-less requests", () => {
    expect(isCrossSite(req({ "sec-fetch-site": "same-origin", origin: "https://salecrawler.example" }))).toBe(false);
    expect(isCrossSite(req({}))).toBe(false);
  });
  it("rejects other sites", () => {
    expect(isCrossSite(req({ "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isCrossSite(req({ origin: "https://evil.example" }))).toBe(true);
    expect(isCrossSite(req({ origin: "not a url" }))).toBe(true);
  });
});

describe("rate limiter", () => {
  it("allows the limit, then rejects with Retry-After", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 30; i++) expect(takeToken("k", 30, 60_000, t0).ok).toBe(true);
    const denied = takeToken("k", 30, 60_000, t0);
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterS).toBe(2);
    expect(takeToken("k", 30, 60_000, t0 + 2_000).ok).toBe(true);
  });

  it("guardRequest returns 403 / 413 / 429 as appropriate", async () => {
    expect((await guardRequest(req({ origin: "https://evil.example" }), { name: "t", limit: 5 }))?.status).toBe(403);
    expect((await guardRequest(req({ "content-length": "99999" }), { name: "t", limit: 5, maxBodyBytes: 4096 }))?.status).toBe(413);
    const ip = { "x-real-ip": "203.0.113.9" };
    for (let i = 0; i < 2; i++) expect(await guardRequest(req(ip), { name: "t2", limit: 2 })).toBeNull();
    const limited = await guardRequest(req(ip), { name: "t2", limit: 2 });
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get("retry-after")).toBeTruthy();
    expect(await limited?.json()).toEqual({ error: expect.stringContaining("Too many requests") });
  });
});

describe("network hardening", () => {
  it.each(["http://example.com:22/", "http://example.com:6379", "https://example.com:3000"])("blocks non-web port %s", async (u) => {
    await expect(assertPublicUrl(u)).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it("connect-time lookup refuses hosts that resolve to private addresses (DNS rebinding)", async () => {
    const err = await new Promise<Error | null>((resolve) => safeLookup("localhost", {}, (e) => resolve(e)));
    expect(err).toBeInstanceOf(BlockedUrlError);
  });
});

describe("content security policy", () => {
  it("is strict in production and nonce-based", () => {
    const csp = buildCsp("abc123", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
  it("allows eval only in development", () => {
    expect(buildCsp("n", true)).toContain("'unsafe-eval'");
  });
});
