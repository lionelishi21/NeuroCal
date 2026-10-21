/**
 * Healthspan: the weekly habits behind a long, healthy life, next to the daily Focus Score. Each is
 * worked out from what's already logged (exercise, meals, sleep, the daylight tick), Monday to Sunday.
 * Targets follow the usual longevity guidance: 150 minutes of easy (zone 2) cardio and two strength
 * sessions a week, one short hard session, protein most days, little ultra-processed food, a steady
 * wake time and morning daylight.
 */
import type { HealthCondition } from "./conditions";
import type { ExerciseKind, Intensity } from "./exercise";

export const HEALTHSPAN_HABITS = ["zone2", "strength", "hard_cardio", "protein", "whole_food", "steady_wake", "daylight"] as const;
export type HealthspanHabitId = (typeof HEALTHSPAN_HABITS)[number];

export interface HealthspanHabit {
  id: HealthspanHabitId;
  title: string;
  /** Why it matters, or what counts, in a sentence. */
  detail: string;
  progress: number;
  target: number;
  /** "min", "sessions", "days", "nights", "%" */
  unit: string;
  done: boolean;
  /** Set when a health condition leaves the habit out; says why. */
  skipped?: string;
}

export interface HealthspanInputs {
  exercises: { kind: ExerciseKind; intensity: Intensity; minutes: number }[];
  /** One entry per day of the week so far with meals logged. */
  mealDays: { proteinG: number; kcal: number; ultraProcessedKcal: number; gradedKcal: number }[];
  proteinTargetG: number;
  /** Each night's wake time, minutes after midnight (local). */
  wakeMinutes: number[];
  daylightDays: number;
  conditions: readonly HealthCondition[];
}

/** Easy, conversational effort: brisk walks, easy rides, swims and runs. */
function isZone2(e: HealthspanInputs["exercises"][number]): boolean {
  switch (e.kind) {
    case "walk":
      return e.intensity !== "light";
    case "cycle":
    case "swim":
      return e.intensity !== "hard";
    case "run":
    case "sport":
      return e.intensity === "light";
    case "other":
      return e.intensity === "moderate";
    default:
      return false;
  }
}

function isHard(e: HealthspanInputs["exercises"][number]): boolean {
  return e.kind === "hiit" || (e.intensity === "hard" && ["run", "cycle", "swim", "sport", "other"].includes(e.kind));
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

export function healthspanWeek(w: HealthspanInputs): HealthspanHabit[] {
  const zone2 = w.exercises.filter(isZone2).reduce((sum, e) => sum + e.minutes, 0);
  const strength = w.exercises.filter((e) => e.kind === "strength").length;
  const hard = w.exercises.filter(isHard).length;
  const proteinDays = w.mealDays.filter((d) => d.proteinG >= 0.8 * w.proteinTargetG).length;
  const graded = w.mealDays.reduce((s, d) => s + d.gradedKcal, 0);
  const upfShare = graded > 0 ? Math.round((100 * w.mealDays.reduce((s, d) => s + d.ultraProcessedKcal, 0)) / graded) : null;
  const usualWake = w.wakeMinutes.length ? median(w.wakeMinutes) : 0;
  const steadyNights = w.wakeMinutes.filter((m) => Math.abs(m - usualWake) <= 45).length;
  const joints = w.conditions.includes("joint_pain");
  const noHardCardio = w.conditions.includes("heart_condition") || w.conditions.includes("pregnant");

  return [
    {
      id: "zone2",
      title: "Easy cardio",
      detail: joints ? "Cycling, swimming or brisk walks you could chat through. Kind to joints." : "Brisk walks, easy rides or swims you could chat through.",
      progress: zone2,
      target: 150,
      unit: "min",
      done: zone2 >= 150,
    },
    {
      id: "strength",
      title: "Strength",
      detail: "Muscle is the organ of longevity: two sessions keep it as you age.",
      progress: strength,
      target: 2,
      unit: "sessions",
      done: strength >= 2,
    },
    {
      id: "hard_cardio",
      title: "One hard session",
      detail: joints ? "A few all-out minutes on a bike or in the pool lift your fitness ceiling." : "A few all-out minutes lift your fitness ceiling (VO2max).",
      progress: hard,
      target: 1,
      unit: "sessions",
      done: hard >= 1,
      ...(noHardCardio ? { skipped: "Left out for your health. Ask your clinician what intensity suits you." } : {}),
    },
    {
      id: "protein",
      title: "Protein most days",
      detail: `At least ${Math.round(0.8 * w.proteinTargetG)} g on 5 days, to keep muscle.`,
      progress: proteinDays,
      target: 5,
      unit: "days",
      done: proteinDays >= 5,
    },
    {
      id: "whole_food",
      title: "Mostly whole food",
      detail: upfShare === null ? "Log meals to see how much was ultra-processed." : `${upfShare}% of this week's calories were ultra-processed. Under 20% is the goal.`,
      progress: upfShare ?? 0,
      target: 20,
      unit: "%",
      done: upfShare !== null && upfShare < 20,
    },
    {
      id: "steady_wake",
      title: "A steady wake time",
      detail: "Waking within 45 minutes of your usual time keeps your body clock set.",
      progress: steadyNights,
      target: 5,
      unit: "nights",
      done: steadyNights >= 5,
    },
    {
      id: "daylight",
      title: "Morning daylight",
      detail: "Ten minutes outside in the morning, five days a week.",
      progress: w.daylightDays,
      target: 5,
      unit: "days",
      done: w.daylightDays >= 5,
    },
  ];
}

/**
 * One number for the week, 0–100: how close each habit is to where it should be by now. Weekly targets
 * are scaled to the days so far (Wednesday expects 3/7 of them), so a Monday isn't a zero. The
 * ultra-processed share scores full under its limit and falls to 0 at twice it. Habits a health
 * condition leaves out don't count, nor the share before any meal is graded; null when nothing counts.
 */
export function healthspanScore(habits: HealthspanHabit[], days: number): number | null {
  const parts = habits.flatMap((h) => {
    if (h.skipped) return [];
    if (h.done) return [1];
    if (h.unit === "%") return h.progress === 0 ? [] : [Math.max(0, 1 - (h.progress - h.target) / h.target)];
    return [Math.min(1, h.progress / ((h.target * Math.max(1, days)) / 7))];
  });
  return parts.length ? Math.round((100 * parts.reduce((s, p) => s + p, 0)) / parts.length) : null;
}

/** Monday of the week [date] (YYYY-MM-DD) falls in, and the days from Monday to [date]. */
export function weekSoFar(date: string): string[] {
  const d = new Date(`${date}T12:00:00Z`);
  const fromMonday = (d.getUTCDay() + 6) % 7;
  return Array.from({ length: fromMonday + 1 }, (_, i) => new Date(d.getTime() - (fromMonday - i) * 86_400_000).toISOString().slice(0, 10));
}
