"use client";

import { ExternalLink, Phone, Trash2 } from "lucide-react";
import { usePipeline } from "@/hooks/use-pipeline";
import { STATUSES, STATUS_LABEL, type LeadStatus } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { hostOf } from "./lead-list";

/** Saved leads grouped by status. Changes save to the account immediately. */
export function LeadsBoard() {
  const { leads, update, remove, loading, error } = usePipeline();

  if (loading) return <p className="py-10 text-haze">Loading your leads…</p>;
  if (!leads.length) {
    return (
      <div className="rounded-2xl border border-dashed border-haze/30 p-8">
        <p className="font-display text-xl font-semibold">No saved leads yet.</p>
        <p className="mt-2 max-w-[48ch] text-haze">
          Run a survey, open a business and choose <span className="text-chalk">Save to my leads</span>. It will appear here and on every device you sign in on.
        </p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-flare/50 bg-flare/10 px-4 py-3 text-sm text-flare">
          {error}
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {STATUSES.map((status) => {
          const column = leads.filter((l) => l.status === status);
          return (
            <section key={status} aria-labelledby={`col-${status}`} className="rounded-2xl border border-haze/15 bg-prussian-deep/40 p-4">
              <h3 id={`col-${status}`} className="flex items-baseline justify-between font-display text-lg font-semibold">
                {STATUS_LABEL[status]}
                <span className="text-sm font-normal text-haze">{column.length}</span>
              </h3>
              <ul className="mt-3 space-y-3">
                {column.map((l) => {
                  const host = hostOf(l.website);
                  return (
                    <li key={l.id} className="rounded-xl bg-cyanotype-soft/60 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 font-bold leading-snug">{l.name}</p>
                        {l.opportunity !== null && (
                          <span className={cn("font-display font-bold", l.verdict === "prime" ? "text-signal" : "text-chalk")} aria-label={`Opportunity ${l.opportunity}`}>
                            {l.opportunity}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-haze">
                        {host && l.website ? (
                          <a href={l.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-chalk">
                            {host} <ExternalLink size={11} aria-hidden />
                          </a>
                        ) : (
                          <span className="text-signal">No website</span>
                        )}
                        {l.phone && (
                          <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 hover:text-chalk">
                            <Phone size={11} aria-hidden /> {l.phone}
                          </a>
                        )}
                      </p>
                      {l.notes && <p className="mt-2 whitespace-pre-wrap border-l-2 border-haze/30 pl-2 text-xs text-chalk/85">{l.notes}</p>}
                      <div className="mt-3 flex items-center gap-2">
                        <label className="sr-only" htmlFor={`st-${l.id}`}>
                          Status for {l.name}
                        </label>
                        <select
                          id={`st-${l.id}`}
                          value={l.status}
                          onChange={(e) => update(l.id, { status: e.target.value as LeadStatus })}
                          className="rounded-md border border-haze/25 bg-prussian-deep px-2 py-1 text-xs text-chalk"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => remove(l.id)}
                          aria-label={`Remove ${l.name}`}
                          className="ml-auto rounded-md p-1.5 text-haze hover:bg-cyanotype hover:text-chalk"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
