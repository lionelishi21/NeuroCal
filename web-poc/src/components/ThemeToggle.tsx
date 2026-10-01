"use client";

import { useEffect, useState } from "react";
import { applyTheme, readTheme, type ThemeChoice } from "../lib/theme";

const options: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Auto / Light / Dark. "Auto" follows the device setting. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => setChoice(readTheme()), []);

  return (
    <div role="group" aria-label="Colour mode" className={`inline-flex gap-0.5 rounded-pill bg-paper p-0.5 ring-1 ring-rule ring-inset ${className}`}>
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={choice === value}
          onClick={() => {
            applyTheme(value);
            setChoice(value);
          }}
          className={`cursor-pointer rounded-pill px-2.5 py-1 text-xs font-semibold ${
            choice === value ? "bg-synapse text-on-accent" : "text-ink-soft hover:text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
