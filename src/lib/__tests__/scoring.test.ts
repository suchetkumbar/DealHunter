import { describe, expect, it } from "vitest";
import { noWebsiteReport, scoreSignals, SIGNAL_WEIGHTS, unreachableReport, verdictFor } from "../scoring";
import { certificateSignal, linksSignal, signalsFromHtml } from "../analyze";

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
      <a href="https://www.facebook.com/acme">FB</a><a href="https://g.page/acme/review">Review us</a>
      <a href="/services">Services</a><a href="/about#team">About</a><a href="https://other.example/x">Out</a>
      <footer>© ${new Date().getFullYear()} Acme</footer></body></html>`;
    const { signals, tools } = signalsFromHtml(html, url, 800);
    expect(signals.every((s) => s.passed)).toBe(true);
    expect(tools).toEqual(expect.arrayContaining(["Intercom", "Calendly", "Google Analytics", "WordPress", "Facebook", "Google reviews"]));
  });

  it("collects same-origin links for the broken-link check", () => {
    const html = `<a href="/services">S</a><a href="/about#team">A</a><a href="https://other.example/x">O</a><a href="/menu.pdf">M</a><a href="/">Home</a>`;
    const { internalLinks } = signalsFromHtml(html, url, 500);
    expect(internalLinks).toEqual(["https://shop.example.com/services", "https://shop.example.com/about"]);
  });

  it("flags a legacy site", () => {
    const html = `<html><body><center><font>Welcome to Bob's Dental</font></center>
      <p>Copyright 2011 Bob</p><p>Mention of intercom.io in plain prose</p></body></html>`;
    const { signals } = signalsFromHtml(html, new URL("http://bob.example.com"), 3200);
    const failed = signals.filter((s) => !s.passed).map((s) => s.id);
    expect(failed).toEqual(
      expect.arrayContaining(["https", "speed", "mobile", "chat", "booking", "platform", "freshness", "contact", "social", "reviews"]),
    );
    expect(scoreSignals(signals).verdict).toBe("prime");
  });
});

describe("network signals", () => {
  const now = Date.parse("2026-11-03T00:00:00Z");
  it("certificate: valid, expiring, untrusted, unknown", () => {
    expect(certificateSignal({ valid: true, expiresAt: new Date(now + 90 * 864e5) }, now).passed).toBe(true);
    const soon = certificateSignal({ valid: true, expiresAt: new Date(now + 5 * 864e5) }, now);
    expect(soon.passed).toBe(false);
    expect(soon.detail).toContain("5 days");
    expect(certificateSignal({ valid: false, expiresAt: null, reason: "self signed" }, now).detail).toBe("self signed");
    expect(certificateSignal(null, now).passed).toBe(false);
  });
  it("links: counts broken, tolerates HEAD-not-allowed", () => {
    expect(linksSignal([]).passed).toBe(true);
    expect(linksSignal([200, 301, 405, 403]).passed).toBe(true);
    const bad = linksSignal([200, 404, 0, 500]);
    expect(bad.passed).toBe(false);
    expect(bad.detail).toBe("3 of 4 homepage links are broken.");
  });
});
