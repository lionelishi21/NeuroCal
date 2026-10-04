const KEY = "neurocal-intro-seen";

/** True once the intro has been shown on this device. Storage can be blocked; then the intro shows each visit. */
export function introSeen(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markIntroSeen() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // The intro simply shows again next time.
  }
}
