import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Bricolage_Grotesque } from "next/font/google";
import { connection } from "next/server";
import { SessionProvider } from "@/components/session-provider";
import { getUser } from "@/lib/session";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["wdth", "opsz"],
  display: "swap",
});

const body = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SaleCrawler — find local businesses that need you",
  description:
    "Survey any city for local businesses, audit their websites in seconds, and find the ones with no booking, no chat and no mobile site.",
};

export const viewport: Viewport = {
  themeColor: "#0F2A44",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Render per request so Next.js can stamp the CSP nonce from src/proxy.ts onto its scripts.
  await connection();
  const user = await getUser();
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="antialiased">
        <SessionProvider user={user}>{children}</SessionProvider>
      </body>
    </html>
  );
}
