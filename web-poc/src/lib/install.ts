/** Chromium's install prompt event; not in the DOM typings. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let pending: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((notify) => notify());

/**
 * Keeps the browser's install prompt for the "Install NeuroCal" button in
 * Settings. The event can fire long before that screen opens, so this is
 * called once when the app starts.
 */
export function watchInstallPrompt() {
  const keep = (event: Event) => {
    event.preventDefault();
    pending = event as InstallPromptEvent;
    changed();
  };
  const clear = () => {
    pending = null;
    changed();
  };
  window.addEventListener("beforeinstallprompt", keep);
  window.addEventListener("appinstalled", clear);
  return () => {
    window.removeEventListener("beforeinstallprompt", keep);
    window.removeEventListener("appinstalled", clear);
  };
}

export const canInstall = () => pending !== null;

export function subscribeToInstall(notify: () => void) {
  listeners.add(notify);
  return () => void listeners.delete(notify);
}

/** Shows the browser's install dialog. Resolves true when the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = pending;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  // A prompt can only be used once.
  pending = null;
  changed();
  return outcome === "accepted";
}

/** True when already running as an installed app. */
export const isInstalled = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);

/** iPhone and iPad have no install prompt; people add the app from the Share menu. */
export const isIos = () => typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
