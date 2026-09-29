import { mealCalories, sumMacros } from "./meal";
import type { BioState, CheckIn, MacroFocus, Macros, Meal, Profile } from "./types";

/** The largest gap must beat the runner-up by this much to become the focus. */
const FOCUS_MARGIN = 0.1;

/**
 * Which macro the user is most short of today (ARCHITECTURE §6.5).
 * Must stay identical to web-poc/src/mocks/db.ts so mocks and backend agree.
 */
export function macroFocus(eaten: Macros, target: Macros): MacroFocus {
  const gaps: [MacroFocus, number][] = [
    ["protein", 1 - eaten.proteinG / target.proteinG],
    ["complex_carbs", 1 - eaten.carbsG / target.carbsG],
    ["healthy_fats", 1 - eaten.fatG / target.fatG],
  ];
  gaps.sort((a, b) => b[1] - a[1]);
  const [top, second] = gaps;
  return top && second && top[1] - second[1] > FOCUS_MARGIN ? top[0] : "balanced";
}

/**
 * Derived, never stored (ARCHITECTURE §3). `meals` are the day's meals and
 * `latestCheckIn` the day's most recent check-in, both already scoped to `date`.
 */
export function computeBioState(
  profile: Profile,
  date: string,
  meals: Meal[],
  latestCheckIn: CheckIn | null,
): BioState {
  const macrosEaten = sumMacros(meals.flatMap((m) => m.items));
  return {
    date,
    calorieTarget: profile.dailyCalorieTarget,
    caloriesEaten: meals.reduce((sum, m) => sum + mealCalories(m), 0),
    macrosEaten,
    macroTargets: profile.macroTargets,
    macroFocus: macroFocus(macrosEaten, profile.macroTargets),
    cognitiveFlags: latestCheckIn?.flags ?? [],
    dietaryPreference: profile.dietaryPreference,
  };
}
