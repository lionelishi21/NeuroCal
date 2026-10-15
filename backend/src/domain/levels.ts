/**
 * Biohacking levels (docs/NCBM.md §8): a ladder from 1 (Aware) to 5 (Upgraded), earned by habits
 * kept over the last 28 days, never by buying anything. Each level needs every level below it.
 */

export const LEVEL_WINDOW_DAYS = 28;

export const LEVEL_NAMES = ["Getting started", "Aware", "Fuelled", "In rhythm", "Recovered", "Upgraded"] as const;

/** One day of the window, as the levels read it. Null means no data that day. */
export interface LevelDay {
  foodLogged: boolean;
  sleepLogged: boolean;
  /** Calories graded ultra-processed, and all graded calories (items typed in by hand aren't graded). */
  ultraKcal: number;
  gradedKcal: number;
  /** Protein eaten over the target, when food was logged. */
  proteinRatio: number | null;
  /** Focus Score inputs for the day, 0–1. */
  timing: number | null;
  sleep: number | null;
  stress: number | null;
  movement: number | null;
  /** The overnight fast reached the plan's hours; null when fasting is off or it can't be told. */
  keptFast: boolean | null;
}

export interface BrainTrend {
  /** Median score of the checks in the last 7 days; null without any. */
  recent: number | null;
  /** The person's usual; null until there are enough checks. */
  usual: number | null;
}

export interface LevelRequirement {
  level: number;
  title: string;
  met: boolean;
  /** Where they are now, in plain words. */
  progress: string;
}

export interface LevelResult {
  level: number;
  name: string;
  requirements: LevelRequirement[];
}

const GOOD = 0.75;
/** Days with data an average needs before it says anything. */
const MIN_DAYS = 10;
/** "Most days" for logging: half the window. */
const MOST_DAYS = 14;
/** "5 nights a week". */
const SHARE_OF_NIGHTS = 5 / 7;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const known = <T>(xs: (T | null)[]) => xs.filter((x): x is T => x !== null);

/** A good-enough average over days with data, with what's missing said plainly. */
function average(label: string, values: (number | null)[]): { met: boolean; progress: string } {
  const have = known(values);
  if (have.length < MIN_DAYS) return { met: false, progress: `${label}: ${have.length} of ${MIN_DAYS} days with data so far` };
  const a = avg(have)!;
  return { met: a >= GOOD, progress: `${label} averages ${Math.round(a * 100)} (needs ${GOOD * 100})` };
}

export function levelOf(days: LevelDay[], brain: BrainTrend): LevelResult {
  const food = days.filter((d) => d.foodLogged).length;
  const slept = days.filter((d) => d.sleepLogged).length;

  const graded = days.reduce((s, d) => s + d.gradedKcal, 0);
  const ultraShare = graded > 0 ? days.reduce((s, d) => s + d.ultraKcal, 0) / graded : null;
  const protein = avg(known(days.map((d) => d.proteinRatio)));

  const timed = known(days.map((d) => d.timing));
  const onTime = timed.filter((t) => t >= GOOD).length;
  const fasts = known(days.map((d) => d.keptFast));
  const fastsKept = fasts.filter(Boolean).length;

  const sleep = average("Sleep", days.map((d) => d.sleep));
  const stress = average("Stress", days.map((d) => d.stress));
  const movement = average("Movement", days.map((d) => d.movement));

  const requirements: LevelRequirement[] = [
    { level: 1, title: "Log food on most days", met: food >= MOST_DAYS, progress: `${food} of the last ${LEVEL_WINDOW_DAYS} days (needs ${MOST_DAYS})` },
    { level: 1, title: "Log sleep on most nights", met: slept >= MOST_DAYS, progress: `${slept} of the last ${LEVEL_WINDOW_DAYS} nights (needs ${MOST_DAYS})` },
    {
      level: 2,
      title: "Keep ultra-processed food under 20%",
      met: ultraShare !== null && ultraShare < 0.2,
      progress: ultraShare === null ? "No graded food yet: snap or scan your meals" : `${pct(ultraShare)} of graded calories were ultra-processed`,
    },
    {
      level: 2,
      title: "Get near your protein target",
      met: protein !== null && protein >= 0.8,
      progress: protein === null ? "No food logged yet" : `${pct(protein)} of your protein target on average (needs 80%)`,
    },
    {
      level: 3,
      title: "Eat and switch off screens on time, 5 nights a week",
      met: timed.length >= MIN_DAYS && onTime / timed.length >= SHARE_OF_NIGHTS,
      progress:
        timed.length < MIN_DAYS
          ? `${timed.length} of ${MIN_DAYS} evenings with data so far`
          : `On time ${onTime} of ${timed.length} evenings (needs 5 in 7)`,
    },
    ...(fasts.length > 0
      ? [
          {
            level: 3,
            title: "Keep your fasting window, 5 days a week",
            met: fasts.length >= MIN_DAYS && fastsKept / fasts.length >= SHARE_OF_NIGHTS,
            progress: fasts.length < MIN_DAYS ? `${fasts.length} of ${MIN_DAYS} fasts with data so far` : `Kept ${fastsKept} of ${fasts.length} fasts (needs 5 in 7)`,
          },
        ]
      : []),
    { level: 4, title: "Sleep well most nights", ...sleep },
    { level: 4, title: "Keep stress low", ...stress },
    {
      level: 4,
      title: "Brain speed at or above your usual",
      met: brain.recent !== null && brain.usual !== null && brain.recent >= brain.usual,
      progress:
        brain.usual === null
          ? "Do the Brain speed check a few more times to set your usual"
          : brain.recent === null
            ? `No check this week (your usual is ${brain.usual})`
            : `This week ${brain.recent}, your usual ${brain.usual}`,
    },
    { level: 5, title: "Move most days", ...movement },
  ];

  let level = 0;
  for (let l = 1; l <= 5; l++) {
    if (!requirements.filter((r) => r.level === l).every((r) => r.met)) break;
    level = l;
  }
  return { level, name: LEVEL_NAMES[level]!, requirements };
}
