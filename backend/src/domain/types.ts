/**
 * Domain types. No external dependencies: the wire format lives in
 * packages/contracts and is mapped in presentation/ (ARCHITECTURE §2–3).
 */

export const DIETARY_PREFERENCES = [
  "omnivore",
  "pescatarian",
  "vegetarian",
  "vegan",
  "keto",
  "mediterranean",
  "cyclical_keto",
  "low_toxin",
  "carnivore",
  "paleo",
  "standard",
] as const;
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
  /** Onboarding answers, stored as given. The contract (presentation) validates their shape in and out. */
  bioProfile?: BioProfileAnswers;
}

export type BioProfileAnswers = Readonly<Record<string, string | boolean | string[]>>;

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

/** `clientKey` is made up by the client once per meal; saving the same key twice keeps the first meal. */
export type NewMeal = Omit<Meal, "id" | "userId"> & { clientKey?: string };

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

export const TELEMETRY_SOURCES = ["manual", "apple_health", "health_connect", "wearable"] as const;
export type TelemetrySource = (typeof TELEMETRY_SOURCES)[number];

export interface SleepSession {
  start: Date;
  end: Date;
  source: TelemetrySource;
  deepMinutes?: number;
}

export interface ScreenTimeSample {
  windowStart: Date;
  windowEnd: Date;
  minutes: number;
  source: TelemetrySource;
}

/** Each 0–1, or null when there was no data for it. */
export interface FocusComponents {
  sleep: number | null;
  timing: number | null;
  glycemic: number | null;
  stress: number | null;
}

export interface FocusScore {
  userId: string;
  date: string;
  /** 0–100, or null when no component has data. */
  score: number | null;
  components: FocusComponents;
  explanation: string;
  modelVersion: string;
}

/** NeuroCal-authored habit protocol (ARCHITECTURE §3). Content lives in the repo, not generated. */
export interface Protocol {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  tags: string[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  url?: string;
  /** Must be labelled as such wherever shown (ARCHITECTURE §10). */
  affiliate: boolean;
  /** Sold by a store run by NeuroCal's makers. Labelled like affiliate items. */
  ownBrand: boolean;
  /** Dietary supplement: clients add a safety note. */
  supplement: boolean;
  tags: string[];
}

/** A product as the admin screen sees it: what is shown to users, plus what the catalog says underneath. */
export interface AdminProduct extends Product {
  enabled: boolean;
  /** "catalog": authored in the repo; "admin": added from the admin screen. */
  managedBy: "catalog" | "admin";
  /** The catalog's own link, when an admin link replaces it. */
  catalogUrl?: string;
}

export interface ProductSettings {
  /** A link to show instead of the catalog's; null goes back to the catalog's link. */
  url?: string | null;
  affiliate?: boolean;
  enabled?: boolean;
}

export type FocusComponentName = keyof FocusComponents;

export interface WeakPoint {
  component: FocusComponentName;
  label: string;
  average: number;
}
