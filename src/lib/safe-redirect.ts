/** Only allow same-site relative paths, so ?redirectTo= can't bounce users to another site. */
export function safeRedirect(to: unknown, fallback = "/"): string {
  if (typeof to !== "string" || to.length > 500) return fallback;
  if (!to.startsWith("/") || to.startsWith("//") || to.startsWith("/\\")) return fallback;
  try {
    const u = new URL(to, "https://salecrawler.invalid");
    return u.origin === "https://salecrawler.invalid" ? `${u.pathname}${u.search}${u.hash}` : fallback;
  } catch {
    return fallback;
  }
}
