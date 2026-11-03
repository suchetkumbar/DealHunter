"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { History, LogIn, LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { useSessionUser } from "./session-provider";

export function AccountMenu() {
  const user = useSessionUser();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) {
    const back = pathname && pathname !== "/" ? `?redirectTo=${encodeURIComponent(pathname)}` : "";
    return (
      <Link
        href={`/auth/sign-in${back}`}
        className="inline-flex items-center gap-2 rounded-lg border border-haze/30 px-3 py-2 text-sm font-bold text-chalk transition-colors hover:border-signal hover:text-signal"
      >
        <LogIn size={16} aria-hidden /> Sign in
      </Link>
    );
  }

  const label = user.name || user.email;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${label}`}
        className="grid size-9 place-items-center rounded-full bg-cyanotype font-display text-sm font-bold uppercase text-chalk ring-signal/60 transition hover:ring-2"
      >
        {label.slice(0, 1)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-haze/20 bg-prussian p-2 shadow-2xl shadow-black/40">
          <div className="px-3 py-2">
            <p className="truncate font-bold">{user.name || "Signed in"}</p>
            <p className="truncate text-sm text-haze">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-haze/15" />
          <Link
            role="menuitem"
            href="/leads"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-cyanotype-soft"
          >
            <History size={16} aria-hidden className="text-haze" /> Leads & history
          </Link>
          <form action={signOutAction}>
            <button role="menuitem" type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-cyanotype-soft">
              <LogOut size={16} aria-hidden className="text-haze" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
