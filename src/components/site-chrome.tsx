import Link from "next/link";

/** Pieces shared by the signed-out landing and the survey app, so both frames line up exactly. */

export function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <circle cx="13" cy="13" r="11.5" fill="none" stroke="#8fa9bf" strokeOpacity="0.6" />
        <circle cx="13" cy="13" r="6" fill="none" stroke="#8fa9bf" strokeOpacity="0.35" strokeDasharray="1.5 2.5" />
        <path d="M13 13 L13 1.5 A11.5 11.5 0 0 1 22.5 6.5 Z" fill="#f4c542" fillOpacity="0.85" />
        <circle cx="17.5" cy="9" r="1.6" fill="#0a1f33" />
      </svg>
      SaleCrawler
    </Link>
  );
}

const STEPS = [
  ["Survey", "Map every matching business near the city centre, from OpenStreetMap."],
  ["Audit", "Check each website for booking, chat, mobile, HTTPS, speed and analytics."],
  ["Pitch", "Sort by opportunity, copy ready-made pitch angles, export to CSV."],
] as const;

/** The three stages of the workflow, in the order a user goes through them. */
export function SurveySteps() {
  return (
    <ol className="mt-8 grid gap-4 text-sm text-haze sm:grid-cols-3">
      {STEPS.map(([title, body], i) => (
        <li key={title} className="border-t border-haze/20 pt-3">
          <span className="font-display text-base font-semibold text-chalk">
            {i + 1}. {title}
          </span>
          <p className="mt-1 leading-relaxed">{body}</p>
        </li>
      ))}
    </ol>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-haze/15 py-6 text-sm text-haze">
      Business data © OpenStreetMap contributors. Audits read only each site&apos;s public homepage.
    </footer>
  );
}
