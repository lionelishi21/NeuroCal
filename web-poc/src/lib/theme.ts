/** The viewer's colour mode: follow the device, or force light or dark. Stored per browser. */
export type ThemeChoice = "system" | "light" | "dark";

export const THEME_KEY = "neurocal-theme";

export function readTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

/** Applies a choice to <html data-theme>, which tokens.css reads, and remembers it. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // storage blocked: the choice lasts for this page only
  }
}

/** Runs before first paint (inlined in <head>) so a saved choice never flashes the other theme. */
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
