"use client";

import { useCallback, useSyncExternalStore } from "react";
import { parseStore, serializeStore, STORAGE_KEY, toSavedLead, type LeadStatus, type SavedLead } from "@/lib/pipeline";
import type { AnalysisReport, Business } from "@/lib/types";

const listeners = new Set<() => void>();
let cache: { raw: string | null; leads: SavedLead[] } = { raw: null, leads: [] };
const EMPTY: SavedLead[] = [];

function read(): SavedLead[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY; // storage disabled (e.g. private mode with strict settings)
  }
  if (raw !== cache.raw) cache = { raw, leads: parseStore(raw) };
  return cache.leads;
}

function write(leads: SavedLead[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeStore(leads));
  } catch {
    // Quota exceeded or storage disabled — keep working in memory for this session.
    cache = { raw: null, leads };
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Keep other tabs in sync.
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePipeline() {
  const leads = useSyncExternalStore(subscribe, read, () => EMPTY);

  const save = useCallback((b: Business, report: AnalysisReport | null) => {
    const current = read();
    const existing = current.find((l) => l.id === b.id);
    const fresh = toSavedLead(b, report);
    const next = existing
      ? current.map((l) =>
          l.id === b.id
            ? { ...fresh, status: l.status, notes: l.notes, savedAt: l.savedAt, opportunity: fresh.opportunity ?? l.opportunity, verdict: fresh.verdict ?? l.verdict, missing: report ? fresh.missing : l.missing }
            : l,
        )
      : [fresh, ...current];
    write(next);
  }, []);

  const update = useCallback((id: string, patch: Partial<Pick<SavedLead, "status" | "notes">>) => {
    write(
      read().map((l) =>
        l.id === id
          ? { ...l, ...patch, notes: (patch.notes ?? l.notes).slice(0, 2000), status: (patch.status ?? l.status) as LeadStatus, updatedAt: Date.now() }
          : l,
      ),
    );
  }, []);

  const remove = useCallback((id: string) => write(read().filter((l) => l.id !== id)), []);

  return { leads, save, update, remove };
}
