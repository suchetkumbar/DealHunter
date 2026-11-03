import type { Business, GeoPoint } from "./types";

const USER_AGENT = "SaleCrawler/1.0 (local-business lead finder)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const OVERPASS_TIMEOUT_MS = 15_000;
const RADIUS_M = 6000;
const MAX_RESULTS = 40;
const CACHE_TTL_MS = 10 * 60 * 1000;

export class CityNotFoundError extends Error {}
export class UpstreamError extends Error {}

/** Niche presets → OSM tag filters. Free text is tried as a tag value. */
/** `search` lists the words Nominatim matches best (e.g. "solicitor" finds UK law firms, "lawyer" doesn't). */
export const NICHES: Record<string, { label: string; filters: string[]; search: string[] }> = {
  dentist: { label: "Dentists", filters: ['["amenity"="dentist"]', '["healthcare"="dentist"]'], search: ["dentist"] },
  doctor: { label: "Doctors & clinics", filters: ['["amenity"="doctors"]', '["amenity"="clinic"]'], search: ["doctors", "clinic"] },
  restaurant: { label: "Restaurants", filters: ['["amenity"="restaurant"]'], search: ["restaurant"] },
  cafe: { label: "Cafés", filters: ['["amenity"="cafe"]'], search: ["cafe"] },
  salon: { label: "Hair & beauty salons", filters: ['["shop"="hairdresser"]', '["shop"="beauty"]'], search: ["hairdresser", "beauty"] },
  gym: { label: "Gyms & studios", filters: ['["leisure"="fitness_centre"]', '["leisure"="sports_centre"]'], search: ["fitness centre", "sports centre"] },
  lawyer: { label: "Law firms", filters: ['["office"="lawyer"]'], search: ["lawyer", "solicitor"] },
  accountant: { label: "Accountants", filters: ['["office"="accountant"]', '["office"="tax_advisor"]'], search: ["accountant", "tax advisor"] },
  realestate: { label: "Real estate agents", filters: ['["office"="estate_agent"]', '["shop"="estate_agent"]'], search: ["real estate", "estate agent"] },
  plumber: { label: "Plumbers", filters: ['["craft"="plumber"]'], search: ["plumbing", "plumber"] },
  electrician: { label: "Electricians", filters: ['["craft"="electrician"]'], search: ["electrician"] },
  auto: { label: "Auto repair", filters: ['["shop"="car_repair"]'], search: ["car repair", "garage"] },
  vet: { label: "Veterinarians", filters: ['["amenity"="veterinary"]'], search: ["veterinary"] },
  hotel: { label: "Hotels & B&Bs", filters: ['["tourism"="hotel"]', '["tourism"="guest_house"]'], search: ["hotel", "guest house"] },
  pharmacy: { label: "Pharmacies", filters: ['["amenity"="pharmacy"]'], search: ["pharmacy"] },
};

const ALIASES: Record<string, string> = {
  dentists: "dentist", dental: "dentist",
  doctors: "doctor", clinic: "doctor", clinics: "doctor",
  restaurants: "restaurant", food: "restaurant",
  cafes: "cafe", "café": "cafe", coffee: "cafe",
  salons: "salon", hairdresser: "salon", barber: "salon", beauty: "salon", spa: "salon",
  gyms: "gym", fitness: "gym", yoga: "gym",
  lawyers: "lawyer", law: "lawyer", attorney: "lawyer", attorneys: "lawyer",
  accountants: "accountant", accounting: "accountant", cpa: "accountant",
  "real estate": "realestate", realtor: "realestate", realtors: "realestate",
  plumbers: "plumber", plumbing: "plumber",
  electricians: "electrician",
  mechanic: "auto", "car repair": "auto", garage: "auto",
  veterinarian: "vet", vets: "vet",
  hotels: "hotel", motel: "hotel",
  pharmacies: "pharmacy", chemist: "pharmacy",
};

export function resolveNiche(input: string): { key: string | null; filters: string[] } {
  const q = input.trim().toLowerCase();
  const key = NICHES[q] ? q : ALIASES[q] ?? null;
  if (key) return { key, filters: NICHES[key].filters };
  // Free text: try it as an OSM tag value ("florist" → shop=florist, "bakery" → shop=bakery, …).
  // Name-regex searches are far too slow on public Overpass servers, so they're not used.
  // Only plain word characters are kept, so the value can't break out of the Overpass string.
  const slug = toTagValue(q);
  if (!slug) return { key: null, filters: [] };
  return { key: null, filters: FREE_TEXT_KEYS.map((k) => `["${k}"="${slug}"]`) };
}

const FREE_TEXT_KEYS = ["shop", "amenity", "office", "craft", "healthcare", "leisure", "tourism"];

export function toTagValue(input: string): string {
  const words = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, " ")
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);
  if (!words.length) return "";
  const last = words.length - 1;
  // Simple singularisation: "bakeries" → "bakery", "florists" → "florist", but leave "glass" alone.
  words[last] = words[last].replace(/ies$/, "y").replace(/([^s])s$/, "$1");
  return words.join("_");
}

type CacheEntry<T> = { value: T; expires: number; staleUntil: number };
const cache = new Map<string, CacheEntry<unknown>>();
const STALE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Fresh entries are served for CACHE_TTL_MS. After that we try to refresh, but if the upstream
 * service is down we fall back to the stale copy (up to STALE_TTL_MS) rather than failing.
 */
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();
  if (hit && hit.expires > now) return hit.value;
  try {
    const value = await load();
    cache.delete(key);
    cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS, staleUntil: Date.now() + STALE_TTL_MS });
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
    return value;
  } catch (err) {
    if (err instanceof UpstreamError && hit && hit.staleUntil > now) return hit.value;
    throw err;
  }
}

/** Nominatim allows at most one request per second; serialise our calls with a small gap. */
let nominatimQueue: Promise<unknown> = Promise.resolve();
let lastNominatimAt = 0;

function nominatim<T>(params: Record<string, string>): Promise<T> {
  const run = async (): Promise<T> => {
    // Clamp so a backwards clock change can never stall requests for longer than one interval.
    const wait = Math.min(1100, lastNominatimAt + 1100 - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatimAt = Date.now();
    const url = `${NOMINATIM}?${new URLSearchParams({ format: "jsonv2", ...params })}`;
    // One retry for transient failures (network errors, 429, 5xx), after a short back-off.
    for (let attempt = 0; ; attempt++) {
      let res: Response | null = null;
      try {
        res = await fetch(url, {
          headers: { "user-agent": USER_AGENT, "accept-language": "en" },
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        res = null;
      }
      if (res?.ok) {
        lastNominatimAt = Date.now();
        return (await res.json()) as T;
      }
      const transient = !res || res.status === 429 || res.status >= 500;
      if (!transient || attempt >= 1) {
        throw new UpstreamError(
          res
            ? `The map service returned HTTP ${res.status}. Try again in a moment.`
            : "The map service didn't respond. Try again in a moment.",
        );
      }
      await new Promise((r) => setTimeout(r, 1500));
      lastNominatimAt = Date.now();
    }
  };
  const next = nominatimQueue.then(run, run);
  nominatimQueue = next.catch(() => undefined);
  return next;
}

export async function geocode(city: string): Promise<GeoPoint> {
  return cached(`geo:${city.toLowerCase()}`, async () => {
    const rows = await nominatim<Array<{ lat: string; lon: string; display_name: string }>>({ q: city, limit: "1" });
    if (!rows.length) throw new CityNotFoundError(`No place called “${city}” was found. Try adding the state or country.`);
    const { lat, lon, display_name } = rows[0];
    return { lat: Number(lat), lon: Number(lon), label: display_name.split(",").slice(0, 3).join(",").trim() };
  });
}

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function normalizeWebsite(raw: string | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(/[;\s]+/)[0].trim();
  if (!first) return null;
  const withScheme = /^https?:\/\//i.test(first) ? first : `https://${first}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function formatAddress(t: Record<string, string>): string | null {
  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  const parts = [street, t["addr:city"]].filter(Boolean);
  return parts.length ? parts.join(", ") : t["addr:full"] ?? null;
}

export function toBusiness(el: OverpassElement): Business | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!tags.name || lat === undefined || lon === undefined) return null;
  return {
    id: `${el.type}/${el.id}`,
    name: tags.name,
    lat,
    lon,
    website: normalizeWebsite(tags.website ?? tags["contact:website"] ?? tags.url),
    phone: tags.phone ?? tags["contact:phone"] ?? null,
    address: formatAddress(tags),
    category:
      tags.amenity ?? tags.shop ?? tags.office ?? tags.craft ?? tags.leisure ?? tags.tourism ?? tags.healthcare ?? null,
  };
}

type NominatimPlace = {
  osm_type: "node" | "way" | "relation";
  osm_id: number;
  lat: string;
  lon: string;
  name: string;
  category: string;
  type: string;
  extratags?: Record<string, string> | null;
  address?: Record<string, string>;
};

const BUSINESS_CATEGORIES = new Set(["shop", "amenity", "office", "craft", "healthcare", "leisure", "tourism", "club"]);

function nominatimToBusiness(p: NominatimPlace): Business | null {
  if (!p.name || !BUSINESS_CATEGORIES.has(p.category)) return null;
  const x = p.extratags ?? {};
  const a = p.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const address = [street, a.city ?? a.town ?? a.village ?? a.suburb].filter(Boolean).join(", ") || null;
  return {
    id: `${p.osm_type}/${p.osm_id}`,
    name: p.name,
    lat: Number(p.lat),
    lon: Number(p.lon),
    website: normalizeWebsite(x.website ?? x["contact:website"] ?? x.url),
    phone: x.phone ?? x["contact:phone"] ?? null,
    address,
    category: p.type ?? null,
  };
}

async function searchNominatim(center: GeoPoint, terms: string[]): Promise<Business[]> {
  const dLat = RADIUS_M / 111_320;
  const dLon = dLat / Math.cos((center.lat * Math.PI) / 180);
  const viewbox = [center.lon - dLon, center.lat + dLat, center.lon + dLon, center.lat - dLat].map((n) => n.toFixed(5)).join(",");
  const out: Business[] = [];
  for (const term of terms) {
    const rows = await nominatim<NominatimPlace[]>({
      q: term,
      viewbox,
      bounded: "1",
      limit: String(MAX_RESULTS),
      extratags: "1",
      addressdetails: "1",
    });
    for (const row of rows) {
      const b = nominatimToBusiness(row);
      if (b) out.push(b);
    }
  }
  return out;
}

function dedupeAndSort(center: GeoPoint, list: Business[]): Business[] {
  const seen = new Set<string>();
  const out: Business[] = [];
  for (const b of list) {
    const key = b.name.toLowerCase();
    if (seen.has(key) || seen.has(b.id)) continue;
    seen.add(key);
    seen.add(b.id);
    out.push(b);
  }
  return out.sort((a, b) => distance(center, a) - distance(center, b)).slice(0, MAX_RESULTS);
}

/**
 * Nominatim answers in about a second, so it's the primary source. Overpass is more complete but
 * public instances are often slow or overloaded, so it's only used when Nominatim finds nothing.
 */
export async function findBusinesses(center: GeoPoint, niche: string): Promise<Business[]> {
  const { key, filters } = resolveNiche(niche);
  if (!filters.length) return [];
  const terms = key ? NICHES[key].search : [toTagValue(niche).replace(/_/g, " ")];

  return cached(`osm:${center.lat.toFixed(4)},${center.lon.toFixed(4)}:${filters.join("|")}`, async () => {
    let primaryError: unknown = null;
    try {
      const fast = dedupeAndSort(center, await searchNominatim(center, terms));
      if (fast.length) return fast;
    } catch (err) {
      primaryError = err;
    }
    try {
      const around = `(around:${RADIUS_M},${center.lat},${center.lon})`;
      const body = filters.map((f) => `nwr${f}${around};`).join("");
      const elements = await queryOverpass(`[out:json][timeout:15];(${body});out center tags ${MAX_RESULTS * 2};`);
      return dedupeAndSort(
        center,
        elements.map(toBusiness).filter((b): b is Business => b !== null),
      );
    } catch (err) {
      // Nominatim answered but had nothing, and Overpass is unavailable: report "no matches"
      // rather than an outage, since that's the best information we have.
      if (!primaryError) return [];
      throw primaryError ?? err;
    }
  });
}

/**
 * Public Overpass instances vary a lot in load and availability, so query them in parallel and
 * take the first valid answer, cancelling the rest.
 */
async function queryOverpass(query: string): Promise<OverpassElement[]> {
  const controllers = OVERPASS_MIRRORS.map(() => new AbortController());
  const deadline = AbortSignal.timeout(OVERPASS_TIMEOUT_MS);
  try {
    return await Promise.any(
      OVERPASS_MIRRORS.map(async (mirror, i) => {
        const res = await fetch(mirror, {
          method: "POST",
          headers: { "user-agent": USER_AGENT, "content-type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.any([controllers[i].signal, deadline]),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { elements?: OverpassElement[]; remark?: string };
        if (!Array.isArray(json.elements)) throw new Error(json.remark ?? "malformed response");
        // Overpass reports runtime errors (e.g. query timeouts) as a remark with no elements.
        if (json.remark && json.elements.length === 0) throw new Error(json.remark);
        controllers.forEach((c, j) => j !== i && c.abort());
        return json.elements;
      }),
    );
  } catch {
    throw new UpstreamError("The business directory (OpenStreetMap) is busy right now. Try again in a moment.");
  }
}

function distance(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = a.lat - b.lat;
  const dLon = (a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180);
  return dLat * dLat + dLon * dLon;
}
