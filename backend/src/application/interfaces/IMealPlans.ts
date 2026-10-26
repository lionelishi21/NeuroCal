import type { MealPlan, PlannedMeal } from "../../domain/mealPlan";
import type { DietaryPreference, Macros, MealKind } from "../../domain/types";

export interface MealPlanContext {
  days: number;
  /** The meals each day holds, in order (from the fasting plan). */
  meals: MealKind[];
  calorieTarget: number;
  macroTargets: Macros;
  dietaryPreference: DietaryPreference;
  cognitiveGoals: string[];
  /** What's in the kitchen; used first. */
  pantry: string[];
  /** The food catalog's ids and names, so ingredients can be matched to it. */
  catalog: { id: string; name: string; serving: string }[];
  /** Food rules from health conditions (domain/conditions.ts mealNotes); left out when there are none. */
  healthNotes?: string[];
  /** Meal titles already in the plan, for swapping one: the new meal must be clearly different. */
  avoid?: string[];
}

/** Proposes meals for the plan (an LLM; its output is schema-checked). */
export interface IMealPlanner {
  plan(context: MealPlanContext): Promise<PlannedMeal[][]>;
}

/** The latest plan per user. */
export interface IMealPlanRepository {
  latest(userId: string): Promise<MealPlan | null>;
  save(userId: string, plan: MealPlan): Promise<void>;
}
