"use client";

import { AlertTriangle, Globe, Loader2, ScanSearch } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { LeadAnalysis } from "@/hooks/use-leads";
import type { Business } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "prime" | "no-site";
type Sort = "distance" | "opportunity" | "name";

type Props = {
  businesses: Business[];
  analyses: Record<string, LeadAnalysis>;
  selectedId: string | null;
  hoveredId: string | null;
  bulkRunning: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onAnalyze: (b: Business) => void;
  onAnalyzeAll: (visible: Business[]) => void;
};

export function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function LeadList({
  businesses,
  analyses,
  selectedId,
  hoveredId,
  bulkRunning,
  onSelect,
  onHover,
  onAnalyze,
  onAnalyzeAll,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("distance");
  const listRef = useRef<HTMLUListElement>(null);

  const rows = useMemo(() => {
    const opp = (b: Business) => {
      const a = analyses[b.id];
      return a?.status === "done" ? a.report.opportunity : -1;
    };
    let out = businesses.filter((b) => {
      if (filter === "no-site") return !b.website;
      if (filter === "prime") {
        const a = analyses[b.id];
        return a?.status === "done" && a.report.verdict === "prime";
      }
      return true;
    });
    if (sort === "opportunity") out = [...out].sort((a, b) => opp(b) - opp(a));
    if (sort === "name") out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [businesses, analyses, filter, sort]);

  const audited = businesses.filter((b) => analyses[b.id]?.status === "done").length;
  const pending = rows.filter((b) => {
    const a = analyses[b.id];
    return !a || a.status === "error";
  }).length;

  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-row]") ?? []);
    const i = items.findIndex((el) => el === document.activeElement);
    if (i === -1) return;
    e.preventDefault();
    items[Math.max(0, Math.min(items.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
  };

  return (
    <section aria-labelledby="leads-heading" className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
        <div>
          <h2 id="leads-heading" className="font-display text-2xl font-semibold tracking-tight">
            {businesses.length} {businesses.length === 1 ? "business" : "businesses"} found
          </h2>
          <p className="text-sm text-haze">
            {audited === 0 ? "None audited yet." : `${audited} of ${businesses.length} audited.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAnalyzeAll(rows)}
          disabled={bulkRunning || pending === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-signal/60 px-4 py-2 text-sm font-bold text-signal transition-colors hover:bg-signal/10 disabled:cursor-not-allowed disabled:border-haze/30 disabled:text-haze"
        >
          {bulkRunning ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ScanSearch size={16} aria-hidden />}
          {bulkRunning ? "Auditing…" : pending === 0 ? "All audited" : `Audit ${pending} ${pending === 1 ? "site" : "sites"}`}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-y border-haze/15 py-3 text-sm">
        <div role="radiogroup" aria-label="Filter leads" className="flex gap-1">
          {(
            [
              ["all", "All"],
              ["prime", "Prime leads"],
              ["no-site", "No website"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-md px-3 py-1.5 transition-colors",
                filter === value ? "bg-cyanotype text-chalk" : "text-haze hover:text-chalk",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-haze">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-md border border-haze/25 bg-prussian-deep px-2 py-1.5 text-chalk"
          >
            <option value="distance">Distance</option>
            <option value="opportunity">Opportunity</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-haze">
          {filter === "prime"
            ? "No prime leads yet. Audit some sites to find them."
            : "Every business here lists a website. Switch to All to audit them."}
        </p>
      ) : (
        <ul ref={listRef} onKeyDown={onKeyDown} className="scrollbar-thin -mx-2 min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {rows.map((b) => {
            const a = analyses[b.id];
            const host = hostOf(b.website);
            const active = b.id === selectedId;
            return (
              <li key={b.id} className="relative">
                <button
                  type="button"
                  data-row
                  onClick={() => onSelect(b.id)}
                  onMouseEnter={() => onHover(b.id)}
                  onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(b.id)}
                  onBlur={() => onHover(null)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "grid w-full grid-cols-[1fr_auto] items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors",
                    (!a || a.status === "error") && "pr-24",
                    active ? "bg-cyanotype/70" : hoveredId === b.id ? "bg-cyanotype-soft/70" : "hover:bg-cyanotype-soft/50",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{b.name}</span>
                    <span className={cn("mt-0.5 flex items-center gap-1.5 truncate text-sm", active ? "text-chalk/85" : "text-haze")}>
                      {host ? (
                        <>
                          <Globe size={13} aria-hidden className="shrink-0" />
                          <span className="truncate">{host}</span>
                        </>
                      ) : (
                        <span className="text-signal">No website listed</span>
                      )}
                    </span>
                  </span>
                  <Meter analysis={a} />
                </button>
                {(!a || a.status === "error") && (
                  <button
                    type="button"
                    onClick={() => onAnalyze(b)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-haze/30 px-3 py-2 text-xs font-bold sm:px-2.5 sm:py-1 text-chalk transition-colors hover:border-signal hover:text-signal"
                    aria-label={`Audit ${b.name}`}
                  >
                    {a?.status === "error" ? "Retry" : "Audit"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Meter({ analysis }: { analysis?: LeadAnalysis }) {
  if (!analysis) return null;
  if (analysis.status === "analyzing")
    return (
      <span className="flex w-24 items-center justify-end gap-1.5 text-xs text-haze">
        <Loader2 size={13} className="animate-spin" aria-hidden /> Auditing
      </span>
    );
  if (analysis.status === "error")
    return (
      <span className="flex items-center gap-1.5 text-xs text-flare" title={analysis.message}>
        <AlertTriangle size={13} aria-hidden /> Audit failed
      </span>
    );
  const { opportunity, verdict } = analysis.report;
  return (
    <span className="flex w-24 flex-col items-end gap-1" aria-label={`Opportunity ${opportunity} out of 100`}>
      <span className={cn("font-display text-lg font-bold leading-none", verdict === "prime" ? "text-signal" : "text-chalk")}>
        {opportunity}
      </span>
      <span className="h-1 w-full overflow-hidden rounded-full bg-haze/20">
        <span
          className={cn("block h-full rounded-full", verdict === "prime" ? "bg-signal" : verdict === "warm" ? "bg-haze" : "bg-cyanotype")}
          style={{ width: `${opportunity}%` }}
        />
      </span>
    </span>
  );
}
