import { isOnLocalDay, localDateOf, localTimeOf, previousDate } from "./localDay";
import { mealCalories } from "./meal";
import type { CheckIn, CognitiveFlag, FocusComponents, Meal, ScreenTimeSample, SleepSession } from "./types";

/**
 * Focus Score v0 (ARCHITECTURE §6.8): a deterministic weighted formula. The AI
 * only explains it. Weights are a proposal to validate against real data.
 *
 * The score for day D is a morning baseline:
 *   sleep    ← sessions that ended on D
 *   timing   ← last meal of D−1 after 21:00, screen time on the evening of D−1 (22:00–04:00)
 *   glycemic ← share of D−1 calories from high-glycemic-load items
 *   stress   ← negative flags in check-ins on D−1 and D
 */
export const FOCUS_MODEL_VERSION = "v0";

export const FOCUS_WEIGHTS: Record<keyof FocusComponents, number> = {
  sleep: 0.4,
  timing: 0.2,
  glycemic: 0.2,
  stress: 0.2,
};

const TARGET_SLEEP_MIN = 480;
const TARGET_DEEP_MIN = 90;
const LATE_EATING_FROM_HOUR = 21;
const LATE_SCREEN_FROM_HOUR = 22;
const LATE_SCREEN_UNTIL_HOUR = 4;
const NEGATIVE_FLAGS: CognitiveFlag[] = ["stressed", "brain_fog", "low_focus", "wired"];

export interface FocusInputs {
  date: string;
  timeZone: string;
  /** Sessions that ended on `date`. */
  sleep: SleepSession[];
  /** Meals on the previous day. */
  previousDayMeals: Meal[];
  /** Samples starting on the previous day or on `date`; filtered to the late evening here. */
  screenTime: ScreenTimeSample[];
  /** Check-ins on the previous day and on `date`. */
  checkIns: CheckIn[];
}

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
  if (!hasScreen && !hasMeals) return null;

  let lateEating = 0;
  for (const meal of inputs.previousDayMeals) {
    const { hour, minute } = localTimeOf(meal.eatenAt, inputs.timeZone);
    lateEating = Math.max(lateEating, (hour - LATE_EATING_FROM_HOUR) * 60 + minute);
  }
  return clamp01(1 - clamp01(lateEating / 120) - 0.5 * clamp01(lateScreen / 120));
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
    glycemic: round(glycemicComponent(inputs.previousDayMeals)),
    stress: round(stressComponent(inputs.checkIns)),
  };
}

/** Weighted average of the components that have data, renormalised; null when none do. */
export function focusScoreFrom(components: FocusComponents): number | null {
  let weighted = 0;
  let weights = 0;
  for (const key of Object.keys(FOCUS_WEIGHTS) as (keyof FocusComponents)[]) {
    const value = components[key];
    if (value === null) continue;
    weighted += FOCUS_WEIGHTS[key] * value;
    weights += FOCUS_WEIGHTS[key];
  }
  return weights === 0 ? null : Math.round((100 * weighted) / weights);
}

const PHRASES: Record<keyof FocusComponents, string> = {
  sleep: "Last night's sleep",
  timing: "Late eating or screen time last night",
  glycemic: "Yesterday's high-glycemic food",
  stress: "How you've been feeling",
};

/** Plain explanation used when the AI explanation is unavailable. */
export function fallbackExplanation(score: number | null, components: FocusComponents): string {
  if (score === null) return "Log last night's sleep or a check-in to get today's Focus Score.";
  const known = (Object.keys(components) as (keyof FocusComponents)[]).filter((k) => components[k] !== null);
  const weakest = known.reduce((a, b) => (components[b]! < components[a]! ? b : a));
  if (components[weakest]! >= 0.8) return "Every input looks good today. Keep the same rhythm.";
  return `${PHRASES[weakest]} is pulling your score down the most today.`;
}

/** True when the sleep session ended on the local day. */
export const endedOn = (s: SleepSession, date: string, timeZone: string) => isOnLocalDay(s.end, { date, timeZone });
