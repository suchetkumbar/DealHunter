import dns from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import tls from "node:tls";
import { Agent, fetch as undiciFetch, type Response as UndiciResponse } from "undici";

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

export class FetchFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchFailedError";
  }
}

const USER_AGENT = "Mozilla/5.0 (compatible; SaleCrawler/1.0; +site-audit)";
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;
/** Empty string = the scheme's default port. Anything else could be used to probe internal services. */
const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);
const HTML_TYPES = ["text/html", "application/xhtml+xml"];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const n = ipv4ToInt(address);
    return BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (family === 6) {
    const a = address.toLowerCase().replace(/^\[|\]$/g, "");
    if (a === "::" || a === "::1") return true;
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    // fc00::/7 unique local, fe80::/10 link-local, ff00::/8 multicast
    return /^f[cd]/.test(a) || /^fe[89ab]/.test(a) || /^ff/.test(a);
  }
  return true; // not an IP at all — treat as unsafe
}

/** Validate scheme/host and make sure every resolved address is public. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError("That isn't a valid web address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError("Only http and https addresses can be checked.");
  }
  if (url.username || url.password) {
    throw new BlockedUrlError("Addresses with embedded credentials can't be checked.");
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new BlockedUrlError("Only standard web ports (80, 443, 8080, 8443) can be checked.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new BlockedUrlError("Private and local addresses can't be checked.");
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new BlockedUrlError("Private and local addresses can't be checked.");
    return url;
  }
  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new FetchFailedError(`The domain ${host} doesn't resolve.`);
  }
  if (records.length === 0 || records.some((r) => isPrivateAddress(r.address))) {
    throw new BlockedUrlError("Private and local addresses can't be checked.");
  }
  return url;
}

/**
 * DNS lookup used for the actual TCP connection. Re-validating here (instead of only before the
 * request) closes the DNS-rebinding window: the address we check is the address we connect to.
 */
export const safeLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, verbatim: true, family: options.family }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) {
      return callback(new BlockedUrlError("Private and local addresses can't be checked."), "", 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

const agent = new Agent({
  connect: { lookup: safeLookup, timeout: 5000 },
  headersTimeout: TIMEOUT_MS,
  bodyTimeout: TIMEOUT_MS,
});

export type SafeFetchResult = {
  finalUrl: URL;
  status: number;
  html: string;
  elapsedMs: number;
};

type Hop = { finalUrl: URL; res: UndiciResponse };

/** Request a public URL, following at most MAX_REDIRECTS redirects and re-validating each hop. */
async function safeRequest(raw: string, method: "GET" | "HEAD", timeoutMs = TIMEOUT_MS): Promise<Hop> {
  let current = await assertPublicUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: UndiciResponse;
    try {
      res = await undiciFetch(current, {
        method,
        redirect: "manual",
        dispatcher: agent,
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      });
    } catch (err) {
      if (err instanceof BlockedUrlError) throw err;
      const cause = (err as { cause?: unknown })?.cause;
      if (cause instanceof BlockedUrlError) throw cause;
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      throw new FetchFailedError(
        timedOut ? `The site took longer than ${timeoutMs / 1000} seconds to respond.` : "The site refused the connection.",
      );
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location) throw new FetchFailedError("The site redirected without a destination.");
      current = await assertPublicUrl(new URL(location, current).toString());
      continue;
    }
    return { finalUrl: current, res };
  }
  throw new FetchFailedError("The site redirected too many times.");
}

/** Fetch a public HTML page with redirect re-validation, a timeout and a size cap. */
export async function safeFetchHtml(raw: string): Promise<SafeFetchResult> {
  const started = performance.now();
  const { finalUrl, res } = await safeRequest(raw, "GET");
  if (res.status >= 400) {
    await res.body?.cancel();
    throw new FetchFailedError(`The site answered with HTTP ${res.status}.`);
  }
  const type = (res.headers.get("content-type") ?? "text/html").toLowerCase();
  if (!HTML_TYPES.some((t) => type.includes(t))) {
    await res.body?.cancel();
    throw new FetchFailedError("The address doesn't return a web page.");
  }
  const html = await readCapped(res);
  return { finalUrl, status: res.status, html, elapsedMs: Math.round(performance.now() - started) };
}

/** HEAD a public URL and return its final status (0 when unreachable). Never throws. */
export async function safeStatus(raw: string, timeoutMs = 4000): Promise<number> {
  try {
    const { res } = await safeRequest(raw, "HEAD", timeoutMs);
    await res.body?.cancel();
    return res.status;
  } catch {
    return 0;
  }
}

export type CertInfo = { valid: boolean; expiresAt: Date | null; reason?: string };

/** Read the TLS certificate of an https URL, connecting only to a validated public address. */
export async function certificateInfo(raw: string, timeoutMs = 5000): Promise<CertInfo> {
  const url = await assertPublicUrl(raw);
  if (url.protocol !== "https:") return { valid: false, expiresAt: null, reason: "Not served over HTTPS." };
  return new Promise((resolve) => {
    const socket = tls.connect({
      host: url.hostname.replace(/^\[|\]$/g, ""),
      port: Number(url.port || 443),
      servername: isIP(url.hostname) ? undefined : url.hostname,
      lookup: safeLookup,
      rejectUnauthorized: false,
      timeout: timeoutMs,
    });
    const done = (info: CertInfo) => {
      socket.destroy();
      resolve(info);
    };
    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      const expiresAt = cert?.valid_to ? new Date(cert.valid_to) : null;
      done({
        valid: socket.authorized,
        expiresAt,
        reason: socket.authorized ? undefined : String(socket.authorizationError ?? "Certificate isn't trusted."),
      });
    });
    socket.once("timeout", () => done({ valid: false, expiresAt: null, reason: "The TLS handshake timed out." }));
    socket.once("error", (err) =>
      done({ valid: false, expiresAt: null, reason: err instanceof BlockedUrlError ? err.message : "The TLS handshake failed." }),
    );
  });
}

async function readCapped(res: UndiciResponse): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    chunks.push(value);
    if (total >= MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}
