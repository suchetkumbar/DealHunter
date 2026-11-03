import type { Business, GeoPoint } from "./types";

/**
 * Geometry for the survey scope. The scope is an azimuthal equidistant plot centred on the
 * surveyed place: every lead sits at its true great-circle distance and compass bearing, so a
 * dot on the "2 km" ring really is 2 km away, in the direction it's drawn.
 */

/** SVG canvas size and centre. */
export const SIZE = 440;
export const C = SIZE / 2;
/** Outer bezel, where the compass ticks sit. */
export const BEZEL_R = 196;
/** The survey boundary. Kept inside the long ticks so a lead on the edge stays clickable. */
export const PLOT_R = 182;
const RING_STEPS_KM = [0.1, 0.25, 0.5, 1, 2, 2.5, 5, 10, 25, 50];
const MAX_RINGS = 5;

/**
 * Distances, in km, of the labelled range rings: round steps (0.5, 1, 2.5 km…) so a lead's distance
 * can be read straight off the scope. The last ring is always the survey boundary.
 * 2 km gets rings at 0.5, 1, 1.5 and 2 km; 5 km at every km; 10 km every 2 km.
 */
export function rangeRingsKm(radiusKm: number): number[] {
  const step = RING_STEPS_KM.find((s) => radiusKm / s <= MAX_RINGS) ?? radiusKm;
  const rings: number[] = [];
  // Skip a ring that would crowd the boundary (closer than half a step).
  for (let km = step; km < radiusKm - step / 2 + 1e-9; km += step) rings.push(Math.round(km * 1000) / 1000);
  return [...rings, radiusKm];
}

const EARTH_KM = 6371.0088;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km (haversine). */
export function distanceKm(a: Pick<GeoPoint, "lat" | "lon">, b: Pick<GeoPoint, "lat" | "lon">): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial compass bearing from a to b, in degrees clockwise from north (0–360). */
export function bearingDeg(a: Pick<GeoPoint, "lat" | "lon">, b: Pick<GeoPoint, "lat" | "lon">): number {
  const φ1 = rad(a.lat);
  const φ2 = rad(b.lat);
  const Δλ = rad(b.lon - a.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Round to 2 decimals so server- and browser-computed SVG attributes hydrate identically. */
export const r2 = (n: number) => Math.round(n * 100) / 100;

/** Point on the canvas at `px` from the centre along compass bearing `deg`. */
export function polar(px: number, deg: number): { x: number; y: number } {
  const a = rad(deg);
  return { x: r2(C + Math.sin(a) * px), y: r2(C - Math.cos(a) * px) };
}

export type Plotted = { b: Business; x: number; y: number; bearing: number; km: number };

/**
 * Place each business on the scope. `radiusKm` maps to PLOT_R, the same scale the range rings use.
 * The server only returns results inside the radius; anything a hair outside (rounding) is held
 * on the boundary rather than drawn over the bezel.
 */
export function project(center: GeoPoint, businesses: Business[], radiusKm: number): Plotted[] {
  const pxPerKm = PLOT_R / radiusKm;
  return businesses.map((b) => {
    const km = distanceKm(center, b);
    const bearing = km === 0 ? 0 : bearingDeg(center, b);
    const { x, y } = polar(Math.min(km, radiusKm) * pxPerKm, bearing);
    return { b, x, y, km, bearing };
  });
}
