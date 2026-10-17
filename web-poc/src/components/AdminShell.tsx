"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useOptionalAuth } from "../auth/AuthProvider";
import { LogoMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/waitlist", label: "Waitlist" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/knowledge", label: "Knowledge" },
  { href: "/admin/devices", label: "Devices" },
  { href: "/app", label: "App preview" },
] as const;

/**
 * The admin area's frame: a website header with the admin pages, the signed-in account and sign
 * out, then the page at desktop width. The consumer screens stay phone-shaped under "App preview".
 */
export function AdminShell({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: ReactNode;
  children: ReactNode;
}) {
  const path = usePathname() ?? "";
  const auth = useOptionalAuth();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-rule bg-mist/90 backdrop-blur-md">
        <div className="mx-auto flex h-[4.25rem] w-full max-w-[73.75rem] items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/admin"
            className="flex shrink-0 items-center gap-2 text-ink no-underline"
          >
            <LogoMark className="size-7" />
            <span className="text-xl font-extrabold tracking-[-0.025em]">
              NeuroCal
            </span>
            <span className="rounded-pill bg-synapse-soft px-2.5 py-0.5 text-2xs font-bold text-synapse-ink">
              Admin
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {auth?.user?.email && (
              <span className="hidden text-sm text-ink-soft md:inline">
                {auth.user.email}
              </span>
            )}
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <button
              type="button"
              onClick={() => auth?.signOut()}
              className="h-10 cursor-pointer rounded-pill border whitespace-nowrap border-rule bg-paper px-4 text-sm font-bold text-ink hover:border-rule-strong"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav
          aria-label="Admin"
          className="mx-auto w-full max-w-[73.75rem] overflow-x-auto px-2 sm:px-4"
        >
          <ul className="m-0 flex list-none gap-1 p-0">
            {LINKS.map((link) => {
              const current =
                link.href === "/admin"
                  ? path === "/admin"
                  : path.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className={`inline-flex h-11 items-center border-b-2 px-3 text-sm font-bold whitespace-nowrap no-underline ${current ? "border-synapse text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main
        className="mx-auto w-full max-w-[73.75rem] flex-1 px-4 py-8 sm:px-6 sm:py-10"
        style={{ animation: "enter var(--duration-step) var(--ease-settle)" }}
      >
        <h1 className="m-0 text-3xl leading-[1.12] font-extrabold tracking-[-0.025em]">
          {title}
        </h1>
        {detail && (
          <p className="mt-2 mb-0 text-base text-pretty text-ink-soft">
            {detail}
          </p>
        )}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}

/** A white card for admin pages, with an optional heading and a link at its top right. */
export function AdminCard({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={`rounded-card border border-rule bg-paper p-5 sm:p-6 ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="m-0 text-lg font-extrabold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** One number on the dashboard: what it counts, the count, and a line of context. */
export function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-rule bg-paper p-5">
      <p className="m-0 text-sm font-bold text-ink-soft">{label}</p>
      <p className="mt-2 mb-0 text-heading leading-none font-extrabold tracking-[-0.03em] tabular-nums">
        {value}
      </p>
      {note && <p className="mt-2 mb-0 text-xs text-ink-soft">{note}</p>}
    </div>
  );
}
