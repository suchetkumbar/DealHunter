"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { takeToken } from "@/lib/guard";
import { safeRedirect } from "@/lib/safe-redirect";

export type AuthFormState = { error?: string; fields?: { email?: string; name?: string } };

const Email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
const Password = z.string().min(8, "Use at least 8 characters for your password.").max(128, "That password is too long.");

async function tooManyAttempts(kind: string): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  // 10 attempts per 5 minutes per IP, on top of Neon Auth's own protections.
  const { ok, retryAfterS } = takeToken(`auth:${kind}:${ip}`, 10, 5 * 60_000);
  return ok ? null : `Too many attempts. Wait ${Math.ceil(retryAfterS / 60)} minute(s) and try again.`;
}

/** Map provider errors to plain messages without revealing whether an account exists. */
function friendly(message: string | undefined, kind: "in" | "up"): string {
  const m = (message ?? "").toLowerCase();
  if (kind === "up" && (m.includes("exist") || m.includes("already"))) return "An account with this email already exists. Sign in instead.";
  if (kind === "up" && m.includes("password")) return "Choose a stronger password: at least 8 characters.";
  if (kind === "in") return "That email and password don't match an account.";
  return "Couldn't create your account. Try again in a moment.";
}

export async function signInAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = Email.safeParse(form.get("email"));
  const password = z.string().min(1, "Enter your password.").max(128).safeParse(form.get("password"));
  const fields = { email: String(form.get("email") ?? "").slice(0, 254) };
  if (!email.success) return { error: email.error.issues[0].message, fields };
  if (!password.success) return { error: password.error.issues[0].message, fields };
  const limited = await tooManyAttempts("in");
  if (limited) return { error: limited, fields };

  let error: { message?: string } | null = null;
  try {
    ({ error } = await auth.signIn.email({ email: email.data, password: password.data }));
  } catch (err) {
    console.error("[auth] sign-in failed", err);
    return { error: "Sign-in is unavailable right now. Try again in a moment.", fields };
  }
  if (error) return { error: friendly(error.message, "in"), fields };
  redirect(safeRedirect(form.get("redirectTo")));
}

export async function signUpAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = Email.safeParse(form.get("email"));
  const password = Password.safeParse(form.get("password"));
  const name = z.string().trim().max(80).safeParse(form.get("name") ?? "");
  const fields = { email: String(form.get("email") ?? "").slice(0, 254), name: String(form.get("name") ?? "").slice(0, 80) };
  if (!email.success) return { error: email.error.issues[0].message, fields };
  if (!password.success) return { error: password.error.issues[0].message, fields };
  if (!name.success) return { error: "Keep your name under 80 characters.", fields };
  const limited = await tooManyAttempts("up");
  if (limited) return { error: limited, fields };

  let error: { message?: string } | null = null;
  try {
    ({ error } = await auth.signUp.email({
      email: email.data,
      password: password.data,
      name: name.data || email.data.split("@")[0],
    }));
  } catch (err) {
    console.error("[auth] sign-up failed", err);
    return { error: "Sign-up is unavailable right now. Try again in a moment.", fields };
  }
  if (error) return { error: friendly(error.message, "up"), fields };
  redirect(safeRedirect(form.get("redirectTo"), "/leads?welcome=1"));
}

export async function signOutAction(): Promise<void> {
  try {
    await auth.signOut();
  } catch (err) {
    console.error("[auth] sign-out failed", err);
  }
  redirect("/");
}
