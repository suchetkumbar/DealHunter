import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/account-menu";
import { ClearHistoryButton } from "@/components/clear-history-button";
import { LeadsBoard } from "@/components/leads-board";
import { BrandMark } from "@/components/site-chrome";
import { listAudits, listSearches } from "@/lib/history";
import { getUser } from "@/lib/session";
import { cn } from "@/lib/utils";

// Reads the session cookie, so it must render per request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Leads & history — SaleCrawler" };

const TABS = [
  { id: "leads", label: "Saved leads" },
  { id: "searches", label: "Searches" },
  { id: "audits", label: "Audits" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const fmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ tab?: string; welcome?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/auth/sign-in?redirectTo=%2Fleads");

  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === params.tab) ? (params.tab as Tab) : "leads";

  // Load only what the open tab needs. A database hiccup shows a message instead of a crash.
  let searches: Awaited<ReturnType<typeof listSearches>> = [];
  let audits: Awaited<ReturnType<typeof listAudits>> = [];
  let loadError = false;
  try {
    if (tab === "searches") searches = await listSearches(user.id);
    if (tab === "audits") audits = await listAudits(user.id);
  } catch (err) {
    console.error("[leads] history load failed", err);
    loadError = true;
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between py-5">
        <BrandMark />
        <nav className="flex items-center gap-2" aria-label="Account">
          <Link href="/" className="rounded-lg px-3 py-2 text-sm text-haze hover:bg-cyanotype-soft hover:text-chalk">
            New survey
          </Link>
          <AccountMenu />
        </nav>
      </header>

      <main className="flex-1 pb-16">
        {params.welcome && (
          <p role="status" className="mb-6 rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-sm">
            Your account is ready. Leads you save, surveys you run and sites you audit are now kept here.
          </p>
        )}
        <h1 className="headline text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.02] tracking-[-0.02em]">
          {user.name ? `${user.name}'s leads` : "Your leads"}
        </h1>

        <nav aria-label="History sections" className="mt-6 flex gap-1 border-b border-haze/15">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.id === "leads" ? "/leads" : `/leads?tab=${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-4 py-2.5 text-sm font-bold transition-colors",
                tab === t.id ? "border-signal text-chalk" : "border-transparent text-haze hover:text-chalk",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6">
          {loadError && (
            <p role="alert" className="rounded-xl border border-flare/50 bg-flare/10 px-4 py-3 text-sm text-flare">
              Your history couldn&apos;t be loaded right now. Refresh the page to try again.
            </p>
          )}

          {tab === "leads" && <LeadsBoard />}

          {tab === "searches" && !loadError && (
            <section aria-label="Search history">
              {searches.length === 0 ? (
                <Empty text="Surveys you run while signed in will be listed here, ready to re-run." />
              ) : (
                <>
                  <div className="mb-3 flex justify-end">
                    <ClearHistoryButton kind="searches" />
                  </div>
                  <ul className="divide-y divide-haze/10 rounded-2xl border border-haze/15">
                    {searches.map((s) => {
                      const qs = new URLSearchParams({ city: s.city, niche: s.niche, r: String(s.radiusM) });
                      return (
                        <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold">
                              <span className="capitalize">{s.niche}</span> in {s.city}
                            </p>
                            <p className="text-sm text-haze">
                              {s.resultCount} found within {s.radiusM / 1000} km{s.placeLabel ? ` of ${s.placeLabel}` : ""}
                            </p>
                          </div>
                          <time className="text-sm text-haze" dateTime={new Date(s.createdAt).toISOString()}>
                            {fmt.format(s.createdAt)} UTC
                          </time>
                          <Link href={`/?${qs}`} className="rounded-lg border border-haze/30 px-3 py-1.5 text-sm font-bold hover:border-signal hover:text-signal">
                            Run again
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>
          )}

          {tab === "audits" && !loadError && (
            <section aria-label="Audit history">
              {audits.length === 0 ? (
                <Empty text="Every website you audit while signed in is recorded here, so you can compare scores over time." />
              ) : (
                <>
                  <div className="mb-3 flex justify-end">
                    <ClearHistoryButton kind="audits" />
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-haze/15">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="text-haze">
                        <tr className="border-b border-haze/15">
                          <th scope="col" className="px-4 py-3 font-normal">Business</th>
                          <th scope="col" className="px-4 py-3 font-normal">Opportunity</th>
                          <th scope="col" className="px-4 py-3 font-normal">Missing</th>
                          <th scope="col" className="px-4 py-3 font-normal">Audited</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-haze/10">
                        {audits.map((a) => (
                          <tr key={a.id}>
                            <td className="px-4 py-3">
                              <p className="font-bold">{a.businessName}</p>
                              <p className="text-xs text-haze">{a.url ? hostOrUrl(a.url) : "No website"}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn("font-display text-lg font-bold", a.verdict === "prime" ? "text-signal" : "text-chalk")}>{a.opportunity}</span>
                              <span className="ml-2 text-xs capitalize text-haze">{a.verdict}</span>
                            </td>
                            <td className="max-w-[28ch] px-4 py-3 text-xs text-haze">{a.missing.join(", ") || "Nothing"}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-haze">
                              <time dateTime={new Date(a.createdAt).toISOString()}>{fmt.format(a.createdAt)} UTC</time>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-haze/30 p-8">
      <p className="max-w-[52ch] text-haze">{text}</p>
      <Link href="/" className="mt-4 inline-flex rounded-xl bg-signal px-4 py-2.5 font-bold text-prussian-deep hover:brightness-105">
        Start a survey
      </Link>
    </div>
  );
}

function hostOrUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
