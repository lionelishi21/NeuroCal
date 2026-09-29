import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type {
  ICheckInRepository,
  IMealRepository,
  IProfileRepository,
  IRecommendationRepository,
  IUserRepository,
} from "../../application/interfaces/IRepositories";
import type {
  CheckIn,
  CognitiveFlag,
  CognitiveGoal,
  DietaryPreference,
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
} from "../../domain/types";
import type { Database } from "./client";
import { checkIns, mealItems, meals, profiles, recipeRecommendations, users } from "./schema";

/** Rows from a user's local calendar day, whatever time zone the database runs in. */
const onLocalDay = (column: typeof meals.eatenAt | typeof checkIns.at, day: LocalDay) =>
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
