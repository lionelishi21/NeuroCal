/**
 * Meal plans: a few days of meals sized to the calorie and macro targets, using the pantry first and
 * fitting the fasting plan. The planner (an LLM) proposes meals; the nutrition, pantry marks and the
 * shopping list are worked out here, from the food catalog where ingredients match.
 */
import type { FastingProtocol } from "./fasting";
import type { Food } from "./foods";
import { markPantryIngredients, pantryKey } from "./pantry";
import { type ParsedIngredient, recipeNutrition } from "./recipe";
import type { FoodProcessing, Macros, MealKind } from "./types";

export const MAX_PLAN_DAYS = 3;

/** The meals a day holds on each fasting plan: one for OMAD, two inside a 16:8 window, else three. */
export function mealSlotsFor(protocol: FastingProtocol): MealKind[] {
  switch (protocol) {
    case "omad":
      return ["dinner"];
    case "16_8":
      return ["lunch", "dinner"];
    default:
      return ["breakfast", "lunch", "dinner"];
  }
}

export interface PlannedMeal {
  kind: MealKind;
  title: string;
  ingredients: ParsedIngredient[];
  steps: string[];
}

export interface PlanMeal {
  kind: MealKind;
  title: string;
  calories: number;
  macros: Macros;
  processing: FoodProcessing;
  ingredients: { name: string; quantity: string; grams: number; inPantry: boolean; source: "catalog" | "estimate" }[];
  steps: string[];
}

export interface PlanDay {
  day: number;
  meals: PlanMeal[];
  calories: number;
  macros: Macros;
}

export interface ShoppingItem {
  name: string;
  grams: number;
  /** How many meals use it. */
  meals: number;
}

export interface MealPlan {
  createdAt: Date;
  days: PlanDay[];
  targets: { calories: number; macros: Macros };
  /** Everything not already in the pantry, combined across the plan, most-used first. */
  shoppingList: ShoppingItem[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The shopping list from a plan's meals: everything not in the pantry, combined, most-used first. */
function shoppingListOf(days: PlanDay[]): ShoppingItem[] {
  const shopping = new Map<string, ShoppingItem>();
  for (const day of days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        if (ing.inPantry) continue;
        const key = pantryKey(ing.name);
        const item = shopping.get(key) ?? { name: ing.name, grams: 0, meals: 0 };
        shopping.set(key, { ...item, grams: item.grams + ing.grams, meals: item.meals + 1 });
      }
    }
  }
  return [...shopping.values()].map((s) => ({ ...s, grams: Math.round(s.grams) })).sort((a, b) => b.meals - a.meals || a.name.localeCompare(b.name));
}

const dayTotals = (meals: PlanMeal[]) => {
  const sum = (f: (m: PlanMeal) => number) => meals.reduce((s, m) => s + f(m), 0);
  return {
    calories: Math.round(sum((m) => m.calories)),
    macros: { proteinG: round1(sum((m) => m.macros.proteinG)), carbsG: round1(sum((m) => m.macros.carbsG)), fatG: round1(sum((m) => m.macros.fatG)) },
  };
};

/** The plan with one meal swapped for [meal], the day's totals and the shopping list worked out again. */
export function replaceMeal(plan: MealPlan, dayIndex: number, mealIndex: number, meal: PlanMeal): MealPlan {
  const days = plan.days.map((d, i) => {
    if (i !== dayIndex) return d;
    const meals = d.meals.map((m, j) => (j === mealIndex ? meal : m));
    return { ...d, meals, ...dayTotals(meals) };
  });
  return { ...plan, days, shoppingList: shoppingListOf(days) };
}

/** Nutrition per meal and day (catalog values where ingredients match), pantry marks, and the shopping list. */
export function buildMealPlan(
  planned: PlannedMeal[][],
  context: { catalog: readonly Food[]; pantry: string[]; targets: { calories: number; macros: Macros }; createdAt: Date },
): MealPlan {
  const days = planned.map((meals, i): PlanDay => {
    const out = meals.map((m): PlanMeal => {
      const n = recipeNutrition({ title: m.title, servings: 1, ingredients: m.ingredients }, context.catalog);
      const marked = markPantryIngredients(n.ingredients, context.pantry);
      return {
        kind: m.kind,
        title: m.title,
        calories: n.calories,
        macros: n.macros,
        processing: n.processing,
        ingredients: marked.map((x) => ({ name: x.name, quantity: x.quantity, grams: x.grams, inPantry: x.inPantry, source: x.source })),
        steps: m.steps,
      };
    });
    return { day: i + 1, meals: out, ...dayTotals(out) };
  });
  return { createdAt: context.createdAt, days, targets: context.targets, shoppingList: shoppingListOf(days) };
}
