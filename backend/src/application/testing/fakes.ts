/** In-memory fakes of every port, for use-case tests (CLAUDE.md: use cases are tested with fake providers). */
import { isOnLocalDay, localDateOf } from "../../domain/localDay";
import type {
  CheckIn,
  FocusComponents,
  FocusScore,
  FoodItem,
  ScreenTimeSample,
  SleepSession,
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
import type { IFocusExplainer } from "../interfaces/IFocusExplainer";
import type {
  ICheckInRepository,
  IFocusScoreRepository,
  IMealRepository,
  IProfileRepository,
  IRecommendationRepository,
  ITelemetryRepository,
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
  async listForDay(userId: string, day: LocalDay) {
    return this.rows.filter((c) => c.userId === userId && isOnLocalDay(c.at, day)).sort((a, b) => a.at.getTime() - b.at.getTime());
  }
}

export class InMemoryTelemetry implements ITelemetryRepository {
  readonly sleep = new Map<string, SleepSession & { userId: string }>();
  readonly screen = new Map<string, ScreenTimeSample & { userId: string }>();
  async upsertSleep(userId: string, sessions: SleepSession[]) {
    for (const s of sessions) {
      for (const [key, existing] of this.sleep) {
        if (existing.userId === userId && existing.source === s.source && existing.start < s.end && existing.end > s.start) {
          this.sleep.delete(key);
        }
      }
      this.sleep.set(`${userId}|${s.source}|${s.start.toISOString()}`, { ...s, userId });
    }
    return sessions.length;
  }
  async upsertScreenTime(userId: string, samples: ScreenTimeSample[]) {
    for (const s of samples) this.screen.set(`${userId}|${s.source}|${s.windowStart.toISOString()}`, { ...s, userId });
    return samples.length;
  }
  async sleepEndingOn(userId: string, day: LocalDay) {
    return [...this.sleep.values()].filter((s) => s.userId === userId && isOnLocalDay(s.end, day)).map(({ userId: _, ...s }) => s);
  }
  async screenTimeStartingOn(userId: string, dates: string[], timeZone: string) {
    return [...this.screen.values()]
      .filter((s) => s.userId === userId && dates.includes(localDateOf(s.windowStart, timeZone)))
      .map(({ userId: _, ...s }) => s);
  }
}

export class InMemoryFocusScores implements IFocusScoreRepository {
  readonly rows = new Map<string, FocusScore>();
  async get(userId: string, date: string) {
    return this.rows.get(`${userId}|${date}`) ?? null;
  }
  async put(score: FocusScore) {
    this.rows.set(`${score.userId}|${score.date}`, score);
  }
}

export class FakeExplainer implements IFocusExplainer {
  calls: { score: number; components: FocusComponents }[] = [];
  constructor(private readonly result: string | Error = "Sleep is the main thing holding you back today.") {}
  async explain(input: { score: number; components: FocusComponents }) {
    this.calls.push(input);
    if (this.result instanceof Error) throw this.result;
    return this.result;
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
