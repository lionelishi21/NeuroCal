import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

/**
 * The website's frame for its few pages outside the landing page (admin sign-in, the "this is for
 * admins" notice, unsubscribe): the landing page's header, then the content on a card. On wide
 * screens a violet panel beside the card says what the page is for, so it reads as a website page
 * rather than a phone screen.
 */
/** `wide` gives long reading pages (terms, privacy) a measure that suits text. */
export function SiteFrame({ aside, wide = false, children }: { aside?: { title: string; body: string }; wide?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-rule bg-mist/90 backdrop-blur-md">
        <div className="mx-auto flex h-[4.25rem] w-full max-w-[73.75rem] items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-2 text-ink no-underline">
            <LogoMark className="size-7" />
            <span className="text-xl font-extrabold tracking-[-0.025em]">NeuroCal</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-10 sm:py-16">
        <div className={`grid w-full items-stretch gap-0 overflow-hidden rounded-[2rem] border border-rule bg-paper ${aside ? "max-w-[60rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]" : wide ? "max-w-[46rem]" : "max-w-[30rem]"}`}>
          {aside && (
            <div className="hidden flex-col justify-between gap-10 bg-linear-to-br from-promo to-promo-deep p-12 text-on-promo lg:flex">
              <svg viewBox="0 0 28 28" aria-hidden className="size-12">
                <path d="M20.5 7.5 A9.5 9.5 0 1 0 20.5 20.5" fill="none" stroke="var(--on-promo)" strokeWidth="3.5" strokeLinecap="round" />
                <circle cx="23.5" cy="14" r="2.2" fill="var(--promo-spark)" />
              </svg>
              <div>
                <p className="m-0 text-heading leading-[1.08] font-extrabold tracking-[-0.03em] text-balance">{aside.title}</p>
                <p className="mt-4 mb-0 max-w-[24rem] text-lg leading-normal text-pretty text-on-promo-soft">{aside.body}</p>
              </div>
            </div>
          )}
          <div className="p-7 sm:p-10" style={{ animation: "enter var(--duration-step) var(--ease-settle)" }}>
            {children}
          </div>
        </div>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex w-full max-w-[73.75rem] flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-ink-soft">
          <span>© 2026 NeuroCal</span>
          <Link href="/" className="font-bold text-synapse-ink underline-offset-4 hover:underline">
            Back to the home page
          </Link>
        </div>
      </footer>
    </div>
  );
}
