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
/**
 * Health conditions that make the plan safer and point suggestions at what suits them (never treatment).
 * Mirrors backend/src/domain/conditions.ts.
 */
export const HealthCondition = z.enum([
  "type1_diabetes",
  "type2_diabetes",
  "glucose_lowering_meds",
  "sleep_disorder",
  "joint_pain",
  "brain_fog",
  "heart_condition",
  "mitochondrial",
  "pregnant",
  "eating_disorder_history",
  "blood_thinners",
]);
export type HealthCondition = z.infer<typeof HealthCondition>;

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
  goal: z.enum(["focus", "deep_sleep", "steady_energy", "longevity", "weight_loss"]),
});
export type BioProfile = z.infer<typeof BioProfile>;

/** A weight-loss plan. Weights are in kilograms; clients convert for display. */
export const WeightGoal = z.object({
  startKg: z.number().min(25).max(350),
  targetKg: z.number().min(25).max(350),
  startedOn: IsoDate,
  /** Planned loss per week as a share of body weight. */
  pacePctPerWeek: z.union([z.literal(0.5), z.literal(0.75), z.literal(1)]),
  /**
   * The person takes diabetes medication, is pregnant or breastfeeding, is under 18, or has had an
   * eating disorder. Long fasts (one meal a day) are then never suggested.
   */
  fastingCaution: z.boolean(),
});
export type WeightGoal = z.infer<typeof WeightGoal>;

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
  weightGoal: WeightGoal.optional(),
  /** Health conditions that make the plan safer; absent for profiles made before the question existed. */
  healthConditions: z.array(HealthCondition).optional(),
});
export type Profile = z.infer<typeof Profile>;

/** Any profile fields; `weightGoal: null` removes the weight goal. */
export const UpdateProfileRequest = Profile.omit({ id: true }).partial().extend({ weightGoal: WeightGoal.nullable().optional() });
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
  /** NOVA-style: whole (NOVA 1–2), processed (NOVA 3), ultra_processed (NOVA 4). Missing for items typed in by hand. */
  processing: z.enum(["whole", "processed", "ultra_processed"]).optional(),
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
  /** The day's calories by how processed the food was; items without a level aren't counted. */
  processing: z.object({
    wholeKcal: z.number().nonnegative(),
    processedKcal: z.number().nonnegative(),
    ultraProcessedKcal: z.number().nonnegative(),
  }),
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
    /** Yesterday's exercise (model v1); null for people who don't log exercise. */
    movement: Component.optional(),
    /** Yesterday's air and environment check (model v1.1); null without either. */
    environment: Component.optional(),
  }),
  /** Plain-language summary of what drives the score. */
  explanation: z.string(),
  /** The weights have been tuned to this person's Brain speed checks (model v1). */
  tuned: z.boolean().optional(),
  /** The blood-sugar input came from yesterday's glucose sensor rather than meals. */
  glycemicFromSensor: z.boolean().optional(),
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

export const FocusComponentName = z.enum(["sleep", "timing", "glycemic", "stress", "movement", "environment"]);
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
  /** For routines from the knowledge pipeline: the video, linked to the moment it was said. */
  source: z.object({ title: z.string(), url: z.url() }).optional(),
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

export const LogWeightRequest = z.object({
  kg: z.number().min(25).max(350),
  /** The day weighed; today (in the profile's time zone) when left out. One weigh-in per day: a second replaces it. */
  date: IsoDate.optional(),
});
export type LogWeightRequest = z.infer<typeof LogWeightRequest>;

export const WeightEntry = z.object({ date: IsoDate, kg: z.number() });
export type WeightEntry = z.infer<typeof WeightEntry>;

export const WeightHistory = z.object({
  /** Oldest first. */
  entries: z.array(WeightEntry),
  /** Smoothed weight, which evens out day-to-day water swings. Absent with no weigh-ins. */
  trendKg: z.number().optional(),
  /** Change in the trend over the last 7 days; negative is a loss. Absent with under a week of data. */
  weeklyChangeKg: z.number().optional(),
  /** Present with a weight goal and at least one weigh-in. */
  goal: z
    .object({
      targetKg: z.number(),
      toGoKg: z.number().nonnegative(),
      /** The planned weekly loss at the goal's pace. */
      plannedWeeklyLossKg: z.number(),
      /** When the trend reaches the target at its current rate; absent if it isn't heading there. */
      projectedOn: IsoDate.optional(),
    })
    .optional(),
});
export type WeightHistory = z.infer<typeof WeightHistory>;

/** The fasting timer, worked out from logged meals. */
export const FastingStatus = z.object({
  /** From the bio-profile; "12_12" for anyone who answered the weight goal's safety question. */
  protocol: z.enum(["16_8", "omad", "12_12", "none"]),
  /** Absent when protocol is "none". */
  fastHours: z.number().int().positive().optional(),
  state: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("off") }),
    /** No meals logged yet. */
    z.object({ kind: z.literal("unknown") }),
    z.object({ kind: z.literal("fasting"), since: IsoDateTime, goalAt: IsoDateTime }),
    /** Fasted long enough; the next meal opens the eating window. */
    z.object({ kind: z.literal("fasted"), since: IsoDateTime, goalAt: IsoDateTime }),
    z.object({ kind: z.literal("eating"), openedAt: IsoDateTime, closesAt: IsoDateTime }),
  ]),
  /** Days in a row with a completed fast. */
  streakDays: z.number().int().nonnegative(),
});
export type FastingStatus = z.infer<typeof FastingStatus>;

export const FoodCategory = z.enum(["fish", "meat", "eggs_dairy", "plant_protein", "grains", "vegetables", "fruit", "nuts_seeds", "fats", "drinks", "extras", "eating_out"]);
export type FoodCategory = z.infer<typeof FoodCategory>;

/** A food in the catalog, per serving. Clients show its photo by `id`. */
export const CatalogFood = z.object({
  id: Id,
  name: z.string().min(1),
  category: FoodCategory,
  /** How the serving reads, e.g. "1 fillet (120 g)". */
  serving: z.string().min(1),
  grams: z.number().positive(),
  calories: z.number().nonnegative(),
  macros: Macros,
  fiberG: z.number().nonnegative(),
  glycemicLoad: z.enum(["low", "medium", "high"]),
  processing: z.enum(["whole", "processed", "ultra_processed"]),
  /** The goals it suits; empty for everyday foods. */
  goals: z.array(CognitiveGoal),
  /** One plain sentence on what it brings. */
  why: z.string().min(1),
  /** The diets it fits. */
  diets: z.array(DietaryPreference),
  /** Source entry in USDA FoodData Central; absent for figures from elsewhere (see `source`). */
  fdcId: z.number().int().positive().optional(),
  /**
   * Eating out: where the numbers come from. usda: USDA's analysis of the US menu (`fdcId`); chain: the
   * chain's own published figures (`sourceUrl`); recipe: estimated from a typical recipe (no chain publishes them).
   */
  source: z.enum(["usda", "chain", "recipe"]).optional(),
  sourceUrl: z.string().url().optional(),
  /** Eating out (`category: "eating_out"`): the restaurant chain whose menu item this is. */
  chain: z.object({ id: Id, name: z.string().min(1) }).optional(),
  /** Eating out: the countries whose menus have it (ISO codes: US, GB, JM). Clients show the phone's region first. */
  regions: z.array(z.enum(["US", "GB", "JM"])).optional(),
  /** Eating out: the id of a better choice at the same place (more protein for its calories, or fewer calories and carbs). */
  betterPick: Id.optional(),
});
export type CatalogFood = z.infer<typeof CatalogFood>;

export const FoodCatalog = z.object({ foods: z.array(CatalogFood) });
export type FoodCatalog = z.infer<typeof FoodCatalog>;

/** The most photos of one bottle a label scan takes: its sides, as the bottle turns. */
export const MAX_LABEL_PHOTOS = 4;

export const AnalyzeSupplementRequest = z.object({
  /** Uploaded photos of the same bottle, each from POST /uploads/meal-photo. */
  photoKeys: z.array(z.string().min(1).max(200)).min(1).max(MAX_LABEL_PHOTOS),
});
export type AnalyzeSupplementRequest = z.infer<typeof AnalyzeSupplementRequest>;

/** Third-party testing marks a supplement label can carry. */
export const SupplementTestingMark = z.enum(["nsf_certified", "nsf_sport", "usp_verified", "informed_sport", "informed_choice", "bscg", "clean_label_project", "other"]);
export type SupplementTestingMark = z.infer<typeof SupplementTestingMark>;

export const SupplementIngredient = z.object({
  name: z.string().min(1),
  /** Per serving, as printed. Missing when the label hides it (a proprietary blend) or it couldn't be read. */
  amount: z.number().nonnegative().optional(),
  /** As printed, e.g. "mg", "mcg", "IU", "g". */
  unit: z.string().optional(),
  /** Part of a proprietary blend, so only the blend's total is given. */
  inBlend: z.boolean(),
});
export type SupplementIngredient = z.infer<typeof SupplementIngredient>;

/** Something on (or missing from) the label worth knowing. Worded by the server; clients show `message` as is. */
export const SupplementFlag = z.object({
  kind: z.enum(["proprietary_blend", "above_upper_limit", "no_third_party_testing", "expired", "expires_soon", "doses_missing"]),
  message: z.string().min(1),
});
export type SupplementFlag = z.infer<typeof SupplementFlag>;

/**
 * What a supplement label says, plus flags. It reports the label: a photo can't show what is in the
 * bottle, so clients never present this as a safety or quality verdict.
 */
export const SupplementLabelResponse = z.object({
  /** Set when the photo isn't a readable supplement label; the other fields are then empty. */
  problem: z.enum(["not_a_label", "blurry", "too_dark", "cut_off"]).optional(),
  brand: z.string().optional(),
  productName: z.string().optional(),
  servingSize: z.string().optional(),
  servingsPerContainer: z.number().int().positive().optional(),
  ingredients: z.array(SupplementIngredient),
  testing: z.array(SupplementTestingMark),
  lotNumber: z.string().optional(),
  /** "YYYY-MM" or "YYYY-MM-DD", as printed. */
  expiresOn: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/).optional(),
  /** One plain sentence: what it is, and what the label does and doesn't show. */
  summary: z.string(),
  flags: z.array(SupplementFlag),
  /** A close own-brand (MitoProof) supplement, when there is one; labelled like other suggestions. */
  alternative: ProductRecommendation.optional(),
});
export type SupplementLabelResponse = z.infer<typeof SupplementLabelResponse>;

export const BrainCheckRequest = z.object({
  /** Each reaction to the light, in milliseconds, in order. */
  reactionTimesMs: z.array(z.number().min(100).max(5000)).min(10).max(80),
  /** Taps before the light appeared. */
  falseStarts: z.number().int().min(0).max(100),
});
export type BrainCheckRequest = z.infer<typeof BrainCheckRequest>;

/** One Brain speed check (a short reaction-time test), scored by the API. */
export const BrainCheck = z.object({
  id: Id,
  takenAt: IsoDateTime,
  /** 0–100, higher is sharper. */
  score: z.number().int().min(0).max(100),
  medianMs: z.number().int(),
  /** Average of the fastest tenth of responses. */
  fastestMs: z.number().int(),
  /** Responses of 500 ms or more. */
  lapses: z.number().int().nonnegative(),
  falseStarts: z.number().int().nonnegative(),
  trials: z.number().int().positive(),
});
export type BrainCheck = z.infer<typeof BrainCheck>;

export const ExerciseKind = z.enum(["walk", "run", "cycle", "strength", "hiit", "yoga", "swim", "sport", "calf", "other"]);
export type ExerciseKind = z.infer<typeof ExerciseKind>;
export const ExerciseIntensity = z.enum(["light", "moderate", "hard"]);
export type ExerciseIntensity = z.infer<typeof ExerciseIntensity>;

export const LogExerciseRequest = z.object({
  kind: ExerciseKind,
  intensity: ExerciseIntensity,
  minutes: z.number().int().min(1).max(600),
  /** When it started; defaults to `minutes` ago. */
  startedAt: IsoDateTime.optional(),
});
export type LogExerciseRequest = z.infer<typeof LogExerciseRequest>;

export const Exercise = z.object({
  id: z.string(),
  kind: ExerciseKind,
  intensity: ExerciseIntensity,
  minutes: z.number().int(),
  startedAt: IsoDateTime,
  /** Burned by the exercise itself (above resting), from the latest weigh-in when it was logged. */
  kcal: z.number().int().nonnegative(),
});
export type Exercise = z.infer<typeof Exercise>;

export const ExerciseDay = z.object({
  date: IsoDate,
  /** Earliest first. */
  exercises: z.array(Exercise),
  totalMinutes: z.number().int().nonnegative(),
  totalKcal: z.number().int().nonnegative(),
  /** "default" when there's no weigh-in yet and calories assume 70 kg. */
  weightSource: z.enum(["weigh_in", "default"]),
});
export type ExerciseDay = z.infer<typeof ExerciseDay>;

export const PantryItem = z.object({ id: z.string(), name: z.string() });
export type PantryItem = z.infer<typeof PantryItem>;

export const PantryResponse = z.object({
  /** Alphabetical. */
  items: z.array(PantryItem),
});
export type PantryResponse = z.infer<typeof PantryResponse>;

export const AddPantryItemsRequest = z.object({
  /** 1–60 characters each; names already in the pantry (ignoring case and plurals) are skipped. */
  names: z.array(z.string().min(1).max(60)).min(1).max(50),
});
export type AddPantryItemsRequest = z.infer<typeof AddPantryItemsRequest>;

export const PantryRecipe = z.object({
  title: z.string(),
  minutes: z.number().int(),
  servings: z.number().int(),
  /** Per serving. */
  calories: z.number().int(),
  macros: Macros,
  /** inPantry is worked out by the API from the pantry, not by the model. */
  ingredients: z.array(z.object({ name: z.string(), quantity: z.string(), inPantry: z.boolean() })),
  steps: z.array(z.string()),
  whyItFits: z.string(),
});
export type PantryRecipe = z.infer<typeof PantryRecipe>;

export const PantryRecipesResponse = z.object({ recipes: z.array(PantryRecipe) });
export type PantryRecipesResponse = z.infer<typeof PantryRecipesResponse>;

export const Pillar = z.enum(["fuel", "rhythm", "recovery", "mind", "movement", "environment", "supplements"]);

/** A technique taken from a talk, waiting for review on the admin Knowledge screen (docs/NCBM.md §7). */
export const KnowledgeTechnique = z.object({
  id: z.string(),
  title: z.string(),
  pillar: Pillar,
  summary: z.string(),
  steps: z.array(z.string()),
  evidence: z.string(),
  cautions: z.string(),
  quote: z.string(),
  /** The video at the moment it was said, when known. */
  link: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  /** The routine it became, once approved. */
  protocolId: z.string().optional(),
});
export type KnowledgeTechnique = z.infer<typeof KnowledgeTechnique>;

export const KnowledgeSource = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  channel: z.string().optional(),
  publishedAt: IsoDateTime.optional(),
  /** queued: waiting for a transcript; extracted: techniques below; failed: try the transcript again. */
  status: z.enum(["queued", "extracted", "failed"]),
  techniques: z.array(KnowledgeTechnique),
});
export type KnowledgeSource = z.infer<typeof KnowledgeSource>;

export const AdminKnowledge = z.object({
  /** Newest first. */
  sources: z.array(KnowledgeSource),
  /** Channels checked for new videos each month; empty without a YouTube API key. */
  watching: z.array(z.string()),
});
export type AdminKnowledge = z.infer<typeof AdminKnowledge>;

const Transcript = z.string().min(500, "Paste the whole transcript.").max(150_000, "Split the transcript in two.");

export const AddKnowledgeSourceRequest = z.object({
  url: z.url(),
  title: z.string().min(1).max(200),
  /** Optional: add it now, or later from the list. */
  transcript: Transcript.optional(),
});
export type AddKnowledgeSourceRequest = z.infer<typeof AddKnowledgeSourceRequest>;

export const AddTranscriptRequest = z.object({ transcript: Transcript });
export type AddTranscriptRequest = z.infer<typeof AddTranscriptRequest>;

export const ReviewTechniqueRequest = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approve"),
    /** Edits before it goes into the catalog. */
    title: z.string().max(120).optional(),
    summary: z.string().max(500).optional(),
    steps: z.array(z.string().max(300)).max(6).optional(),
  }),
  z.object({ decision: z.literal("reject") }),
]);
export type ReviewTechniqueRequest = z.infer<typeof ReviewTechniqueRequest>;

export const KnowledgeSyncResponse = z.object({ added: z.number().int().nonnegative() });
export type KnowledgeSyncResponse = z.infer<typeof KnowledgeSyncResponse>;

/** One glucose-sensor day, summarised on the phone (backend domain/glucose.ts). */
export const GlucoseDay = z.object({
  date: IsoDate,
  meanMgdl: z.number(),
  /** Share of readings 70–140 mg/dL, 0–100. */
  inRange140Pct: z.number().min(0).max(100),
  /** Share of readings 70–180 mg/dL, 0–100. */
  inRange180Pct: z.number().min(0).max(100),
  /** Coefficient of variation, 0–100. */
  cvPct: z.number().min(0).max(100),
  readings: z.number().int().positive(),
  source: z.enum(["health_connect", "apple_health"]),
});
export type GlucoseDay = z.infer<typeof GlucoseDay>;

export const RecordGlucoseRequest = z.object({ days: z.array(GlucoseDay).min(1).max(31) });
export type RecordGlucoseRequest = z.infer<typeof RecordGlucoseRequest>;

export const GlucoseResponse = z.object({ days: z.array(GlucoseDay) });
export type GlucoseResponse = z.infer<typeof GlucoseResponse>;

export const HealthMarkerId = z.enum([
  "resting_hr",
  "hrv",
  "vo2max",
  "bp_systolic",
  "bp_diastolic",
  "waist_cm",
  "grip_kg",
  "body_fat_pct",
  "hba1c",
  "ldl",
  "hdl",
  "triglycerides",
]);
export type HealthMarkerId = z.infer<typeof HealthMarkerId>;

export const MarkerReading = z.object({
  id: z.string(),
  marker: HealthMarkerId,
  value: z.number(),
  measuredAt: IsoDateTime,
  source: z.enum(["manual", "health_connect", "apple_health"]),
});
export type MarkerReading = z.infer<typeof MarkerReading>;

/** One marker with readings (backend domain/markers.ts): label, unit and a plain-words reference. */
export const MarkerSummary = z.object({
  marker: HealthMarkerId,
  label: z.string(),
  unit: z.string(),
  better: z.enum(["lower", "higher"]).nullable(),
  /** General adult reference in plain words; never a diagnosis. */
  reference: z.string(),
  latest: MarkerReading,
  /** Latest minus the reading closest to 90 days earlier; null without one at least 30 days older. */
  change: z.number().nullable(),
  improving: z.boolean().nullable(),
  /** Up to 12 readings, oldest first. */
  points: z.array(z.object({ value: z.number(), measuredAt: IsoDateTime })),
});
export type MarkerSummary = z.infer<typeof MarkerSummary>;

export const HealthMarkersResponse = z.object({ markers: z.array(MarkerSummary) });
export type HealthMarkersResponse = z.infer<typeof HealthMarkersResponse>;

export const RecordMarkersRequest = z.object({
  readings: z
    .array(
      z.object({
        marker: HealthMarkerId,
        value: z.number(),
        /** Defaults to now. */
        measuredAt: IsoDateTime.optional(),
        source: z.enum(["manual", "health_connect", "apple_health"]).default("manual"),
      }),
    )
    .min(1)
    .max(200),
});
export type RecordMarkersRequest = z.infer<typeof RecordMarkersRequest>;

/** One weekly longevity habit (backend domain/healthspan.ts), worked out from what's logged. */
export const HealthspanHabit = z.object({
  id: z.enum(["zone2", "strength", "hard_cardio", "protein", "whole_food", "steady_wake", "daylight"]),
  title: z.string(),
  detail: z.string(),
  progress: z.number(),
  target: z.number(),
  /** "min", "sessions", "days", "nights" or "%" (for "%", lower is better: under the target). */
  unit: z.string(),
  done: z.boolean(),
  /** Set when a health condition leaves the habit out; says why. Skipped habits don't count. */
  skipped: z.string().optional(),
});
export type HealthspanHabit = z.infer<typeof HealthspanHabit>;

export const HealthspanResponse = z.object({
  /** Monday. */
  weekStart: IsoDate,
  /** Days of the week so far, today included. */
  days: z.number().int().min(1).max(7),
  habits: z.array(HealthspanHabit),
});
export type HealthspanResponse = z.infer<typeof HealthspanResponse>;

export const DeviceTag = z.enum(["kitchen:air-fryer", "kitchen:water-filter", "kitchen:ice-cream-maker", "kitchen:blender"]);
export type DeviceTag = z.infer<typeof DeviceTag>;

/** A kitchen device the monthly scout found, waiting for review. */
export const DeviceCandidate = z.object({
  id: z.string(),
  tag: DeviceTag,
  /** "Air fryer", "Water filter", … */
  category: z.string(),
  name: z.string(),
  maker: z.string(),
  url: z.string(),
  description: z.string(),
  status: z.enum(["pending", "approved", "dismissed"]),
  /** The product it became, once approved. */
  productId: z.string().optional(),
  foundAt: IsoDateTime,
});
export type DeviceCandidate = z.infer<typeof DeviceCandidate>;

export const AdminDevices = z.object({
  /** Newest first. */
  devices: z.array(DeviceCandidate),
  /** False without a search key: the monthly scan and "Look now" can't run. */
  canScan: z.boolean(),
});
export type AdminDevices = z.infer<typeof AdminDevices>;

export const ReviewDeviceRequest = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approve"),
    /** Edits before it becomes a product. */
    name: z.string().max(120).optional(),
    description: z.string().max(600).optional(),
    url: z.url().optional(),
  }),
  z.object({ decision: z.literal("dismiss") }),
]);
export type ReviewDeviceRequest = z.infer<typeof ReviewDeviceRequest>;

export const DeviceScanResponse = z.object({ added: z.number().int().nonnegative() });
export type DeviceScanResponse = z.infer<typeof DeviceScanResponse>;

export const CreateMealPlanRequest = z.object({ days: z.number().int().min(1).max(3) });
export type CreateMealPlanRequest = z.infer<typeof CreateMealPlanRequest>;

const PlanIngredient = z.object({
  name: z.string(),
  quantity: z.string(),
  grams: z.number(),
  /** Already in the pantry. */
  inPantry: z.boolean(),
  /** catalog: USDA values scaled by weight; estimate: the planner's figures. */
  source: z.enum(["catalog", "estimate"]),
});

export const MealPlanResponse = z.object({
  createdAt: IsoDateTime,
  days: z.array(
    z.object({
      day: z.number().int(),
      meals: z.array(
        z.object({
          kind: MealKind,
          title: z.string(),
          calories: z.number().int(),
          macros: Macros,
          processing: z.enum(["whole", "processed", "ultra_processed"]),
          ingredients: z.array(PlanIngredient),
          steps: z.array(z.string()),
        }),
      ),
      calories: z.number().int(),
      macros: Macros,
    }),
  ),
  targets: z.object({ calories: z.number().int(), macros: Macros }),
  /** Everything not in the pantry, combined across the plan, most-used first. */
  shoppingList: z.array(z.object({ name: z.string(), grams: z.number().int(), meals: z.number().int() })),
});
export type MealPlanResponse = z.infer<typeof MealPlanResponse>;

export const AnalyzeRecipeRequest = z.object({
  /** The ingredients with their amounts; method steps can be included and are ignored. */
  text: z.string().min(10).max(8000),
  /** Overrides the servings the recipe states. */
  servings: z.number().int().min(1).max(24).optional(),
});
export type AnalyzeRecipeRequest = z.infer<typeof AnalyzeRecipeRequest>;

export const RecipeAnalysis = z.object({
  /** The text wasn't a recipe; the rest is then left out. */
  problem: z.literal("not_a_recipe").optional(),
  title: z.string().optional(),
  servings: z.number().int().optional(),
  /** Per serving. */
  calories: z.number().int().optional(),
  macros: Macros.optional(),
  processing: z.enum(["whole", "processed", "ultra_processed"]).optional(),
  /** Share of calories from USDA catalog values rather than estimates, 0–1. */
  catalogShare: z.number().min(0).max(1).optional(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      quantity: z.string(),
      grams: z.number(),
      calories: z.number().int(),
      macros: Macros,
      processing: z.enum(["whole", "processed", "ultra_processed"]),
      /** catalog: USDA values scaled by weight; estimate: the reader's figures. */
      source: z.enum(["catalog", "estimate"]),
    }),
  ),
});
export type RecipeAnalysis = z.infer<typeof RecipeAnalysis>;

/** A typed or pasted list; send a photo of the list as multipart `photo` instead. */
export const ShoppingReviewRequest = z.object({ text: z.string().min(1).max(4000) });
export type ShoppingReviewRequest = z.infer<typeof ShoppingReviewRequest>;

export const ShoppingReviewResponse = z.object({
  /** The photo wasn't a list or receipt, or couldn't be read; items are then empty. */
  problem: z.enum(["not_a_list", "unreadable"]).optional(),
  items: z.array(
    z.object({
      name: z.string(),
      processing: z.enum(["whole", "processed", "ultra_processed"]),
      verdict: z.enum(["keep", "swap", "limit"]),
      reason: z.string(),
      /** A cleaner choice, when the verdict is swap. */
      swapFor: z.string().optional(),
    }),
  ),
  /** Kitchen devices the list calls for, each with the items that called for it. */
  devices: z.array(z.object({ product: ProductRecommendation, because: z.array(z.string()) })),
});
export type ShoppingReviewResponse = z.infer<typeof ShoppingReviewResponse>;

export const EnvironmentItems = z.object({
  /** 10+ minutes of outdoor light in the morning. */
  daylight: z.boolean().optional(),
  darkBedroom: z.boolean().optional(),
  quietBedroom: z.boolean().optional(),
  filteredWater: z.boolean().optional(),
});
export type EnvironmentItems = z.infer<typeof EnvironmentItems>;

export const EnvironmentDay = z.object({
  date: IsoDate,
  /** The town air quality is measured for, rounded to about 10 km; null until set. */
  location: z.object({ place: z.string(), latitude: z.number(), longitude: z.number() }).nullable(),
  /** The day's mean US AQI and its EPA band; null without a place or a reading. */
  air: z.object({ aqi: z.number().int(), category: z.enum(["good", "moderate", "sensitive", "unhealthy", "very_unhealthy", "hazardous"]) }).nullable(),
  check: EnvironmentItems.nullable(),
  /** The Focus Score's environment input for the day, 0–1. */
  signal: z.number().min(0).max(1).nullable(),
});
export type EnvironmentDay = z.infer<typeof EnvironmentDay>;

export const SetEnvironmentLocationRequest = z.object({ place: z.string().max(100).nullable() });
export type SetEnvironmentLocationRequest = z.infer<typeof SetEnvironmentLocationRequest>;

export const EnvironmentCheckRequest = z.object({ date: IsoDate.optional(), items: EnvironmentItems });
export type EnvironmentCheckRequest = z.infer<typeof EnvironmentCheckRequest>;

/** The biohacking level (docs/NCBM.md §8): 0 Getting started, 1 Aware … 5 Upgraded, from the last 28 days. */
export const LevelResponse = z.object({
  level: z.number().int().min(0).max(5),
  name: z.string(),
  /** Every habit for levels 1–5, in order; a level needs all of its own and every lower level's. */
  requirements: z.array(z.object({ level: z.number().int().min(1).max(5), title: z.string(), met: z.boolean(), progress: z.string() })),
});
export type LevelResponse = z.infer<typeof LevelResponse>;

export const BrainCheckHistory = z.object({
  /** Newest first. */
  checks: z.array(BrainCheck),
  /** The median score of checks before the latest one, once there are three. */
  baselineScore: z.number().int().optional(),
});
export type BrainCheckHistory = z.infer<typeof BrainCheckHistory>;

/** A packaged food, by barcode or label photos, graded by NeuroCal. */
export const FoodScanResponse = z.object({
  problem: z.enum(["not_a_label", "blurry", "too_dark", "cut_off"]).optional(),
  brand: z.string().optional(),
  productName: z.string().optional(),
  barcode: z.string().optional(),
  servingSize: z.string().optional(),
  servingsPerContainer: z.number().positive().optional(),
  /** Per serving. */
  nutrition: z
    .object({
      calories: z.number().nonnegative(),
      proteinG: z.number().nonnegative(),
      carbsG: z.number().nonnegative(),
      fatG: z.number().nonnegative(),
      fiberG: z.number().nonnegative().optional(),
      sugarsG: z.number().nonnegative().optional(),
      addedSugarsG: z.number().nonnegative().optional(),
      sodiumMg: z.number().nonnegative().optional(),
    })
    .optional(),
  ingredients: z.array(z.string()),
  /** The company that makes or distributes it ("Manufactured by …", "Distributed by …"), when printed. */
  manufacturer: z.string().optional(),
  /** Production or packed-on date, "YYYY-MM" or "YYYY-MM-DD", when printed. */
  producedOn: z.string().optional(),
  bestBefore: z.string().optional(),
  lotNumber: z.string().optional(),
  /** "open_food_facts" data must be credited where it shows (Open Database License). */
  source: z.enum(["label", "open_food_facts"]),
  /** NOVA-style level from the ingredient list, and the industrial ingredients that made it ultra-processed. */
  processing: z.object({ level: z.enum(["whole", "processed", "ultra_processed"]), markers: z.array(z.string()) }),
  flags: z.array(z.object({ kind: z.enum(["ultra_processed", "high_added_sugar", "high_sodium", "expired", "expires_soon"]), message: z.string() })),
  /** One serving ready to log; its glycemic load is an estimate. Missing without nutrition. */
  item: FoodItem.optional(),
});
export type FoodScanResponse = z.infer<typeof FoodScanResponse>;

export const StackTiming = z.enum(["morning", "with_food", "evening", "any"]);
export type StackTiming = z.infer<typeof StackTiming>;

/** A supplement in someone's stack. */
export const StackItem = z.object({
  id: Id,
  name: z.string().min(1),
  servingSize: z.string().optional(),
  ingredients: z.array(SupplementIngredient),
  servingsPerDay: z.number().int().min(1).max(6),
  timing: StackTiming,
  servingsPerContainer: z.number().int().positive().optional(),
  /** When this bottle was started (YYYY-MM-DD). */
  startedOn: IsoDate,
  /** Days of this bottle left, when servingsPerContainer is known. */
  daysLeft: z.number().int().nonnegative().optional(),
  /** Ticked as taken today (the profile's local day). */
  takenToday: z.boolean(),
});
export type StackItem = z.infer<typeof StackItem>;

/** Something about the stack as a whole. Worded by the server; clients show `message` as is. */
export const StackFlag = z.object({
  /** interaction: an ingredient that interacts with the medicines behind a health condition. */
  kind: z.enum(["above_upper_limit", "duplicate", "late_caffeine", "interaction"]),
  message: z.string().min(1),
  itemIds: z.array(Id),
});
export type StackFlag = z.infer<typeof StackFlag>;

export const StackResponse = z.object({
  /** Today in the profile's time zone. */
  date: IsoDate,
  items: z.array(StackItem),
  flags: z.array(StackFlag),
});
export type StackResponse = z.infer<typeof StackResponse>;

/** The most supplements a stack holds. */
export const MAX_STACK_ITEMS = 30;

export const AddStackItemRequest = z.object({
  name: z.string().trim().min(1).max(120),
  servingSize: z.string().max(80).optional(),
  ingredients: z.array(SupplementIngredient).max(60),
  servingsPerDay: z.number().int().min(1).max(6),
  timing: StackTiming,
  servingsPerContainer: z.number().int().positive().max(2000).optional(),
});
export type AddStackItemRequest = z.infer<typeof AddStackItemRequest>;

export const UpdateStackItemRequest = z.object({
  servingsPerDay: z.number().int().min(1).max(6).optional(),
  timing: StackTiming.optional(),
  servingsPerContainer: z.number().int().positive().max(2000).nullable().optional(),
  /** Started a new bottle today: resets the running-low count. */
  newBottle: z.boolean().optional(),
});
export type UpdateStackItemRequest = z.infer<typeof UpdateStackItemRequest>;

export const SetTakenRequest = z.object({ taken: z.boolean() });
export type SetTakenRequest = z.infer<typeof SetTakenRequest>;

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

/** Someone asking to be told when the mobile app is ready. Public: no sign-in. */
export const JoinWaitlistRequest = z.object({
  email: z.email().max(254),
  /** The phone they would install it on, when they say. */
  platform: z.enum(["iphone", "android"]).optional(),
});
export type JoinWaitlistRequest = z.infer<typeof JoinWaitlistRequest>;

/** The same answer whether or not the address was already on the list, so the list can't be probed. */
export const JoinWaitlistResponse = z.object({ status: z.literal("joined") });
export type JoinWaitlistResponse = z.infer<typeof JoinWaitlistResponse>;

/** The token from the unsubscribe link in a waitlist email. */
export const LeaveWaitlistRequest = z.object({ token: z.string().min(16).max(64) });
export type LeaveWaitlistRequest = z.infer<typeof LeaveWaitlistRequest>;

export const LeaveWaitlistResponse = z.object({ status: z.literal("unsubscribed") });
export type LeaveWaitlistResponse = z.infer<typeof LeaveWaitlistResponse>;

/** One person on the waitlist, as the admin dashboard shows them. */
export const AdminWaitlistEntry = z.object({
  email: z.string(),
  platform: z.enum(["iphone", "android"]).optional(),
  joinedAt: IsoDateTime,
  /** The "you're on the list" email went out. */
  confirmed: z.boolean(),
  unsubscribed: z.boolean(),
});
export type AdminWaitlistEntry = z.infer<typeof AdminWaitlistEntry>;

/** The waitlist at a glance, with the newest sign-ups. Counts leave out people who unsubscribed. */
export const AdminWaitlist = z.object({
  total: z.number().int().nonnegative(),
  iphone: z.number().int().nonnegative(),
  android: z.number().int().nonnegative(),
  /** Joined in the last seven days. */
  thisWeek: z.number().int().nonnegative(),
  unsubscribed: z.number().int().nonnegative(),
  /** Newest first, at most 500. */
  entries: z.array(AdminWaitlistEntry),
});
export type AdminWaitlist = z.infer<typeof AdminWaitlist>;

/** The caller's subscription (RevenueCat), and whether it gives access right now. */
export const SubscriptionStatus = z.object({
  active: z.boolean(),
  status: z.enum(["trial", "active", "grace", "expired", "none"]),
  productId: z.string().optional(),
  /** When access ends unless it renews. */
  expiresAt: IsoDateTime.optional(),
  /** False once cancelled; access lasts until `expiresAt`. */
  willRenew: z.boolean(),
});
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>;

/**
 * Everything the Today screen shows, in one call. Without `date` it is today in the profile's time zone and
 * carries the extras (suggestions, fasting, stack, Brain speed); with a past `date` only the day itself.
 * An extra that fails is left out, so the day still shows.
 */
export const TodayResponse = z.object({
  focus: FocusScore,
  bio: BioState,
  meals: MealList,
  recipes: NextRecommendationsResponse.optional(),
  fasting: FastingStatus.optional(),
  stack: StackResponse.optional(),
  brain: BrainCheckHistory.optional(),
  /** The day's exercise; left out only if it failed to load. */
  exercise: ExerciseDay.optional(),
  /** The day's environment; left out only if it failed to load. */
  environment: EnvironmentDay.optional(),
});
export type TodayResponse = z.infer<typeof TodayResponse>;

export const ApiError = z.object({
  code: z.string(),
  message: z.string(),
});
export type ApiError = z.infer<typeof ApiError>;

/** HTTP surface shared by the web app, its mocks and the backend. */
export const endpoints = {
  getMe: { method: "GET", path: "/me", response: Profile },
  updateProfile: { method: "PUT", path: "/me/profile", body: UpdateProfileRequest, response: Profile },
  /** Deletes the account for good: profile, meals, scores, photos, waitlist entry and the sign-in itself. */
  deleteAccount: { method: "DELETE", path: "/me" },
  getBioState: { method: "GET", path: "/bio-state", response: BioState },
  createCheckIn: { method: "POST", path: "/check-ins", body: CreateCheckInRequest, response: CheckIn },
  /** Step 1 of logging a photo: get a short-lived URL to upload it to. */
  createPhotoUpload: { method: "POST", path: "/uploads/meal-photo", body: CreatePhotoUploadRequest, response: PhotoUpload },
  /** Takes the key of an uploaded photo, or (older clients) the photo itself as multipart `photo`. */
  analyzeMeal: { method: "POST", path: "/meals/analyze", body: AnalyzeMealRequest, response: AnalyzeMealResponse },
  /** Logs a weigh-in; one per day, a second the same day replaces the first. */
  logWeight: { method: "POST", path: "/weights", body: LogWeightRequest, response: WeightEntry },
  /** Weigh-ins for the last `days` days (default 90, at most 730) with the trend and goal progress. */
  getWeights: { method: "GET", path: "/weights", response: WeightHistory },
  deleteWeight: { method: "DELETE", path: "/weights/:date" },
  getFasting: { method: "GET", path: "/fasting", response: FastingStatus },
  /** Saves a Brain speed check from its raw reaction times; the API scores it. */
  addBrainCheck: { method: "POST", path: "/brain-checks", body: BrainCheckRequest, response: BrainCheck },
  /** Checks from the last `days` days (default 30) with your usual score. */
  getBrainChecks: { method: "GET", path: "/brain-checks", response: BrainCheckHistory },
  /** Logs exercise; the API works out the calories. */
  logExercise: { method: "POST", path: "/exercises", body: LogExerciseRequest, response: Exercise },
  /** A day's exercise (?date=, default today) with its totals. */
  getExercises: { method: "GET", path: "/exercises", response: ExerciseDay },
  deleteExercise: { method: "DELETE", path: "/exercises/:id" },
  /** A day's environment (?date=, default today): air where you live, the check, and the score input. */
  getEnvironment: { method: "GET", path: "/environment", response: EnvironmentDay },
  /** Sets (or with null, clears) the town air quality is measured for. */
  setEnvironmentLocation: { method: "PUT", path: "/environment/location", body: SetEnvironmentLocationRequest, response: EnvironmentDay },
  /** Saves answers to the day's environment check; items not sent keep their answer. */
  saveEnvironmentCheck: { method: "PUT", path: "/environment/check", body: EnvironmentCheckRequest, response: EnvironmentDay },
  /** The biohacking level from the last 28 days, with each habit and how close it is. */
  getLevel: { method: "GET", path: "/level", response: LevelResponse },
  getPantry: { method: "GET", path: "/pantry", response: PantryResponse },
  /** The latest meal plan; 404 when there isn't one yet. */
  getMealPlan: { method: "GET", path: "/meal-plan", response: MealPlanResponse },
  /** Makes a new plan (replacing the last) for 1–3 days. Paid. */
  createMealPlan: { method: "POST", path: "/meal-plan", body: CreateMealPlanRequest, response: MealPlanResponse },
  /** Calories and macros per serving of a typed or pasted recipe. Paid; nothing is saved. */
  analyzeRecipe: { method: "POST", path: "/recipes/analyze", body: AnalyzeRecipeRequest, response: RecipeAnalysis },
  /** Grades a shopping list item by item, with kitchen devices that would help. Paid; nothing is saved. */
  reviewShoppingList: { method: "POST", path: "/shopping/review", body: ShoppingReviewRequest, response: ShoppingReviewResponse },
  addPantryItems: { method: "POST", path: "/pantry", body: AddPantryItemsRequest, response: PantryResponse },
  deletePantryItem: { method: "DELETE", path: "/pantry/:id" },
  /** Up to three recipes from the pantry that fit what's left of today. Paid; nothing is saved. */
  pantryRecipes: { method: "POST", path: "/pantry/recipes", response: PantryRecipesResponse },
  /** The supplements someone takes, today's ticks, and checks across the whole stack. */
  getStack: { method: "GET", path: "/stack", response: StackResponse },
  addStackItem: { method: "POST", path: "/stack", body: AddStackItemRequest, response: StackItem },
  updateStackItem: { method: "PUT", path: "/stack/:id", body: UpdateStackItemRequest, response: StackItem },
  deleteStackItem: { method: "DELETE", path: "/stack/:id" },
  /** Ticks (or unticks) a supplement as taken today. */
  setStackTaken: { method: "PUT", path: "/stack/:id/taken", body: SetTakenRequest, response: SetTakenRequest },
  getSubscription: { method: "GET", path: "/me/subscription", response: SubscriptionStatus },
  /** The whole food catalog (about 100 foods), sorted by name; clients search and filter it themselves. */
  listFoods: { method: "GET", path: "/foods", response: FoodCatalog },
  /** Reads 1–4 photos of a food package (photoKeys, or multipart) and grades it. Nothing is saved. */
  scanFood: { method: "POST", path: "/foods/scan", body: AnalyzeSupplementRequest, response: FoodScanResponse },
  /** Looks a barcode up in Open Food Facts and grades it. 404 when it isn't known. */
  lookupBarcode: { method: "GET", path: "/foods/barcode/:code", response: FoodScanResponse },
  /** Reads 1–4 photos of one supplement bottle as a single label (uploaded photoKeys, or multipart). Nothing is saved. */
  analyzeSupplement: { method: "POST", path: "/supplements/analyze", body: AnalyzeSupplementRequest, response: SupplementLabelResponse },
  createMeal: { method: "POST", path: "/meals", body: CreateMealRequest, response: Meal },
  listMeals: { method: "GET", path: "/meals", response: MealList },
  deleteMeal: { method: "DELETE", path: "/meals/:id" },
  nextRecommendations: { method: "GET", path: "/recommendations/next", response: NextRecommendationsResponse },
  getFocusScore: { method: "GET", path: "/focus-score", response: FocusScore },
  /** The whole Today screen in one call (see TodayResponse). */
  getToday: { method: "GET", path: "/today", response: TodayResponse },
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
  /** Admin only: videos and the techniques taken from them, for review. */
  getAdminKnowledge: { method: "GET", path: "/admin/knowledge", response: AdminKnowledge },
  addKnowledgeSource: { method: "POST", path: "/admin/knowledge/sources", body: AddKnowledgeSourceRequest, response: KnowledgeSource },
  addKnowledgeTranscript: { method: "POST", path: "/admin/knowledge/sources/:id/transcript", body: AddTranscriptRequest, response: KnowledgeSource },
  /** Approve (into the catalog as a routine, optionally edited) or reject. */
  reviewTechnique: { method: "PUT", path: "/admin/knowledge/techniques/:id", body: ReviewTechniqueRequest, response: KnowledgeTechnique },
  /** Checks the watched channels for new videos now, instead of waiting for the monthly run. */
  syncKnowledge: { method: "POST", path: "/admin/knowledge/sync", response: KnowledgeSyncResponse },
  /** The last 14 glucose-sensor days, oldest first. */
  getGlucose: { method: "GET", path: "/glucose", response: GlucoseResponse },
  /** Daily summaries from a glucose sensor; a day sent again replaces the earlier one. */
  recordGlucose: { method: "POST", path: "/glucose", body: RecordGlucoseRequest, response: IngestResponse },
  /** Health markers with readings: the latest, the three-month change and recent points. */
  getMarkers: { method: "GET", path: "/markers", response: HealthMarkersResponse },
  /** Readings typed in or imported from Health Connect / Apple Health; the same marker, time and source is kept once. */
  recordMarkers: { method: "POST", path: "/markers", body: RecordMarkersRequest, response: IngestResponse },
  deleteMarker: { method: "DELETE", path: "/markers/:id" },
  /** This week's healthspan habits (Monday to today), from what's logged. */
  getHealthspan: { method: "GET", path: "/healthspan", response: HealthspanResponse },
  /** Admin only: kitchen devices the monthly scout found, for review. */
  getAdminDevices: { method: "GET", path: "/admin/devices", response: AdminDevices },
  /** Approve (into the products, optionally edited) or dismiss. */
  reviewDevice: { method: "PUT", path: "/admin/devices/:id", body: ReviewDeviceRequest, response: DeviceCandidate },
  /** Looks for new devices now, instead of waiting for the monthly run. */
  scanDevices: { method: "POST", path: "/admin/devices/scan", response: DeviceScanResponse },
  /** Admin only (403 otherwise): the waitlist at a glance. */
  getAdminWaitlist: { method: "GET", path: "/admin/waitlist", response: AdminWaitlist },
  /** Public (no sign-in): join the list to be emailed when the app is ready. */
  joinWaitlist: { method: "POST", path: "/waitlist", body: JoinWaitlistRequest, response: JoinWaitlistResponse },
  /** Public: leave the list with the token from an email's unsubscribe link. */
  leaveWaitlist: { method: "POST", path: "/waitlist/unsubscribe", body: LeaveWaitlistRequest, response: LeaveWaitlistResponse },
} as const;

export function mealCalories(meal: Pick<Meal, "items">): number {
  return meal.items.reduce((sum, item) => sum + item.calories, 0);
}

export function caloriesRemaining(state: Pick<BioState, "calorieTarget" | "caloriesEaten">): number {
  return state.calorieTarget - state.caloriesEaten;
}
