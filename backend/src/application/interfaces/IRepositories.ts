import type {
  CheckIn,
  FocusScore,
  ScreenTimeSample,
  SleepSession,
  LocalDay,
  Meal,
  NewCheckIn,
  NewMeal,
  NewRecipeRecommendation,
  Profile,
  RecipeRecommendation,
  WaitlistEntry,
  WaitlistPlatform,
} from "../../domain/types";

/** Maps the identity provider's subject (Cognito `sub`) to our user id, creating the user on first sign-in. */
export interface IUserRepository {
  findOrCreateByAuthSubject(subject: string, email: string): Promise<string>;
}

/** Every method below is scoped to one user; implementations must filter by userId (ARCHITECTURE §10). */

export interface IProfileRepository {
  get(userId: string): Promise<Profile | null>;
  save(profile: Profile): Promise<void>;
}

export interface IMealRepository {
  /** Non-deleted meals eaten on the local day, oldest first. */
  listForDay(userId: string, day: LocalDay): Promise<Meal[]>;
  get(userId: string, mealId: string): Promise<Meal | null>;
  create(userId: string, meal: NewMeal): Promise<Meal>;
  /** False when the meal doesn't exist or isn't this user's. */
  softDelete(userId: string, mealId: string): Promise<boolean>;
}

export interface ICheckInRepository {
  create(userId: string, checkIn: NewCheckIn): Promise<CheckIn>;
  latestForDay(userId: string, day: LocalDay): Promise<CheckIn | null>;
  listForDay(userId: string, day: LocalDay): Promise<CheckIn[]>;
}

export interface ITelemetryRepository {
  /** A session replaces any stored session from the same source that overlaps it (re-syncs and corrections). Returns how many were stored. */
  upsertSleep(userId: string, sessions: SleepSession[]): Promise<number>;
  /** Idempotent on (source, windowStart). */
  upsertScreenTime(userId: string, samples: ScreenTimeSample[]): Promise<number>;
  sleepEndingOn(userId: string, day: LocalDay): Promise<SleepSession[]>;
  /** Samples whose window starts on any of the given local dates. */
  screenTimeStartingOn(userId: string, dates: string[], timeZone: string): Promise<ScreenTimeSample[]>;
}

export interface IFocusScoreRepository {
  get(userId: string, date: string): Promise<FocusScore | null>;
  put(score: FocusScore): Promise<void>;
}

export interface IWaitlistRepository {
  /**
   * Adds the address, or returns the entry it already has. `fresh` is true for a new address and
   * for one that had unsubscribed and is joining again; a platform given later replaces an earlier one.
   */
  join(email: string, platform: WaitlistPlatform | undefined, unsubscribeToken: string): Promise<{ entry: WaitlistEntry; fresh: boolean }>;
  markConfirmationSent(id: string, at: Date): Promise<void>;
  /** False when no entry has this token. Unsubscribing twice is fine. */
  leave(unsubscribeToken: string): Promise<boolean>;
}

export interface IRecommendationRepository {
  /** Saves one batch. `contextKey` names what it was made for, so the batch can be found again. */
  saveRecipes(userId: string, recipes: NewRecipeRecommendation[], contextKey?: string): Promise<RecipeRecommendation[]>;
  /** The newest batch saved with this key, or an empty list. */
  latestRecipes(userId: string, contextKey: string): Promise<RecipeRecommendation[]>;
}
