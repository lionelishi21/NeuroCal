import type { Session } from "../../domain/session";
import type { CoffeeCup } from "../../domain/coffee";
import type { FastPlan } from "../../domain/fasting";
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
  WaitlistOverview,
  WaitlistPlatform,
} from "../../domain/types";
import type { WeightEntry } from "../../domain/weight";

/** Maps the identity provider's subject (Cognito `sub`) to our user id, creating the user on first sign-in. */
export interface IUserRepository {
  findOrCreateByAuthSubject(subject: string, email: string): Promise<string>;
  /**
   * Deletes the user and every row that belongs to them, plus any waitlist entry for their email,
   * in one transaction. Returns their sign-in subject, or null when there was no such user.
   */
  delete(userId: string): Promise<{ authSubject: string } | null>;
  /** The sign-in email, for the account's own emails (welcome, deleted); null when there's no such user. */
  emailOf(userId: string): Promise<string | null>;
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
  /** When each non-deleted meal since `since` was eaten, oldest first (for the fasting timer). */
  /** When meals were eaten, oldest first; with [minKcal], only meals of at least that many kcal. */
  eatenSince(userId: string, since: Date, minKcal?: number): Promise<Date[]>;
}

export interface IWeightRepository {
  /** One weigh-in per day: a second the same day replaces the first. */
  upsert(userId: string, entry: WeightEntry): Promise<WeightEntry>;
  /** Weigh-ins on or after `since` (YYYY-MM-DD), oldest first. */
  list(userId: string, since: string): Promise<WeightEntry[]>;
  /** False when there was no weigh-in that day. */
  delete(userId: string, date: string): Promise<boolean>;
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
  /** Stored scores on or after `since` (YYYY-MM-DD), oldest first. */
  listSince(userId: string, since: string): Promise<FocusScore[]>;
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
  /** Counts, with "this week" meaning joined since `since`, and the newest `limit` entries. */
  overview(since: Date, limit: number): Promise<WaitlistOverview>;
}

export interface IRecommendationRepository {
  /** Saves one batch. `contextKey` names what it was made for, so the batch can be found again. */
  saveRecipes(userId: string, recipes: NewRecipeRecommendation[], contextKey?: string): Promise<RecipeRecommendation[]>;
  /** The newest batch saved with this key, or an empty list. */
  latestRecipes(userId: string, contextKey: string): Promise<RecipeRecommendation[]>;
}

/** The fast someone planned, one at a time; scoped to one user. */
export interface IFastPlanRepository {
  get(userId: string): Promise<FastPlan | null>;
  /** Null removes it. */
  set(userId: string, plan: FastPlan | null): Promise<void>;
}

/** The coffee log; scoped to one user. */
/** Gadget and practice sessions, scoped to one user. */
export interface ISessionRepository {
  add(userId: string, session: Omit<Session, "id">): Promise<Session>;
  /** Taken at or after `from` and before `to`, oldest first. */
  listBetween(userId: string, from: Date, to: Date): Promise<Session[]>;
  delete(userId: string, id: string): Promise<boolean>;
}

export interface ICoffeeRepository {
  add(userId: string, cup: Omit<CoffeeCup, "id">): Promise<CoffeeCup>;
  /** Cups taken in [from, to), oldest first. */
  listBetween(userId: string, from: Date, to: Date): Promise<CoffeeCup[]>;
  /** False when there was no such cup for this user. */
  delete(userId: string, id: string): Promise<boolean>;
}
