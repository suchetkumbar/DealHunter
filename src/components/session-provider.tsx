"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/session";

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser | null; children: React.ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export const useSessionUser = () => useContext(SessionContext);
