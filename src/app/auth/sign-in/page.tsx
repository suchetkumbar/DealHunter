import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signInAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { safeRedirect } from "@/lib/safe-redirect";
import { getUser } from "@/lib/session";

// Reads the session cookie, so it must render per request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in — SaleCrawler" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirectTo?: string }> }) {
  const redirectTo = safeRedirect((await searchParams).redirectTo);
  if (await getUser()) redirect(redirectTo);
  return (
    <AuthShell title="Welcome back." lede="Sign in to pick up your saved leads, past surveys and audits on any device.">
      <AuthForm mode="sign-in" action={signInAction} redirectTo={redirectTo} />
    </AuthShell>
  );
}
