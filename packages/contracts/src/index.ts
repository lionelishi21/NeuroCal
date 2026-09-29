import { z } from "zod";

/** Calendar day in the user's local time, e.g. "2026-09-29". */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const IsoDateTime = z.iso.datetime({ offset: true });
export const Id = z.string().min(1);

export const DietaryPreference = z.enum([
  "omnivore",
  "pescatarian",
  "vegetarian",
  "vegan",
  "keto",
  "mediterranean",
]);
export type DietaryPreference = z.infer<typeof DietaryPreference>;

export const CognitiveFlag = z.enum([
  "sharp",
  "low_focus",
  "brain_fog",
  "low_energy",
  "wired",
  "stressed",
  "calm",
]);
export type CognitiveFlag = z.infer<typeof CognitiveFlag>;

export const CognitiveGoal = z.enum(["focus", "calm", "energy", "sleep"]);
export type CognitiveGoal = z.infer<typeof CognitiveGoal>;

export const MacroFocus = z.enum(["protein", "complex_carbs", "healthy_fats", "balanced"]);
export type MacroFocus = z.infer<typeof MacroFocus>;

export const Macros = z.object({
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
});
export type Macros = z.infer<typeof Macros>;

export const Profile = z.object({
  id: Id,
  displayName: z.string().min(1),
  /** IANA time zone that defines the user's day, e.g. "America/Chicago". Defaults to UTC. */
  timeZone: z.string().min(1).optional(),
  dietaryPreference: DietaryPreference,
  cognitiveGoals: z.array(CognitiveGoal),
  dailyCalorieTarget: z.number().int().positive(),
  macroTargets: Macros,
});
export type Profile = z.infer<typeof Profile>;

export const UpdateProfileRequest = Profile.omit({ id: true }).partial();
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;

export const FoodItem = z.object({
  name: z.string().min(1),
  portion: z.string().min(1),
  calories: z.number().nonnegative(),
  macros: Macros,
  /** 0–1 confidence from photo analysis; absent for manual entries. */
  confidence: z.number().min(0).max(1).optional(),
});
export type FoodItem = z.infer<typeof FoodItem>;

export const MealKind = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export type MealKind = z.infer<typeof MealKind>;

export const Meal = z.object({
  id: Id,
  kind: MealKind,
  eatenAt: IsoDateTime,
  items: z.array(FoodItem).min(1),
  photoUrl: z.url().optional(),
});
export type Meal = z.infer<typeof Meal>;

export const CreateMealRequest = Meal.omit({ id: true });
export type CreateMealRequest = z.infer<typeof CreateMealRequest>;

export const AnalyzeMealResponse = z.object({
  items: z.array(FoodItem),
  /** Set when the photo could not be read well enough to propose items. */
  problem: z.enum(["too_dark", "no_food_found", "blurry"]).optional(),
});
export type AnalyzeMealResponse = z.infer<typeof AnalyzeMealResponse>;

export const CheckIn = z.object({
  id: Id,
  at: IsoDateTime,
  flags: z.array(CognitiveFlag).min(1),
  note: z.string().max(280).optional(),
});
export type CheckIn = z.infer<typeof CheckIn>;

export const CreateCheckInRequest = CheckIn.omit({ id: true });
export type CreateCheckInRequest = z.infer<typeof CreateCheckInRequest>;

export const BioState = z.object({
  date: IsoDate,
  calorieTarget: z.number().int().positive(),
  caloriesEaten: z.number().nonnegative(),
  macrosEaten: Macros,
  macroTargets: Macros,
  macroFocus: MacroFocus,
  cognitiveFlags: z.array(CognitiveFlag),
  dietaryPreference: DietaryPreference,
});
export type BioState = z.infer<typeof BioState>;

export const RecipeRecommendation = z.object({
  id: Id,
  title: z.string().min(1),
  sourceName: z.string().min(1),
  sourceUrl: z.url(),
  imageUrl: z.url().optional(),
  minutes: z.number().int().positive(),
  calories: z.number().nonnegative(),
  macros: Macros,
  /** Plain-language reason this recipe fits the current bio-state. */
  reasoning: z.string().min(1),
});
export type RecipeRecommendation = z.infer<typeof RecipeRecommendation>;

export const NextRecommendationsResponse = z.object({
  searchQuery: z.string(),
  recipes: z.array(RecipeRecommendation),
});
export type NextRecommendationsResponse = z.infer<typeof NextRecommendationsResponse>;

export const ApiError = z.object({
  code: z.string(),
  message: z.string(),
});
export type ApiError = z.infer<typeof ApiError>;

/** HTTP surface shared by the web app, its mocks and the backend. */
export const endpoints = {
  getMe: { method: "GET", path: "/me", response: Profile },
  updateProfile: { method: "PUT", path: "/me/profile", body: UpdateProfileRequest, response: Profile },
  getBioState: { method: "GET", path: "/bio-state", response: BioState },
  createCheckIn: { method: "POST", path: "/check-ins", body: CreateCheckInRequest, response: CheckIn },
  analyzeMeal: { method: "POST", path: "/meals/analyze", response: AnalyzeMealResponse },
  createMeal: { method: "POST", path: "/meals", body: CreateMealRequest, response: Meal },
  listMeals: { method: "GET", path: "/meals", response: z.array(Meal) },
  deleteMeal: { method: "DELETE", path: "/meals/:id" },
  nextRecommendations: { method: "GET", path: "/recommendations/next", response: NextRecommendationsResponse },
} as const;

export function mealCalories(meal: Pick<Meal, "items">): number {
  return meal.items.reduce((sum, item) => sum + item.calories, 0);
}

export function caloriesRemaining(state: Pick<BioState, "calorieTarget" | "caloriesEaten">): number {
  return state.calorieTarget - state.caloriesEaten;
}
