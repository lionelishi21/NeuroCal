/** "system" follows the device; the others pin tokens.css to one palette via <html data-theme>. */
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

const KEY = "neurocal-theme";

/** The saved choice. Storage can be blocked (private windows), so it falls back to "system". */
export function storedTheme(): Theme {
  try {
    const value = window.localStorage.getItem(KEY);
    return THEMES.includes(value as Theme) ? (value as Theme) : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function saveTheme(theme: Theme) {
  applyTheme(theme);
  try {
    if (theme === "system") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, theme);
  } catch {
    // The choice still applies until the page is reloaded.
  }
}
