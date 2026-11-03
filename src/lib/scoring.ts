import type { AnalysisReport, Signal, SignalId, Verdict } from "./types";

/** How much each passed signal contributes to digital maturity. Sums to 100. */
export const SIGNAL_WEIGHTS: Record<SignalId, number> = {
  website: 15,
  reachable: 10,
  https: 8,
  speed: 7,
  mobile: 10,
  chat: 15,
  booking: 12,
  analytics: 8,
  platform: 7,
  freshness: 4,
  contact: 4,
};

export function verdictFor(opportunity: number): Verdict {
  if (opportunity >= 60) return "prime";
  if (opportunity >= 35) return "warm";
  return "saturated";
}

export function scoreSignals(signals: Signal[]): Pick<AnalysisReport, "maturity" | "opportunity" | "verdict"> {
  const maturity = Math.round(
    signals.reduce((sum, s) => sum + (s.passed ? SIGNAL_WEIGHTS[s.id] : 0), 0),
  );
  const clamped = Math.max(0, Math.min(100, maturity));
  const opportunity = 100 - clamped;
  return { maturity: clamped, opportunity, verdict: verdictFor(opportunity) };
}

/** Report for a business that has no website listed at all. */
export function noWebsiteReport(): AnalysisReport {
  const signals: Signal[] = [
    {
      id: "website",
      label: "Website",
      passed: false,
      detail: "No website is listed for this business.",
      pitch: "Customers searching for them online find nothing to click.",
    },
  ];
  const { maturity, opportunity, verdict } = scoreSignals(signals);
  return {
    url: null,
    reachable: false,
    maturity,
    opportunity,
    verdict,
    signals,
    detectedTools: [],
    responseMs: null,
  };
}

/** Report for a site that is listed but could not be loaded. */
export function unreachableReport(url: string, reason: string): AnalysisReport {
  const signals: Signal[] = [
    { id: "website", label: "Website", passed: true, detail: "A website is listed." },
    {
      id: "reachable",
      label: "Site loads",
      passed: false,
      detail: reason,
      pitch: "Their listed website doesn't load, so leads bounce before they ever call.",
    },
  ];
  const { maturity, opportunity, verdict } = scoreSignals(signals);
  return {
    url,
    reachable: false,
    maturity,
    opportunity,
    verdict,
    signals,
    detectedTools: [],
    responseMs: null,
  };
}
