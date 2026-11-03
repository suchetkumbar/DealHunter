import { describe, expect, it } from "vitest";
import { safeRedirect } from "../safe-redirect";

describe("safeRedirect", () => {
  it.each([
    ["/leads", "/leads"],
    ["/leads?tab=audits", "/leads?tab=audits"],
    ["/?city=Austin&niche=dentist", "/?city=Austin&niche=dentist"],
  ])("keeps same-site path %s", (input, out) => expect(safeRedirect(input)).toBe(out));

  it.each([
    "https://evil.example/phish",
    "//evil.example",
    String.raw`/\evil.example`,
    String.raw`/\/evil.example`,
    "javascript:alert(1)",
    "leads",
    "",
    null,
    undefined,
    42,
    "/" + "a".repeat(600),
  ])("rejects %s", (input) => expect(safeRedirect(input)).toBe("/"));

  it("uses the given fallback", () => {
    expect(safeRedirect("https://evil.example", "/leads?welcome=1")).toBe("/leads?welcome=1");
  });
});
