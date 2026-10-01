"use client";

import { useEffect, useState } from "react";
import { THEMES, type Theme, saveTheme, storedTheme, themeLabel } from "../lib/theme";

/** Compact appearance switch for screens outside Settings (sign-in). Same choices and names as Settings. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => setTheme(storedTheme()), []);

  return (
    <div role="group" aria-label="Appearance" className={`inline-flex gap-0.5 rounded-pill bg-paper p-0.5 ring-1 ring-rule ring-inset ${className}`}>
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={theme === option}
          onClick={() => {
            saveTheme(option);
            setTheme(option);
          }}
          className={`cursor-pointer rounded-pill px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
            theme === option ? "bg-synapse text-on-accent" : "text-ink-soft hover:text-ink"
          }`}
        >
          {themeLabel[option]}
        </button>
      ))}
    </div>
  );
}
