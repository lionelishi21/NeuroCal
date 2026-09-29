import type { FocusComponentName, FocusComponents, Product, Protocol, WeakPoint } from "./types";

/** A component averaging below this over the week counts as a weak point. */
export const WEAK_THRESHOLD = 0.75;
export const MAX_WEAK_POINTS = 2;

const LABELS: Record<FocusComponentName, string> = {
  sleep: "short or light sleep",
  timing: "late eating and late-night screens",
  glycemic: "high-glycemic meals",
  stress: "stress and low focus",
};

/** The weakest components over the period, lowest first. Components without data are ignored. */
export function weakPoints(days: FocusComponents[]): WeakPoint[] {
  const names = Object.keys(LABELS) as FocusComponentName[];
  return names
    .map((component) => {
      const values = days.map((d) => d[component]).filter((v): v is number => v !== null);
      const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      return { component, label: LABELS[component], average };
    })
    .filter((w): w is WeakPoint => w.average !== null && w.average < WEAK_THRESHOLD)
    .sort((a, b) => a.average - b.average)
    .slice(0, MAX_WEAK_POINTS)
    .map((w) => ({ ...w, average: Math.round(w.average * 100) / 100 }));
}

/** What gets embedded to search the catalog: the problems, plus what the user wants from food. */
export function needText(points: WeakPoint[], goals: string[]): string {
  const problems = points.length ? `Help with ${points.map((p) => p.label).join("; ")}.` : "Maintain steady focus, energy and sleep.";
  return goals.length ? `${problems} Goals: ${goals.join(", ")}.` : problems;
}

export const protocolText = (p: Protocol) => `${p.title}. ${p.summary} ${p.tags.join(", ")}`;
export const productText = (p: Product) => `${p.name}. ${p.description} ${p.tags.join(", ")}`;

/**
 * Hash of the whole catalog record (not just the embedded text), so edits to
 * steps, URLs or the affiliate flag are always stored. FNV-1a.
 */
export const recordHash = (item: Protocol | Product) => contentHash(JSON.stringify(item));

/** FNV-1a string hash. */
export function contentHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
