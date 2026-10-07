/** In-memory fakes of every port, for use-case tests (CLAUDE.md: use cases are tested with fake providers). */
import { isOnLocalDay, localDateOf } from "../../domain/localDay";
import type {
  AdminProduct,
  Product,
  ProductSettings,
  Protocol,
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
  WaitlistEntry,
  WaitlistPlatform,
} from "../../domain/types";
import type { BioStateContext, IAiReasoningProvider, RecipeQueryOutput } from "../interfaces/IAiReasoningProvider";
import type { IAiVisionProvider, MealPhoto, MealPhotoAnalysis } from "../interfaces/IAiVisionProvider";
import type { Embedded, ICatalogRepository } from "../interfaces/ICatalogRepository";
import type { IClock } from "../interfaces/IClock";
import type { Email, IEmailSender } from "../interfaces/IEmailSender";
import { EMBEDDING_DIMENSIONS, type IEmbeddingProvider } from "../interfaces/IEmbeddingProvider";
import type { IFocusExplainer } from "../interfaces/IFocusExplainer";
import type { IObjectStorage } from "../interfaces/IObjectStorage";
import type {
  ICheckInRepository,
  IFocusScoreRepository,
  IMealRepository,
  IProfileRepository,
  IRecommendationRepository,
  ITelemetryRepository,
  IWaitlistRepository,
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
  private readonly byKey = new Map<string, Meal>();
  async create(userId: string, { clientKey, ...meal }: NewMeal) {
    const earlier = clientKey ? this.byKey.get(`${userId}:${clientKey}`) : undefined;
    if (earlier) return earlier;
    const row = { ...meal, id: id("meal"), userId };
    this.rows.push(row);
    if (clientKey) this.byKey.set(`${userId}:${clientKey}`, row);
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
  readonly rows: (RecipeRecommendation & { userId: string; contextKey?: string; batch: number })[] = [];
  private batches = 0;
  async saveRecipes(userId: string, recipes: NewRecipeRecommendation[], contextKey?: string) {
    const saved = recipes.map((r) => ({ ...r, id: id("rec") }));
    const batch = ++this.batches;
    this.rows.push(...saved.map((r) => ({ ...r, userId, batch, ...(contextKey ? { contextKey } : {}) })));
    return saved;
  }
  async latestRecipes(userId: string, contextKey: string) {
    const matching = this.rows.filter((r) => r.userId === userId && r.contextKey === contextKey);
    const newest = Math.max(...matching.map((r) => r.batch));
    return matching.filter((r) => r.batch === newest).map(({ userId: _, contextKey: __, batch: ___, ...recipe }) => recipe);
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

/** Bag-of-words embedding: texts sharing words point the same way. Enough to test nearest-neighbour logic. */
export class FakeEmbedder implements IEmbeddingProvider {
  calls: string[][] = [];
  async embed(texts: string[]) {
    this.calls.push(texts);
    return texts.map((text) => {
      const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
      for (const word of text.toLowerCase().match(/[a-z]{4,}/g) ?? []) {
        let h = 0;
        for (const ch of word.slice(0, 5)) h = (h * 31 + ch.charCodeAt(0)) % EMBEDDING_DIMENSIONS;
        v[h]! += 1;
      }
      const norm = Math.hypot(...v) || 1;
      return v.map((x) => x / norm);
    });
  }
}

const cosine = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i]!, 0);

export class InMemoryCatalog implements ICatalogRepository {
  readonly protocols = new Map<string, Embedded<Protocol>>();
  readonly products = new Map<string, Embedded<Product>>();
  /** Admin settings per product id; survive `upsertProducts` like the real columns do. */
  readonly settings = new Map<string, ProductSettings>();
  readonly adminIds = new Set<string>();

  async hashes() {
    const hashes = <T>(m: Map<string, Embedded<T>>, skip: Set<string>) =>
      new Map([...m].filter(([id]) => !skip.has(id)).map(([id, e]) => [id, e.contentHash]));
    return { protocols: hashes(this.protocols, new Set()), products: hashes(this.products, this.adminIds) };
  }
  async upsertProtocols(items: Embedded<Protocol>[]) {
    for (const e of items) this.protocols.set(e.item.id, e);
  }
  async upsertProducts(items: Embedded<Product>[]) {
    for (const e of items) this.products.set(e.item.id, e);
  }
  async retain(ids: { protocols: string[]; products: string[] }) {
    for (const id of this.protocols.keys()) if (!ids.protocols.includes(id)) this.protocols.delete(id);
    for (const id of this.products.keys()) if (!ids.products.includes(id) && !this.adminIds.has(id)) this.products.delete(id);
  }
  private shown(item: Product): Product {
    const { url: _, ...rest } = item;
    const set = this.settings.get(item.id);
    const url = set?.url ?? item.url;
    return { ...rest, ...(url ? { url } : {}), affiliate: set?.affiliate ?? item.affiliate };
  }
  private admin(item: Product): AdminProduct {
    const set = this.settings.get(item.id);
    return {
      ...this.shown(item),
      enabled: set?.enabled ?? true,
      managedBy: this.adminIds.has(item.id) ? "admin" : "catalog",
      ...(set?.url && item.url ? { catalogUrl: item.url } : {}),
    };
  }
  async nearestProtocols(embedding: number[], limit: number) {
    return [...this.protocols.values()]
      .map((e) => ({ item: e.item, similarity: cosine(e.embedding, embedding) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
  async nearestProducts(embedding: number[], limit: number, only?: "ownSupplements") {
    return [...this.products.values()]
      .filter((e) => this.settings.get(e.item.id)?.enabled !== false)
      .filter((e) => only !== "ownSupplements" || (e.item.ownBrand && e.item.supplement))
      .map((e) => ({ item: this.shown(e.item), similarity: cosine(e.embedding, embedding) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
  async listProducts() {
    return [...this.products.values()].map((e) => this.admin(e.item)).sort((a, b) => a.name.localeCompare(b.name));
  }
  async updateProductSettings(id: string, settings: ProductSettings) {
    const found = this.products.get(id);
    if (!found) return null;
    this.settings.set(id, { ...this.settings.get(id), ...settings });
    return this.admin(found.item);
  }
  async addProduct(product: Embedded<Product>) {
    this.products.set(product.item.id, product);
    this.adminIds.add(product.item.id);
    return this.admin(product.item);
  }
  async removeAdminProduct(id: string) {
    if (!this.adminIds.has(id)) return false;
    this.adminIds.delete(id);
    this.settings.delete(id);
    return this.products.delete(id);
  }
}

export class InMemoryStorage implements IObjectStorage {
  objects = new Map<string, { bytes: Uint8Array; mediaType: string }>();
  uploads: { key: string; mediaType: string; sizeBytes: number }[] = [];
  async createUploadUrl(key: string, mediaType: string, sizeBytes: number) {
    this.uploads.push({ key, mediaType, sizeBytes });
    return { url: `https://storage.test/${key}`, headers: { "content-type": mediaType }, expiresAt: new Date("2026-09-29T17:05:00Z") };
  }
  async read(key: string, maxBytes: number) {
    const found = this.objects.get(key);
    return found && found.bytes.byteLength <= maxBytes ? found : null;
  }
}

export class InMemoryWaitlist implements IWaitlistRepository {
  readonly rows: (WaitlistEntry & { unsubscribed?: boolean })[] = [];
  async join(email: string, platform: WaitlistPlatform | undefined, unsubscribeToken: string) {
    const existing = this.rows.find((r) => r.email === email);
    if (!existing) {
      const entry = { id: id("wait"), email, unsubscribeToken, ...(platform ? { platform } : {}) };
      this.rows.push(entry);
      return { entry, fresh: true };
    }
    const rejoining = existing.unsubscribed === true;
    if (platform) existing.platform = platform;
    if (rejoining) {
      existing.unsubscribed = false;
      delete existing.confirmationSentAt;
    }
    return { entry: existing, fresh: rejoining };
  }
  async markConfirmationSent(entryId: string, at: Date) {
    const row = this.rows.find((r) => r.id === entryId);
    if (row) row.confirmationSentAt = at;
  }
  async leave(unsubscribeToken: string) {
    const row = this.rows.find((r) => r.unsubscribeToken === unsubscribeToken);
    if (row) row.unsubscribed = true;
    return Boolean(row);
  }
}

export class FakeEmail implements IEmailSender {
  sent: Email[] = [];
  constructor(
    readonly enabled = true,
    private readonly failure?: Error,
  ) {}
  async send(email: Email) {
    if (this.failure) throw this.failure;
    this.sent.push(email);
  }
}
