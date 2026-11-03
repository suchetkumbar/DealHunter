import Link from "next/link";
import { LogIn } from "lucide-react";
import { BrandMark, SiteFooter, SurveySteps } from "@/components/site-chrome";
import { SurveyScope, type ExampleBlip } from "@/components/survey-scope";

/**
 * A made-up survey for the preview: unnamed blips in each audit state, so a visitor sees what a
 * result looks like. Captioned as an example and never clickable.
 */
const EXAMPLE: ExampleBlip[] = [
  { km: 1.2, bearing: 38, verdict: "prime" },
  { km: 3.1, bearing: 74, verdict: "warm" },
  { km: 2.2, bearing: 128, verdict: null },
  { km: 4.3, bearing: 161, verdict: "saturated" },
  { km: 0.8, bearing: 205, verdict: "warm" },
  { km: 3.7, bearing: 242, verdict: "prime" },
  { km: 2.6, bearing: 298, verdict: null },
  { km: 4.6, bearing: 331, verdict: "saturated" },
];

type Props = {
  /** Set when a visitor opened a shared survey link before signing in. */
  shared: { city: string; niche: string } | null;
  /** Where to return after signing in or creating an account. */
  redirectTo: string;
};

/** What signed-out visitors see: the same frame as the app, with the search panel's slot asking them in. */
export function Landing({ shared, redirectTo }: Props) {
  const back = redirectTo !== "/" ? `?redirectTo=${encodeURIComponent(redirectTo)}` : "";
  const signIn = `/auth/sign-in${back}`;
  const signUp = `/auth/sign-up${back}`;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between py-5">
        <BrandMark />
        <Link
          href={signIn}
          className="inline-flex items-center gap-2 rounded-lg border border-haze/30 px-3 py-2 text-sm font-bold text-chalk transition-colors hover:border-signal hover:text-signal"
        >
          <LogIn size={16} aria-hidden /> Sign in
        </Link>
      </header>

      <main className="flex flex-1 flex-col pb-16">
        <section className="grid items-center gap-10 pt-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14 lg:pt-10">
          <div className="max-w-2xl">
            <h1 className="headline text-[clamp(2.6rem,6.4vw,5.25rem)] font-bold leading-[0.98] tracking-[-0.02em] text-balance">
              Find local businesses that still run on paper.
            </h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-haze">
              Survey a city for any niche, audit every website in seconds, and see who&apos;s missing online booking,
              chat, a mobile site or basic analytics. Those are the clients who need you.
            </p>

            <div className="spotlight mt-8 rounded-2xl bg-prussian-deep/60 p-6 sm:p-7">
              <p className="font-display text-xl font-semibold text-balance">
                {shared ? (
                  `Sign in to see ${shared.niche} in ${shared.city}.`
                ) : (
                  "Surveys and audits need a free account."
                )}
              </p>
              <p className="mt-1.5 max-w-[48ch] text-pretty text-haze">
                {shared
                  ? "Someone shared this survey with you. It runs as soon as you're signed in."
                  : "Your leads, notes and survey history are kept in it, on every device you use."}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href={signUp}
                  className="inline-flex h-12 items-center rounded-xl bg-signal px-5 font-bold text-prussian-deep transition-[filter] hover:brightness-105"
                >
                  Create a free account
                </Link>
                <Link
                  href={signIn}
                  className="inline-flex h-12 items-center rounded-xl border border-haze/30 px-5 font-bold text-chalk transition-colors hover:border-signal hover:text-signal"
                >
                  Sign in
                </Link>
              </div>
            </div>

            <SurveySteps />
          </div>

          <div className="w-full">
            <SurveyScope
              search={{ status: "idle" }}
              analyses={{}}
              selectedId={null}
              hoveredId={null}
              example={EXAMPLE}
              idleHint="Example survey. Sign in to run your own."
            />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
