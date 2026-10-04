import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import type {
  ICheckInRepository,
  IFocusScoreRepository,
  IMealRepository,
  IProfileRepository,
  IRecommendationRepository,
  ITelemetryRepository,
  IUserRepository,
} from "../../application/interfaces/IRepositories";
import type {
  CheckIn,
  CognitiveFlag,
  CognitiveGoal,
  DietaryPreference,
  FocusScore,
  FoodItem,
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
} from "../../domain/types";
import type { Database } from "./client";
import {
  checkIns,
  focusScores,
  mealItems,
  meals,
  profiles,
  recipeRecommendations,
  screenTimeSamples,
  sleepSessions,
  users,
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
    };
    await this.db
      .insert(profiles)
      .values({ userId: profile.userId, ...values })
      .onConflictDoUpdate({ target: profiles.userId, set: values });
  }
}

export class DrizzleMealRepository implements IMealRepository {
  constructor(private readonly db: Database) {}

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

  async create(userId: string, meal: NewMeal): Promise<Meal> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(meals)
        .values({ userId, kind: meal.kind, eatenAt: meal.eatenAt, photoKey: meal.photoKey ?? null })
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

  async saveRecipes(userId: string, recipes: NewRecipeRecommendation[]): Promise<RecipeRecommendation[]> {
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
        })),
      )
      .returning({ id: recipeRecommendations.id });
    return recipes.map((r, i) => ({ ...r, id: rows[i]!.id }));
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
