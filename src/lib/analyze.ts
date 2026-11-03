import * as cheerio from "cheerio";
import { safeFetchHtml, FetchFailedError } from "./safe-fetch";
import { noWebsiteReport, scoreSignals, unreachableReport } from "./scoring";
import type { AnalysisReport, Signal } from "./types";

type Detector = { name: string; patterns: string[] };

const CHAT_TOOLS: Detector[] = [
  { name: "Intercom", patterns: ["widget.intercom.io", "intercomcdn.com", "intercomsettings"] },
  { name: "Drift", patterns: ["js.driftt.com", "drift.com/"] },
  { name: "Zendesk Chat", patterns: ["static.zdassets.com", "zopim.com"] },
  { name: "Tidio", patterns: ["code.tidio.co"] },
  { name: "Tawk.to", patterns: ["embed.tawk.to"] },
  { name: "Crisp", patterns: ["client.crisp.chat"] },
  { name: "LiveChat", patterns: ["cdn.livechatinc.com"] },
  { name: "HubSpot Chat", patterns: ["js.usemessages.com", "hs-scripts.com"] },
  { name: "Chatbase", patterns: ["chatbase.co/embed"] },
  { name: "Botpress", patterns: ["cdn.botpress.cloud"] },
  { name: "Freshchat", patterns: ["wchat.freshchat.com"] },
  { name: "Podium", patterns: ["connect.podium.com"] },
  { name: "Birdeye", patterns: ["birdeye.com/embed"] },
  { name: "Facebook Messenger", patterns: ["connect.facebook.net/en_us/sdk/xfbml.customerchat"] },
  { name: "WhatsApp button", patterns: ["wa.me/", "api.whatsapp.com/send"] },
];

const BOOKING_TOOLS: Detector[] = [
  { name: "Calendly", patterns: ["calendly.com"] },
  { name: "Acuity", patterns: ["acuityscheduling.com", "as.me/"] },
  { name: "Square Appointments", patterns: ["squareup.com/appointments", "square.site/book"] },
  { name: "Booksy", patterns: ["booksy.com"] },
  { name: "Fresha", patterns: ["fresha.com"] },
  { name: "Vagaro", patterns: ["vagaro.com"] },
  { name: "Mindbody", patterns: ["mindbodyonline.com", "healcode.com"] },
  { name: "Zocdoc", patterns: ["zocdoc.com"] },
  { name: "OpenTable", patterns: ["opentable.com"] },
  { name: "Resy", patterns: ["resy.com"] },
  { name: "SimplyBook", patterns: ["simplybook.me"] },
  { name: "Setmore", patterns: ["setmore.com"] },
  { name: "Doctolib", patterns: ["doctolib."] },
  { name: "LocalMed", patterns: ["localmed.com"] },
  { name: "NexHealth", patterns: ["nexhealth.com"] },
];

const ANALYTICS_TOOLS: Detector[] = [
  { name: "Google Analytics", patterns: ["googletagmanager.com/gtag", "google-analytics.com"] },
  { name: "Google Tag Manager", patterns: ["googletagmanager.com/gtm.js"] },
  { name: "Meta Pixel", patterns: ["connect.facebook.net/en_us/fbevents.js", "fbq("] },
  { name: "Hotjar", patterns: ["static.hotjar.com"] },
  { name: "Plausible", patterns: ["plausible.io/js"] },
  { name: "Microsoft Clarity", patterns: ["clarity.ms/tag"] },
];

const MODERN_PLATFORMS: Detector[] = [
  { name: "Next.js", patterns: ["/_next/static"] },
  { name: "Webflow", patterns: ["webflow.com", "data-wf-site"] },
  { name: "Shopify", patterns: ["cdn.shopify.com"] },
  { name: "Squarespace", patterns: ["static1.squarespace.com", "squarespace-cdn.com"] },
  { name: "Wix", patterns: ["static.wixstatic.com", "wix.com"] },
  { name: "Framer", patterns: ["framerusercontent.com"] },
  { name: "WordPress", patterns: ["/wp-content/", "/wp-includes/"] },
];

function detect(haystack: string, detectors: Detector[]): string[] {
  return detectors.filter((d) => d.patterns.some((p) => haystack.includes(p))).map((d) => d.name);
}

/** Pure HTML → signals step, separated from the network so it can be unit tested. */
export function signalsFromHtml(html: string, finalUrl: URL, responseMs: number): { signals: Signal[]; tools: string[] } {
  const $ = cheerio.load(html);

  // Only consider places third-party tools are actually wired in: script/iframe/link targets and inline scripts.
  const resourceText = [
    ...$("script[src]").map((_, el) => $(el).attr("src") ?? "").get(),
    ...$("iframe[src]").map((_, el) => $(el).attr("src") ?? "").get(),
    ...$("a[href]").map((_, el) => $(el).attr("href") ?? "").get(),
    ...$("link[href]").map((_, el) => $(el).attr("href") ?? "").get(),
    ...$("script:not([src])").map((_, el) => $(el).html() ?? "").get(),
    ...$("[data-wf-site]").map(() => "data-wf-site").get(),
  ]
    .join("\n")
    .toLowerCase();

  const chat = detect(resourceText, CHAT_TOOLS);
  const booking = detect(resourceText, BOOKING_TOOLS);
  const analytics = detect(resourceText, ANALYTICS_TOOLS);
  const platform = detect(resourceText, MODERN_PLATFORMS);
  const generator = $('meta[name="generator"]').attr("content")?.trim();

  const hasViewport = $('meta[name="viewport"]').length > 0;
  const legacyMarkup = $("font, center, marquee, frameset").length > 0 || $("table[width], td[bgcolor]").length > 3;
  const hasForm = $("form").filter((_, el) => $(el).find("input, textarea").length >= 2).length > 0;
  const hasTelOrMail = $('a[href^="tel:"], a[href^="mailto:"]').length > 0;

  const bodyText = $("body").text();
  const years = [...bodyText.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1]));
  const thisYear = new Date().getFullYear();
  const latestYear = years.length ? Math.max(...years) : null;
  const fresh = latestYear === null ? true : thisYear - latestYear <= 2;

  const signals: Signal[] = [
    { id: "website", label: "Website", passed: true, detail: `Site loads at ${finalUrl.hostname}.` },
    { id: "reachable", label: "Site loads", passed: true, detail: "The homepage responded normally." },
    finalUrl.protocol === "https:"
      ? { id: "https", label: "Secure connection", passed: true, detail: "Served over HTTPS." }
      : {
          id: "https",
          label: "Secure connection",
          passed: false,
          detail: "Served over plain HTTP — browsers mark it “Not secure”.",
          pitch: "Browsers flag their site as “Not secure”, which scares off new patients and customers.",
        },
    responseMs <= 2500
      ? { id: "speed", label: "Load time", passed: true, detail: `Responded in ${(responseMs / 1000).toFixed(1)}s.` }
      : {
          id: "speed",
          label: "Load time",
          passed: false,
          detail: `Took ${(responseMs / 1000).toFixed(1)}s to respond.`,
          pitch: "Their homepage is slow enough that mobile visitors leave before it loads.",
        },
    hasViewport
      ? { id: "mobile", label: "Mobile-ready", passed: true, detail: "Has a responsive viewport." }
      : {
          id: "mobile",
          label: "Mobile-ready",
          passed: false,
          detail: "No mobile viewport — the page renders as a shrunken desktop site on phones.",
          pitch: "Most of their visitors are on phones, and the site isn't built for them.",
        },
    chat.length
      ? { id: "chat", label: "Chat or AI assistant", passed: true, detail: `Uses ${chat.join(", ")}.` }
      : {
          id: "chat",
          label: "Chat or AI assistant",
          passed: false,
          detail: "No chat widget or assistant found.",
          pitch: "After-hours questions go unanswered — an AI assistant could capture those leads.",
        },
    booking.length
      ? { id: "booking", label: "Online booking", passed: true, detail: `Takes bookings through ${booking.join(", ")}.` }
      : {
          id: "booking",
          label: "Online booking",
          passed: false,
          detail: "No online booking tool found.",
          pitch: "Customers still have to call to book — automated scheduling would fill the calendar.",
        },
    analytics.length
      ? { id: "analytics", label: "Analytics", passed: true, detail: `Tracks visits with ${analytics.join(", ")}.` }
      : {
          id: "analytics",
          label: "Analytics",
          passed: false,
          detail: "No analytics or ad pixel found.",
          pitch: "They have no idea how many people visit or where they come from.",
        },
    !legacyMarkup && (platform.length || generator)
      ? {
          id: "platform",
          label: "Modern platform",
          passed: true,
          detail: `Built with ${platform[0] ?? generator}.`,
        }
      : {
          id: "platform",
          label: "Modern platform",
          passed: false,
          detail: legacyMarkup ? "Uses outdated markup (tables, <font>, <center>)." : "Hand-built or unidentified platform.",
          pitch: "The site is built on dated technology that's hard to update.",
        },
    fresh
      ? {
          id: "freshness",
          label: "Recently updated",
          passed: true,
          detail: latestYear ? `Copyright notice reads ${latestYear}.` : "No stale copyright notice.",
        }
      : {
          id: "freshness",
          label: "Recently updated",
          passed: false,
          detail: `Copyright notice still reads ${latestYear}.`,
          pitch: `Their footer still says ${latestYear} — the site hasn't been touched in years.`,
        },
    hasForm || hasTelOrMail
      ? {
          id: "contact",
          label: "Easy to contact",
          passed: true,
          detail: hasForm ? "Has a contact form." : "Has tap-to-call or email links.",
        }
      : {
          id: "contact",
          label: "Easy to contact",
          passed: false,
          detail: "No contact form, tap-to-call or email link found.",
          pitch: "There's no quick way to get in touch from the homepage.",
        },
  ];

  return { signals, tools: [...chat, ...booking, ...analytics, ...platform] };
}

export async function analyzeWebsite(url: string | null): Promise<AnalysisReport> {
  if (!url) return noWebsiteReport();

  let page;
  try {
    page = await safeFetchHtml(url);
  } catch (err) {
    if (err instanceof FetchFailedError) return unreachableReport(url, err.message);
    throw err; // BlockedUrlError and unexpected errors are handled by the route
  }

  const { signals, tools } = signalsFromHtml(page.html, page.finalUrl, page.elapsedMs);
  return {
    url: page.finalUrl.toString(),
    reachable: true,
    ...scoreSignals(signals),
    signals,
    detectedTools: tools,
    responseMs: page.elapsedMs,
  };
}
