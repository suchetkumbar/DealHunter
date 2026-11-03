import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Off the map — SaleCrawler",
};

const SIZE = 320;
const C = SIZE / 2;
const R = 140;
const r2 = (n: number) => Math.round(n * 100) / 100;

export default async function NotFound() {
  // Show the address the visitor tried, so the page explains itself.
  const h = await headers();
  const path = (h.get("x-pathname") ?? "").slice(0, 80);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 sm:px-8">
      <header className="py-5">
        <Link href="/" className="font-display text-lg font-bold tracking-tight">
          SaleCrawler
        </Link>
      </header>

      <main className="grid flex-1 items-center gap-12 pb-16 md:grid-cols-[1fr_auto]">
        <div>
          <p className="font-display text-[clamp(5rem,16vw,10rem)] font-bold leading-none tracking-[-0.04em] text-signal">404</p>
          <h1 className="headline mt-4 text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.02] tracking-[-0.02em] text-balance">
            Nothing on the scope at this address.
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-haze">
            The page you were looking for doesn&apos;t exist or has moved. Your saved leads are safe — head back and run a
            new survey.
          </p>
          {path && path !== "/_not-found" && (
            <p className="mt-4 text-sm text-haze">
              Requested: <span className="break-all text-chalk">{path}</span>
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center rounded-xl bg-signal px-5 py-3 font-bold text-prussian-deep hover:brightness-105"
            >
              Back to the survey
            </Link>
            <Link
              href="/leads"
              className="inline-flex items-center rounded-xl border border-haze/30 px-5 py-3 font-bold hover:border-chalk"
            >
              My leads
            </Link>
          </div>
        </div>

        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[320px]" aria-hidden="true">
          <defs>
            <radialGradient id="nf-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1d4f7a" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#0a1f33" stopOpacity="0.9" />
            </radialGradient>
            <linearGradient id="nf-sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f4c542" stopOpacity="0" />
              <stop offset="100%" stopColor="#f4c542" stopOpacity="0.25" />
            </linearGradient>
          </defs>
          <circle cx={C} cy={C} r={R} fill="url(#nf-bg)" stroke="#8fa9bf" strokeOpacity="0.35" />
          <g stroke="#8fa9bf" strokeOpacity="0.16" fill="none">
            <circle cx={C} cy={C} r={r2(R / 3)} strokeDasharray="2 5" />
            <circle cx={C} cy={C} r={r2((R * 2) / 3)} strokeDasharray="2 5" />
            <line x1={C - R} y1={C} x2={C + R} y2={C} />
            <line x1={C} y1={C - R} x2={C} y2={C + R} />
          </g>
          {/* A slow, endless sweep that finds nothing. Stops under prefers-reduced-motion (globals.css). */}
          <g className="origin-center animate-[spin_4s_linear_infinite] motion-reduce:animate-none" style={{ transformOrigin: `${C}px ${C}px` }}>
            <path
              d={`M ${C} ${C} L ${C} ${C - R} A ${R} ${R} 0 0 0 ${r2(C - R * Math.sin(Math.PI / 5))} ${r2(C - R * Math.cos(Math.PI / 5))} Z`}
              fill="url(#nf-sweep)"
            />
            <line x1={C} y1={C} x2={C} y2={C - R} stroke="#f4c542" strokeWidth="1.5" />
          </g>
          <circle cx={C} cy={C} r={3} fill="#e6edf2" />
        </svg>
      </main>
    </div>
  );
}
