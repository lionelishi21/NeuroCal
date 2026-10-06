/** "system" follows the device; the others pin tokens.css to one palette via <html data-theme>. */
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** The short names, for the compact switch on the sign-in screens. */
export const themeLabel: Record<Theme, string> = { system: "Auto", light: "Light", dark: "Dark" };

/** Settings has room to say what "Auto" does. In the order Settings shows them. */
export const THEME_CHOICES: readonly (readonly [Theme, string])[] = [
  ["light", "Light"],
  ["dark", "Dark"],
  ["system", "Match device"],
];

export const THEME_KEY = "neurocal-theme";

/** The saved choice. Storage can be blocked (private windows), so it falls back to "system". */
export function storedTheme(): Theme {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
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
    if (theme === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // The choice still applies until the page is reloaded.
  }
}

/** Runs before first paint (inlined in <head>) so a saved choice never flashes the other palette. */
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
