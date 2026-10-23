import { isOnLocalDay, localDateOf, localTimeOf, previousDate } from "./localDay";
import { mealCalories } from "./meal";
import { type EnvironmentCheck, environmentSignal } from "./environment";
import type { CheckIn, CognitiveFlag, FocusComponents, Meal, ScreenTimeSample, SleepSession } from "./types";

/**
 * Focus Score v0 (ARCHITECTURE §6.8): a deterministic weighted formula. The AI
 * only explains it. Weights are a proposal to validate against real data.
 *
 * The score for day D is a morning baseline:
 *   sleep    ← sessions that ended on D
 *   timing   ← last meal of D−1 after 21:00, screen time on the evening of D−1 (22:00–04:00),
 *              plus a bonus for keeping the fasting window overnight (v1)
 *   glycemic ← share of D−1 calories from high-glycemic-load items
 *   stress   ← negative flags in check-ins on D−1 and D
 *   movement ← exercise on D−1, for people who log exercise (v1)
 *   environment ← the air where you live on D−1 and that day's environment check (v1.1)
 *
 * v1 (docs/NCBM.md §3.2) adds movement and fasting, and tunes the weights to each person once
 * their Brain speed checks show which inputs actually move their reaction time.
 */
export const FOCUS_MODEL_VERSION = "v1.1";

export const FOCUS_WEIGHTS: FocusWeights = {
  sleep: 0.3,
  timing: 0.2,
  glycemic: 0.15,
  stress: 0.15,
  movement: 0.1,
  environment: 0.1,
};

export type FocusWeights = Record<keyof FocusComponents, number>;

/** [weights] with one input set to [value], the others scaled so they still add up to 1. */
export function withWeight(weights: FocusWeights, input: keyof FocusWeights, value: number): FocusWeights {
  const rest = 1 - weights[input];
  const scale = rest > 0 ? (1 - value) / rest : 0;
  const out = { ...weights };
  for (const k of Object.keys(out) as (keyof FocusWeights)[]) out[k] = k === input ? value : weights[k] * scale;
  return out;
}

const TARGET_SLEEP_MIN = 480;
const TARGET_DEEP_MIN = 90;
const LATE_EATING_FROM_HOUR = 21;
const LATE_SCREEN_FROM_HOUR = 22;
const LATE_SCREEN_UNTIL_HOUR = 4;
/** The feelings that lower the score: everything but sharp and calm. Low energy is the slump it exists to catch. */
const NEGATIVE_FLAGS: CognitiveFlag[] = ["stressed", "brain_fog", "low_focus", "low_energy", "wired"];

export interface FocusInputs {
  date: string;
  timeZone: string;
  /** Sessions that ended on `date`. */
  sleep: SleepSession[];
  /** Meals on the previous day. */
  previousDayMeals: Meal[];
  /** Samples starting on the previous day or on `date`; filtered to the late evening here. */
  screenTime: ScreenTimeSample[];
  /** Caffeine after the curfew on the previous day; absent when no coffee was logged that day. */
  previousDayLateCaffeineMg?: number;
  /** Check-ins on the previous day and on `date`. */
  checkIns: CheckIn[];
  /** Exercise on the previous day. */
  previousDayExercise?: { minutes: number; intensity: "light" | "moderate" | "hard" }[];
  /** Any exercise logged in the week before `date`: without it, movement has no data. */
  logsExercise?: boolean;
  /** Hours of the fasting protocol in force; absent when fasting is off. */
  fastHours?: number;
  /** Meals on `date`, for the overnight fast (the first one ends it). */
  todayMeals?: Meal[];
  /** The previous day's air (US AQI) and environment check. */
  environment?: { aqi: number | null; check: EnvironmentCheck | null };
  /** The previous day's glucose-sensor summary, already scored 0–1 (domain/glucose.ts); replaces the meal estimate. */
  previousDayGlucose?: number;
}

/** Exercise minutes count by effort: a hard 15 minutes is worth a moderate 30. */
const EFFORT = { light: 0.5, moderate: 1, hard: 2 } as const;
/** About the daily share of the 150 moderate minutes a week adults are advised to get. */
const TARGET_MOVE_MIN = 30;
/** Added to evening timing when the overnight fast reached the protocol's hours. */
const FAST_KEPT_BONUS = 0.15;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Total minutes covered by the sessions, counting overlaps (e.g. a watch and a manual entry) once. */
export function sleepMinutes(sessions: SleepSession[]): number {
  const sorted = [...sessions].sort((a, b) => a.start.getTime() - b.start.getTime());
  let total = 0;
  let coveredUntil = -Infinity;
  for (const s of sorted) {
    const start = Math.max(s.start.getTime(), coveredUntil);
    const end = s.end.getTime();
    if (end > start) total += (end - start) / 60_000;
    coveredUntil = Math.max(coveredUntil, end);
  }
  return total;
}

export function sleepComponent(sessions: SleepSession[]): number | null {
  if (sessions.length === 0) return null;
  const total = sleepMinutes(sessions);
  const duration = clamp01(total / TARGET_SLEEP_MIN);
  const allHaveDeep = sessions.every((s) => s.deepMinutes !== undefined);
  if (!allHaveDeep) return duration;
  const deep = sessions.reduce((sum, s) => sum + (s.deepMinutes ?? 0), 0);
  return 0.7 * duration + 0.3 * clamp01(deep / TARGET_DEEP_MIN);
}

/** Screen minutes on the evening before `date` (22:00–04:00), or null when nothing was recorded for it. */
export function lateScreenMinutes(inputs: FocusInputs): number | null {
  const previous = previousDate(inputs.date);
  const late = inputs.screenTime.filter((s) => {
    const day = localDateOf(s.windowStart, inputs.timeZone);
    const { hour } = localTimeOf(s.windowStart, inputs.timeZone);
    return (day === previous && hour >= LATE_SCREEN_FROM_HOUR) || (day === inputs.date && hour < LATE_SCREEN_UNTIL_HOUR);
  });
  return late.length ? late.reduce((sum, s) => sum + s.minutes, 0) : null;
}

export function timingComponent(inputs: FocusInputs): number | null {
  const recorded = lateScreenMinutes(inputs);
  const lateScreen = recorded ?? 0;
  // Only that evening's samples count as data: daytime screen time says nothing about timing.
  const hasScreen = recorded !== null;
  const hasMeals = inputs.previousDayMeals.length > 0;
  const lateCaffeine = inputs.previousDayLateCaffeineMg;
  if (!hasScreen && !hasMeals && lateCaffeine === undefined) return null;

  let lateEating = 0;
  for (const meal of inputs.previousDayMeals) {
    const { hour, minute } = localTimeOf(meal.eatenAt, inputs.timeZone);
    lateEating = Math.max(lateEating, (hour - LATE_EATING_FROM_HOUR) * 60 + minute);
  }
  // A cup of coffee after the curfew costs as much as an hour of late screens.
  const caffeine = 0.3 * clamp01((lateCaffeine ?? 0) / 95);
  return clamp01(1 - clamp01(lateEating / 120) - 0.5 * clamp01(lateScreen / 120) - caffeine + (keptFast(inputs) ? FAST_KEPT_BONUS : 0));
}

/** The overnight fast from the last meal of D−1 to the first meal of D reached the protocol's hours. */
export function keptFast(inputs: FocusInputs): boolean {
  if (!inputs.fastHours || inputs.previousDayMeals.length === 0 || !inputs.todayMeals?.length) return false;
  const last = Math.max(...inputs.previousDayMeals.map((m) => m.eatenAt.getTime()));
  const first = Math.min(...inputs.todayMeals.map((m) => m.eatenAt.getTime()));
  return first - last >= inputs.fastHours * 3_600_000;
}

/** Yesterday's exercise against 30 moderate minutes; null for people who haven't logged any lately. */
export function movementComponent(inputs: FocusInputs): number | null {
  if (!inputs.logsExercise) return null;
  const minutes = (inputs.previousDayExercise ?? []).reduce((sum, e) => sum + e.minutes * EFFORT[e.intensity], 0);
  return clamp01(minutes / TARGET_MOVE_MIN);
}

export function glycemicComponent(meals: Meal[]): number | null {
  const total = meals.reduce((sum, m) => sum + mealCalories(m), 0);
  if (total <= 0) return null;
  const high = meals
    .flatMap((m) => m.items)
    .filter((i) => i.glycemicLoad === "high")
    .reduce((sum, i) => sum + i.calories, 0);
  return clamp01(1 - high / total);
}

export function stressComponent(checkIns: CheckIn[]): number | null {
  if (checkIns.length === 0) return null;
  const negatives = new Set(checkIns.flatMap((c) => c.flags).filter((f) => NEGATIVE_FLAGS.includes(f)));
  return clamp01(1 - 0.25 * negatives.size);
}

export function computeFocusComponents(inputs: FocusInputs): FocusComponents {
  const round = (n: number | null) => (n === null ? null : round2(n));
  return {
    sleep: round(sleepComponent(inputs.sleep)),
    timing: round(timingComponent(inputs)),
    glycemic: round(inputs.previousDayGlucose ?? glycemicComponent(inputs.previousDayMeals)),
    stress: round(stressComponent(inputs.checkIns)),
    movement: round(movementComponent(inputs)),
    environment: inputs.environment ? environmentSignal(inputs.environment.aqi, inputs.environment.check) : null,
  };
}

/** Weighted average of the components that have data, renormalised; null when none do. */
export function focusScoreFrom(components: FocusComponents, weightsFor: FocusWeights = FOCUS_WEIGHTS): number | null {
  let weighted = 0;
  let weights = 0;
  for (const key of Object.keys(weightsFor) as (keyof FocusComponents)[]) {
    const value = components[key];
    if (value === null || value === undefined) continue;
    weighted += weightsFor[key] * value;
    weights += weightsFor[key];
  }
  return weights === 0 ? null : Math.round((100 * weighted) / weights);
}

/** Days of a score and a Brain speed check together before the weights are tuned to a person. */
export const MIN_TUNING_DAYS = 14;
/** Days a single input needs data on before its own weight can move. */
const MIN_INPUT_DAYS = 10;

function correlation(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
    syy += (ys[i]! - my) ** 2;
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}

/**
 * The weights tuned to one person (NCBM §3.2): each input's weight moves with how closely it tracked
 * their Brain speed score on the same days, by at most half either way, and the weights still add up
 * to 1. Inputs that never vary, or have too little data, keep their standard weight. With fewer than
 * MIN_TUNING_DAYS paired days, the standard weights.
 */
export function personalWeights(days: { components: FocusComponents; brainScore: number }[]): { weights: FocusWeights; tuned: boolean } {
  if (days.length < MIN_TUNING_DAYS) return { weights: FOCUS_WEIGHTS, tuned: false };
  const raw = { ...FOCUS_WEIGHTS };
  let moved = false;
  for (const key of Object.keys(FOCUS_WEIGHTS) as (keyof FocusComponents)[]) {
    const pairs = days.filter((d) => d.components[key] !== null && d.components[key] !== undefined);
    if (pairs.length < MIN_INPUT_DAYS) continue;
    const r = correlation(
      pairs.map((d) => d.components[key]!),
      pairs.map((d) => d.brainScore),
    );
    if (r === null) continue;
    raw[key] = FOCUS_WEIGHTS[key] * (1 + Math.max(-0.5, Math.min(0.5, r)));
    moved = true;
  }
  if (!moved) return { weights: FOCUS_WEIGHTS, tuned: false };
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  const weights = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Math.round((v / total) * 1000) / 1000])) as FocusWeights;
  return { weights, tuned: true };
}

const PHRASES: Record<keyof FocusComponents, string> = {
  sleep: "Last night's sleep",
  timing: "Late eating, screens or caffeine last night",
  glycemic: "Yesterday's high-glycemic food",
  stress: "How you've been feeling",
  movement: "Too little movement yesterday",
  environment: "Yesterday's air and surroundings",
};

/**
 * Said instead of any other explanation while sleep, the biggest input, is missing: the score then
 * comes from the other inputs alone and can read higher than the day really is.
 */
export const SLEEP_MISSING = "Sleep isn't in yet, so this score is from your other inputs so far. Log last night's sleep to complete it.";

/** Plain explanation used when the AI explanation is unavailable. */
export function fallbackExplanation(score: number | null, components: FocusComponents): string {
  if (score === null) return "Log last night's sleep or a check-in to get today's Focus Score.";
  if (components.sleep === null) return SLEEP_MISSING;
  const known = (Object.keys(components) as (keyof FocusComponents)[]).filter((k) => components[k] !== null);
  const weakest = known.reduce((a, b) => (components[b]! < components[a]! ? b : a));
  if (components[weakest]! >= 0.8) return "Every input looks good today. Keep the same rhythm.";
  return `${PHRASES[weakest]} is pulling your score down the most today.`;
}

/** True when the sleep session ended on the local day. */
export const endedOn = (s: SleepSession, date: string, timeZone: string) => isOnLocalDay(s.end, { date, timeZone });
