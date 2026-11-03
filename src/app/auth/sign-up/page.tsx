import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signUpAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { safeRedirect } from "@/lib/safe-redirect";
import { getUser } from "@/lib/session";

// Reads the session cookie, so it must render per request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Create an account — SaleCrawler" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ redirectTo?: string }> }) {
  const redirectTo = safeRedirect((await searchParams).redirectTo);
  if (await getUser()) redirect(redirectTo);
  return (
    <AuthShell
      title="Keep every lead you find."
      lede="A free account lets you survey any city and audit every website. Your leads, notes and history follow you from laptop to phone."
    >
      <AuthForm mode="sign-up" action={signUpAction} redirectTo={redirectTo === "/" ? "/leads?welcome=1" : redirectTo} />
    </AuthShell>
  );
}
