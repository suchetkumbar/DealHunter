"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearMyHistory } from "@/app/actions/data";

/** Two-step clear: the first click asks for confirmation inline (no browser dialogs). */
export function ClearHistoryButton({ kind }: { kind: "searches" | "audits" }) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className="rounded-lg px-3 py-1.5 text-sm text-haze hover:bg-cyanotype-soft hover:text-chalk">
        Clear {kind === "searches" ? "search" : "audit"} history
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-haze">Delete all {kind}? This can&apos;t be undone.</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              await clearMyHistory(kind);
              setArmed(false);
              router.refresh();
            } catch {
              setError("Couldn't clear it. Try again.");
            }
          })
        }
        className="rounded-lg border border-flare/60 px-3 py-1.5 font-bold text-flare hover:bg-flare/10"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      <button type="button" onClick={() => setArmed(false)} className="rounded-lg px-3 py-1.5 text-haze hover:text-chalk">
        Cancel
      </button>
      {error && <span role="alert" className="text-flare">{error}</span>}
    </span>
  );
}
