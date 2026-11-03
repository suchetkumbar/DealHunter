"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ExternalLink, Phone, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { STATUSES, STATUS_LABEL, type LeadStatus, type SavedLead } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { hostOf } from "./lead-list";

type Props = {
  leads: SavedLead[];
  onClose: () => void;
  onUpdate: (id: string, patch: { status?: LeadStatus; notes?: string }) => void;
  onRemove: (id: string) => void;
  onExport: () => void;
  signedIn: boolean;
};

export function PipelineDrawer({ leads, onClose, onUpdate, onRemove, onExport, signedIn }: Props) {
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const closeRef = useRef<HTMLButtonElement>(null);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length])) as Record<LeadStatus, number>;
  const shown = (filter === "all" ? leads : leads.filter((l) => l.status === filter)).toSorted((a, b) => b.updatedAt - a.updatedAt);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-prussian-deep/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="pipeline-title"
        className="scrollbar-thin fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-haze/20 bg-prussian p-6"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
      >
        <header className="flex items-center justify-between gap-3">
          <h2 id="pipeline-title" className="font-display text-2xl font-semibold">
            My leads
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close my leads"
            className="rounded-lg p-2 text-haze hover:bg-cyanotype-soft hover:text-chalk"
          >
            <X size={20} />
          </button>
        </header>
        {signedIn ? (
          <p className="mt-1 text-sm text-haze">
            Saved to your account.{" "}
            <Link href="/leads" className="font-bold text-chalk underline-offset-4 hover:underline">
              Open full history
            </Link>
          </p>
        ) : (
          <p className="mt-1 text-sm text-haze">
            Saved in this browser only.{" "}
            <Link href="/auth/sign-up" className="font-bold text-chalk underline-offset-4 hover:underline">
              Create a free account
            </Link>{" "}
            to keep them on every device.
          </p>
        )}

        <div role="radiogroup" aria-label="Filter by status" className="mt-5 flex flex-wrap gap-1.5 text-sm">
          {(["all", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={filter === s}
              onClick={() => setFilter(s)}
              className={cn(
                "rounded-md px-3 py-1.5 transition-colors",
                filter === s ? "bg-cyanotype text-chalk" : "text-haze hover:text-chalk",
              )}
            >
              {s === "all" ? `All ${leads.length}` : `${STATUS_LABEL[s]} ${counts[s]}`}
            </button>
          ))}
        </div>

        {leads.length === 0 ? (
          <p className="mt-10 text-haze">
            No saved leads yet. Open a business from a survey and choose <span className="text-chalk">Save to my leads</span>.
          </p>
        ) : shown.length === 0 ? (
          <p className="mt-10 text-haze">No leads with this status.</p>
        ) : (
          <ul className="mt-4 divide-y divide-haze/10">
            {shown.map((l) => {
              const host = hostOf(l.website);
              return (
                <li key={l.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{l.name}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-haze">
                        {host && l.website ? (
                          <a href={l.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-chalk">
                            {host} <ExternalLink size={12} aria-hidden />
                          </a>
                        ) : (
                          <span className="text-signal">No website</span>
                        )}
                        {l.phone && (
                          <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 hover:text-chalk">
                            <Phone size={12} aria-hidden /> {l.phone}
                          </a>
                        )}
                      </p>
                    </div>
                    {l.opportunity !== null && (
                      <span
                        className={cn("font-display text-lg font-bold", l.verdict === "prime" ? "text-signal" : "text-chalk")}
                        aria-label={`Opportunity ${l.opportunity}`}
                      >
                        {l.opportunity}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <label className="sr-only" htmlFor={`status-${l.id}`}>
                      Status for {l.name}
                    </label>
                    <select
                      id={`status-${l.id}`}
                      value={l.status}
                      onChange={(e) => onUpdate(l.id, { status: e.target.value as LeadStatus })}
                      className="rounded-md border border-haze/25 bg-prussian-deep px-2 py-1.5 text-sm text-chalk"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => onRemove(l.id)}
                      aria-label={`Remove ${l.name}`}
                      className="ml-auto rounded-md p-2 text-haze hover:bg-cyanotype-soft hover:text-chalk"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {l.notes && <p className="mt-2 whitespace-pre-wrap border-l-2 border-haze/30 pl-3 text-sm text-chalk/85">{l.notes}</p>}
                </li>
              );
            })}
          </ul>
        )}

        {leads.length > 0 && (
          <button
            type="button"
            onClick={onExport}
            className="mt-6 rounded-lg border border-haze/30 px-4 py-2.5 text-sm font-bold hover:border-chalk"
          >
            Export my leads as CSV
          </button>
        )}
      </motion.aside>
    </>
  );
}
