/** In-memory fakes of every port, for use-case tests (CLAUDE.md: use cases are tested with fake providers). */
import { isOnLocalDay } from "../../domain/localDay";
import type {
  CheckIn,
  FoodItem,
  LocalDay,
  Meal,
  NewCheckIn,
  NewMeal,
  NewRecipeRecommendation,
  Profile,
  RecipeRecommendation,
} from "../../domain/types";
import type { BioStateContext, IAiReasoningProvider, RecipeQueryOutput } from "../interfaces/IAiReasoningProvider";
import type { IAiVisionProvider, MealPhoto, MealPhotoAnalysis } from "../interfaces/IAiVisionProvider";
import type { IClock } from "../interfaces/IClock";
import type {
  ICheckInRepository,
  IMealRepository,
  IProfileRepository,
  IRecommendationRepository,
} from "../interfaces/IRepositories";
import type { ISearchEngineAdapter, RecipeSearchHit } from "../interfaces/ISearchEngineAdapter";

let nextId = 1;
const id = (prefix: string) => `${prefix}-${nextId++}`;

export class FixedClock implements IClock {
  constructor(public current: Date) {}
  now() {
    return this.current;
  }
}

export class InMemoryProfiles implements IProfileRepository {
  readonly rows = new Map<string, Profile>();
  async get(userId: string) {
    return this.rows.get(userId) ?? null;
  }
  async save(profile: Profile) {
    this.rows.set(profile.userId, profile);
  }
}

export class InMemoryMeals implements IMealRepository {
  readonly rows: (Meal & { deleted?: boolean })[] = [];
  async listForDay(userId: string, day: LocalDay) {
    return this.rows
      .filter((m) => m.userId === userId && !m.deleted && isOnLocalDay(m.eatenAt, day))
      .sort((a, b) => a.eatenAt.getTime() - b.eatenAt.getTime());
  }
  async get(userId: string, mealId: string) {
    return this.rows.find((m) => m.userId === userId && m.id === mealId && !m.deleted) ?? null;
  }
  async create(userId: string, meal: NewMeal) {
    const row = { ...meal, id: id("meal"), userId };
    this.rows.push(row);
    return row;
  }
  async softDelete(userId: string, mealId: string) {
    const row = this.rows.find((m) => m.userId === userId && m.id === mealId && !m.deleted);
    if (row) row.deleted = true;
    return Boolean(row);
  }
}

export class InMemoryCheckIns implements ICheckInRepository {
  readonly rows: CheckIn[] = [];
  async create(userId: string, checkIn: NewCheckIn) {
    const row = { ...checkIn, id: id("checkin"), userId };
    this.rows.push(row);
    return row;
  }
  async latestForDay(userId: string, day: LocalDay) {
    const onDay = this.rows.filter((c) => c.userId === userId && isOnLocalDay(c.at, day));
    return onDay.sort((a, b) => b.at.getTime() - a.at.getTime())[0] ?? null;
  }
}

export class InMemoryRecommendations implements IRecommendationRepository {
  readonly rows: (RecipeRecommendation & { userId: string })[] = [];
  async saveRecipes(userId: string, recipes: NewRecipeRecommendation[]) {
    const saved = recipes.map((r) => ({ ...r, id: id("rec") }));
    this.rows.push(...saved.map((r) => ({ ...r, userId })));
    return saved;
  }
}

export class FakeVision implements IAiVisionProvider {
  calls: MealPhoto[] = [];
  constructor(private readonly result: MealPhotoAnalysis | Error) {}
  async analyzeMealPhoto(photo: MealPhoto) {
    this.calls.push(photo);
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

export class FakeReasoning implements IAiReasoningProvider {
  calls: BioStateContext[] = [];
  constructor(private readonly result: RecipeQueryOutput | Error) {}
  async generateRecipeSearchQuery(context: BioStateContext) {
    this.calls.push(context);
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

export class FakeSearch implements ISearchEngineAdapter {
  calls: { query: string; allowedDomains: string[]; limit: number }[] = [];
  constructor(private readonly result: RecipeSearchHit[] | Error) {}
  async searchRecipes(query: string, opts: { allowedDomains: string[]; limit: number }) {
    this.calls.push({ query, ...opts });
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

export const item = (name: string, calories: number, proteinG: number, carbsG: number, fatG: number): FoodItem => ({
  name,
  portion: "1 serving",
  calories,
  macros: { proteinG, carbsG, fatG },
});

export const profile = (overrides: Partial<Profile> = {}): Profile => ({
  userId: "u1",
  displayName: "Lionel",
  timeZone: "America/Chicago",
  dietaryPreference: "pescatarian",
  cognitiveGoals: ["focus", "energy"],
  dailyCalorieTarget: 2200,
  macroTargets: { proteinG: 130, carbsG: 240, fatG: 75 },
  ...overrides,
});
