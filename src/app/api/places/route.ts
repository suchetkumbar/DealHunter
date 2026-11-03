import { NextResponse } from "next/server";
import { z } from "zod";
import { CityNotFoundError, UpstreamError, findBusinesses, geocode } from "@/lib/osm";
import type { PlacesResponse } from "@/lib/types";

export const runtime = "nodejs";

const Query = z.object({
  city: z.string().trim().min(2, "Enter a city to search.").max(120),
  niche: z.string().trim().min(2, "Choose or type a niche.").max(60),
});

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = Query.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the search fields." }, { status: 400 });
  }

  try {
    const center = await geocode(parsed.data.city);
    const businesses = await findBusinesses(center, parsed.data.niche);
    const body: PlacesResponse = { center, businesses };
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof CityNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof UpstreamError) return NextResponse.json({ error: err.message }, { status: 502 });
    console.error("[places] unexpected failure", err);
    return NextResponse.json({ error: "Search failed unexpectedly. Try again." }, { status: 500 });
  }
}
