import { describe, expect, it } from "vitest";
import { noWebsiteReport, scoreSignals, SIGNAL_WEIGHTS, unreachableReport, verdictFor } from "../scoring";
import { signalsFromHtml } from "../analyze";

describe("scoring", () => {
  it("weights sum to 100", () => {
    expect(Object.values(SIGNAL_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("maps opportunity to verdicts", () => {
    expect(verdictFor(90)).toBe("prime");
    expect(verdictFor(40)).toBe("warm");
    expect(verdictFor(10)).toBe("saturated");
  });

  it("treats no website as maximum opportunity", () => {
    const r = noWebsiteReport();
    expect(r.opportunity).toBe(100);
    expect(r.verdict).toBe("prime");
  });

  it("scores an unreachable site as prime", () => {
    const r = unreachableReport("https://x.test", "timeout");
    expect(r.maturity).toBe(SIGNAL_WEIGHTS.website);
    expect(r.verdict).toBe("prime");
    expect(r.reachable).toBe(false);
  });

  it("all passed → saturated", () => {
    const signals = (Object.keys(SIGNAL_WEIGHTS) as (keyof typeof SIGNAL_WEIGHTS)[]).map((id) => ({
      id, label: id, passed: true, detail: "",
    }));
    expect(scoreSignals(signals)).toEqual({ maturity: 100, opportunity: 0, verdict: "saturated" });
  });
});

describe("signalsFromHtml", () => {
  const url = new URL("https://shop.example.com/");

  it("detects a modern, automated site", () => {
    const html = `<html><head><meta name="viewport" content="width=device-width">
      <script src="https://widget.intercom.io/widget/abc"></script>
      <script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>
      <link href="/wp-content/themes/x.css" rel="stylesheet"></head>
      <body><a href="https://calendly.com/acme">Book</a><a href="tel:+15551234">Call</a>
      <footer>© ${new Date().getFullYear()} Acme</footer></body></html>`;
    const { signals, tools } = signalsFromHtml(html, url, 800);
    expect(signals.every((s) => s.passed)).toBe(true);
    expect(tools).toEqual(expect.arrayContaining(["Intercom", "Calendly", "Google Analytics", "WordPress"]));
  });

  it("flags a legacy site", () => {
    const html = `<html><body><center><font>Welcome to Bob's Dental</font></center>
      <p>Copyright 2011 Bob</p><p>Mention of intercom.io in plain prose</p></body></html>`;
    const { signals } = signalsFromHtml(html, new URL("http://bob.example.com"), 3200);
    const failed = signals.filter((s) => !s.passed).map((s) => s.id);
    expect(failed).toEqual(expect.arrayContaining(["https", "speed", "mobile", "chat", "booking", "platform", "freshness", "contact"]));
    expect(scoreSignals(signals).verdict).toBe("prime");
  });
});
