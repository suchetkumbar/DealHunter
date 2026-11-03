"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import type { AuthFormState } from "@/app/actions/auth";

type Props = {
  mode: "sign-in" | "sign-up";
  action: (prev: AuthFormState, form: FormData) => Promise<AuthFormState>;
  redirectTo: string;
};

export function AuthForm({ mode, action, redirectTo }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [show, setShow] = useState(false);
  const signUp = mode === "sign-up";
  const other = signUp ? "/auth/sign-in" : "/auth/sign-up";
  const qs = redirectTo !== "/" ? `?redirectTo=${encodeURIComponent(redirectTo)}` : "";

  return (
    <form action={formAction} className="spotlight rounded-2xl bg-prussian-deep/60 p-6 sm:p-8" noValidate>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="grid gap-4">
        {signUp && (
          <label className="grid gap-1.5 text-sm text-haze">
            Name <span className="sr-only">(optional)</span>
            <input
              name="name"
              autoComplete="name"
              maxLength={80}
              defaultValue={state.fields?.name}
              placeholder="Optional"
              className="field !pl-4"
            />
          </label>
        )}
        <label className="grid gap-1.5 text-sm text-haze">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
            defaultValue={state.fields?.email}
            aria-invalid={!!state.error}
            aria-describedby={state.error ? "auth-error" : undefined}
            className="field !pl-4"
          />
        </label>
        <label className="grid gap-1.5 text-sm text-haze">
          Password
          <span className="relative">
            <input
              name="password"
              type={show ? "text" : "password"}
              required
              minLength={signUp ? 8 : 1}
              maxLength={128}
              autoComplete={signUp ? "new-password" : "current-password"}
              aria-invalid={!!state.error}
              aria-describedby={signUp ? "pw-hint" : state.error ? "auth-error" : undefined}
              className="field !pl-4 !pr-12"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-haze hover:text-chalk"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
          {signUp && (
            <span id="pw-hint" className="text-xs">
              At least 8 characters.
            </span>
          )}
        </label>
      </div>

      {state.error && (
        <p id="auth-error" role="alert" className="mt-4 rounded-lg border border-flare/50 bg-flare/10 px-3 py-2 text-sm text-flare">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-signal font-bold text-prussian-deep transition-[filter] hover:brightness-105 disabled:cursor-progress disabled:opacity-70"
      >
        {pending && <Loader2 size={18} className="animate-spin" aria-hidden />}
        {signUp ? (pending ? "Creating account…" : "Create account") : pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="mt-5 text-center text-sm text-haze">
        {signUp ? "Already have an account?" : "New to SaleCrawler?"}{" "}
        <Link href={`${other}${qs}`} className="font-bold text-chalk underline-offset-4 hover:underline">
          {signUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
