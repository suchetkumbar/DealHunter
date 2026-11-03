import { describe, expect, it } from "vitest";
import { parseStore, serializeStore, toSavedLead } from "../pipeline";
import { noWebsiteReport } from "../scoring";
import type { Business } from "../types";

const b: Business = { id: "node/1", name: "Bob's Dental", lat: 1, lon: 2, website: null, phone: "+1 555", address: "1 Main St", category: "dentist" };

describe("pipeline storage", () => {
  it("round-trips a saved lead", () => {
    const lead = toSavedLead(b, noWebsiteReport(), 1000);
    expect(lead).toMatchObject({ opportunity: 100, verdict: "prime", status: "new", missing: ["Website"] });
    expect(parseStore(serializeStore([lead]))).toEqual([lead]);
  });

  it("treats storage as untrusted: drops corrupt entries, keeps valid ones", () => {
    const good = toSavedLead(b, null, 1);
    const raw = JSON.stringify({
      version: 1,
      leads: [good, { ...good, id: "x", status: "hacked" }, { ...good, id: "y", notes: "x".repeat(5000) }, "<script>", null, good],
    });
    expect(parseStore(raw)).toEqual([good]);
  });

  it("returns nothing for garbage, wrong versions or empty storage", () => {
    expect(parseStore(null)).toEqual([]);
    expect(parseStore("{not json")).toEqual([]);
    expect(parseStore(JSON.stringify({ version: 2, leads: [] }))).toEqual([]);
    expect(parseStore(JSON.stringify([1, 2, 3]))).toEqual([]);
  });
});
