"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today", icon: "M4 11l8-6.5 8 6.5V20h-5v-5.5H9V20H4z", also: [] as string[] },
  { href: "/history", label: "This week", icon: "M5 20V12M12 20V5M19 20v-9", also: [] },
  { href: "/sleep", label: "Sleep", icon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z", also: [] },
  {
    href: "/settings",
    label: "Settings",
    icon: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6",
    // Manage products is reached from Settings.
    also: ["/admin"],
  },
] as const;

/** The four main screens, fixed to the bottom. Shown only on those screens (and Manage products). */
export function TabBar() {
  const path = usePathname() ?? "";
  const current = TABS.find((tab) => tab.href === path || (tab.also as readonly string[]).includes(path));
  if (!current) return null;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <ul className="m-0 mx-auto grid max-w-[34rem] list-none grid-cols-4 p-0">
        {TABS.map((tab) => {
          const selected = tab === current;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={selected ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-1 rounded-control no-underline ${selected ? "text-synapse-ink" : "text-ink-soft hover:text-ink"}`}
              >
                <span className={`grid h-[1.875rem] w-14 place-items-center rounded-pill ${selected ? "bg-synapse-soft" : ""}`}>
                  <svg viewBox="0 0 24 24" aria-hidden className="size-[1.375rem]" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d={tab.icon} />
                  </svg>
                </span>
                <span className="text-3xs font-bold">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
