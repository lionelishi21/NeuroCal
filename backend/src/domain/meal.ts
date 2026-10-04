import { InvalidError } from "./errors";
import type { FoodItem, Macros, Meal, NewMeal } from "./types";

const FUTURE_TOLERANCE_MS = 5 * 60_000;

export function mealCalories(meal: Pick<Meal, "items">): number {
  return meal.items.reduce((sum, item) => sum + item.calories, 0);
}

export function sumMacros(items: FoodItem[]): Macros {
  return items.reduce(
    (acc, item) => ({
      proteinG: acc.proteinG + item.macros.proteinG,
      carbsG: acc.carbsG + item.macros.carbsG,
      fatG: acc.fatG + item.macros.fatG,
    }),
    { proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** Meal invariants (ARCHITECTURE §3). Throws InvalidError with a user-facing message. */
export function assertValidMeal(meal: NewMeal, now: Date): void {
  if (meal.items.length === 0) throw new InvalidError("A meal needs at least one item.");
  if (meal.eatenAt.getTime() - now.getTime() > FUTURE_TOLERANCE_MS) {
    throw new InvalidError("A meal can't be logged in the future.");
  }
  for (const item of meal.items) {
    const numbers = [item.calories, item.macros.proteinG, item.macros.carbsG, item.macros.fatG];
    if (numbers.some((n) => !Number.isFinite(n) || n < 0)) {
      throw new InvalidError(`${item.name} has a negative or missing amount.`);
    }
    if (item.confidence !== undefined && (item.confidence < 0 || item.confidence > 1)) {
      throw new InvalidError(`${item.name} has a confidence outside 0–1.`);
    }
  }
}
