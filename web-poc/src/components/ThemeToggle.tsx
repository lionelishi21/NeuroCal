"use client";

import { useEffect, useState } from "react";
import { THEMES, type Theme, saveTheme, storedTheme, themeLabel } from "../lib/theme";

/** Compact appearance switch for screens outside Settings (sign-in). Same choices and names as Settings. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => setTheme(storedTheme()), []);

  return (
    <div role="group" aria-label="Appearance" className={`inline-flex rounded-pill bg-track p-[3px] ${className}`}>
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={theme === option}
          onClick={() => {
            saveTheme(option);
            setTheme(option);
          }}
          className={`h-[2.375rem] min-w-11 cursor-pointer rounded-pill px-2.5 text-xs font-semibold whitespace-nowrap transition-colors duration-200 ${
            theme === option ? "bg-paper text-ink shadow-[0_1px_3px_var(--shade)]" : "text-ink-soft hover:text-ink"
          }`}
        >
          {themeLabel[option]}
        </button>
      ))}
    </div>
  );
}
