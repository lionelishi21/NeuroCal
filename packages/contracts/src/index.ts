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
  // Diet protocols offered by the bio-profile onboarding.
  "cyclical_keto",
  "low_toxin",
  "carnivore",
  "paleo",
  "standard",
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

const Frequency = z.enum(["daily", "weekly", "never"]);

/** Answers from the bio-profile onboarding. They shape suggestions; none of them is a medical record. */
export const BioProfile = z.object({
  /** When the person wakes without an alarm. */
  wake: z.enum(["before_6", "6_to_8", "after_8"]),
  fasting: z.enum(["16_8", "omad", "12_12", "none"]),
  coffeeType: z.enum(["biohacked", "black", "espresso", "none"]),
  /** Absent when they don't drink coffee. */
  coffeeTime: z.enum(["before_9", "9_to_11", "afternoon"]).optional(),
  coffeeMoldTested: z.boolean().optional(),
  moldSensitive: z.boolean(),
  /** Hours of screens after sunset without blue-light blockers. */
  eveningScreens: z.enum(["none", "1_2", "3_plus"]),
  phoneAtNight: z.enum(["airplane_mode", "another_room", "nightstand", "next_to_head"]),
  water: z.enum(["filtered", "spring", "tap"]),
  addsMinerals: z.boolean(),
  coldTherapy: Frequency,
  redLight: Frequency,
  pemf: Frequency,
  takesSupplements: z.boolean(),
  supplements: z.array(z.enum(["c8_mct", "magnesium_l_threonate", "l_theanine", "creatine", "ashwagandha", "rhodiola", "binders", "ketone_esters", "methyl_b", "nootropics"])),
  movement: z.enum(["heavy_lifting", "rehit", "chronic_cardio", "mobility", "none"]),
  /** The daily problem to watch for first. */
  friction: z.enum(["afternoon_crash", "night_waking", "post_meal_fog", "slow_recovery"]),
  goal: z.enum(["focus", "deep_sleep", "steady_energy", "longevity"]),
});
export type BioProfile = z.infer<typeof BioProfile>;

export const Profile = z.object({
  id: Id,
  displayName: z.string().min(1),
  /** IANA time zone that defines the user's day, e.g. "America/Chicago". Defaults to UTC. */
  timeZone: z.string().min(1).optional(),
  dietaryPreference: DietaryPreference,
  cognitiveGoals: z.array(CognitiveGoal),
  dailyCalorieTarget: z.number().int().positive(),
  macroTargets: Macros,
  /** Set by the bio-profile onboarding; absent for profiles made before it existed. */
  bioProfile: BioProfile.optional(),
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

export const MealList = z.array(Meal);
export type MealList = z.infer<typeof MealList>;

export const CreateMealRequest = Meal.omit({ id: true }).extend({
  /**
   * A UUID the client makes up once per meal. Sending the same meal again with the same key
   * (a retry after a lost response, the offline queue) returns the first one instead of logging it twice.
   */
  clientKey: z.uuid().optional(),
});
export type CreateMealRequest = z.infer<typeof CreateMealRequest>;

export const AnalyzeMealResponse = z.object({
  items: z.array(FoodItem),
  /** Set when the photo could not be read well enough to propose items. */
  problem: z.enum(["too_dark", "no_food_found", "blurry"]).optional(),
});
export type AnalyzeMealResponse = z.infer<typeof AnalyzeMealResponse>;

/** The largest meal photo the API accepts. */
export const MAX_MEAL_PHOTO_BYTES = 8 * 1024 * 1024;

export const CreatePhotoUploadRequest = z.object({
  /** The photo's media type, e.g. "image/jpeg". */
  mediaType: z.string().regex(/^image\/[\w.+-]+$/),
  /** The photo's exact size; the upload is refused if the bytes sent differ. */
  sizeBytes: z.number().int().positive().max(MAX_MEAL_PHOTO_BYTES),
});
export type CreatePhotoUploadRequest = z.infer<typeof CreatePhotoUploadRequest>;

export const PhotoUpload = z.object({
  /** Pass this to POST /meals/analyze once the upload has finished. */
  photoKey: z.string().min(1),
  /** PUT the photo's bytes here, with exactly the headers below. */
  uploadUrl: z.url(),
  headers: z.record(z.string(), z.string()),
  expiresAt: IsoDateTime,
});
export type PhotoUpload = z.infer<typeof PhotoUpload>;

export const AnalyzeMealRequest = z.object({ photoKey: z.string().min(1).max(200) });
export type AnalyzeMealRequest = z.infer<typeof AnalyzeMealRequest>;

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

/** Local wall-clock time, "21:40". */
const LocalTime = z.string().regex(/^\d{2}:\d{2}$/);

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
  lastMealAt: LocalTime.nullable(),
  /** Local time the sleep that ended that morning began, or null without data. */
  bedtime: LocalTime.nullable(),
  /** Local time that sleep ended, or null without data. */
  wakeTime: LocalTime.nullable(),
  /** Screen minutes after 22:00 the night before (until 04:00), or null when none was recorded. */
  lateScreenMinutes: z.number().int().nonnegative().nullable(),
  /** Every distinct flag from that day's check-ins. */
  flags: z.array(CognitiveFlag),
});
export type HistoryDay = z.infer<typeof HistoryDay>;

export const HistoryResponse = z.object({ days: z.array(HistoryDay) });
export type HistoryResponse = z.infer<typeof HistoryResponse>;

export const FocusComponentName = z.enum(["sleep", "timing", "glycemic", "stress"]);
export type FocusComponentName = z.infer<typeof FocusComponentName>;

/** A Focus Score input that averaged below par over the past week. */
export const WeakPoint = z.object({
  component: FocusComponentName,
  /** Plain description, e.g. "short or light sleep". */
  label: z.string(),
  /** 7-day average, 0–1. */
  average: z.number().min(0).max(1),
});
export type WeakPoint = z.infer<typeof WeakPoint>;

export const ProtocolRecommendation = z.object({
  id: Id,
  title: z.string().min(1),
  summary: z.string().min(1),
  /** Ordered steps to follow. */
  steps: z.array(z.string().min(1)).min(1),
  /** 0–1 similarity to the user's weak points. */
  match: z.number().min(0).max(1),
});
export type ProtocolRecommendation = z.infer<typeof ProtocolRecommendation>;

export const ProductRecommendation = z.object({
  id: Id,
  name: z.string().min(1),
  description: z.string().min(1),
  url: z.url().optional(),
  /** NeuroCal may earn a commission; clients must label these visibly. */
  affiliate: z.boolean(),
  /** Sold by a store run by NeuroCal's makers (MitoProof); clients must label these visibly. */
  ownBrand: z.boolean(),
  /** A dietary supplement; clients show a check-with-your-doctor note alongside it. */
  supplement: z.boolean(),
  match: z.number().min(0).max(1),
});
export type ProductRecommendation = z.infer<typeof ProductRecommendation>;

export const ProtocolsResponse = z.object({
  weakPoints: z.array(WeakPoint),
  protocols: z.array(ProtocolRecommendation),
  products: z.array(ProductRecommendation),
});
export type ProtocolsResponse = z.infer<typeof ProtocolsResponse>;

/** A product as the admin screen manages it. */
export const AdminProduct = z.object({
  id: Id,
  name: z.string().min(1),
  description: z.string().min(1),
  /** The link users are sent to: the admin's link when one is set, otherwise the catalog's. */
  url: z.url().optional(),
  /** The catalog's own link, present only while an admin link replaces it. */
  catalogUrl: z.url().optional(),
  affiliate: z.boolean(),
  ownBrand: z.boolean(),
  supplement: z.boolean(),
  tags: z.array(z.string()),
  /** Disabled products are never suggested. */
  enabled: z.boolean(),
  /** "catalog": comes with the app; "admin": added from the admin screen and removable there. */
  managedBy: z.enum(["catalog", "admin"]),
});
export type AdminProduct = z.infer<typeof AdminProduct>;

export const AdminProductList = z.object({ products: z.array(AdminProduct) });
export type AdminProductList = z.infer<typeof AdminProductList>;

const HttpsUrl = z.url().regex(/^https:\/\//, "The link must start with https://");

export const UpdateAdminProductRequest = z
  .object({
    /** A link to use instead of the catalog's; null goes back to the catalog's link. */
    url: HttpsUrl.nullable(),
    affiliate: z.boolean(),
    enabled: z.boolean(),
  })
  .partial();
export type UpdateAdminProductRequest = z.infer<typeof UpdateAdminProductRequest>;

export const CreateAdminProductRequest = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(600),
  url: HttpsUrl.optional(),
  affiliate: z.boolean(),
  ownBrand: z.boolean(),
  supplement: z.boolean(),
  /** Words that describe when to suggest it, e.g. "sleep", "low focus", "protein". */
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
});
export type CreateAdminProductRequest = z.infer<typeof CreateAdminProductRequest>;

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
  /** Step 1 of logging a photo: get a short-lived URL to upload it to. */
  createPhotoUpload: { method: "POST", path: "/uploads/meal-photo", body: CreatePhotoUploadRequest, response: PhotoUpload },
  /** Takes the key of an uploaded photo, or (older clients) the photo itself as multipart `photo`. */
  analyzeMeal: { method: "POST", path: "/meals/analyze", body: AnalyzeMealRequest, response: AnalyzeMealResponse },
  createMeal: { method: "POST", path: "/meals", body: CreateMealRequest, response: Meal },
  listMeals: { method: "GET", path: "/meals", response: MealList },
  deleteMeal: { method: "DELETE", path: "/meals/:id" },
  nextRecommendations: { method: "GET", path: "/recommendations/next", response: NextRecommendationsResponse },
  getFocusScore: { method: "GET", path: "/focus-score", response: FocusScore },
  /** ?days=7 (1–31), oldest first, ending today in the user's time zone. */
  getHistory: { method: "GET", path: "/history", response: HistoryResponse },
  /** Protocols and products matched (pgvector) to the past week's weakest Focus Score inputs. */
  getProtocols: { method: "GET", path: "/recommendations/protocols", response: ProtocolsResponse },
  /** Admin only (403 otherwise): every product, including disabled ones. */
  listAdminProducts: { method: "GET", path: "/admin/products", response: AdminProductList },
  createAdminProduct: { method: "POST", path: "/admin/products", body: CreateAdminProductRequest, response: AdminProduct },
  updateAdminProduct: { method: "PUT", path: "/admin/products/:id", body: UpdateAdminProductRequest, response: AdminProduct },
  deleteAdminProduct: { method: "DELETE", path: "/admin/products/:id" },
  ingestSleep: { method: "POST", path: "/telemetry/sleep", body: IngestSleepRequest, response: IngestResponse },
  ingestScreenTime: { method: "POST", path: "/telemetry/screen-time", body: IngestScreenTimeRequest, response: IngestResponse },
} as const;

export function mealCalories(meal: Pick<Meal, "items">): number {
  return meal.items.reduce((sum, item) => sum + item.calories, 0);
}

export function caloriesRemaining(state: Pick<BioState, "calorieTarget" | "caloriesEaten">): number {
  return state.calorieTarget - state.caloriesEaten;
}
