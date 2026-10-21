/**
 * The Brain speed check: a short reaction-time test after the Psychomotor Vigilance Task (PVT),
 * which sleep and fatigue research uses because it barely improves with practice. A light appears
 * at random moments; the person taps as fast as they can. Slow responses ("lapses", 500 ms or more)
 * and taps before the light ("false starts") show a tired brain better than the average does.
 * This is a self-check for comparing your own days, not a medical test.
 */

/** Responses this slow count as lapses (the PVT's standard threshold). */
export const LAPSE_MS = 500;
/** Faster than this can't be a reaction to the light: the app counts it as a false start. */
export const MIN_REACTION_MS = 100;
export const MAX_REACTION_MS = 5_000;
export const MIN_TRIALS = 10;
export const MAX_TRIALS = 80;

export interface BrainCheckResult {
  trials: number;
  medianMs: number;
  /** The fastest 10% of responses, a measure of best-case alertness. */
  fastestMs: number;
  lapses: number;
  falseStarts: number;
  /** 0–100, higher is sharper. */
  score: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/**
 * A rested median on a phone. Lab rigs give about 250 ms; a touchscreen and its display add 50 to
 * 100 ms of their own, so a phone check is scored against 300.
 */
export const RESTED_MS = 300;

/**
 * Scores a check: 100 up to a rested median, a point off for every 4 ms slower, up to 50 off as the
 * share of lapses rises (they track sleep loss most closely), and 2 for each false start, at most 20.
 * Kept in step with drizzle/0030_rescore_brain_checks.sql, which re-scored the checks saved before.
 */
export function scoreCheck(reactionTimesMs: number[], falseStarts: number): BrainCheckResult {
  const rts = reactionTimesMs.map((x) => Math.round(x));
  const med = median(rts);
  const sorted = [...rts].sort((a, b) => a - b);
  const fastest = sorted.slice(0, Math.max(1, Math.round(sorted.length / 10)));
  const lapses = rts.filter((x) => x >= LAPSE_MS).length;
  const lapseRate = lapses / rts.length;
  const raw = 100 - Math.max(0, med - RESTED_MS) / 4 - lapseRate * 50 - Math.min(falseStarts * 2, 20);
  return {
    trials: rts.length,
    medianMs: Math.round(med),
    fastestMs: Math.round(fastest.reduce((a, b) => a + b, 0) / fastest.length),
    lapses,
    falseStarts,
    score: Math.max(0, Math.min(100, Math.round(raw))),
  };
}

/** Your usual: the median score of earlier checks, once there are at least three. */
export function baselineOf(scores: number[]): number | null {
  return scores.length >= 3 ? Math.round(median(scores)) : null;
}
