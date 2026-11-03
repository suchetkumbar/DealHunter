import { BrandMark } from "@/components/site-chrome";

/** Shared frame for the sign-in and sign-up pages. */
export function AuthShell({ title, lede, children }: { title: string; lede: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 sm:px-8">
      <header className="py-5">
        <BrandMark />
      </header>
      <main className="grid flex-1 items-center gap-10 pb-16 md:grid-cols-[1fr_minmax(0,420px)] md:gap-16">
        <div>
          <h1 className="headline text-[clamp(2.2rem,5vw,3.75rem)] font-bold leading-[1] tracking-[-0.02em] text-balance">{title}</h1>
          <p className="mt-5 max-w-[44ch] text-lg leading-relaxed text-haze">{lede}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
