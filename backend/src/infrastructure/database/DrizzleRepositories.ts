import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import type {
  ICheckInRepository,
  IFocusScoreRepository,
  IMealRepository,
  IProfileRepository,
  IRecommendationRepository,
  ITelemetryRepository,
  IUserRepository,
  IWaitlistRepository,
  IWeightRepository,
} from "../../application/interfaces/IRepositories";
import type {
  CheckIn,
  CognitiveFlag,
  CognitiveGoal,
  DietaryPreference,
  FocusScore,
  FoodItem,
  FoodProcessing,
  GlycemicLoad,
  LocalDay,
  Meal,
  MealKind,
  NewCheckIn,
  NewMeal,
  NewRecipeRecommendation,
  Profile,
  RecipeRecommendation,
  ScreenTimeSample,
  SleepSession,
  TelemetrySource,
  WaitlistEntry,
  WaitlistOverview,
  WaitlistPlatform,
} from "../../domain/types";
import type { Subscription, SubscriptionStatus } from "../../domain/subscription";
import type { BrainCheckResult } from "../../domain/brainCheck";
import type { StackItem, StackTiming } from "../../domain/stack";
import type { IBrainCheckRepository, SavedBrainCheck } from "../../application/interfaces/IBrainCheckRepository";
import type { Exercise, IExerciseRepository, NewExercise } from "../../application/interfaces/IExerciseRepository";
import type { WeightEntry } from "../../domain/weight";
import type { IStackRepository, NewStackItem, StackItemPatch } from "../../application/interfaces/IStackRepository";
import type { EndingTrial, ISubscriptionRepository } from "../../application/interfaces/ISubscriptions";
import type { Database } from "./client";
import {
  brainChecks,
  exercises,
  checkIns,
  focusScores,
  mealItems,
  meals,
  profiles,
  recipeRecommendations,
  screenTimeSamples,
  sleepSessions,
  stackDoses,
  stackItems,
  subscriptions,
  users,
  waitlist,
  weightEntries,
} from "./schema";

/** Rows from a user's local calendar day, whatever time zone the database runs in. */
type TimestampColumn = typeof meals.eatenAt | typeof checkIns.at | typeof sleepSessions.endAt;
const onLocalDay = (column: TimestampColumn, day: LocalDay) =>
  sql`(${column} at time zone ${day.timeZone})::date = ${day.date}::date`;

export class DrizzleUserRepository implements IUserRepository {
  constructor(private readonly db: Database) {}

  async findOrCreateByAuthSubject(subject: string, email: string): Promise<string> {
    const [row] = await this.db
      .insert(users)
      .values({ cognitoSub: subject, email })
      .onConflictDoUpdate({ target: users.cognitoSub, set: { email } })
      .returning({ id: users.id });
    if (!row) throw new Error("User upsert returned no row");
    return row.id;
  }

  async delete(userId: string): Promise<{ authSubject: string } | null> {
    return this.db.transaction(async (tx) => {
      const [user] = await tx.select({ subject: users.cognitoSub, email: users.email }).from(users).where(eq(users.id, userId));
      if (!user) return null;
      // Meal items and the profile go with their meal and user (on delete cascade).
      await tx.delete(meals).where(eq(meals.userId, userId));
      await tx.delete(checkIns).where(eq(checkIns.userId, userId));
      await tx.delete(recipeRecommendations).where(eq(recipeRecommendations.userId, userId));
      await tx.delete(sleepSessions).where(eq(sleepSessions.userId, userId));
      await tx.delete(screenTimeSamples).where(eq(screenTimeSamples.userId, userId));
      await tx.delete(focusScores).where(eq(focusScores.userId, userId));
      await tx.delete(weightEntries).where(eq(weightEntries.userId, userId));
      await tx.delete(subscriptions).where(eq(subscriptions.userId, userId));
      // Doses go with their items (on delete cascade).
      await tx.delete(stackItems).where(eq(stackItems.userId, userId));
      await tx.delete(brainChecks).where(eq(brainChecks.userId, userId));
      await tx.delete(exercises).where(eq(exercises.userId, userId));
      await tx.delete(waitlist).where(eq(waitlist.email, user.email.toLowerCase()));
      await tx.delete(users).where(eq(users.id, userId));
      return { authSubject: user.subject };
    });
  }
}

export class DrizzleProfileRepository implements IProfileRepository {
  constructor(private readonly db: Database) {}

  async get(userId: string): Promise<Profile | null> {
    const [row] = await this.db.select().from(profiles).where(eq(profiles.userId, userId));
    if (!row) return null;
    return {
      userId: row.userId,
      displayName: row.displayName,
      timeZone: row.timeZone,
      dietaryPreference: row.dietaryPreference as DietaryPreference,
      cognitiveGoals: row.cognitiveGoals as CognitiveGoal[],
      dailyCalorieTarget: row.dailyCalorieTarget,
      macroTargets: { proteinG: row.proteinTargetG, carbsG: row.carbsTargetG, fatG: row.fatTargetG },
      ...(row.bioProfile ? { bioProfile: row.bioProfile } : {}),
      ...(row.weightGoal ? { weightGoal: row.weightGoal } : {}),
    };
  }

  async save(profile: Profile): Promise<void> {
    const values = {
      displayName: profile.displayName,
      timeZone: profile.timeZone,
      dietaryPreference: profile.dietaryPreference,
      cognitiveGoals: profile.cognitiveGoals,
      dailyCalorieTarget: profile.dailyCalorieTarget,
      proteinTargetG: profile.macroTargets.proteinG,
      carbsTargetG: profile.macroTargets.carbsG,
      fatTargetG: profile.macroTargets.fatG,
      bioProfile: profile.bioProfile ?? null,
      weightGoal: profile.weightGoal ?? null,
    };
    await this.db
      .insert(profiles)
      .values({ userId: profile.userId, ...values })
      .onConflictDoUpdate({ target: profiles.userId, set: values });
  }
}

export class DrizzleMealRepository implements IMealRepository {
  constructor(private readonly db: Database) {}

  async eatenSince(userId: string, since: Date): Promise<Date[]> {
    const rows = await this.db
      .select({ eatenAt: meals.eatenAt })
      .from(meals)
      .where(and(eq(meals.userId, userId), isNull(meals.deletedAt), gte(meals.eatenAt, since)))
      .orderBy(asc(meals.eatenAt));
    return rows.map((r) => r.eatenAt);
  }

  async listForDay(userId: string, day: LocalDay): Promise<Meal[]> {
    const rows = await this.db
      .select()
      .from(meals)
      .where(and(eq(meals.userId, userId), isNull(meals.deletedAt), onLocalDay(meals.eatenAt, day)))
      .orderBy(asc(meals.eatenAt));
    return this.withItems(rows);
  }

  async get(userId: string, mealId: string): Promise<Meal | null> {
    const rows = await this.db
      .select()
      .from(meals)
      .where(and(eq(meals.id, mealId), eq(meals.userId, userId), isNull(meals.deletedAt)));
    const [meal] = await this.withItems(rows);
    return meal ?? null;
  }

  /** The meal first saved with this key, deleted or not: a retry must never recreate it. */
  private async findByClientKey(userId: string, clientKey: string): Promise<Meal | null> {
    const rows = await this.db.select().from(meals).where(and(eq(meals.userId, userId), eq(meals.clientKey, clientKey)));
    const [meal] = await this.withItems(rows);
    return meal ?? null;
  }

  async create(userId: string, meal: NewMeal): Promise<Meal> {
    // The same key again is the same meal sent twice: keep the first.
    if (meal.clientKey) {
      const earlier = await this.findByClientKey(userId, meal.clientKey);
      if (earlier) return earlier;
    }
    try {
      return await this.insert(userId, meal);
    } catch (error) {
      // Two copies of the request racing: the unique key let one in, so hand back that one.
      const winner = meal.clientKey ? await this.findByClientKey(userId, meal.clientKey) : null;
      if (winner) return winner;
      throw error;
    }
  }

  private insert(userId: string, meal: NewMeal): Promise<Meal> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(meals)
        .values({ userId, kind: meal.kind, eatenAt: meal.eatenAt, photoKey: meal.photoKey ?? null, clientKey: meal.clientKey ?? null })
        .returning();
      if (!row) throw new Error("Meal insert returned no row");
      await tx.insert(mealItems).values(
        meal.items.map((item, position) => ({
          mealId: row.id,
          position,
          name: item.name,
          portion: item.portion,
          calories: item.calories,
          proteinG: item.macros.proteinG,
          carbsG: item.macros.carbsG,
          fatG: item.macros.fatG,
          confidence: item.confidence ?? null,
          glycemicLoad: item.glycemicLoad ?? null,
          processing: item.processing ?? null,
        })),
      );
      return { id: row.id, userId, kind: meal.kind, eatenAt: row.eatenAt, items: meal.items, ...(meal.photoKey ? { photoKey: meal.photoKey } : {}) };
    });
  }

  async softDelete(userId: string, mealId: string): Promise<boolean> {
    const rows = await this.db
      .update(meals)
      .set({ deletedAt: new Date() })
      .where(and(eq(meals.id, mealId), eq(meals.userId, userId), isNull(meals.deletedAt)))
      .returning({ id: meals.id });
    return rows.length > 0;
  }

  private async withItems(rows: (typeof meals.$inferSelect)[]): Promise<Meal[]> {
    if (rows.length === 0) return [];
    const items = await this.db
      .select()
      .from(mealItems)
      .where(inArray(mealItems.mealId, rows.map((r) => r.id)))
      .orderBy(asc(mealItems.position));
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      kind: row.kind as MealKind,
      eatenAt: row.eatenAt,
      ...(row.photoKey ? { photoKey: row.photoKey } : {}),
      items: items
        .filter((i) => i.mealId === row.id)
        .map(
          (i): FoodItem => ({
            name: i.name,
            portion: i.portion,
            calories: i.calories,
            macros: { proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG },
            ...(i.confidence === null ? {} : { confidence: i.confidence }),
            ...(i.glycemicLoad === null ? {} : { glycemicLoad: i.glycemicLoad as GlycemicLoad }),
            ...(i.processing === null ? {} : { processing: i.processing as FoodProcessing }),
          }),
        ),
    }));
  }
}

export class DrizzleCheckInRepository implements ICheckInRepository {
  constructor(private readonly db: Database) {}

  async create(userId: string, checkIn: NewCheckIn): Promise<CheckIn> {
    const [row] = await this.db
      .insert(checkIns)
      .values({ userId, at: checkIn.at, flags: checkIn.flags, note: checkIn.note ?? null })
      .returning();
    if (!row) throw new Error("Check-in insert returned no row");
    return toCheckIn(row);
  }

  async latestForDay(userId: string, day: LocalDay): Promise<CheckIn | null> {
    const [row] = await this.db
      .select()
      .from(checkIns)
      .where(and(eq(checkIns.userId, userId), isNull(checkIns.deletedAt), onLocalDay(checkIns.at, day)))
      .orderBy(desc(checkIns.at))
      .limit(1);
    return row ? toCheckIn(row) : null;
  }

  async listForDay(userId: string, day: LocalDay): Promise<CheckIn[]> {
    const rows = await this.db
      .select()
      .from(checkIns)
      .where(and(eq(checkIns.userId, userId), isNull(checkIns.deletedAt), onLocalDay(checkIns.at, day)))
      .orderBy(asc(checkIns.at));
    return rows.map(toCheckIn);
  }
}

function toCheckIn(row: typeof checkIns.$inferSelect): CheckIn {
  return {
    id: row.id,
    userId: row.userId,
    at: row.at,
    flags: row.flags as CognitiveFlag[],
    ...(row.note === null ? {} : { note: row.note }),
  };
}

export class DrizzleRecommendationRepository implements IRecommendationRepository {
  constructor(private readonly db: Database) {}

  async saveRecipes(userId: string, recipes: NewRecipeRecommendation[], contextKey?: string): Promise<RecipeRecommendation[]> {
    const rows = await this.db
      .insert(recipeRecommendations)
      .values(
        recipes.map((r) => ({
          userId,
          searchQuery: r.searchQuery,
          title: r.title,
          sourceName: r.sourceName,
          sourceUrl: r.sourceUrl,
          imageUrl: r.imageUrl ?? null,
          minutes: r.minutes,
          calories: r.calories,
          proteinG: r.macros.proteinG,
          carbsG: r.macros.carbsG,
          fatG: r.macros.fatG,
          reasoning: r.reasoning,
          contextKey: contextKey ?? null,
        })),
      )
      .returning({ id: recipeRecommendations.id });
    return recipes.map((r, i) => ({ ...r, id: rows[i]!.id }));
  }

  async latestRecipes(userId: string, contextKey: string): Promise<RecipeRecommendation[]> {
    const rows = await this.db
      .select()
      .from(recipeRecommendations)
      .where(and(eq(recipeRecommendations.userId, userId), eq(recipeRecommendations.contextKey, contextKey)))
      .orderBy(desc(recipeRecommendations.createdAt))
      .limit(20);
    // One insert is one batch: its rows share a timestamp.
    const newest = rows[0]?.createdAt.getTime();
    return rows
      .filter((row) => row.createdAt.getTime() === newest)
      .map((row) => ({
        id: row.id,
        title: row.title,
        sourceName: row.sourceName,
        sourceUrl: row.sourceUrl,
        ...(row.imageUrl ? { imageUrl: row.imageUrl } : {}),
        minutes: row.minutes,
        calories: row.calories,
        macros: { proteinG: row.proteinG, carbsG: row.carbsG, fatG: row.fatG },
        reasoning: row.reasoning,
        searchQuery: row.searchQuery,
      }));
  }
}

export class DrizzleTelemetryRepository implements ITelemetryRepository {
  constructor(private readonly db: Database) {}

  async upsertSleep(userId: string, sessions: SleepSession[]): Promise<number> {
    if (sessions.length === 0) return 0;
    return this.db.transaction(async (tx) => {
      for (const s of sessions) {
        await tx
          .delete(sleepSessions)
          .where(
            and(
              eq(sleepSessions.userId, userId),
              eq(sleepSessions.source, s.source),
              lt(sleepSessions.startAt, s.end),
              gt(sleepSessions.endAt, s.start),
            ),
          );
        await tx
          .insert(sleepSessions)
          .values({ userId, source: s.source, startAt: s.start, endAt: s.end, deepMinutes: s.deepMinutes ?? null });
      }
      return sessions.length;
    });
  }

  async upsertScreenTime(userId: string, samples: ScreenTimeSample[]): Promise<number> {
    if (samples.length === 0) return 0;
    const rows = await this.db
      .insert(screenTimeSamples)
      .values(samples.map((s) => ({ userId, source: s.source, windowStart: s.windowStart, windowEnd: s.windowEnd, minutes: s.minutes })))
      .onConflictDoUpdate({
        target: [screenTimeSamples.userId, screenTimeSamples.source, screenTimeSamples.windowStart],
        set: { windowEnd: sql`excluded.window_end`, minutes: sql`excluded.minutes` },
      })
      .returning({ id: screenTimeSamples.id });
    return rows.length;
  }

  async sleepEndingOn(userId: string, day: LocalDay): Promise<SleepSession[]> {
    const rows = await this.db
      .select()
      .from(sleepSessions)
      .where(and(eq(sleepSessions.userId, userId), onLocalDay(sleepSessions.endAt, day)))
      .orderBy(asc(sleepSessions.startAt));
    return rows.map((r) => ({
      start: r.startAt,
      end: r.endAt,
      source: r.source as TelemetrySource,
      ...(r.deepMinutes === null ? {} : { deepMinutes: r.deepMinutes }),
    }));
  }

  async screenTimeStartingOn(userId: string, dates: string[], timeZone: string): Promise<ScreenTimeSample[]> {
    if (dates.length === 0) return [];
    const rows = await this.db
      .select()
      .from(screenTimeSamples)
      .where(
        and(
          eq(screenTimeSamples.userId, userId),
          inArray(sql`(${screenTimeSamples.windowStart} at time zone ${timeZone})::date::text`, dates),
        ),
      )
      .orderBy(asc(screenTimeSamples.windowStart));
    return rows.map((r) => ({ windowStart: r.windowStart, windowEnd: r.windowEnd, minutes: r.minutes, source: r.source as TelemetrySource }));
  }
}

export class DrizzleFocusScoreRepository implements IFocusScoreRepository {
  constructor(private readonly db: Database) {}

  async get(userId: string, date: string): Promise<FocusScore | null> {
    const [row] = await this.db.select().from(focusScores).where(and(eq(focusScores.userId, userId), eq(focusScores.date, date)));
    if (!row) return null;
    return {
      userId: row.userId,
      date: row.date,
      score: row.score,
      components: { sleep: row.sleepComponent, timing: row.timingComponent, glycemic: row.glycemicComponent, stress: row.stressComponent },
      explanation: row.explanation,
      modelVersion: row.modelVersion,
    };
  }

  async put(score: FocusScore): Promise<void> {
    const values = {
      score: score.score,
      sleepComponent: score.components.sleep,
      timingComponent: score.components.timing,
      glycemicComponent: score.components.glycemic,
      stressComponent: score.components.stress,
      explanation: score.explanation,
      modelVersion: score.modelVersion,
      computedAt: new Date(),
    };
    await this.db
      .insert(focusScores)
      .values({ userId: score.userId, date: score.date, ...values })
      .onConflictDoUpdate({ target: [focusScores.userId, focusScores.date], set: values });
  }
}

const toWaitlistEntry = (row: typeof waitlist.$inferSelect): WaitlistEntry => ({
  id: row.id,
  email: row.email,
  ...(row.platform ? { platform: row.platform as WaitlistPlatform } : {}),
  unsubscribeToken: row.unsubscribeToken,
  ...(row.confirmationSentAt ? { confirmationSentAt: row.confirmationSentAt } : {}),
});

export class DrizzleWaitlistRepository implements IWaitlistRepository {
  constructor(private readonly db: Database) {}

  async join(email: string, platform: WaitlistPlatform | undefined, unsubscribeToken: string): Promise<{ entry: WaitlistEntry; fresh: boolean }> {
    const [added] = await this.db
      .insert(waitlist)
      .values({ email, platform: platform ?? null, unsubscribeToken })
      .onConflictDoNothing({ target: waitlist.email })
      .returning();
    if (added) return { entry: toWaitlistEntry(added), fresh: true };

    const [existing] = await this.db.select().from(waitlist).where(eq(waitlist.email, email));
    if (!existing) throw new Error("Waitlist entry not found after a conflict");
    const rejoining = existing.unsubscribedAt !== null;
    const [updated] = await this.db
      .update(waitlist)
      // Joining again after unsubscribing starts over: back on the list, and the confirmation goes out again.
      .set({ ...(platform ? { platform } : {}), ...(rejoining ? { unsubscribedAt: null, confirmationSentAt: null } : {}), updatedAt: new Date() })
      .where(eq(waitlist.id, existing.id))
      .returning();
    return { entry: toWaitlistEntry(updated ?? existing), fresh: rejoining };
  }

  async markConfirmationSent(id: string, at: Date): Promise<void> {
    await this.db.update(waitlist).set({ confirmationSentAt: at }).where(eq(waitlist.id, id));
  }

  async leave(unsubscribeToken: string): Promise<boolean> {
    const rows = await this.db
      .update(waitlist)
      .set({ unsubscribedAt: sql`coalesce(${waitlist.unsubscribedAt}, now())` })
      .where(eq(waitlist.unsubscribeToken, unsubscribeToken))
      .returning({ id: waitlist.id });
    return rows.length > 0;
  }

  async overview(since: Date, limit: number): Promise<WaitlistOverview> {
    const active = sql`${waitlist.unsubscribedAt} is null`;
    const [counts] = await this.db
      .select({
        total: sql<number>`count(*) filter (where ${active})::int`,
        iphone: sql<number>`count(*) filter (where ${active} and ${waitlist.platform} = 'iphone')::int`,
        android: sql<number>`count(*) filter (where ${active} and ${waitlist.platform} = 'android')::int`,
        thisWeek: sql<number>`count(*) filter (where ${active} and ${waitlist.createdAt} >= ${since})::int`,
        unsubscribed: sql<number>`count(*) filter (where not (${active}))::int`,
      })
      .from(waitlist);
    const rows = await this.db.select().from(waitlist).orderBy(desc(waitlist.createdAt)).limit(limit);
    return {
      total: counts?.total ?? 0,
      iphone: counts?.iphone ?? 0,
      android: counts?.android ?? 0,
      thisWeek: counts?.thisWeek ?? 0,
      unsubscribed: counts?.unsubscribed ?? 0,
      entries: rows.map((row) => ({
        email: row.email,
        ...(row.platform ? { platform: row.platform as WaitlistPlatform } : {}),
        joinedAt: row.createdAt,
        confirmed: row.confirmationSentAt !== null,
        unsubscribed: row.unsubscribedAt !== null,
      })),
    };
  }
}

export class DrizzleWeightRepository implements IWeightRepository {
  constructor(private readonly db: Database) {}

  async upsert(userId: string, entry: WeightEntry): Promise<WeightEntry> {
    await this.db
      .insert(weightEntries)
      .values({ userId, date: entry.date, kg: entry.kg })
      .onConflictDoUpdate({ target: [weightEntries.userId, weightEntries.date], set: { kg: entry.kg } });
    return entry;
  }

  async list(userId: string, since: string): Promise<WeightEntry[]> {
    const rows = await this.db
      .select({ date: weightEntries.date, kg: weightEntries.kg })
      .from(weightEntries)
      .where(and(eq(weightEntries.userId, userId), gte(weightEntries.date, since)))
      .orderBy(asc(weightEntries.date));
    return rows;
  }

  async delete(userId: string, date: string): Promise<boolean> {
    const rows = await this.db
      .delete(weightEntries)
      .where(and(eq(weightEntries.userId, userId), eq(weightEntries.date, date)))
      .returning({ date: weightEntries.date });
    return rows.length > 0;
  }
}

export class DrizzleSubscriptionRepository implements ISubscriptionRepository {
  constructor(private readonly db: Database) {}

  async get(userId: string): Promise<Subscription | null> {
    const [row] = await this.db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    if (!row) return null;
    return {
      status: row.status as SubscriptionStatus,
      ...(row.productId ? { productId: row.productId } : {}),
      ...(row.expiresAt ? { expiresAt: row.expiresAt } : {}),
      willRenew: row.willRenew,
      eventAt: row.eventAt,
    };
  }

  async save(userId: string, s: Subscription): Promise<boolean> {
    // Store events can name ids that aren't ours (test events, deleted accounts): skip those.
    const [user] = await this.db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!user) return false;
    const values = { status: s.status, productId: s.productId ?? null, expiresAt: s.expiresAt ?? null, willRenew: s.willRenew, eventAt: s.eventAt };
    await this.db
      .insert(subscriptions)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: subscriptions.userId, set: values });
    return true;
  }
  async trialsEndingBetween(from: Date, to: Date): Promise<EndingTrial[]> {
    const rows = await this.db
      .select({ userId: subscriptions.userId, email: users.email, endsAt: subscriptions.expiresAt, timeZone: profiles.timeZone })
      .from(subscriptions)
      .innerJoin(users, eq(users.id, subscriptions.userId))
      .leftJoin(profiles, eq(profiles.userId, subscriptions.userId))
      .where(
        and(
          eq(subscriptions.status, "trial"),
          eq(subscriptions.willRenew, true),
          gte(subscriptions.expiresAt, from),
          lt(subscriptions.expiresAt, to),
          sql`${subscriptions.trialRemindedFor} is distinct from ${subscriptions.expiresAt}`,
        ),
      );
    return rows.flatMap((r) => (r.endsAt ? [{ userId: r.userId, email: r.email, endsAt: r.endsAt, timeZone: r.timeZone ?? "UTC" }] : []));
  }

  async markTrialReminded(userId: string, endsAt: Date): Promise<void> {
    await this.db.update(subscriptions).set({ trialRemindedFor: endsAt }).where(eq(subscriptions.userId, userId));
  }
}

export class DrizzleStackRepository implements IStackRepository {
  constructor(private readonly db: Database) {}

  private static toItem(row: typeof stackItems.$inferSelect): StackItem {
    return {
      id: row.id,
      name: row.name,
      ...(row.servingSize ? { servingSize: row.servingSize } : {}),
      ingredients: row.ingredients,
      servingsPerDay: row.servingsPerDay,
      timing: row.timing as StackTiming,
      ...(row.servingsPerContainer ? { servingsPerContainer: row.servingsPerContainer } : {}),
      startedOn: row.startedOn,
    };
  }

  async list(userId: string): Promise<StackItem[]> {
    const rows = await this.db.select().from(stackItems).where(eq(stackItems.userId, userId)).orderBy(asc(stackItems.createdAt));
    return rows.map(DrizzleStackRepository.toItem);
  }

  async add(userId: string, item: NewStackItem): Promise<StackItem> {
    const [row] = await this.db
      .insert(stackItems)
      .values({
        userId,
        name: item.name,
        servingSize: item.servingSize ?? null,
        ingredients: item.ingredients,
        servingsPerDay: item.servingsPerDay,
        timing: item.timing,
        servingsPerContainer: item.servingsPerContainer ?? null,
        startedOn: item.startedOn,
      })
      .returning();
    if (!row) throw new Error("Stack insert returned no row");
    return DrizzleStackRepository.toItem(row);
  }

  async update(userId: string, id: string, patch: StackItemPatch): Promise<StackItem | null> {
    const set = {
      ...(patch.servingsPerDay !== undefined ? { servingsPerDay: patch.servingsPerDay } : {}),
      ...(patch.timing !== undefined ? { timing: patch.timing } : {}),
      ...(patch.servingsPerContainer !== undefined ? { servingsPerContainer: patch.servingsPerContainer } : {}),
      ...(patch.startedOn !== undefined ? { startedOn: patch.startedOn } : {}),
    };
    const where = and(eq(stackItems.id, id), eq(stackItems.userId, userId));
    const [row] = Object.keys(set).length
      ? await this.db.update(stackItems).set(set).where(where).returning()
      : await this.db.select().from(stackItems).where(where);
    return row ? DrizzleStackRepository.toItem(row) : null;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(stackItems)
      .where(and(eq(stackItems.id, id), eq(stackItems.userId, userId)))
      .returning({ id: stackItems.id });
    return rows.length > 0;
  }

  async takenOn(userId: string, date: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ itemId: stackDoses.itemId })
      .from(stackDoses)
      .where(and(eq(stackDoses.userId, userId), eq(stackDoses.date, date)));
    return new Set(rows.map((r) => r.itemId));
  }

  async setTaken(userId: string, id: string, date: string, taken: boolean): Promise<boolean> {
    const [item] = await this.db
      .select({ id: stackItems.id })
      .from(stackItems)
      .where(and(eq(stackItems.id, id), eq(stackItems.userId, userId)));
    if (!item) return false;
    if (taken) await this.db.insert(stackDoses).values({ itemId: id, userId, date }).onConflictDoNothing();
    else await this.db.delete(stackDoses).where(and(eq(stackDoses.itemId, id), eq(stackDoses.date, date)));
    return true;
  }
}

export class DrizzleBrainCheckRepository implements IBrainCheckRepository {
  constructor(private readonly db: Database) {}

  private static toCheck(r: typeof brainChecks.$inferSelect): SavedBrainCheck {
    return {
      id: r.id,
      takenAt: r.takenAt,
      score: r.score,
      medianMs: r.medianMs,
      fastestMs: r.fastestMs,
      lapses: r.lapses,
      falseStarts: r.falseStarts,
      trials: r.trials,
    };
  }

  async add(userId: string, c: BrainCheckResult & { takenAt: Date; reactionTimesMs: number[] }): Promise<SavedBrainCheck> {
    const [row] = await this.db.insert(brainChecks).values({ userId, ...c }).returning();
    if (!row) throw new Error("Brain check insert returned no row");
    return DrizzleBrainCheckRepository.toCheck(row);
  }

  async listSince(userId: string, since: Date): Promise<SavedBrainCheck[]> {
    const rows = await this.db
      .select()
      .from(brainChecks)
      .where(and(eq(brainChecks.userId, userId), gte(brainChecks.takenAt, since)))
      .orderBy(desc(brainChecks.takenAt));
    return rows.map(DrizzleBrainCheckRepository.toCheck);
  }
}

export class DrizzleExerciseRepository implements IExerciseRepository {
  constructor(private readonly db: Database) {}

  private static toExercise(r: typeof exercises.$inferSelect): Exercise {
    return { id: r.id, kind: r.kind, intensity: r.intensity, minutes: r.minutes, startedAt: r.startedAt, kcal: r.kcal };
  }

  async add(userId: string, e: NewExercise): Promise<Exercise> {
    const [row] = await this.db.insert(exercises).values({ userId, ...e }).returning();
    if (!row) throw new Error("Exercise insert returned no row");
    return DrizzleExerciseRepository.toExercise(row);
  }

  async listBetween(userId: string, from: Date, to: Date): Promise<Exercise[]> {
    const rows = await this.db
      .select()
      .from(exercises)
      .where(and(eq(exercises.userId, userId), gte(exercises.startedAt, from), lt(exercises.startedAt, to)))
      .orderBy(asc(exercises.startedAt));
    return rows.map(DrizzleExerciseRepository.toExercise);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    // Not a UUID can't be one of theirs; Postgres would refuse it as input.
    if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
    const gone = await this.db.delete(exercises).where(and(eq(exercises.userId, userId), eq(exercises.id, id))).returning({ id: exercises.id });
    return gone.length > 0;
  }
}
