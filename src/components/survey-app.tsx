"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { BookmarkCheck, Check, Download, Link2, LogIn, RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { recordMySearch } from "@/app/actions/data";
import { AccountMenu } from "@/components/account-menu";
import { BrandMark, SiteFooter, SurveySteps } from "@/components/site-chrome";
import { LeadList } from "@/components/lead-list";
import { LeadReport } from "@/components/lead-report";
import { PipelineDrawer } from "@/components/pipeline-drawer";
import { SearchPanel } from "@/components/search-panel";
import { SurveyScope } from "@/components/survey-scope";
import { useLeads } from "@/hooks/use-leads";
import { useSessionUser } from "@/components/session-provider";
import { usePipeline } from "@/hooks/use-pipeline";
import { STATUS_LABEL } from "@/lib/pipeline";
import { toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );
}

const RADIUS_VALUES = [2000, 5000, 10000];

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** The survey tool itself. Only rendered for signed-in users; see src/app/page.tsx. */
export function SurveyApp() {
  const { search, analyses, bulkRunning, runSearch, analyzeOne, analyzeAll } = useLeads();
  const pipeline = usePipeline();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Shared links: ?city=…&niche=…&r=5000
  const initial = useMemo(() => {
    const r = Number(params.get("r"));
    return {
      city: (params.get("city") ?? "").slice(0, 120),
      niche: (params.get("niche") ?? "").slice(0, 60),
      radius: RADIUS_VALUES.includes(r) ? r : 5000,
    };
  }, [params]);
  const autoRan = useRef(false);
  const user = useSessionUser();
  const recorded = useRef<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const savedIds = useMemo(() => new Set(pipeline.leads.map((l) => l.id)), [pipeline.leads]);
  const savedById = useMemo(() => new Map(pipeline.leads.map((l) => [l.id, l])), [pipeline.leads]);

  const ready = search.status === "ready" ? search : null;
  const businesses = ready?.businesses ?? [];
  const selected = businesses.find((b) => b.id === selectedId) ?? null;
  const hasResults = businesses.length > 0;

  const onSearch = (city: string, niche: string, radiusM: number) => {
    setSelectedId(null);
    setHoveredId(null);
    const qs = new URLSearchParams({ city, niche, r: String(radiusM) });
    router.replace(`${pathname}?${qs}`, { scroll: false });
    void runSearch(city, niche, radiusM);
  };

  // Run the survey from a shared link once, on first load.
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    if (initial.city.trim().length >= 2 && initial.niche.trim().length >= 2) {
      void runSearch(initial.city.trim(), initial.niche.trim(), initial.radius);
    }
  }, [initial, runSearch]);

  // Signed-in users get each completed survey in their history.
  useEffect(() => {
    if (!user || search.status !== "ready") return;
    const key = `${search.city}|${search.niche}|${search.radiusM}|${search.center.lat}`;
    if (recorded.current === key) return;
    recorded.current = key;
    recordMySearch({
      city: search.city,
      niche: search.niche,
      radiusM: search.radiusM as 2000 | 5000 | 10000,
      placeLabel: search.center.label.slice(0, 200),
      resultCount: search.businesses.length,
    }).catch(() => {
      /* history is best effort; the survey itself already succeeded */
    });
  }, [user, search]);

  const runImport = async () => {
    try {
      const added = await pipeline.importLocal();
      setImportMsg(`Added ${added} lead${added === 1 ? "" : "s"} to your account.`);
    } catch {
      setImportMsg("Import didn't finish. Try again in a moment.");
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  // Close the mobile sheet with Escape.
  useEffect(() => {
    if (isDesktop || !selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelectedId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDesktop, selected]);

  const exportCsv = () => {
    if (!ready) return;
    const rows = businesses.map((b) => {
      const a = analyses[b.id];
      const r = a?.status === "done" ? a.report : null;
      return [
        b.name,
        b.category,
        b.address,
        b.phone,
        b.website,
        r?.opportunity ?? "",
        r?.verdict ?? "not audited",
        r ? r.signals.filter((s) => !s.passed).map((s) => s.label).join("; ") : "",
        r ? r.detectedTools.join("; ") : "",
        savedById.get(b.id) ? STATUS_LABEL[savedById.get(b.id)!.status] : "",
        savedById.get(b.id)?.notes ?? "",
        b.lat,
        b.lon,
      ];
    });
    const csv = toCsv(
      ["Name", "Category", "Address", "Phone", "Website", "Opportunity", "Verdict", "Missing", "Detected tools", "Status", "Notes", "Lat", "Lon"],
      rows,
    );
    downloadCsv(`salecrawler-${ready.niche}-${ready.city}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".csv", csv);
  };

  const exportPipeline = () => {
    const csv = toCsv(
      ["Name", "Status", "Notes", "Opportunity", "Verdict", "Missing", "Phone", "Website", "Address", "Saved"],
      pipeline.leads.map((l) => [
        l.name,
        STATUS_LABEL[l.status],
        l.notes,
        l.opportunity ?? "",
        l.verdict ?? "",
        l.missing.join("; "),
        l.phone,
        l.website,
        l.address,
        new Date(l.savedAt).toISOString().slice(0, 10),
      ]),
    );
    downloadCsv("salecrawler-my-leads.csv", csv);
  };

  const reportProps = {
    onAnalyze: (b: Parameters<typeof analyzeOne>[0]) => void analyzeOne(b),
    onSave: pipeline.save,
    onUpdate: pipeline.update,
    onRemove: pipeline.remove,
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between py-5">
        <BrandMark />
        <nav className="flex items-center gap-1" aria-label="Tools">
          {ready && (
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-haze transition-colors hover:bg-cyanotype-soft hover:text-chalk"
            >
              {copied ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
              <span aria-live="polite" className="hidden sm:inline">
                {copied ? "Link copied" : "Copy link"}
              </span>
            </button>
          )}
          {hasResults && (
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-haze transition-colors hover:bg-cyanotype-soft hover:text-chalk"
            >
              <Download size={16} aria-hidden /> <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-chalk transition-colors hover:bg-cyanotype-soft"
          >
            <BookmarkCheck size={16} aria-hidden className="text-signal" /> My leads
            <span className="rounded-full bg-cyanotype px-2 text-xs leading-5" suppressHydrationWarning>
              {pipeline.leads.length}
            </span>
          </button>
          <AccountMenu />
        </nav>
      </header>

      {(pipeline.pendingImport.length > 0 || importMsg) && (
        <div role="status" className="mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-sm">
          {importMsg ? (
            <span>{importMsg}</span>
          ) : (
            <>
              <span>
                You have {pipeline.pendingImport.length} lead{pipeline.pendingImport.length === 1 ? "" : "s"} saved in this browser.
                Add {pipeline.pendingImport.length === 1 ? "it" : "them"} to your account?
              </span>
              <span className="ml-auto flex gap-2">
                <button type="button" onClick={runImport} className="rounded-lg bg-signal px-3 py-1.5 font-bold text-prussian-deep">
                  Add to my account
                </button>
                <button type="button" onClick={pipeline.dismissImport} className="rounded-lg px-3 py-1.5 text-haze hover:text-chalk">
                  Not now
                </button>
              </span>
            </>
          )}
        </div>
      )}
      {pipeline.error && (
        <p role="alert" className="mb-2 rounded-xl border border-flare/50 bg-flare/10 px-4 py-3 text-sm text-flare">
          {pipeline.error}
        </p>
      )}

      <main className="flex flex-1 flex-col pb-16">
        <section className={cn("grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14", hasResults ? "pt-2" : "pt-6 lg:pt-10")}>
          <div className="max-w-2xl">
            <h1
              className="headline text-[clamp(2.6rem,6.4vw,5.25rem)] data-[condensed=true]:text-[clamp(2.1rem,3.6vw,3.25rem)] font-bold leading-[0.98] tracking-[-0.02em] text-balance"
              data-condensed={hasResults}
            >
              Find local businesses that still run on paper.
            </h1>
            <p className={cn("mt-6 max-w-[52ch] text-lg leading-relaxed text-haze", hasResults && "sr-only")}>
              Survey a city for any niche, audit every website in seconds, and see who&apos;s missing online booking,
              chat, a mobile site or basic analytics. Those are the clients who need you.
            </p>
            <div className={hasResults ? "mt-6" : "mt-8"}>
              <SearchPanel
                busy={search.status === "loading"}
                initialCity={initial.city}
                initialNiche={initial.niche}
                initialRadius={initial.radius}
                onSearch={onSearch}
              />
            </div>
            {search.status === "idle" && <SurveySteps />}
          </div>

          <div className={cn("w-full transition-[max-width] duration-700", hasResults ? "mx-auto max-w-[400px]" : "")}>
          <SurveyScope
            search={search}
            analyses={analyses}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={setSelectedId}
            onHover={setHoveredId}
          />
          </div>
        </section>

        {search.status === "error" && (
          <div className="mt-12 max-w-2xl rounded-2xl border border-flare/50 bg-flare/10 p-6" role="alert">
            <p className="font-display text-xl font-semibold text-flare">Survey didn&apos;t run</p>
            <p className="mt-1 text-chalk/90">{search.message}</p>
            {search.signInRequired && (
              <Link
                href={`/auth/sign-in?redirectTo=${encodeURIComponent(
                  `/?${new URLSearchParams({ city: search.city, niche: search.niche, r: String(search.radiusM) })}`,
                )}`}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-bold text-prussian-deep hover:brightness-105"
              >
                <LogIn size={15} aria-hidden /> Sign in again
              </Link>
            )}
            {search.retryable && (
            <button
              type="button"
              onClick={() => onSearch(search.city, search.niche, search.radiusM)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-chalk/40 px-4 py-2 text-sm font-bold hover:border-chalk"
            >
              <RotateCcw size={15} aria-hidden /> Try again
            </button>
            )}
          </div>
        )}

        {ready && businesses.length === 0 && (
          <div className="mt-12 max-w-2xl rounded-2xl border border-haze/25 p-6">
            <p className="font-display text-xl font-semibold">No matches near {ready.center.label}</p>
            <p className="mt-1 text-haze">
              OpenStreetMap has no “{ready.niche}” listings within {ready.radiusM / 1000} km of the city centre. Try a wider
              radius, a broader niche, a preset from the chips above, or a larger nearby city.
            </p>
          </div>
        )}

        {hasResults && (
          <section className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
            <div className="lg:max-h-[calc(100dvh-6rem)] lg:sticky lg:top-6 flex flex-col">
              <LeadList
                businesses={businesses}
                analyses={analyses}
                selectedId={selectedId}
                hoveredId={hoveredId}
                bulkRunning={bulkRunning}
                savedIds={savedIds}
                onSelect={setSelectedId}
                onHover={setHoveredId}
                onAnalyze={(b) => void analyzeOne(b)}
                onAnalyzeAll={(rows) => void analyzeAll(rows)}
              />
            </div>

            {isDesktop && (
              <aside className="rounded-3xl border border-haze/15 bg-prussian-deep/50 p-7" aria-live="polite">
                {selected ? (
                  <LeadReport business={selected} analysis={analyses[selected.id]} saved={savedById.get(selected.id)} {...reportProps} />
                ) : (
                  <div className="flex min-h-80 flex-col justify-center">
                    <p className="font-display text-2xl font-semibold">Pick a business to see its report.</p>
                    <p className="mt-2 max-w-[42ch] text-haze">
                      Click a row or a dot on the scope. Audit sites one at a time, or audit the whole list at once.
                    </p>
                  </div>
                )}
              </aside>
            )}
          </section>
        )}
      </main>

      <SiteFooter />

      {/* Mobile report sheet */}
      <AnimatePresence>
        {!isDesktop && selected && (
          <>
            <motion.div
              key="scrim"
              className="fixed inset-0 z-40 bg-prussian-deep/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
            />
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="report-title"
              className="scrollbar-thin fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-haze/20 bg-prussian p-6"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <LeadReport
                business={selected}
                analysis={analyses[selected.id]}
                saved={savedById.get(selected.id)}
                {...reportProps}
                onClose={() => setSelectedId(null)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {drawerOpen && (
          <PipelineDrawer
            key="pipeline"
            leads={pipeline.leads}
            onClose={() => setDrawerOpen(false)}
            onUpdate={pipeline.update}
            onRemove={pipeline.remove}
            onExport={exportPipeline}
            signedIn={pipeline.signedIn}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
