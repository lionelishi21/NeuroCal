/**
 * The Focus Score formula, for the landing page's demo. It mirrors
 * `backend/src/domain/focusScore.ts` (ARCHITECTURE §6.8) for one imagined evening,
 * so what a visitor sees move is what the app would compute.
 */
export const WEIGHTS = { sleep: 0.4, timing: 0.2, glycemic: 0.2, stress: 0.2 } as const;
export type Part = keyof typeof WEIGHTS;

/** Feelings that lower the stress input; each one named takes a quarter off it. */
export const NEGATIVE_FLAGS = ["stressed", "brain_fog", "low_focus", "wired"] as const;

export interface Evening {
  /** Clock hours, 24-hour, e.g. 21.75 for 21:45. Dinner is between 18:00 and midnight. */
  dinner: number;
  /** Bedtime in clock hours; after midnight it is small (0.5 for 00:30). */
  bedtime: number;
  wake: number;
  /** Minutes on screens after 22:00. */
  screens: number;
  /** Share of the day's calories from high-glycemic food, 0–1. */
  highGlycemicShare: number;
  flags: readonly string[];
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function sleepMinutes({ bedtime, wake }: Pick<Evening, "bedtime" | "wake">): number {
  return Math.round((((wake - bedtime) % 24) + 24) % 24 * 60);
}

export function parts(evening: Evening): Record<Part, number> {
  const lateEating = Math.max(0, (evening.dinner - 21) * 60);
  const negatives = new Set(evening.flags.filter((flag) => (NEGATIVE_FLAGS as readonly string[]).includes(flag)));
  return {
    sleep: clamp01(sleepMinutes(evening) / 480),
    timing: clamp01(1 - clamp01(lateEating / 120) - 0.5 * clamp01(evening.screens / 120)),
    glycemic: clamp01(1 - evening.highGlycemicShare),
    stress: clamp01(1 - 0.25 * negatives.size),
  };
}

export function score(values: Record<Part, number>): number {
  return Math.round(100 * (Object.keys(WEIGHTS) as Part[]).reduce((sum, part) => sum + WEIGHTS[part] * values[part], 0));
}

/** The input taking the most points off, and how many; null when nothing takes a whole point. */
export function biggestDrag(values: Record<Part, number>): { part: Part; points: number } | null {
  const [part, points] = (Object.keys(WEIGHTS) as Part[])
    .map((key) => [key, Math.round(100 * WEIGHTS[key] * (1 - values[key]))] as const)
    .sort((a, b) => b[1] - a[1])[0]!;
  return points >= 1 ? { part, points } : null;
}

/** 21.75 → "21:45"; wraps past midnight. */
export function clock(hours: number): string {
  const h = ((hours % 24) + 24) % 24;
  const whole = Math.floor(h);
  return `${String(whole).padStart(2, "0")}:${String(Math.round((h - whole) * 60)).padStart(2, "0")}`;
}
