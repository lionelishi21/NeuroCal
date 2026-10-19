/** In-memory fakes of every port, for use-case tests (CLAUDE.md: use cases are tested with fake providers). */
import { isOnLocalDay, localDateOf } from "../../domain/localDay";
import type { SupplementLabelReading } from "../../domain/supplement";
import type { BrainCheckResult } from "../../domain/brainCheck";
import type { FoodLabelReading } from "../../domain/foodLabel";
import type { IBrainCheckRepository, SavedBrainCheck } from "../interfaces/IBrainCheckRepository";
import type { Exercise, IExerciseRepository, NewExercise } from "../interfaces/IExerciseRepository";
import type { IKnowledgeRepository, ITechniqueExtractor, IVideoFeed, NewTechnique } from "../interfaces/IKnowledge";
import type { IAiUsage } from "../interfaces/IAiUsage";
import type { IMarkerRepository, NewMarkerReading } from "../interfaces/IMarkers";
import type { MarkerReading } from "../../domain/markers";
import type { AiFeature } from "../../domain/aiAllowance";
import type { FoundDevice, IDeviceCandidateRepository, IDeviceExtractor, IWebSearch, WebResult } from "../interfaces/IDevices";
import type { DeviceCandidate, DeviceStatus, DeviceTag } from "../../domain/devices";
import type { KnowledgeSource, SourceStatus, Technique, TechniqueStatus } from "../../domain/knowledge";
import type { IAirQuality, IEnvironmentRepository, IGeocoder } from "../interfaces/IEnvironment";
import type { AirLocation, EnvironmentCheck } from "../../domain/environment";
import type { IMealPlanRepository, IMealPlanner, MealPlanContext } from "../interfaces/IMealPlans";
import type { MealPlan, PlannedMeal } from "../../domain/mealPlan";
import type { IRecipeParser } from "../interfaces/IRecipeParser";
import type { IShoppingListReviewer, ShoppingReviewContext } from "../interfaces/IShoppingListReviewer";
import type { IPantryRecipeAssistant, IPantryRepository, PantryItem, PantryRecipeContext, SuggestedRecipe } from "../interfaces/IPantry";
import { pantryKey } from "../../domain/pantry";
import type { StackItem } from "../../domain/stack";
import type { IFoodLabelReader, IProductDatabase } from "../interfaces/IFoodLabels";
import type { Subscription } from "../../domain/subscription";
import type { IStackRepository, NewStackItem, StackItemPatch } from "../interfaces/IStackRepository";
import type { WeightEntry } from "../../domain/weight";
import type { ISubscriptionRepository } from "../interfaces/ISubscriptions";
import type { IIdentityProvider } from "../interfaces/IIdentityProvider";
import type { ISupplementLabelReader } from "../interfaces/ISupplementLabelReader";
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
  WaitlistOverview,
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
  IUserRepository,
  IWaitlistRepository,
  IWeightRepository,
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
  async eatenSince(userId: string, since: Date) {
    return this.rows
      .filter((m) => m.userId === userId && !m.deleted && m.eatenAt >= since)
      .map((m) => m.eatenAt)
      .sort((a, b) => a.getTime() - b.getTime());
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
  async listSince(userId: string, since: string) {
    return [...this.rows.values()].filter((s) => s.userId === userId && s.date >= since).sort((a, b) => a.date.localeCompare(b.date));
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

export class FakeLabelReader implements ISupplementLabelReader {
  calls: MealPhoto[][] = [];
  constructor(public result: SupplementLabelReading | Error) {}
  async readLabel(photos: MealPhoto[]) {
    this.calls.push(photos);
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

export class FakeFoodLabelReader implements IFoodLabelReader {
  calls: MealPhoto[][] = [];
  constructor(public result: FoodLabelReading | Error) {}
  async readLabel(photos: MealPhoto[]) {
    this.calls.push(photos);
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

/** Products by barcode; `failure` makes every lookup throw (the database is down). */
export class FakeProductDatabase implements IProductDatabase {
  constructor(
    readonly products: Record<string, FoodLabelReading> = {},
    private readonly failure?: Error,
  ) {}
  async lookup(barcode: string) {
    if (this.failure) throw this.failure;
    return this.products[barcode] ?? null;
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
  readonly knowledgeIds = new Set<string>();

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
  async addProtocol(e: Embedded<Protocol>) {
    this.protocols.set(e.item.id, e);
    this.knowledgeIds.add(e.item.id);
  }
  async retain(ids: { protocols: string[]; products: string[] }) {
    for (const id of this.protocols.keys()) if (!ids.protocols.includes(id) && !this.knowledgeIds.has(id)) this.protocols.delete(id);
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
  async deleteAll(prefix: string) {
    for (const key of [...this.objects.keys()]) if (key.startsWith(prefix)) this.objects.delete(key);
  }
}

/** Users by id; `delete` only removes the user row (other fakes keep their own rows). */
export class InMemoryUsers implements IUserRepository {
  readonly rows = new Map<string, { subject: string; email: string }>();
  async findOrCreateByAuthSubject(subject: string, email: string) {
    const found = [...this.rows].find(([, u]) => u.subject === subject);
    if (found) return found[0];
    const id = `u${this.rows.size + 1}`;
    this.rows.set(id, { subject, email });
    return id;
  }
  async delete(userId: string) {
    const user = this.rows.get(userId);
    this.rows.delete(userId);
    return user ? { authSubject: user.subject } : null;
  }
}

export class FakeIdentity implements IIdentityProvider {
  readonly deleted: string[] = [];
  async deleteLogin(subject: string) {
    this.deleted.push(subject);
  }
}

export class InMemoryWeights implements IWeightRepository {
  readonly rows = new Map<string, WeightEntry>();
  async upsert(userId: string, entry: WeightEntry) {
    this.rows.set(`${userId}:${entry.date}`, entry);
    return entry;
  }
  async list(userId: string, since: string) {
    return [...this.rows]
      .filter(([key, e]) => key.startsWith(`${userId}:`) && e.date >= since)
      .map(([, e]) => e)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  async delete(userId: string, date: string) {
    return this.rows.delete(`${userId}:${date}`);
  }
}

export class InMemorySubscriptions implements ISubscriptionRepository {
  readonly rows = new Map<string, Subscription>();
  /** Users that exist; events for others are skipped, as in the database. */
  known = new Set(["u1", "u2"]);
  async get(userId: string) {
    return this.rows.get(userId) ?? null;
  }
  async save(userId: string, s: Subscription) {
    if (!this.known.has(userId)) return false;
    this.rows.set(userId, s);
    return true;
  }
  readonly emails = new Map<string, string>([["u1", "maya@example.com"]]);
  readonly reminded = new Map<string, Date>();
  async trialsEndingBetween(from: Date, to: Date) {
    return [...this.rows].flatMap(([userId, s]) =>
      s.status === "trial" && s.willRenew && s.expiresAt && s.expiresAt >= from && s.expiresAt < to && this.reminded.get(userId)?.getTime() !== s.expiresAt.getTime()
        ? [{ userId, email: this.emails.get(userId) ?? `${userId}@example.com`, endsAt: s.expiresAt, timeZone: "America/Chicago" }]
        : [],
    );
  }
  async markTrialReminded(userId: string, endsAt: Date) {
    this.reminded.set(userId, endsAt);
  }
}

export class InMemoryStack implements IStackRepository {
  readonly rows: (StackItem & { userId: string })[] = [];
  readonly doses = new Set<string>();
  private next = 1;
  async list(userId: string) {
    return this.rows.filter((r) => r.userId === userId).map(({ userId: _, ...item }) => item);
  }
  async add(userId: string, item: NewStackItem) {
    const saved = { ...item, id: `s${this.next++}` };
    this.rows.push({ ...saved, userId });
    return saved;
  }
  async update(userId: string, id: string, patch: StackItemPatch) {
    const row = this.rows.find((r) => r.userId === userId && r.id === id);
    if (!row) return null;
    const { servingsPerContainer, ...rest } = patch;
    Object.assign(row, rest);
    if (servingsPerContainer === null) delete row.servingsPerContainer;
    else if (servingsPerContainer !== undefined) row.servingsPerContainer = servingsPerContainer;
    const { userId: _, ...item } = row;
    return item;
  }
  async delete(userId: string, id: string) {
    const i = this.rows.findIndex((r) => r.userId === userId && r.id === id);
    if (i < 0) return false;
    this.rows.splice(i, 1);
    return true;
  }
  async takenOn(userId: string, date: string) {
    return new Set(this.rows.filter((r) => r.userId === userId && this.doses.has(`${r.id}:${date}`)).map((r) => r.id));
  }
  async setTaken(userId: string, id: string, date: string, taken: boolean) {
    if (!this.rows.some((r) => r.userId === userId && r.id === id)) return false;
    if (taken) this.doses.add(`${id}:${date}`);
    else this.doses.delete(`${id}:${date}`);
    return true;
  }
}

export class InMemoryBrainChecks implements IBrainCheckRepository {
  readonly rows: (SavedBrainCheck & { userId: string })[] = [];
  async add(userId: string, c: BrainCheckResult & { takenAt: Date; reactionTimesMs: number[] }) {
    const { reactionTimesMs: _, ...rest } = c;
    const saved = { ...rest, id: `b${this.rows.length + 1}` };
    this.rows.push({ ...saved, userId });
    return saved;
  }
  async listSince(userId: string, since: Date) {
    return this.rows
      .filter((r) => r.userId === userId && r.takenAt >= since)
      .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime())
      .map(({ userId: _, ...c }) => c);
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
  /** Rows here have no join time; tests read the counts. */
  async overview(_since: Date, limit: number): Promise<WaitlistOverview> {
    const active = this.rows.filter((r) => !r.unsubscribed);
    return {
      total: active.length,
      iphone: active.filter((r) => r.platform === "iphone").length,
      android: active.filter((r) => r.platform === "android").length,
      thisWeek: active.length,
      unsubscribed: this.rows.length - active.length,
      entries: [...this.rows]
        .reverse()
        .slice(0, limit)
        .map((r) => ({ email: r.email, ...(r.platform ? { platform: r.platform } : {}), joinedAt: new Date(0), confirmed: Boolean(r.confirmationSentAt), unsubscribed: r.unsubscribed === true })),
    };
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

export class InMemoryExercises implements IExerciseRepository {
  readonly rows: (Exercise & { userId: string })[] = [];
  async add(userId: string, e: NewExercise) {
    const saved = { ...e, id: `x${this.rows.length + 1}` };
    this.rows.push({ ...saved, userId });
    return saved;
  }
  async listBetween(userId: string, from: Date, to: Date) {
    return this.rows
      .filter((r) => r.userId === userId && r.startedAt >= from && r.startedAt < to)
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
      .map(({ userId: _, ...e }) => e);
  }
  async delete(userId: string, id: string) {
    const i = this.rows.findIndex((r) => r.userId === userId && r.id === id);
    if (i < 0) return false;
    this.rows.splice(i, 1);
    return true;
  }
}

export class InMemoryPantry implements IPantryRepository {
  readonly rows: (PantryItem & { userId: string })[] = [];
  async list(userId: string) {
    return this.rows
      .filter((r) => r.userId === userId)
      .sort((a, b) => pantryKey(a.name).localeCompare(pantryKey(b.name)))
      .map(({ userId: _, ...i }) => i);
  }
  async add(userId: string, names: string[]) {
    for (const name of names) {
      const known = this.rows.some((r) => r.userId === userId && pantryKey(r.name) === pantryKey(name));
      if (!known) this.rows.push({ id: `p${this.rows.length + 1}`, name, userId });
    }
    return this.list(userId);
  }
  async delete(userId: string, id: string) {
    const i = this.rows.findIndex((r) => r.userId === userId && r.id === id);
    if (i < 0) return false;
    this.rows.splice(i, 1);
    return true;
  }
}

/** Returns one recipe from the first two pantry items and remembers what it was asked. */
export class FakePantryRecipes implements IPantryRecipeAssistant {
  readonly calls: PantryRecipeContext[] = [];
  async suggest(context: PantryRecipeContext): Promise<SuggestedRecipe[]> {
    this.calls.push(context);
    return [
      {
        title: `${context.pantry[0]} bowl`,
        minutes: 15,
        servings: 1,
        calories: 450,
        macros: { proteinG: 30, carbsG: 40, fatG: 15 },
        ingredients: [
          { name: context.pantry[0]!, quantity: "1 cup" },
          { name: "feta", quantity: "30 g" },
        ],
        steps: ["Cook it."],
        whyItFits: "Protein for the afternoon.",
      },
    ];
  }
}

/** Grades by name: anything containing "nuggets" or "soda" is ultra-processed and swapped. */
export class FakeShoppingReviewer implements IShoppingListReviewer {
  readonly calls: ShoppingReviewContext[] = [];
  async review(context: ShoppingReviewContext) {
    this.calls.push(context);
    if (context.photo && context.items.length === 0) return { items: [{ name: "Chicken nuggets", processing: "ultra_processed" as const, verdict: "swap" as const, reason: "Breaded and fried.", swapFor: "Chicken breast" }] };
    return {
      items: context.items.map((name) =>
        /nuggets|soda/i.test(name)
          ? { name, processing: "ultra_processed" as const, verdict: "swap" as const, reason: "Industrial additives.", swapFor: "A whole-food version" }
          : { name, processing: "whole" as const, verdict: "keep" as const, reason: "A whole food." },
      ),
    };
  }
}

export class InMemoryKnowledge implements IKnowledgeRepository {
  readonly sources: KnowledgeSource[] = [];
  readonly techniques: Technique[] = [];
  async list() {
    return [...this.sources].reverse().map((source) => ({ source, techniques: this.techniques.filter((t) => t.sourceId === source.id) }));
  }
  async getSource(id: string) {
    return this.sources.find((s) => s.id === id) ?? null;
  }
  async addSource(s: Omit<KnowledgeSource, "id" | "addedAt" | "status"> & { status?: SourceStatus }) {
    const known = this.sources.find((x) => x.url === s.url);
    if (known) return known;
    const source: KnowledgeSource = { ...s, id: `s${this.sources.length + 1}`, status: s.status ?? "queued", addedAt: new Date() };
    this.sources.push(source);
    return source;
  }
  async setSourceStatus(id: string, status: SourceStatus) {
    const s = this.sources.find((x) => x.id === id);
    if (s) s.status = status;
  }
  async addTechniques(sourceId: string, items: NewTechnique[]) {
    const added = items.map((t, i) => ({ ...t, id: `t${this.techniques.length + i + 1}`, sourceId, status: "pending" as const }));
    this.techniques.push(...added);
    return added;
  }
  async getTechnique(id: string) {
    return this.techniques.find((t) => t.id === id) ?? null;
  }
  async updateTechnique(id: string, patch: Partial<Pick<Technique, "title" | "summary" | "steps">> & { status: TechniqueStatus; protocolId?: string }) {
    const t = this.techniques.find((x) => x.id === id)!;
    Object.assign(t, patch);
    return t;
  }
}

/** One technique per transcript, titled after the source. */
export class FakeTechniqueExtractor implements ITechniqueExtractor {
  readonly calls: { title: string; transcript: string }[] = [];
  async extract(input: { title: string; transcript: string }): Promise<NewTechnique[]> {
    this.calls.push(input);
    return [
      {
        title: "Calf raises after meals",
        pillar: "movement",
        summary: "Ten slow calf raises after eating help push blood back up from the legs.",
        steps: ["Stand up after the meal.", "Rise onto your toes and lower slowly, ten times."],
        evidence: "The speaker cites research on calf muscle pumps.",
        cautions: "",
        quote: "your calf is your second heart",
        timestampSeconds: 90,
      },
    ];
  }
}

export class FakeVideoFeed implements IVideoFeed {
  constructor(private readonly videos: { url: string; title: string; channel: string; publishedAt: Date }[] = []) {}
  async latest(_channelId: string) {
    return this.videos;
  }
}

/** Reads "N g <food>" lines; oats match the catalog, anything else is estimated at 1 kcal a gram. */
export class FakeRecipeParser implements IRecipeParser {
  async parse(input: { text: string }) {
    const lines = input.text.split("\n").map((l) => l.match(/^(\d+) g (.+)$/)).filter((m): m is RegExpMatchArray => m !== null);
    if (lines.length === 0) return { problem: "not_a_recipe" as const, title: "", servings: null, ingredients: [] };
    return {
      title: "Test recipe",
      servings: 2,
      ingredients: lines.map(([, g, name]) => ({
        name: name!,
        quantity: `${g} g`,
        grams: Number(g),
        catalogId: /oat/i.test(name!) ? "oats" : null,
        estimate: { calories: Number(g), proteinG: 0, carbsG: 0, fatG: 0 },
        processing: "whole" as const,
      })),
    };
  }
}

export class InMemoryEnvironment implements IEnvironmentRepository {
  readonly locations = new Map<string, AirLocation>();
  readonly checks = new Map<string, EnvironmentCheck>();
  readonly air = new Map<string, number | null>();
  async getLocation(userId: string) {
    return this.locations.get(userId) ?? null;
  }
  async setLocation(userId: string, location: AirLocation | null) {
    if (location) this.locations.set(userId, location);
    else this.locations.delete(userId);
  }
  async getCheck(userId: string, date: string) {
    return this.checks.get(`${userId}|${date}`) ?? null;
  }
  async saveCheck(userId: string, date: string, check: EnvironmentCheck) {
    const merged = { ...this.checks.get(`${userId}|${date}`), ...check };
    this.checks.set(`${userId}|${date}`, merged);
    return merged;
  }
  async cachedAqi(latitude: number, longitude: number, date: string) {
    const key = `${latitude}|${longitude}|${date}`;
    return this.air.has(key) ? this.air.get(key)! : undefined;
  }
  async cacheAqi(latitude: number, longitude: number, date: string, aqi: number | null) {
    this.air.set(`${latitude}|${longitude}|${date}`, aqi);
  }
}

/** The same AQI everywhere, and counts the lookups. */
export class FakeAirQuality implements IAirQuality {
  calls = 0;
  constructor(private readonly aqi: number | null = 42) {}
  async dailyAqi() {
    this.calls++;
    return this.aqi;
  }
}

export class FakeGeocoder implements IGeocoder {
  async find(place: string) {
    return /nowhere/i.test(place) ? null : { name: `${place}, Texas, United States`, latitude: 30.26715, longitude: -97.74306 };
  }
}

/** The same simple meal for every slot, and remembers what it was asked. */
export class FakeMealPlanner implements IMealPlanner {
  readonly calls: MealPlanContext[] = [];
  async plan(context: MealPlanContext): Promise<PlannedMeal[][]> {
    this.calls.push(context);
    return Array.from({ length: context.days }, () =>
      context.meals.map((kind) => ({
        kind,
        title: `Oats and berries (${kind})`,
        ingredients: [
          { name: "Oats", quantity: "1/2 cup", grams: 40, catalogId: "oats", estimate: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }, processing: "whole" as const },
          { name: "Berries", quantity: "1 cup", grams: 150, catalogId: null, estimate: { calories: 80, proteinG: 1, carbsG: 18, fatG: 0 }, processing: "whole" as const },
        ],
        steps: ["Mix."],
      })),
    );
  }
}

export class InMemoryMealPlans implements IMealPlanRepository {
  readonly plans = new Map<string, MealPlan>();
  async latest(userId: string) {
    return this.plans.get(userId) ?? null;
  }
  async save(userId: string, plan: MealPlan) {
    this.plans.set(userId, plan);
  }
}

export class InMemoryDeviceCandidates implements IDeviceCandidateRepository {
  readonly items: DeviceCandidate[] = [];
  async list() {
    return [...this.items].reverse();
  }
  async get(id: string) {
    return this.items.find((d) => d.id === id) ?? null;
  }
  async add(devices: (FoundDevice & { tag: DeviceTag })[]) {
    const added = devices.map((d): DeviceCandidate => ({ ...d, id: `d${this.items.length + 1}`, status: "pending", foundAt: new Date() }));
    for (const d of added) this.items.push(d);
    return added;
  }
  async update(id: string, patch: Partial<Pick<DeviceCandidate, "name" | "description" | "url">> & { status: DeviceStatus; productId?: string }) {
    const i = this.items.findIndex((d) => d.id === id);
    this.items[i] = { ...this.items[i]!, ...patch };
    return this.items[i]!;
  }
}

/** Two results per query: one product page, one listicle. */
export class FakeWebSearch implements IWebSearch {
  readonly queries: string[] = [];
  async search(query: string): Promise<WebResult[]> {
    this.queries.push(query);
    const n = this.queries.length;
    return [
      { title: `Device ${n}`, url: `https://maker${n}.example/device`, snippet: "A new model." },
      { title: "Best of the year", url: "https://reviews.example/best", snippet: "Our picks." },
    ];
  }
}

/** Finds the first result's device, plus one with an invented link (which must be dropped). */
export class FakeDeviceExtractor implements IDeviceExtractor {
  async extract(input: { category: string; results: WebResult[] }): Promise<FoundDevice[]> {
    const first = input.results[0]!;
    return [
      { name: `${first.title} ${input.category}`, maker: "Maker", url: first.url, description: `A ${input.category.toLowerCase()}.` },
      { name: "Made-up device", maker: "Nobody", url: "https://invented.example/x", description: "Not in the results." },
    ];
  }
}

export class InMemoryAiUsage implements IAiUsage {
  readonly counts = new Map<string, number>();
  async spend(userId: string, day: string, feature: AiFeature) {
    const key = `${userId}|${day}|${feature}`;
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    return n;
  }
  async total(userId: string, feature: AiFeature) {
    return [...this.counts].filter(([k]) => k.startsWith(`${userId}|`) && k.endsWith(`|${feature}`)).reduce((s, [, n]) => s + n, 0);
  }
}

export class InMemoryMarkers implements IMarkerRepository {
  readonly rows: (MarkerReading & { userId: string })[] = [];
  async add(userId: string, readings: NewMarkerReading[]) {
    let added = 0;
    for (const r of readings) {
      const same = this.rows.some((x) => x.userId === userId && x.marker === r.marker && x.source === r.source && x.measuredAt.getTime() === r.measuredAt.getTime());
      if (same) continue;
      this.rows.push({ ...r, userId, id: `m${this.rows.length + 1}` });
      added++;
    }
    return added;
  }
  async listSince(userId: string, since: Date) {
    return this.rows
      .filter((r) => r.userId === userId && r.measuredAt >= since)
      .sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime())
      .map(({ userId: _, ...r }) => r);
  }
  async delete(userId: string, id: string) {
    const i = this.rows.findIndex((r) => r.userId === userId && r.id === id);
    if (i < 0) return false;
    this.rows.splice(i, 1);
    return true;
  }
}
