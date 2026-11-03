"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import type { LeadAnalysis, SearchState } from "@/hooks/use-leads";
import { BEZEL_R, C, PLOT_R, SIZE, polar, project, r2, rangeRingsKm } from "@/lib/scope-geometry";
import type { Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";

const SWEEP_S = 1.9;
/** Half-width of the sweep's fading trail, in degrees. */
const TRAIL_DEG = 36;

/**
 * framer-motion gives animated SVG elements `transform-box: fill-box`, which measures the origin
 * from each element's own bounding box. Our origins are canvas coordinates, so measure them from
 * the viewBox instead; otherwise the sweep orbits off-centre and dots scale in from off-canvas.
 */
const originAt = (x: number, y: number) =>
  ({ transformBox: "view-box", originX: `${x}px`, originY: `${y}px` }) as const;

/** An unnamed blip for the signed-out preview: where it sits and what an audit concluded. */
export type ExampleBlip = { km: number; bearing: number; verdict: Verdict | null };

type Dot = {
  id: string;
  x: number;
  y: number;
  bearing: number;
  verdict: Verdict | undefined;
  analysis: LeadAnalysis | undefined;
};

type Props = {
  search: SearchState;
  analyses: Record<string, LeadAnalysis>;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  /** Caption shown before any survey has run. */
  idleHint?: string;
  /** Illustrative blips to sweep in while idle, on a 5 km scale. Never interactive. */
  example?: ExampleBlip[];
};

export function SurveyScope({
  search,
  analyses,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  idleHint = "Enter a city and a niche to run a survey.",
  example,
}: Props) {
  const reduce = useReducedMotion();
  const ready = search.status === "ready" ? search : null;
  // While a survey loads, label the rings with the radius being searched, not a stale one.
  const maxKm = (search.status === "idle" ? 5000 : search.radiusM) / 1000;
  const points = useMemo(() => (ready ? project(ready.center, ready.businesses, ready.radiusM / 1000) : []), [ready]);
  const rings = rangeRingsKm(maxKm);
  const trail = polar(BEZEL_R, -TRAIL_DEG);
  const showExample = search.status === "idle" && !!example?.length;
  const dots = useMemo<Dot[]>(() => {
    if (showExample && example) {
      return example.map((e, i) => ({
        id: `example-${i}`,
        ...polar((Math.min(e.km, 5) * PLOT_R) / 5, e.bearing),
        bearing: e.bearing,
        verdict: e.verdict ?? undefined,
        analysis: undefined,
      }));
    }
    return points.map(({ b, x, y, bearing }) => {
      const a = analyses[b.id];
      return { id: b.id, x, y, bearing, verdict: a?.status === "done" ? a.report.verdict : undefined, analysis: a };
    });
  }, [showExample, example, points, analyses]);
  const interactive = !showExample && !!onSelect;
  const sweepKey = ready
    ? `${ready.center.lat},${ready.center.lon},${ready.niche},${ready.radiusM}`
    : showExample
      ? "example"
      : "idle";
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
            <circle cx={C} cy={C} r={BEZEL_R} />
          </clipPath>
        </defs>

        <circle cx={C} cy={C} r={BEZEL_R} fill="url(#scope-bg)" stroke="#8fa9bf" strokeOpacity="0.35" />

        {/* Range rings at round distances, on the same scale as the leads; the solid one is the survey boundary */}
        <g stroke="#8fa9bf" fill="none">
          {rings.map((km) => (
            <circle
              key={km}
              cx={C}
              cy={C}
              r={r2((PLOT_R * km) / maxKm)}
              strokeOpacity={km === maxKm ? 0.3 : 0.16}
              strokeDasharray={km === maxKm ? undefined : "2 5"}
            />
          ))}
          <g strokeOpacity="0.16">
            <line x1={C - PLOT_R} y1={C} x2={C + PLOT_R} y2={C} />
            <line x1={C} y1={C - PLOT_R} x2={C} y2={C + PLOT_R} />
          </g>
        </g>

        {/* Compass ticks every 15°, longer at the cardinal points */}
        <g stroke="#8fa9bf" strokeOpacity="0.4">
          {Array.from({ length: 24 }, (_, i) => {
            const inner = polar(i % 6 === 0 ? BEZEL_R - 12 : BEZEL_R - 6, i * 15);
            const outer = polar(BEZEL_R, i * 15);
            return <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />;
          })}
        </g>
        <text x={C} y={C - BEZEL_R - 8} textAnchor="middle" className="fill-haze text-[12px]">
          N
        </text>

        {/* Range labels on the south axis. The dark halo keeps them readable over a lead or a ring. */}
        <g className="fill-haze text-[12px]" stroke="#0a1f33" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke">
          {rings.map((km) => (
            <text key={km} x={C + 6} y={r2(C + (PLOT_R * km) / maxKm - 5)}>
              {formatKm(km)}
            </text>
          ))}
        </g>

        {/* Sweep: one pass per new survey, continuous only while a search is in flight.
            The scanning sweep fades out as the reveal pass starts, instead of snapping to north. */}
        <g clipPath="url(#scope-clip)">
          <AnimatePresence>
          {(scanning || ((ready || showExample) && !reduce)) && (
            <motion.g
              key={scanning ? "scanning" : sweepKey}
              style={originAt(C, C)}
              exit={{ opacity: 0, transition: { duration: 0.35 } }}
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
              <path d={`M ${C} ${C} L ${C} ${C - BEZEL_R} A ${BEZEL_R} ${BEZEL_R} 0 0 0 ${trail.x} ${trail.y} Z`} fill="url(#sweep-fade)" />
              <line x1={C} y1={C} x2={C} y2={C - BEZEL_R} stroke="#f4c542" strokeWidth="1.5" strokeOpacity="0.9" />
            </motion.g>
          )}
          </AnimatePresence>
        </g>

        {/* Center marker */}
        <circle cx={C} cy={C} r={3} fill="#e6edf2" />

        {/* Leads (or example blips), revealed as the sweep passes their bearing */}
        {dots.map(({ id, x, y, bearing, verdict, analysis: a }) => {
          const active = interactive && (id === selectedId || id === hoveredId);
          const delay = reduce ? 0 : (bearing / 360) * SWEEP_S;
          return (
            <motion.g
              key={`${sweepKey}:${id}`}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: verdict === "saturated" && !active ? 0.45 : 1, scale: 1 }}
              transition={{ delay, duration: 0.35 }}
              style={originAt(x, y)}
              className={interactive ? "cursor-pointer" : undefined}
              onClick={interactive && onSelect ? () => onSelect(id) : undefined}
              onMouseEnter={interactive && onHover ? () => onHover(id) : undefined}
              onMouseLeave={interactive && onHover ? () => onHover(null) : undefined}
              aria-hidden="true"
            >
              {interactive && <circle cx={x} cy={y} r={12} fill="transparent" />}
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
                  key={`ping:${id}`}
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
        {search.status === "idle" && <span className={showExample ? "w-full text-center" : undefined}>{idleHint}</span>}
        {search.status === "loading" && <span role="status">Surveying {search.city}. This usually takes a few seconds.</span>}
        {search.status === "error" && <span>No survey to show.</span>}
        {ready && (
          <span className="w-full text-center text-chalk/90">
            {ready.businesses.length} {ready.businesses.length === 1 ? "business" : "businesses"} within {formatKm(maxKm)} of {ready.center.label}
          </span>
        )}
        {(ready || showExample) && (
          <>
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
