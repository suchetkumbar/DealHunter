"use client";

import { Briefcase, Loader2, MapPin, Radar } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const POPULAR = [
  { value: "dentist", label: "Dentists" },
  { value: "salon", label: "Salons" },
  { value: "restaurant", label: "Restaurants" },
  { value: "plumber", label: "Plumbers" },
  { value: "lawyer", label: "Law firms" },
  { value: "gym", label: "Gyms" },
  { value: "realestate", label: "Real estate" },
  { value: "auto", label: "Auto repair" },
];

const ALL_NICHES = [
  ...POPULAR,
  { value: "doctor", label: "Doctors & clinics" },
  { value: "cafe", label: "Cafés" },
  { value: "accountant", label: "Accountants" },
  { value: "electrician", label: "Electricians" },
  { value: "vet", label: "Veterinarians" },
  { value: "hotel", label: "Hotels & B&Bs" },
  { value: "pharmacy", label: "Pharmacies" },
];

export const RADII = [
  { value: 2000, label: "2 km" },
  { value: 5000, label: "5 km" },
  { value: 10000, label: "10 km" },
] as const;

type Props = {
  busy: boolean;
  initialCity?: string;
  initialNiche?: string;
  initialRadius?: number;
  onSearch: (city: string, niche: string, radiusM: number) => void;
};

export function SearchPanel({ busy, initialCity = "", initialNiche = "", initialRadius = 5000, onSearch }: Props) {
  const [city, setCity] = useState(initialCity);
  const [niche, setNiche] = useState(initialNiche);
  const [radius, setRadius] = useState(initialRadius);
  const [touched, setTouched] = useState(false);
  const ref = useRef<HTMLFormElement>(null);

  const cityError = touched && city.trim().length < 2 ? "Enter a city, e.g. Austin, TX." : null;
  const nicheError = touched && niche.trim().length < 2 ? "Pick a niche below or type one." : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (city.trim().length < 2 || niche.trim().length < 2) return;
    onSearch(city.trim(), niche.trim(), radius);
  };

  const trackPointer = (e: React.PointerEvent<HTMLFormElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  };

  return (
    <form
      ref={ref}
      onSubmit={submit}
      onPointerMove={trackPointer}
      noValidate
      className="spotlight rounded-2xl bg-prussian-deep/60 p-3 sm:p-4"
      aria-label="Search for businesses"
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label htmlFor="city" className="sr-only">
            City
          </label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-haze" size={18} aria-hidden />
            <input
              id="city"
              name="city"
              autoComplete="address-level2"
              placeholder="City, e.g. Austin, TX"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              aria-invalid={!!cityError}
              aria-describedby={cityError ? "city-error" : undefined}
              className={cn("field", cityError && "border-flare")}
            />
          </div>
        </div>
        <div>
          <label htmlFor="niche" className="sr-only">
            Niche
          </label>
          <div className="relative">
            <Briefcase className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-haze" size={18} aria-hidden />
            <input
              id="niche"
              name="niche"
              list="niche-options"
              autoComplete="off"
              placeholder="Niche, e.g. dentist"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              aria-invalid={!!nicheError}
              aria-describedby={nicheError ? "niche-error" : undefined}
              className={cn("field", nicheError && "border-flare")}
            />
            <datalist id="niche-options">
              {ALL_NICHES.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </datalist>
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-[3.25rem] items-center justify-center gap-2 rounded-xl bg-signal px-6 font-bold text-prussian-deep transition-[filter,transform] hover:brightness-105 active:scale-[0.98] disabled:cursor-progress disabled:opacity-70"
        >
          {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Radar size={18} aria-hidden />}
          {busy ? "Surveying…" : "Run survey"}
        </button>
      </div>

      {(cityError || nicheError) && (
        <p className="mt-2 px-1 text-sm text-flare" role="alert">
          <span id="city-error">{cityError}</span> <span id="niche-error">{nicheError}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
        <span id="radius-label" className="text-sm text-haze">
          Search radius
        </span>
        <div role="radiogroup" aria-labelledby="radius-label" className="flex rounded-full border border-haze/25 p-0.5">
          {RADII.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={radius === r.value}
              onClick={() => setRadius(r.value)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm transition-colors sm:px-3 sm:py-1",
                radius === r.value ? "bg-cyanotype text-chalk" : "text-haze hover:text-chalk",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 px-1" role="group" aria-label="Popular niches">
        {POPULAR.map((n) => (
          <button
            key={n.value}
            type="button"
            onClick={() => setNiche(n.value)}
            aria-pressed={niche === n.value}
            className={cn(
              "rounded-full border px-3.5 py-2 text-sm transition-colors sm:px-3 sm:py-1",
              niche === n.value
                ? "border-signal bg-signal/10 text-chalk"
                : "border-haze/25 text-haze hover:border-haze/60 hover:text-chalk",
            )}
          >
            {n.label}
          </button>
        ))}
      </div>
    </form>
  );
}
