/**
 * Domain types. No external dependencies: the wire format lives in
 * packages/contracts and is mapped in presentation/ (ARCHITECTURE §2–3).
 */

export const DIETARY_PREFERENCES = ["omnivore", "pescatarian", "vegetarian", "vegan", "keto", "mediterranean"] as const;
export type DietaryPreference = (typeof DIETARY_PREFERENCES)[number];

export const COGNITIVE_FLAGS = ["sharp", "low_focus", "brain_fog", "low_energy", "wired", "stressed", "calm"] as const;
export type CognitiveFlag = (typeof COGNITIVE_FLAGS)[number];

export const COGNITIVE_GOALS = ["focus", "calm", "energy", "sleep"] as const;
export type CognitiveGoal = (typeof COGNITIVE_GOALS)[number];

export const MACRO_FOCUSES = ["protein", "complex_carbs", "healthy_fats", "balanced"] as const;
export type MacroFocus = (typeof MACRO_FOCUSES)[number];

export const MEAL_KINDS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealKind = (typeof MEAL_KINDS)[number];

export const GLYCEMIC_LOADS = ["low", "medium", "high"] as const;
export type GlycemicLoad = (typeof GLYCEMIC_LOADS)[number];

export interface Macros {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Profile {
  userId: string;
  displayName: string;
  /** IANA time zone; defines the user's calendar day. */
  timeZone: string;
  dietaryPreference: DietaryPreference;
  cognitiveGoals: CognitiveGoal[];
  dailyCalorieTarget: number;
  macroTargets: Macros;
}

export interface FoodItem {
  name: string;
  portion: string;
  calories: number;
  macros: Macros;
  /** 0–1, only on AI-proposed items. */
  confidence?: number;
  glycemicLoad?: GlycemicLoad;
}

export interface Meal {
  id: string;
  userId: string;
  kind: MealKind;
  eatenAt: Date;
  items: FoodItem[];
  photoKey?: string;
}

export type NewMeal = Omit<Meal, "id" | "userId">;

export interface CheckIn {
  id: string;
  userId: string;
  at: Date;
  flags: CognitiveFlag[];
  note?: string;
}

export type NewCheckIn = Omit<CheckIn, "id" | "userId">;

/** A calendar day in a given time zone, e.g. { date: "2026-09-29", timeZone: "America/Chicago" }. */
export interface LocalDay {
  date: string;
  timeZone: string;
}

export interface BioState {
  date: string;
  calorieTarget: number;
  caloriesEaten: number;
  macrosEaten: Macros;
  macroTargets: Macros;
  macroFocus: MacroFocus;
  cognitiveFlags: CognitiveFlag[];
  dietaryPreference: DietaryPreference;
}

export interface RecipeRecommendation {
  id: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl?: string;
  minutes: number;
  calories: number;
  macros: Macros;
  reasoning: string;
  searchQuery: string;
}

export type NewRecipeRecommendation = Omit<RecipeRecommendation, "id">;
