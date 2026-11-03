import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth/server";

export type SessionUser = { id: string; email: string; name: string };

/**
 * The signed-in user, or null. Never throws: an auth outage just looks signed-out.
 * Wrapped in React's cache so the layout and page share one lookup per render; in Route
 * Handlers and Server Actions the wrapper is a pass-through.
 */
export const getUser = cache(async function getUser(): Promise<SessionUser | null> {
  try {
    const { data } = await auth.getSession();
    const u = data?.user;
    if (!u?.id || !u.email) return null;
    return { id: String(u.id), email: String(u.email), name: String(u.name ?? "") };
  } catch (err) {
    // Let Next.js's own control-flow errors (dynamic rendering, redirects) through untouched.
    unstable_rethrow(err);
    console.error("[session] getSession failed", err);
    return null;
  }
});
