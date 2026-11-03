import { describe, expect, it } from "vitest";
import { resolveNiche, toBusiness } from "../osm";
import { csvCell, toCsv } from "../csv";

describe("resolveNiche", () => {
  it("maps presets and aliases", () => {
    expect(resolveNiche("Dentists").key).toBe("dentist");
    expect(resolveNiche("real estate").key).toBe("realestate");
  });
  it("falls back to sanitized tag-value guesses", () => {
    const r = resolveNiche('pizza"] ; (.*');
    expect(r.key).toBeNull();
    expect(r.filters).toContain('["shop"="pizza"]');
    expect(r.filters.every((f) => !f.includes(";") && !f.includes("("))).toBe(true);
    expect(resolveNiche("Florists").filters).toContain('["shop"="florist"]');
    expect(resolveNiche("bakeries").filters).toContain('["shop"="bakery"]');
    expect(resolveNiche("dry cleaning").filters).toContain('["shop"="dry_cleaning"]');
    expect(resolveNiche('"];').filters).toEqual([]);
  });
});

describe("toBusiness", () => {
  it("normalizes a website without scheme and skips unnamed elements", () => {
    const b = toBusiness({ type: "node", id: 1, lat: 1, lon: 2, tags: { name: "A", website: "a.com; b.com" } });
    expect(b?.website).toBe("https://a.com/");
    expect(toBusiness({ type: "node", id: 2, lat: 1, lon: 2, tags: {} })).toBeNull();
  });
  it("drops non-http websites", () => {
    const b = toBusiness({ type: "way", id: 3, center: { lat: 1, lon: 2 }, tags: { name: "B", website: "javascript:alert(1)" } });
    expect(b?.website).toBeNull();
  });
});

describe("csv", () => {
  it("escapes quotes, commas and formulas", () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell("=HYPERLINK()")).toBe("'=HYPERLINK()");
    expect(csvCell(null)).toBe("");
    expect(toCsv(["x", "y"], [[1, 2]])).toBe("x,y\r\n1,2");
  });
});

describe("niche presets", () => {
  it("every preset has filters and Nominatim search words", async () => {
    const { NICHES } = await import("../osm");
    for (const n of Object.values(NICHES)) {
      expect(n.filters.length).toBeGreaterThan(0);
      expect(n.search.length).toBeGreaterThan(0);
      expect(n.search.length).toBeLessThanOrEqual(2);
    }
  });
});
