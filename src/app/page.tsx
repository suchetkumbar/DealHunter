import { connection } from "next/server";
import { Suspense } from "react";
import { Landing } from "@/components/landing";
import { SurveyApp } from "@/components/survey-app";
import { safeRedirect } from "@/lib/safe-redirect";
import { NICHES, resolveNiche } from "@/lib/osm";
import { getUser } from "@/lib/session";

type Search = { city?: string | string[]; niche?: string | string[]; r?: string | string[] };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.slice(0, 120) ?? "";

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  // Reads the session cookie, so it must render per request (the layout runs in parallel).
  await connection();
  const user = await getUser();
  if (user) {
    // useSearchParams needs a Suspense boundary.
    return (
      <Suspense>
        <SurveyApp />
      </Suspense>
    );
  }

  // Signed out: no tool, just the way in. A shared survey link survives the trip through sign-in.
  const params = await searchParams;
  const city = first(params.city).trim();
  const niche = first(params.niche).trim().slice(0, 60);
  // Presets read naturally as their label ("dentist" becomes "dentists"); free text stays as typed.
  const preset = niche ? resolveNiche(niche).key : null;
  const nicheLabel = preset ? NICHES[preset].label.toLowerCase() : niche;
  const shared = city.length >= 2 && niche.length >= 2 ? { city, niche: nicheLabel } : null;
  const qs = shared ? new URLSearchParams({ city, niche, r: first(params.r) || "5000" }).toString() : "";
  return <Landing shared={shared} redirectTo={safeRedirect(qs ? `/?${qs}` : "/")} />;
}
