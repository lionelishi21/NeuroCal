/**
 * The fasting timer, worked out from logged meals: a fast runs from the last meal, and the eating
 * window runs from the first meal after a full fast. No separate "start fast" button to forget.
 * Drinks under FAST_SAFE_KCAL don't count as meals. A longer fast can be planned to end at a time
 * ("until noon tomorrow"); it ends early when a meal is logged.
 */
import { conditionsOf, fastingLimit } from "./conditions";
import type { Profile } from "./types";

export type FastingProtocol = "16_8" | "omad" | "12_12" | "none";

/** Hours of fasting each protocol aims for. OMAD is one meal a day: about 23 hours. */
export const FAST_HOURS: Record<Exclude<FastingProtocol, "none">, number> = { "16_8": 16, omad: 23, "12_12": 12 };

/** People who answered the safety question only get the gentlest protocol. */
export const CAUTIOUS_PROTOCOL = "12_12";

/** Water, black coffee, plain tea: anything under this many kcal doesn't break a fast. */
export const FAST_SAFE_KCAL = 10;

/** The longest fast the app lets anyone plan; longer ones are for a clinician to plan. */
export const MAX_PLANNED_FAST_HOURS = 36;

/** A fast someone chose to run until a time. `startedAt` is when they planned it. */
export interface FastPlan {
  startedAt: Date;
  until: Date;
}

/**
 * The longest fast someone may plan, in hours from their last meal: none when a health condition
 * rules fasting out, 12 at the cautious protocol, otherwise MAX_PLANNED_FAST_HOURS.
 */
export function plannedFastLimit(profile: Pick<Profile, "weightGoal" | "healthConditions">): number {
  const limit = fastingLimit(conditionsOf(profile));
  if (limit === "none") return 0;
  return limit === CAUTIOUS_PROTOCOL || profile.weightGoal?.fastingCaution ? FAST_HOURS[CAUTIOUS_PROTOCOL] : MAX_PLANNED_FAST_HOURS;
}

/** The plan while it still runs: before its end, with no meal eaten since it was made. */
export function activePlan(plan: FastPlan | null, meals: Date[], now: Date): FastPlan | null {
  if (!plan || now >= plan.until) return null;
  return meals.some((m) => m > plan.startedAt && m <= now) ? null : plan;
}

/**
 * The fasting protocol in force: the onboarding choice, capped by health conditions (none when pregnant
 * or with an eating-disorder history; 12:12 with type 1 diabetes or blood-sugar-lowering medicines) and
 * at 12:12 by the weight goal's safety answer.
 */
export function fastingProtocolOf(profile: Pick<Profile, "bioProfile" | "weightGoal" | "healthConditions">): FastingProtocol {
  const chosen = (profile.bioProfile?.fasting as FastingProtocol | undefined) ?? "none";
  if (chosen === "none") return "none";
  const limit = fastingLimit(conditionsOf(profile));
  if (limit === "none") return "none";
  return limit === CAUTIOUS_PROTOCOL || profile.weightGoal?.fastingCaution ? CAUTIOUS_PROTOCOL : chosen;
}

export type FastingState =
  /** Fasting since the last meal; the goal is not reached yet. */
  | { kind: "fasting"; since: Date; goalAt: Date }
  /** Fasted long enough: the eating window opens with the next meal. */
  | { kind: "fasted"; since: Date; goalAt: Date }
  /** Inside the eating window that started with `openedAt`; it closes at `closesAt`. */
  | { kind: "eating"; openedAt: Date; closesAt: Date }
  /** No meals logged yet, so there is nothing to time from. */
  | { kind: "unknown" };

const HOUR_MS = 3_600_000;

/**
 * Where someone is in their fast. `meals` are eating times (any order). A gap of at least the
 * fast's length ends a fast; the window then lasts 24 hours minus the fast.
 */
export function fastingState(meals: Date[], now: Date, fastHours: number): FastingState {
  const past = meals.filter((m) => m <= now).sort((a, b) => a.getTime() - b.getTime());
  const last = past.at(-1);
  if (!last) return { kind: "unknown" };
  const fast = fastHours * HOUR_MS;

  // The window opened with the first meal after the last full fast.
  let opened = last;
  for (let i = past.length - 1; i > 0; i--) {
    if (past[i]!.getTime() - past[i - 1]!.getTime() >= fast) break;
    opened = past[i - 1]!;
  }
  const closesAt = new Date(opened.getTime() + (24 - fastHours) * HOUR_MS);
  if (now < closesAt) return { kind: "eating", openedAt: opened, closesAt };

  const goalAt = new Date(last.getTime() + fast);
  return now >= goalAt ? { kind: "fasted", since: last, goalAt } : { kind: "fasting", since: last, goalAt };
}

/**
 * Days in a row, up to today, with a completed fast: a gap between meals of at least the fast's
 * length that ended (with a meal) on that day. Today counts once its fast is done; until then the
 * streak runs to yesterday.
 */
export function fastingStreak(meals: Date[], now: Date, fastHours: number, dayOf: (d: Date) => string): number {
  const past = meals.filter((m) => m <= now).sort((a, b) => a.getTime() - b.getTime());
  const fast = fastHours * HOUR_MS;
  const doneOn = new Set<string>();
  for (let i = 1; i < past.length; i++) {
    if (past[i]!.getTime() - past[i - 1]!.getTime() >= fast) doneOn.add(dayOf(past[i]!));
  }
  // A fast running now that has passed its goal counts for today too.
  const last = past.at(-1);
  if (last && now.getTime() - last.getTime() >= fast) doneOn.add(dayOf(now));

  let streak = 0;
  let day = new Date(now);
  if (!doneOn.has(dayOf(day))) day = new Date(day.getTime() - 24 * HOUR_MS);
  while (doneOn.has(dayOf(day))) {
    streak++;
    day = new Date(day.getTime() - 24 * HOUR_MS);
  }
  return streak;
}
