"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import type { LeadAnalysis, SearchState } from "@/hooks/use-leads";
import type { Business, GeoPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

const SIZE = 440;
const C = SIZE / 2;
const R = 196;
const SWEEP_S = 1.9;
const KM_PER_DEG = 111.32;

type Props = {
  search: SearchState;
  analyses: Record<string, LeadAnalysis>;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

type Plotted = { b: Business; x: number; y: number; bearing: number; km: number };

function project(center: GeoPoint, businesses: Business[]): { points: Plotted[]; maxKm: number } {
  const cos = Math.cos((center.lat * Math.PI) / 180);
  const raw = businesses.map((b) => {
    const dx = (b.lon - center.lon) * cos * KM_PER_DEG;
    const dy = (b.lat - center.lat) * KM_PER_DEG;
    return { b, dx, dy, km: Math.hypot(dx, dy) };
  });
  const maxKm = Math.max(1, Math.ceil(Math.max(0, ...raw.map((r) => r.km))));
  const points = raw.map(({ b, dx, dy, km }) => {
    const scale = (R - 10) / maxKm;
    const x = C + dx * scale;
    const y = C - dy * scale;
    // Bearing clockwise from north, so it matches the sweep direction.
    const bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
    return { b, x, y, km, bearing: (bearing + 360) % 360 };
  });
  return { points, maxKm };
}

export function SurveyScope({ search, analyses, selectedId, hoveredId, onSelect, onHover }: Props) {
  const reduce = useReducedMotion();
  const ready = search.status === "ready" ? search : null;
  const { points, maxKm } = useMemo(
    () => (ready ? project(ready.center, ready.businesses) : { points: [], maxKm: 5 }),
    [ready],
  );
  const sweepKey = ready ? `${ready.center.lat},${ready.center.lon},${ready.niche}` : "idle";
  const scanning = search.status === "loading";

  return (
    <figure className="relative mx-auto w-full max-w-[520px]">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-auto w-full"
        role="group"
        aria-label={
          ready
            ? `Survey of ${ready.businesses.length} businesses within ${maxKm} km of ${ready.center.label}`
            : "Survey scope"
        }
      >
        <defs>
          <radialGradient id="scope-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1d4f7a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0a1f33" stopOpacity="0.9" />
          </radialGradient>
          <linearGradient id="sweep-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f4c542" stopOpacity="0" />
            <stop offset="100%" stopColor="#f4c542" stopOpacity="0.28" />
          </linearGradient>
          <clipPath id="scope-clip">
            <circle cx={C} cy={C} r={R} />
          </clipPath>
        </defs>

        <circle cx={C} cy={C} r={R} fill="url(#scope-bg)" stroke="#8fa9bf" strokeOpacity="0.35" />

        {/* Range rings + cross hairs */}
        <g stroke="#8fa9bf" strokeOpacity="0.16" fill="none">
          {[1 / 3, 2 / 3].map((f) => (
            <circle key={f} cx={C} cy={C} r={R * f} strokeDasharray="2 5" />
          ))}
          <line x1={C - R} y1={C} x2={C + R} y2={C} />
          <line x1={C} y1={C - R} x2={C} y2={C + R} />
        </g>

        {/* Tick marks every 15° */}
        <g stroke="#8fa9bf" strokeOpacity="0.4">
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i * 15 * Math.PI) / 180;
            const inner = i % 6 === 0 ? R - 12 : R - 6;
            return (
              <line
                key={i}
                x1={C + Math.sin(a) * inner}
                y1={C - Math.cos(a) * inner}
                x2={C + Math.sin(a) * R}
                y2={C - Math.cos(a) * R}
              />
            );
          })}
        </g>
        <text x={C} y={C - R - 8} textAnchor="middle" className="fill-haze text-[11px]">
          N
        </text>

        {/* Range labels */}
        {/* Range labels sit on the south axis, where they collide with fewer leads. */}
        <g className="fill-haze text-[11px]">
          {[1 / 3, 2 / 3, 1].map((f) => (
            <text key={f} x={C + 5} y={C + R * f - 5}>
              {formatKm(maxKm * f)}
            </text>
          ))}
        </g>

        {/* Sweep: one pass per new survey, continuous only while a search is in flight */}
        <g clipPath="url(#scope-clip)">
          {(scanning || (ready && !reduce)) && (
            <motion.g
              key={scanning ? "scanning" : sweepKey}
              style={{ originX: `${C}px`, originY: `${C}px` }}
              initial={{ rotate: 0, opacity: 1 }}
              animate={
                scanning
                  ? { rotate: 360, opacity: 1 }
                  : { rotate: 360, opacity: [1, 1, 0] }
              }
              transition={
                scanning
                  ? { duration: SWEEP_S, ease: "linear", repeat: Infinity }
                  : { duration: SWEEP_S, ease: "linear", opacity: { duration: SWEEP_S + 0.4, times: [0, 0.85, 1] } }
              }
            >
              <path d={`M ${C} ${C} L ${C} ${C - R} A ${R} ${R} 0 0 0 ${C - R * Math.sin(Math.PI / 5)} ${C - R * Math.cos(Math.PI / 5)} Z`} fill="url(#sweep-fade)" />
              <line x1={C} y1={C} x2={C} y2={C - R} stroke="#f4c542" strokeWidth="1.5" strokeOpacity="0.9" />
            </motion.g>
          )}
        </g>

        {/* Center marker */}
        <circle cx={C} cy={C} r={3} fill="#e6edf2" />

        {/* Leads */}
        {points.map(({ b, x, y, bearing }) => {
          const a = analyses[b.id];
          const report = a?.status === "done" ? a.report : null;
          const verdict = report?.verdict;
          const active = b.id === selectedId || b.id === hoveredId;
          const delay = reduce ? 0 : (bearing / 360) * SWEEP_S;
          return (
            <motion.g
              key={`${sweepKey}:${b.id}`}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: verdict === "saturated" && !active ? 0.45 : 1, scale: 1 }}
              transition={{ delay, duration: 0.35 }}
              style={{ originX: `${x}px`, originY: `${y}px` }}
              className="cursor-pointer"
              onClick={() => onSelect(b.id)}
              onMouseEnter={() => onHover(b.id)}
              onMouseLeave={() => onHover(null)}
              aria-hidden="true"
            >
              <circle cx={x} cy={y} r={12} fill="transparent" />
              {active && (
                <circle cx={x} cy={y} r={9} fill="none" stroke="#f4c542" strokeWidth="1.25" />
              )}
              {a?.status === "analyzing" && (
                <motion.circle
                  cx={x}
                  cy={y}
                  r={5}
                  fill="none"
                  stroke="#e6edf2"
                  initial={{ r: 4, opacity: 0.9 }}
                  animate={{ r: 11, opacity: 0 }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              {/* One-shot target ping when an audit confirms a prime lead (idea via 21st.dev HUD radars). */}
              {verdict === "prime" && !reduce && (
                <motion.circle
                  key={`ping:${b.id}`}
                  cx={x}
                  cy={y}
                  fill="none"
                  stroke="#f4c542"
                  strokeWidth="1.5"
                  initial={{ r: 5, opacity: 0.9 }}
                  animate={{ r: 22, opacity: 0 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={verdict === "prime" ? 5 : 4}
                className={cn(
                  verdict === "prime" && "fill-signal stroke-signal",
                  verdict === "warm" && "fill-haze stroke-haze",
                  verdict === "saturated" && "fill-cyanotype stroke-haze",
                  !verdict && "fill-prussian-deep stroke-chalk",
                )}
                strokeWidth="1.5"
              />
            </motion.g>
          );
        })}
      </svg>

      <figcaption className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-haze">
        {search.status === "idle" && <span>Enter a city and a niche to run a survey.</span>}
        {search.status === "loading" && <span role="status">Surveying {search.city}. This usually takes a few seconds.</span>}
        {search.status === "error" && <span>No survey to show.</span>}
        {ready && (
          <>
            <span className="w-full text-center text-chalk/90">
              {ready.businesses.length} {ready.businesses.length === 1 ? "business" : "businesses"} within {formatKm(maxKm)} of {ready.center.label}
            </span>
            <Legend className="fill-prussian-deep stroke-chalk" label="Not audited" />
            <Legend className="fill-signal stroke-signal" label="Prime lead" />
            <Legend className="fill-haze stroke-haze" label="Warm" />
            <Legend className="fill-cyanotype stroke-haze" label="Well equipped" />
          </>
        )}
      </figcaption>
    </figure>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <circle cx="5" cy="5" r="3.5" className={className} strokeWidth="1.5" />
      </svg>
      {label}
    </span>
  );
}

function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km % 1 === 0 ? km : km.toFixed(1)} km`;
}
