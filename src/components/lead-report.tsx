"use client";

import { animate, motion, useReducedMotion } from "framer-motion";
import { Check, Copy, ExternalLink, Loader2, MapPin, Phone, RotateCcw, ScanSearch, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { LeadAnalysis } from "@/hooks/use-leads";
import type { AnalysisReport, Business, Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";
import { hostOf } from "./lead-list";

const VERDICT_COPY: Record<Verdict, { title: string; body: string }> = {
  prime: { title: "Prime lead", body: "Big gaps in their online presence. There's a lot you could sell them." },
  warm: { title: "Warm lead", body: "Some basics are covered, but there are clear gaps to pitch." },
  saturated: { title: "Already well equipped", body: "Most tools are in place. Pitch only if you have something specialised." },
};

type Props = {
  business: Business;
  analysis?: LeadAnalysis;
  onAnalyze: (b: Business) => void;
  onClose?: () => void;
};

export function LeadReport({ business, analysis, onAnalyze, onClose }: Props) {
  const host = hostOf(business.website);
  return (
    <article aria-labelledby="report-title" className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="report-title" className="font-display text-3xl font-semibold leading-tight tracking-tight text-balance">
            {business.name}
          </h2>
          {business.category && <p className="mt-1 capitalize text-haze">{business.category.replace(/_/g, " ")}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-haze hover:bg-cyanotype-soft hover:text-chalk"
            aria-label="Close report"
          >
            <X size={20} />
          </button>
        )}
      </header>

      <dl className="grid gap-2 text-sm">
        <Row icon={<MapPin size={15} />} label="Address">
          {business.address ?? <span className="text-haze">Not listed</span>}
        </Row>
        <Row icon={<Phone size={15} />} label="Phone">
          {business.phone ? (
            <a href={`tel:${business.phone.replace(/[^\d+]/g, "")}`} className="hover:text-signal hover:underline">
              {business.phone}
            </a>
          ) : (
            <span className="text-haze">Not listed</span>
          )}
        </Row>
        <Row icon={<ExternalLink size={15} />} label="Website">
          {business.website && host ? (
            <a href={business.website} target="_blank" rel="noopener noreferrer" className="hover:text-signal hover:underline">
              {host}
            </a>
          ) : (
            <span className="text-signal">No website listed</span>
          )}
        </Row>
      </dl>

      {!analysis && (
        <div className="rounded-2xl border border-dashed border-haze/30 p-6">
          <p className="text-haze">
            {business.website
              ? "Audit the website to see what they're missing: booking, chat, mobile, analytics and more."
              : "No website is listed. Audit to log this as a lead with full opportunity."}
          </p>
          <button
            type="button"
            onClick={() => onAnalyze(business)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2.5 font-bold text-prussian-deep hover:brightness-105"
          >
            <ScanSearch size={17} aria-hidden /> Audit this business
          </button>
        </div>
      )}

      {analysis?.status === "analyzing" && (
        <div className="flex items-center gap-3 rounded-2xl border border-haze/20 p-6 text-haze" role="status">
          <Loader2 size={20} className="animate-spin" aria-hidden />
          Checking {host ?? "the listing"} for booking, chat, mobile support and more…
        </div>
      )}

      {analysis?.status === "error" && (
        <div className="rounded-2xl border border-flare/50 bg-flare/10 p-6" role="alert">
          <p className="font-bold text-flare">The audit didn&apos;t finish.</p>
          <p className="mt-1 text-sm text-chalk/90">{analysis.message}</p>
          <button
            type="button"
            onClick={() => onAnalyze(business)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-chalk/40 px-4 py-2 text-sm font-bold hover:border-chalk"
          >
            <RotateCcw size={15} aria-hidden /> Retry audit
          </button>
        </div>
      )}

      {analysis?.status === "done" && <ReportBody report={analysis.report} name={business.name} />}
    </article>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1.25rem_5rem_1fr] items-baseline gap-2">
      <dt className="contents">
        <span className="translate-y-0.5 text-haze" aria-hidden>
          {icon}
        </span>
        <span className="text-haze">{label}</span>
      </dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function ReportBody({ report, name }: { report: AnalysisReport; name: string }) {
  const copy = VERDICT_COPY[report.verdict];
  const pitches = report.signals.filter((s) => !s.passed && s.pitch).map((s) => s.pitch!);
  const passed = report.signals.filter((s) => s.passed).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-5">
        <Dial value={report.opportunity} verdict={report.verdict} />
        <div>
          <p className={cn("font-display text-xl font-semibold", report.verdict === "prime" ? "text-signal" : "text-chalk")}>
            {copy.title}
          </p>
          <p className="mt-1 max-w-[34ch] text-sm text-haze">{copy.body}</p>
          {report.responseMs !== null && (
            <p className="mt-2 text-xs text-haze">
              {passed} of {report.signals.length} checks passed, responded in {(report.responseMs / 1000).toFixed(1)}s
            </p>
          )}
        </div>
      </div>

      <section aria-labelledby="checks-heading">
        <h3 id="checks-heading" className="font-display text-lg font-semibold">
          What we checked
        </h3>
        <ul className="mt-3 divide-y divide-haze/10">
          {report.signals.map((s) => (
            <li key={s.id} className="flex gap-3 py-2.5">
              <span
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                  s.passed ? "bg-haze/20 text-chalk" : "bg-signal text-prussian-deep",
                )}
                aria-label={s.passed ? "Has it" : "Missing"}
              >
                {s.passed ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block font-bold">{s.label}</span>
                <span className="block text-sm text-haze">{s.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        {report.verdict !== "saturated" && report.reachable && (
          <p className="mt-3 text-xs text-haze">
            Widgets that load only after JavaScript runs can be missed. Confirm on the live site before pitching.
          </p>
        )}
      </section>

      {pitches.length > 0 && <PitchBlock name={name} pitches={pitches.slice(0, 3)} />}
    </div>
  );
}

function PitchBlock({ name, pitches }: { name: string; pitches: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = `Ideas for ${name}:\n${pitches.map((p) => `• ${p}`).join("\n")}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-labelledby="pitch-heading" className="rounded-2xl bg-cyanotype/45 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 id="pitch-heading" className="font-display text-lg font-semibold">
          Pitch angles
        </h3>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm text-haze hover:bg-cyanotype hover:text-chalk"
        >
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <ul className="mt-3 space-y-2.5">
        {pitches.map((p) => (
          <li key={p} className="border-l-2 border-signal pl-3 text-[0.95rem] leading-relaxed">
            {p}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Dial({ value, verdict }: { value: number; verdict: Verdict }) {
  const reduce = useReducedMotion();
  const [animated, setAnimated] = useState(0);
  const shown = reduce ? value : animated;
  const r = 40;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;

  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, value, { duration: 0.9, ease: [0.2, 0.7, 0.1, 1], onUpdate: (v) => setAnimated(Math.round(v)) });
    return () => controls.stop();
  }, [value, reduce]);

  return (
    <div className="relative size-28 shrink-0" role="img" aria-label={`Opportunity score ${value} out of 100`}>
      <svg viewBox="0 0 100 100" className="size-full rotate-[135deg]">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" className="text-haze/20" strokeWidth="7" strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className={verdict === "prime" ? "stroke-signal" : verdict === "warm" ? "stroke-haze" : "stroke-cyanotype"}
          strokeDasharray={`${arc} ${circ}`}
          initial={{ strokeDashoffset: reduce ? arc * (1 - value / 100) : arc }}
          animate={{ strokeDashoffset: arc * (1 - value / 100) }}
          transition={{ duration: reduce ? 0 : 0.9, ease: [0.2, 0.7, 0.1, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold leading-none">{shown}</span>
        <span className="mt-1 text-[11px] text-haze">opportunity</span>
      </div>
    </div>
  );
}
