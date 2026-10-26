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

/**
 * A new level: when someone's usual has moved and stayed moved, as after starting a nootropic that kept
 * working, or a run of better sleep. The last four weeks' median against the four weeks before; a
 * change of at least LEVEL_CHANGE points counts once at least two of the recent weeks sit past halfway
 * to it. The first week of checks is left out: people can be a little slow while they get used to it.
 * The daily score compares each check with the usual, so the new level becomes the new normal there;
 * this is where the change itself is shown.
 */
export const LEVEL_CHANGE = 5;
const WEEK_MS = 7 * 86_400_000;
const MIN_WINDOW_CHECKS = 5;

export interface LevelChange {
  direction: "up" | "down";
  /** The usual before, and now. */
  from: number;
  to: number;
  /** Start of the earliest recent week at the new level. */
  since: Date;
  /** Recent weeks in a row, up to four, at the new level. */
  weeksHeld: number;
}

/** [checks]: any order; [firstEver]: when the person's very first check was, if known. */
export function levelChangeOf(checks: { takenAt: Date; score: number }[], now: Date, firstEver?: Date): LevelChange | null {
  const practiceUntil = firstEver ? firstEver.getTime() + WEEK_MS : -Infinity;
  const counted = checks.filter((c) => c.takenAt.getTime() >= practiceUntil);
  const t = now.getTime();
  const recent = counted.filter((c) => c.takenAt.getTime() > t - 4 * WEEK_MS);
  const prior = counted.filter((c) => c.takenAt.getTime() <= t - 4 * WEEK_MS && c.takenAt.getTime() > t - 8 * WEEK_MS);
  if (recent.length < MIN_WINDOW_CHECKS || prior.length < MIN_WINDOW_CHECKS) return null;
  const from = Math.round(median(prior.map((c) => c.score)));
  const to = Math.round(median(recent.map((c) => c.score)));
  if (Math.abs(to - from) < LEVEL_CHANGE) return null;
  const up = to > from;
  const halfway = from + (to - from) / 2;
  // Weeks back from now: count the run, newest first, of weeks with checks sitting past halfway.
  let weeksHeld = 0;
  let since = now;
  for (let w = 0; w < 4; w++) {
    const end = t - w * WEEK_MS;
    const week = recent.filter((c) => c.takenAt.getTime() > end - WEEK_MS && c.takenAt.getTime() <= end).map((c) => c.score);
    if (!week.length) continue;
    const m = median(week);
    if (up ? m < halfway : m > halfway) break;
    weeksHeld++;
    since = new Date(end - WEEK_MS);
  }
  return weeksHeld >= 2 ? { direction: up ? "up" : "down", from, to, since, weeksHeld } : null;
}
