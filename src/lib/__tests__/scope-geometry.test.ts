import { describe, expect, it } from "vitest";
import { C, PLOT_R, bearingDeg, distanceKm, polar, project, rangeRingsKm } from "@/lib/scope-geometry";
import type { Business } from "@/lib/types";

const center = { lat: 51.5072, lon: -0.1276, label: "London" };
const biz = (id: string, lat: number, lon: number): Business => ({
  id,
  name: id,
  lat,
  lon,
  website: null,
  phone: null,
  address: null,
  category: null,
});
/** A point `km` due north / east of the centre. */
const north = (km: number) => center.lat + km / 111.195;
const east = (km: number) => center.lon + km / (111.195 * Math.cos((center.lat * Math.PI) / 180));

describe("scope geometry", () => {
  it("measures great-circle distance and compass bearing", () => {
    expect(distanceKm(center, { lat: north(3), lon: center.lon })).toBeCloseTo(3, 2);
    expect(bearingDeg(center, { lat: north(3), lon: center.lon })).toBeCloseTo(0, 1);
    expect(bearingDeg(center, { lat: center.lat, lon: east(3) })).toBeCloseTo(90, 0);
    expect(bearingDeg(center, { lat: 2 * center.lat - north(3), lon: center.lon })).toBeCloseTo(180, 1);
    expect(bearingDeg(center, { lat: center.lat, lon: 2 * center.lon - east(3) })).toBeCloseTo(270, 0);
  });

  it("puts a lead on the range ring that matches its distance", () => {
    // Survey radius 6 km: rings at 2, 4 and 6 km sit at PLOT_R/3, 2·PLOT_R/3 and PLOT_R.
    const [a, b, c] = project(
      center,
      [biz("2km-N", north(2), center.lon), biz("4km-E", center.lat, east(4)), biz("6km-N", north(6), center.lon)],
      6,
    );
    expect(a.x).toBeCloseTo(C, 1);
    expect(C - a.y).toBeCloseTo(PLOT_R / 3, 0);
    expect(b.y).toBeCloseTo(C, 0);
    expect(b.x - C).toBeCloseTo((2 * PLOT_R) / 3, 0);
    expect(C - c.y).toBeCloseTo(PLOT_R, 0);
  });

  it("keeps the true direction: east is right, south is down", () => {
    const [e, s] = project(center, [biz("e", center.lat, east(1)), biz("s", 2 * center.lat - north(1), center.lon)], 5);
    expect(e.x).toBeGreaterThan(C);
    expect(s.y).toBeGreaterThan(C);
    expect(e.bearing).toBeCloseTo(90, 0);
    expect(s.bearing).toBeCloseTo(180, 0);
  });

  it("holds a lead just past the radius on the boundary, never on the bezel", () => {
    const [p] = project(center, [biz("far", north(5.05), center.lon)], 5);
    expect(Math.hypot(p.x - C, p.y - C)).toBeLessThanOrEqual(PLOT_R + 0.01);
    expect(p.km).toBeGreaterThan(5);
  });

  it("plots a lead at the centre without a bogus bearing", () => {
    const [p] = project(center, [biz("here", center.lat, center.lon)], 2);
    expect(p).toMatchObject({ x: C, y: C, km: 0, bearing: 0 });
  });

  it("polar() follows compass convention", () => {
    expect(polar(10, 0)).toEqual({ x: C, y: C - 10 });
    expect(polar(10, 90)).toEqual({ x: C + 10, y: C });
  });

  it("labels range rings at round distances ending on the survey boundary", () => {
    expect(rangeRingsKm(2)).toEqual([0.5, 1, 1.5, 2]);
    expect(rangeRingsKm(5)).toEqual([1, 2, 3, 4, 5]);
    expect(rangeRingsKm(10)).toEqual([2, 4, 6, 8, 10]);
    expect(rangeRingsKm(3)).toEqual([1, 2, 3]);
  });
});
