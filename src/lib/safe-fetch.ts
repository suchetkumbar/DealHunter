import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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

export type SafeFetchResult = {
  finalUrl: URL;
  status: number;
  html: string;
  elapsedMs: number;
};

/** Fetch a public HTML page with redirect re-validation, a timeout and a size cap. */
export async function safeFetchHtml(raw: string): Promise<SafeFetchResult> {
  const started = performance.now();
  let current = await assertPublicUrl(raw);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      });
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      throw new FetchFailedError(
        timedOut ? `The site took longer than ${TIMEOUT_MS / 1000} seconds to respond.` : "The site refused the connection.",
      );
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location) throw new FetchFailedError("The site redirected without a destination.");
      current = await assertPublicUrl(new URL(location, current).toString());
      continue;
    }

    if (res.status >= 400) {
      await res.body?.cancel();
      throw new FetchFailedError(`The site answered with HTTP ${res.status}.`);
    }

    const html = await readCapped(res);
    return { finalUrl: current, status: res.status, html, elapsedMs: Math.round(performance.now() - started) };
  }

  throw new FetchFailedError("The site redirected too many times.");
}

async function readCapped(res: Response): Promise<string> {
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
