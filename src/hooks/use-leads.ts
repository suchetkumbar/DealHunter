"use client";

import { useCallback, useRef, useState } from "react";
import type { AnalysisReport, ApiError, Business, GeoPoint, PlacesResponse } from "@/lib/types";

export type SearchState =
  | { status: "idle" }
  | { status: "loading"; city: string; niche: string }
  | { status: "ready"; city: string; niche: string; center: GeoPoint; businesses: Business[] }
  | { status: "error"; city: string; niche: string; message: string; retryable: boolean };

export type LeadAnalysis =
  | { status: "analyzing" }
  | { status: "done"; report: AnalysisReport }
  | { status: "error"; message: string };

const CONCURRENCY = 3;

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as Partial<ApiError>;
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function useLeads() {
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [analyses, setAnalyses] = useState<Record<string, LeadAnalysis>>({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const generation = useRef(0);
  const searchAbort = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (city: string, niche: string) => {
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    const gen = ++generation.current;

    setSearch({ status: "loading", city, niche });
    setAnalyses({});
    setBulkRunning(false);

    try {
      const qs = new URLSearchParams({ city, niche });
      let res = await fetch(`/api/places?${qs}`, { signal: controller.signal }).catch(() => null);
      // Public map services occasionally hiccup; retry once quietly before showing an error.
      if (!res || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1200));
        if (controller.signal.aborted || gen !== generation.current) return;
        res = await fetch(`/api/places?${qs}`, { signal: controller.signal });
      }
      if (!res.ok) {
        const message = await readError(res, "Search failed. Try again.");
        if (gen !== generation.current) return;
        // 400/404 mean the input needs changing; retrying the same search won't help.
        setSearch({ status: "error", city, niche, message, retryable: res.status >= 500 });
        return;
      }
      const data = (await res.json()) as PlacesResponse;
      if (gen !== generation.current) return;
      setSearch({ status: "ready", city, niche, center: data.center, businesses: data.businesses });
    } catch (err) {
      if (controller.signal.aborted || gen !== generation.current) return;
      const message =
        err instanceof TypeError
          ? "Couldn't reach the server. Check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Search failed. Try again.";
      setSearch({ status: "error", city, niche, message, retryable: true });
    }
  }, []);

  const analyzeOne = useCallback(async (business: Business, gen = generation.current) => {
    setAnalyses((prev) => ({ ...prev, [business.id]: { status: "analyzing" } }));
    let next: LeadAnalysis;
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: business.website }),
      });
      if (!res.ok) {
        next = { status: "error", message: await readError(res, "The audit failed. Try again.") };
      } else {
        next = { status: "done", report: (await res.json()) as AnalysisReport };
      }
    } catch {
      next = { status: "error", message: "Couldn't reach the server. Try again." };
    }
    // Ignore results that belong to a previous search.
    if (gen !== generation.current) return;
    setAnalyses((prev) => ({ ...prev, [business.id]: next }));
  }, []);

  const analyzeAll = useCallback(
    async (businesses: Business[]) => {
      const gen = generation.current;
      const queue = businesses.filter((b) => {
        const a = analyses[b.id];
        return !a || a.status === "error";
      });
      if (!queue.length) return;
      setBulkRunning(true);
      const worker = async () => {
        while (queue.length && gen === generation.current) {
          const next = queue.shift()!;
          await analyzeOne(next, gen);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
      if (gen === generation.current) setBulkRunning(false);
    },
    [analyses, analyzeOne],
  );

  return { search, analyses, bulkRunning, runSearch, analyzeOne, analyzeAll };
}
