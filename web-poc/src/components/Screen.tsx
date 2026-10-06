import Link from "next/link";
import type { ReactNode } from "react";

/** A main screen's column: room for the tab bar at the bottom, and for an ActionBar when `actions` is set. */
export function Screen({ children, actions = false, className = "" }: { children: ReactNode; actions?: boolean; className?: string }) {
  return (
    <main className={`mx-auto w-full max-w-[34rem] pt-[max(0.5rem,env(safe-area-inset-top))] ${actions ? "pb-52" : "pb-32"} ${className}`}>{children}</main>
  );
}

/** The screen's main actions, floating above the tab bar on a fade so content scrolls out underneath. */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 z-20 bg-linear-to-b from-transparent to-mist to-35%" style={{ bottom: "var(--tabbar-height)" }}>
      <div className="pointer-events-auto mx-auto flex w-full max-w-[34rem] gap-2.5 px-4 pt-4 pb-3">{children}</div>
    </div>
  );
}

/** Screen title, with a back arrow when the screen sits under another one and a line of detail under it. */
export function ScreenHeader({ title, detail, back, children }: { title: string; detail?: string; back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <div className={`flex items-center gap-1 pt-2 pr-4 ${back ? "pl-1.5" : "pl-5"}`}>
      {back && (
        <Link href={back.href} aria-label={back.label} className="grid size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-track">
          <svg viewBox="0 0 24 24" aria-hidden className="size-[1.375rem]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="m-0 text-xl font-extrabold tracking-[-0.02em]">{title}</h1>
        {detail && <p className="m-0 text-xs text-ink-soft">{detail}</p>}
      </div>
      {children}
    </div>
  );
}

/**
 * A titled group, then (usually) one card. `label` is the small grey heading of a
 * settings group; `title` is the heavier heading of a block of content.
 */
export function Section({ title, children, id, kind = "label", className = "" }: { title: string; children: ReactNode; id?: string; kind?: "label" | "title"; className?: string }) {
  const titleId = `${id ?? title.toLowerCase().replaceAll(/[^a-z]+/g, "-")}-title`;
  return (
    <section aria-labelledby={titleId} id={id} className={className}>
      <h2 id={titleId} className={`m-0 px-5 pt-[1.375rem] pb-2 font-bold ${kind === "label" ? "text-xs text-ink-soft" : "text-lg"}`}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export const cardClass = "mx-4 rounded-card border border-rule bg-paper";
