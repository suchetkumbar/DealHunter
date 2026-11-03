"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { importMyLeads, listMyLeads, removeMyLead, saveMyLead, updateMyLead } from "@/app/actions/data";
import { useSessionUser } from "@/components/session-provider";
import { parseStore, serializeStore, STORAGE_KEY, toSavedLead, type LeadStatus, type SavedLead } from "@/lib/pipeline";
import type { AnalysisReport, Business } from "@/lib/types";

/* ---------- Guest mode: leads live in this browser's localStorage ---------- */

const listeners = new Set<() => void>();
let cache: { raw: string | null; leads: SavedLead[] } = { raw: null, leads: [] };
const EMPTY: SavedLead[] = [];

function readLocal(): SavedLead[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cache.raw) cache = { raw, leads: parseStore(raw) };
  return cache.leads;
}

function writeLocal(leads: SavedLead[]) {
  try {
    if (leads.length) window.localStorage.setItem(STORAGE_KEY, serializeStore(leads));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    cache = { raw: null, leads };
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function mergeForSave(current: SavedLead[], b: Business, report: AnalysisReport | null): SavedLead[] {
  const existing = current.find((l) => l.id === b.id);
  const fresh = toSavedLead(b, report);
  if (!existing) return [fresh, ...current];
  return current.map((l) =>
    l.id === b.id
      ? {
          ...fresh,
          status: l.status,
          notes: l.notes,
          savedAt: l.savedAt,
          opportunity: fresh.opportunity ?? l.opportunity,
          verdict: fresh.verdict ?? l.verdict,
          missing: report ? fresh.missing : l.missing,
        }
      : l,
  );
}

function applyPatch(leads: SavedLead[], id: string, patch: { status?: LeadStatus; notes?: string }): SavedLead[] {
  return leads.map((l) =>
    l.id === id
      ? { ...l, ...patch, notes: (patch.notes ?? l.notes).slice(0, 2000), status: patch.status ?? l.status, updatedAt: Date.now() }
      : l,
  );
}

/* ---------- Hook: same API for guests and signed-in users ---------- */

export type PipelineError = string | null;

export function usePipeline() {
  const user = useSessionUser();
  const localLeads = useSyncExternalStore(subscribe, readLocal, () => EMPTY);
  const [remote, setRemote] = useState<SavedLead[] | null>(null);
  const [error, setError] = useState<PipelineError>(null);
  const [importDismissed, setImportDismissed] = useState(false);

  // Signed in: load the account's leads from the database.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    listMyLeads()
      .then((leads) => alive && setRemote(leads))
      .catch(() => alive && setError("Couldn't load your saved leads. Refresh to try again."));
    return () => {
      alive = false;
    };
  }, [user]);

  const signedIn = !!user;
  const leads = signedIn ? (remote ?? EMPTY) : localLeads;

  /** Optimistic update for signed-in users; rolls back and explains if the server rejects it. */
  const mutate = useCallback(
    async (next: (prev: SavedLead[]) => SavedLead[], server: () => Promise<unknown>) => {
      let before: SavedLead[] = EMPTY;
      setRemote((prev) => {
        before = prev ?? EMPTY;
        return next(before);
      });
      try {
        await server();
        setError(null);
      } catch {
        setRemote(before);
        setError("That change didn't save. Check your connection and try again.");
      }
    },
    [],
  );

  const save = useCallback(
    (b: Business, report: AnalysisReport | null) => {
      if (!signedIn) return writeLocal(mergeForSave(readLocal(), b, report));
      void mutate(
        (prev) => mergeForSave(prev, b, report),
        () => saveMyLead(toSavedLead(b, report)),
      );
    },
    [signedIn, mutate],
  );

  const update = useCallback(
    (id: string, patch: { status?: LeadStatus; notes?: string }) => {
      if (!signedIn) return writeLocal(applyPatch(readLocal(), id, patch));
      void mutate(
        (prev) => applyPatch(prev, id, patch),
        () => updateMyLead(id, patch),
      );
    },
    [signedIn, mutate],
  );

  const remove = useCallback(
    (id: string) => {
      if (!signedIn) return writeLocal(readLocal().filter((l) => l.id !== id));
      void mutate(
        (prev) => prev.filter((l) => l.id !== id),
        () => removeMyLead(id),
      );
    },
    [signedIn, mutate],
  );

  /** Leads saved in this browser before signing in, offered for import into the account. */
  const pendingImport = signedIn && !importDismissed ? localLeads : EMPTY;

  const importLocal = useCallback(async () => {
    const local = readLocal();
    if (!local.length) return 0;
    const added = await importMyLeads(local);
    writeLocal([]);
    setRemote(await listMyLeads());
    return added;
  }, []);

  // Hides the offer only; the browser copy stays untouched so nothing is lost.
  const dismissImport = useCallback(() => setImportDismissed(true), []);

  return { leads, save, update, remove, signedIn, loading: signedIn && remote === null, error, pendingImport, importLocal, dismissImport };
}
