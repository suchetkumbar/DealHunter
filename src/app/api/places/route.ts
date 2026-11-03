import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson, guardRequest } from "@/lib/guard";
import { CityNotFoundError, DEFAULT_RADIUS_M, RADII_M, UpstreamError, findBusinesses, geocode } from "@/lib/osm";
import type { PlacesResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const Query = z.object({
  city: z.string().trim().min(2, "Enter a city to search.").max(120),
  niche: z.string().trim().min(2, "Choose or type a niche.").max(60),
  r: z.coerce
    .number()
    .refine((v): v is (typeof RADII_M)[number] => (RADII_M as readonly number[]).includes(v), "Radius must be 2, 5 or 10 km.")
    .default(DEFAULT_RADIUS_M),
});

export async function GET(request: Request) {
  const blocked = await guardRequest(request, { name: "places", limit: 15 });
  if (blocked) return blocked;

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = Query.safeParse(params);
  if (!parsed.success) {
    return errorJson(parsed.error.issues[0]?.message ?? "Check the search fields.", 400);
  }

  try {
    const center = await geocode(parsed.data.city);
    const businesses = await findBusinesses(center, parsed.data.niche, parsed.data.r);
    const body: PlacesResponse = { center, radiusM: parsed.data.r, businesses };
    // Let the Vercel CDN share results across instances and keep serving them if OSM is down.
    return NextResponse.json(body, {
      headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=86400" },
    });
  } catch (err) {
    if (err instanceof CityNotFoundError) return errorJson(err.message, 404);
    if (err instanceof UpstreamError) return errorJson(err.message, 502);
    console.error("[places] unexpected failure", err);
    return errorJson("Search failed unexpectedly. Try again.", 500);
  }
}
