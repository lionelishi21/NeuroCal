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
  /** Estimated glycemic load from photo analysis; feeds the Focus Score. */
  glycemicLoad: z.enum(["low", "medium", "high"]).optional(),
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

export const TelemetrySource = z.enum(["manual", "apple_health", "health_connect", "wearable"]);
export type TelemetrySource = z.infer<typeof TelemetrySource>;

export const SleepSession = z
  .object({
    start: IsoDateTime,
    end: IsoDateTime,
    source: TelemetrySource,
    /** Minutes of deep sleep, when the source measures it. */
    deepMinutes: z.number().int().nonnegative().optional(),
  })
  .refine((s) => Date.parse(s.end) > Date.parse(s.start), { message: "Sleep must end after it starts", path: ["end"] })
  .refine((s) => Date.parse(s.end) - Date.parse(s.start) <= 24 * 3_600_000, {
    message: "A sleep session can't be longer than 24 hours",
    path: ["end"],
  });
export type SleepSession = z.infer<typeof SleepSession>;

export const ScreenTimeSample = z
  .object({
    windowStart: IsoDateTime,
    windowEnd: IsoDateTime,
    minutes: z.number().int().nonnegative(),
    source: TelemetrySource,
  })
  .refine((s) => s.minutes <= (Date.parse(s.windowEnd) - Date.parse(s.windowStart)) / 60_000, {
    message: "Minutes can't exceed the window length",
    path: ["minutes"],
  });
export type ScreenTimeSample = z.infer<typeof ScreenTimeSample>;

export const IngestSleepRequest = z.object({ sessions: z.array(SleepSession).min(1).max(100) });
export type IngestSleepRequest = z.infer<typeof IngestSleepRequest>;

export const IngestScreenTimeRequest = z.object({ samples: z.array(ScreenTimeSample).min(1).max(500) });
export type IngestScreenTimeRequest = z.infer<typeof IngestScreenTimeRequest>;

export const IngestResponse = z.object({ accepted: z.number().int().nonnegative() });
export type IngestResponse = z.infer<typeof IngestResponse>;

/** 0–1 per input; null when there was no data for it today. */
const Component = z.number().min(0).max(1).nullable();

export const FocusScore = z.object({
  date: IsoDate,
  /** 0–100; null when no input has data yet. */
  score: z.number().int().min(0).max(100).nullable(),
  components: z.object({
    sleep: Component,
    timing: Component,
    glycemic: Component,
    stress: Component,
  }),
  /** Plain-language summary of what drives the score. */
  explanation: z.string(),
});
export type FocusScore = z.infer<typeof FocusScore>;

export const HistoryDay = z.object({
  date: IsoDate,
  calorieTarget: z.number().int().positive(),
  caloriesEaten: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  /** That day's Focus Score, or null without data. */
  focusScore: z.number().int().min(0).max(100).nullable(),
  /** Sleep that ended that morning, or null without data. */
  sleepMinutes: z.number().int().nonnegative().nullable(),
  /** Local time of the last meal ("21:40"), or null if nothing was logged. */
  lastMealAt: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  /** Every distinct flag from that day's check-ins. */
  flags: z.array(CognitiveFlag),
});
export type HistoryDay = z.infer<typeof HistoryDay>;

export const HistoryResponse = z.object({ days: z.array(HistoryDay) });
export type HistoryResponse = z.infer<typeof HistoryResponse>;

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
  getFocusScore: { method: "GET", path: "/focus-score", response: FocusScore },
  /** ?days=7 (1–31), oldest first, ending today in the user's time zone. */
  getHistory: { method: "GET", path: "/history", response: HistoryResponse },
  ingestSleep: { method: "POST", path: "/telemetry/sleep", body: IngestSleepRequest, response: IngestResponse },
  ingestScreenTime: { method: "POST", path: "/telemetry/screen-time", body: IngestScreenTimeRequest, response: IngestResponse },
} as const;

export function mealCalories(meal: Pick<Meal, "items">): number {
  return meal.items.reduce((sum, item) => sum + item.calories, 0);
}

export function caloriesRemaining(state: Pick<BioState, "calorieTarget" | "caloriesEaten">): number {
  return state.calorieTarget - state.caloriesEaten;
}
