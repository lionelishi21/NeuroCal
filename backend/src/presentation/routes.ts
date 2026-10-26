import { SESSION_KIND, SESSION_KINDS } from "../domain/session";
import type { SessionDay as SessionDayRecord, SessionUseCases } from "../application/use-cases/SessionUseCases";
import {
  AdminProduct,
  AdminProductList,
  AdminWaitlist,
  AnalyzeMealRequest,
  AnalyzeMealResponse,
  SupplementLabelResponse,
  FoodCatalog,
  AdminEatingOutList,
  CatalogFood,
  SaveEatingOutItemRequest,
  BrainCheck,
  BrainCheckHistory,
  BrainCheckRequest,
  FoodScanResponse,
  AddStackItemRequest,
  SetTakenRequest,
  SetFeelingRequest,
  StackItem,
  StackResponse,
  Exercise,
  ExerciseDay,
  LogExerciseRequest,
  AddPantryItemsRequest,
  LevelResponse,
  ShoppingReviewRequest,
  AnalyzeRecipeRequest,
  CreateMealPlanRequest,
  MealPlanResponse,
  EnvironmentCheckRequest,
  EnvironmentDay,
  SetEnvironmentLocationRequest,
  RecipeAnalysis,
  AddKnowledgeSourceRequest,
  AddTranscriptRequest,
  AdminKnowledge,
  KnowledgeSource,
  KnowledgeSyncResponse,
  AdminDevices,
  HealthspanResponse,
  HealthMarkersResponse,
  GlucoseResponse,
  RecordGlucoseRequest,
  RecordMarkersRequest,
  DeviceCandidate as DeviceCandidateDto,
  DeviceScanResponse,
  ReviewDeviceRequest,
  KnowledgeTechnique,
  ReviewTechniqueRequest,
  ShoppingReviewResponse,
  PantryRecipesResponse,
  PlanFastRequest,
  CoffeeDay,
  CoffeeProducts,
  LogSessionRequest,
  SessionsResponse,
  LogCoffeeRequest,
  BetterChoiceRequest,
  BetterChoiceResponse,
  PantryResponse,
  TodayResponse,
  UpdateStackItemRequest,
  SubscriptionStatus,
  FastingStatus,
  LogWeightRequest,
  WeightEntry,
  WeightHistory,
  AnalyzeSupplementRequest,
  MAX_LABEL_PHOTOS,
  BioState,
  CheckIn,
  CreateAdminProductRequest,
  CreateCheckInRequest,
  CreateMealRequest,
  CreatePhotoUploadRequest,
  FocusScore,
  HistoryResponse,
  JoinWaitlistRequest,
  JoinWaitlistResponse,
  LeaveWaitlistRequest,
  LeaveWaitlistResponse,
  ProtocolsResponse,
  IngestResponse,
  IngestScreenTimeRequest,
  IngestSleepRequest,
  Meal,
  NextRecommendationsResponse,
  PhotoUpload,
  Profile,
  UpdateAdminProductRequest,
  UpdateProfileRequest,
  type ApiError,
} from "@neurocal/contracts";
import { z } from "zod";
import type { AdminProductUseCases } from "../application/use-cases/AdminProductUseCases";
import type { AnalyzeMealPhotoUseCase } from "../application/use-cases/AnalyzeMealPhotoUseCase";
import type { AnalyzeSupplementLabelUseCase } from "../application/use-cases/AnalyzeSupplementLabelUseCase";
import type { CreatePhotoUploadUseCase } from "../application/use-cases/CreatePhotoUploadUseCase";
import type { DeleteAccountUseCase } from "../application/use-cases/DeleteAccountUseCase";
import type { DeleteMealUseCase } from "../application/use-cases/DeleteMealUseCase";
import type { GetBioStateUseCase } from "../application/use-cases/GetBioStateUseCase";
import type { GetFocusScoreUseCase } from "../application/use-cases/GetFocusScoreUseCase";
import type { GetHistoryUseCase } from "../application/use-cases/GetHistoryUseCase";
import type { GetProtocolsUseCase } from "../application/use-cases/GetProtocolsUseCase";
import type { IngestTelemetryUseCase } from "../application/use-cases/IngestTelemetryUseCase";
import type { ListMealsUseCase } from "../application/use-cases/ListMealsUseCase";
import type { DeleteWeightUseCase, GetWeightHistoryUseCase, LogWeightUseCase } from "../application/use-cases/WeightUseCases";
import type { GetSubscriptionUseCase, HandleStoreEventUseCase, SubscriptionGate } from "../application/use-cases/SubscriptionUseCases";
import type { BrainCheckUseCases } from "../application/use-cases/BrainCheckUseCases";
import type { ExerciseDay as ExerciseDayResult, ExerciseUseCases } from "../application/use-cases/ExerciseUseCases";
import type { PantryUseCases } from "../application/use-cases/PantryUseCases";
import type { GetLevelUseCase } from "../application/use-cases/GetLevelUseCase";
import type { ReviewShoppingListUseCase } from "../application/use-cases/ReviewShoppingListUseCase";
import type { KnowledgeUseCases } from "../application/use-cases/KnowledgeUseCases";
import type { DeviceScoutUseCases } from "../application/use-cases/DeviceScoutUseCases";
import type { AiAllowanceUseCase } from "../application/use-cases/AiAllowanceUseCase";
import type { GetHealthspanUseCase } from "../application/use-cases/GetHealthspanUseCase";
import type { MarkerUseCases } from "../application/use-cases/MarkerUseCases";
import type { GlucoseUseCases } from "../application/use-cases/GlucoseUseCases";
import { MARKERS, type MarkerSummary as MarkerSummaryRecord } from "../domain/markers";
import type { AnalyzeRecipeUseCase } from "../application/use-cases/AnalyzeRecipeUseCase";
import type { EnvironmentUseCases } from "../application/use-cases/EnvironmentUseCases";
import type { MealPlanUseCases } from "../application/use-cases/MealPlanUseCases";
import type { MealPlan } from "../domain/mealPlan";
import { linkAt, type KnowledgeSource as SourceRecord, type Technique } from "../domain/knowledge";
import { DEVICE_CATEGORIES, type DeviceCandidate as DeviceRecord } from "../domain/devices";
import type { Exercise as SavedExercise } from "../application/interfaces/IExerciseRepository";
import type { SavedBrainCheck } from "../application/interfaces/IBrainCheckRepository";
import type { StackUseCases } from "../application/use-cases/StackUseCases";
import type { GetFastingUseCase } from "../application/use-cases/GetFastingUseCase";
import type { FoodScan, ScanFoodUseCase } from "../application/use-cases/ScanFoodUseCase";
import type { BetterChoiceUseCase } from "../application/use-cases/BetterChoiceUseCase";
import type { CoffeeDay as CoffeeDayRecord, CoffeeUseCases } from "../application/use-cases/CoffeeUseCases";
import { breaksFast, cupName, cupNutrition } from "../domain/coffee";
import type { ListFoodsUseCase } from "../application/use-cases/ListFoodsUseCase";
import type { EatingOutAdminUseCases } from "../application/use-cases/EatingOutAdminUseCases";
import { dietsFor, type Food } from "../domain/foods";
import type { LogMealUseCase } from "../application/use-cases/LogMealUseCase";
import type { GetProfileUseCase, UpdateProfileUseCase } from "../application/use-cases/ProfileUseCases";
import type { RecommendRecipeUseCase } from "../application/use-cases/RecommendRecipeUseCase";
import type { RecordCheckInUseCase } from "../application/use-cases/RecordCheckInUseCase";
import type { AdminWaitlistUseCase, JoinWaitlistUseCase, LeaveWaitlistUseCase } from "../application/use-cases/WaitlistUseCases";
import type { IErrorReporter } from "../application/interfaces/IErrorReporter";
import { DomainError } from "../domain/errors";
import { storeEventFrom } from "../infrastructure/billing/RevenueCat";
import { routeOf } from "../infrastructure/monitoring/SentryErrorReporter";
import { imageTypeOf } from "../domain/photo";
import { toAnalysis, toBioState, toCheckIn, toFasting, toFocusScore, toFoodItem, toMeal, toProductRecommendation, toProfile, toProtocols, toRecommendations, toSupplementLabel } from "./mappers";

/** Transport-neutral request: the Lambda adapter and the dev server both build one of these. */
export interface ApiRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string | undefined>;
  body?: Uint8Array;
  /** Set by the transport from the verified identity; never read from the request. Empty on public routes. */
  userId: string;
  /** Set by the transport when the verified email is on the admin list. */
  isAdmin?: boolean;
}

export interface ApiResponse {
  status: number;
  body?: unknown;
}

export interface UseCases {
  getProfile: GetProfileUseCase;
  updateProfile: UpdateProfileUseCase;
  deleteAccount: DeleteAccountUseCase;
  getBioState: GetBioStateUseCase;
  recordCheckIn: RecordCheckInUseCase;
  createPhotoUpload: CreatePhotoUploadUseCase;
  analyzeMealPhoto: AnalyzeMealPhotoUseCase;
  listFoods: ListFoodsUseCase;
  eatingOutAdmin: EatingOutAdminUseCases;
  scanFood: ScanFoodUseCase;
  betterChoice: BetterChoiceUseCase;
  coffee: CoffeeUseCases;
  sessions: SessionUseCases;
  logWeight: LogWeightUseCase;
  getWeightHistory: GetWeightHistoryUseCase;
  deleteWeight: DeleteWeightUseCase;
  getFasting: GetFastingUseCase;
  getSubscription: GetSubscriptionUseCase;
  stack: StackUseCases;
  brainChecks: BrainCheckUseCases;
  exercise: ExerciseUseCases;
  pantry: PantryUseCases;
  getLevel: GetLevelUseCase;
  reviewShoppingList: ReviewShoppingListUseCase;
  knowledge: KnowledgeUseCases;
  devices: DeviceScoutUseCases;
  aiAllowance: AiAllowanceUseCase;
  getHealthspan: GetHealthspanUseCase;
  markers: MarkerUseCases;
  glucose: GlucoseUseCases;
  analyzeRecipe: AnalyzeRecipeUseCase;
  environment: EnvironmentUseCases;
  mealPlans: MealPlanUseCases;
  handleStoreEvent: HandleStoreEventUseCase;
  gate: SubscriptionGate;
  analyzeSupplementLabel: AnalyzeSupplementLabelUseCase;
  logMeal: LogMealUseCase;
  listMeals: ListMealsUseCase;
  deleteMeal: DeleteMealUseCase;
  recommendRecipe: RecommendRecipeUseCase;
  ingestTelemetry: IngestTelemetryUseCase;
  getFocusScore: GetFocusScoreUseCase;
  getHistory: GetHistoryUseCase;
  getProtocols: GetProtocolsUseCase;
  adminProducts: AdminProductUseCases;
  joinWaitlist: JoinWaitlistUseCase;
  leaveWaitlist: LeaveWaitlistUseCase;
  adminWaitlist: AdminWaitlistUseCase;
}

class BadRequest extends Error {}

const STATUS: Record<string, number> = { invalid_request: 400, subscription_required: 402, forbidden: 403, not_found: 404, daily_limit: 429, upstream_failed: 502 };

const error = (status: number, code: string, message: string): ApiResponse => ({
  status,
  body: { code, message } satisfies ApiError,
});

/** Parse a response with its contract schema before sending it (ARCHITECTURE §1, step 5). */
const ok = <S extends z.ZodType>(schema: S, value: z.input<S>, status = 200): ApiResponse => ({
  status,
  body: schema.parse(value),
});

function json<S extends z.ZodType>(req: ApiRequest, schema: S): z.infer<S> {
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(req.body ?? new Uint8Array()));
  } catch {
    throw new BadRequest("The request body isn't valid JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new BadRequest(`${issue?.path.join(".") || "body"}: ${issue?.message ?? "invalid"}`);
  }
  return parsed.data;
}

async function photoFrom(req: ApiRequest) {
  const [photo] = await photosFrom(req, 1);
  return photo!;
}

/** Up to `max` photos from a multipart body, one `photo` field each. */
async function photosFrom(req: ApiRequest, max: number) {
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.startsWith("multipart/form-data")) throw new BadRequest("Send the photo's key as JSON, or the photo as multipart/form-data.");
  let form: FormData;
  try {
    form = await new Request("http://local/", {
      method: "POST",
      headers: { "content-type": contentType },
      body: Buffer.from(req.body ?? new Uint8Array()),
    }).formData();
  } catch {
    throw new BadRequest("The upload couldn't be read. Choose the photo again.");
  }
  const files = form.getAll("photo").filter((p): p is File => typeof p !== "string");
  if (files.length === 0) throw new BadRequest("Attach a photo of the meal.");
  if (files.length > max) throw new BadRequest(`Send at most ${max} photos.`);
  return Promise.all(
    files.map(async (photo) => {
      const bytes = new Uint8Array(await photo.arrayBuffer());
      // Trust a declared image type; otherwise tell from the bytes (the Flutter app sends application/octet-stream).
      const mediaType = photo.type.startsWith("image/") ? photo.type : (imageTypeOf(bytes) ?? (photo.type || "application/octet-stream"));
      return { bytes, mediaType };
    }),
  );
}

/** A food scan over the wire: the label as read, NeuroCal's grading, and a serving to log. */
const toFoodScan = ({ reading: { sourceNovaGroup: _, ...reading }, processing, flags, item, coffee, coffeeFat }: FoodScan) => ({
  ...reading,
  processing,
  flags,
  ...(item ? { item: toFoodItem(item) } : {}),
  ...(coffee ? { coffee } : {}),
  ...(coffeeFat ? { coffeeFat } : {}),
});

const toSessionDay = (d: SessionDayRecord) => ({
  date: d.date,
  sessions: d.sessions.map((s) => ({ ...s, takenAt: s.takenAt.toISOString() })),
  kinds: SESSION_KINDS.map((kind) => {
    const { label, purpose, evidence, expectation, usualMinutes } = SESSION_KIND[kind];
    return { kind, label, purpose, evidence, expectation, usualMinutes };
  }),
  insights: d.insights.map((i) => ({ ...i, lastAt: i.lastAt.toISOString() })),
});

const toCoffeeDay = (d: CoffeeDayRecord) => ({
  ...d,
  cups: d.cups.map((c) => {
    const n = cupNutrition(c);
    return { ...c, takenAt: c.takenAt.toISOString(), name: cupName(c), kcal: Math.round(n.kcal), caffeineMg: n.caffeineMg, breaksFast: breaksFast(c) };
  }),
});

const toBrainCheck = ({ takenAt, ...c }: SavedBrainCheck) => ({ ...c, takenAt: takenAt.toISOString() });
const toExercise = ({ startedAt, ...e }: SavedExercise) => ({ ...e, startedAt: startedAt.toISOString() });
const toTechnique = (url: string) => ({ sourceId: _, timestampSeconds, ...t }: Technique) => ({ ...t, link: linkAt(url, timestampSeconds) });
const toMarkerSummary = (s: MarkerSummaryRecord) => {
  const def = MARKERS[s.marker];
  return {
    marker: s.marker,
    label: def.label,
    unit: def.unit,
    better: def.better,
    reference: def.reference,
    latest: { ...s.latest, measuredAt: s.latest.measuredAt.toISOString() },
    change: s.change,
    improving: s.improving,
    points: s.points.map((p) => ({ value: p.value, measuredAt: p.measuredAt.toISOString() })),
  };
};

const toDevice = (d: DeviceRecord) => ({
  ...d,
  category: DEVICE_CATEGORIES.find((c) => c.tag === d.tag)!.label,
  foundAt: d.foundAt.toISOString(),
});

const toKnowledgeSource = ({ source, techniques }: { source: SourceRecord; techniques: Technique[] }) => ({
  id: source.id,
  url: source.url,
  title: source.title,
  ...(source.channel ? { channel: source.channel } : {}),
  ...(source.publishedAt ? { publishedAt: source.publishedAt.toISOString() } : {}),
  status: source.status,
  techniques: techniques.map(toTechnique(source.url)),
});
const toExerciseDay = (d: ExerciseDayResult) => ({ ...d, exercises: d.exercises.map(toExercise) });
const toMealPlan = ({ createdAt, ...plan }: MealPlan) => ({ ...plan, createdAt: createdAt.toISOString() });

const admin = (req: ApiRequest) => ({ isAdmin: req.isAdmin === true });
const toCatalogFood = (food: Food) => {
  const { kind: _, ...rest } = food;
  return { ...rest, diets: dietsFor(food) };
};
const date = (req: ApiRequest) => req.query.get("date") ?? undefined;

type Route = [method: string, pattern: RegExp, handler: (req: ApiRequest, params: string[]) => Promise<ApiResponse>];
const normalise = (path: string) => path.replace(/\/+$/, "") || "/";

/** `errors` gets every unexpected error (the 500s); none without one. */
export function createApi(uc: UseCases, errors?: IErrorReporter) {
  // Open to anyone, signed in or not: the transport checks `isPublic` before it asks for an identity.
  const publicRoutes: Route[] = [
    [
      "POST",
      /^\/waitlist$/,
      async (req) => {
        await uc.joinWaitlist.execute(json(req, JoinWaitlistRequest));
        return ok(JoinWaitlistResponse, { status: "joined" }, 201);
      },
    ],
    [
      "POST",
      /^\/waitlist\/unsubscribe$/,
      async (req) => {
        await uc.leaveWaitlist.execute(json(req, LeaveWaitlistRequest));
        return ok(LeaveWaitlistResponse, { status: "unsubscribed" });
      },
    ],
    // RevenueCat calls this on purchases, renewals and expiries; it proves itself with a shared secret.
    [
      "POST",
      /^\/webhooks\/revenuecat$/,
      async (req) => {
        let body: unknown = null;
        try {
          body = JSON.parse(Buffer.from(req.body ?? new Uint8Array()).toString("utf8"));
        } catch {
          // Checked as "no event" after the secret.
        }
        const result = await uc.handleStoreEvent.execute(req.headers.authorization, storeEventFrom(body));
        return { status: 200, body: { result } };
      },
    ],
  ];

  const routes: Route[] = [
    ...publicRoutes,
    ["GET", /^\/me$/, async (req) => ok(Profile, toProfile(await uc.getProfile.execute(req)))],
    [
      "PUT",
      /^\/me\/profile$/,
      async (req) => ok(Profile, toProfile(await uc.updateProfile.execute({ userId: req.userId, patch: json(req, UpdateProfileRequest) }))),
    ],
    ["GET", /^\/bio-state$/, async (req) => ok(BioState, toBioState(await uc.getBioState.execute({ userId: req.userId, date: date(req) })))],
    [
      "POST",
      /^\/check-ins$/,
      async (req) => {
        const body = json(req, CreateCheckInRequest);
        const saved = await uc.recordCheckIn.execute({ userId: req.userId, checkIn: { ...body, at: new Date(body.at) } });
        return ok(CheckIn, toCheckIn(saved), 201);
      },
    ],
    [
      "POST",
      /^\/uploads\/meal-photo$/,
      async (req) => {
        const upload = await uc.createPhotoUpload.execute({ userId: req.userId, ...json(req, CreatePhotoUploadRequest) });
        return ok(PhotoUpload, { ...upload, expiresAt: upload.expiresAt.toISOString() }, 201);
      },
    ],
    [
      "POST",
      /^\/meals\/analyze$/,
      async (req) => {
        // The first few reads are free, for the meal snapped during onboarding (before the trial starts).
        if (!(await uc.aiAllowance.isFree(req, "read"))) await uc.gate.require(req);
        await uc.aiAllowance.spend(req, "read");
        // JSON names a photo uploaded first; multipart carries the photo itself (older clients, small photos).
        const analysis = (req.headers["content-type"] ?? "").startsWith("application/json")
          ? await uc.analyzeMealPhoto.executeForKey({ userId: req.userId, photoKey: json(req, AnalyzeMealRequest).photoKey })
          : await uc.analyzeMealPhoto.execute(await photoFrom(req));
        return ok(AnalyzeMealResponse, toAnalysis(analysis));
      },
    ],
    [
      "POST",
      /^\/weights$/,
      async (req) => ok(WeightEntry, await uc.logWeight.execute({ userId: req.userId, ...json(req, LogWeightRequest) }), 201),
    ],
    [
      "GET",
      /^\/weights$/,
      async (req) => {
        const days = req.query.get("days");
        if (days !== null && !/^\d+$/.test(days)) throw new BadRequest("days must be a whole number.");
        return ok(WeightHistory, await uc.getWeightHistory.execute({ userId: req.userId, ...(days ? { days: Number(days) } : {}) }));
      },
    ],
    [
      "DELETE",
      /^\/weights\/(\d{4}-\d{2}-\d{2})$/,
      async (req, [day]) => {
        await uc.deleteWeight.execute({ userId: req.userId, date: day! });
        return { status: 204 };
      },
    ],
    [
      "GET",
      /^\/me\/subscription$/,
      async (req) => {
        const s = await uc.getSubscription.execute(req);
        return ok(SubscriptionStatus, {
          active: s.active,
          status: s.status,
          ...(s.productId ? { productId: s.productId } : {}),
          ...(s.expiresAt ? { expiresAt: s.expiresAt.toISOString() } : {}),
          willRenew: s.willRenew,
        });
      },
    ],
    [
      "POST",
      /^\/brain-checks$/,
      async (req) => ok(BrainCheck, toBrainCheck(await uc.brainChecks.add(req.userId, json(req, BrainCheckRequest))), 201),
    ],
    [
      "GET",
      /^\/brain-checks$/,
      async (req) => {
        const days = req.query.get("days");
        if (days !== null && !/^\d+$/.test(days)) throw new BadRequest("days must be a whole number.");
        const h = await uc.brainChecks.history(req.userId, days ? Number(days) : undefined);
        return ok(BrainCheckHistory, { checks: h.checks.map(toBrainCheck), ...(h.baselineScore === undefined ? {} : { baselineScore: h.baselineScore }) });
      },
    ],
    [
      "POST",
      /^\/shopping\/review$/,
      async (req) => {
        await uc.gate.require(req);
        await uc.aiAllowance.spend(req, "generate");
        const isJson = (req.headers["content-type"] ?? "").startsWith("application/json");
        const review = isJson
          ? await uc.reviewShoppingList.execute({ userId: req.userId, text: json(req, ShoppingReviewRequest).text })
          : await uc.reviewShoppingList.execute({ userId: req.userId, photo: (await photosFrom(req, 1))[0]! });
        return ok(ShoppingReviewResponse, {
          ...(review.problem ? { problem: review.problem } : {}),
          items: review.items,
          devices: review.devices.map(({ product, because }) => ({ product: toProductRecommendation({ item: product, similarity: 1 }), because })),
        });
      },
    ],
    [
      "POST",
      /^\/recipes\/analyze$/,
      async (req) => {
        await uc.gate.require(req);
        await uc.aiAllowance.spend(req, "generate");
        const result = await uc.analyzeRecipe.execute(json(req, AnalyzeRecipeRequest));
        return ok(RecipeAnalysis, "problem" in result ? { problem: result.problem, ingredients: [] } : result);
      },
    ],
    [
      "GET",
      /^\/meal-plan$/,
      async (req) => {
        const plan = await uc.mealPlans.latest(req.userId);
        return plan ? ok(MealPlanResponse, toMealPlan(plan)) : { status: 404, body: { code: "not_found", message: "No meal plan yet." } };
      },
    ],
    [
      "POST",
      /^\/meal-plan$/,
      async (req) => {
        await uc.gate.require(req);
        await uc.aiAllowance.spend(req, "generate");
        return ok(MealPlanResponse, toMealPlan(await uc.mealPlans.create(req.userId, json(req, CreateMealPlanRequest).days)), 201);
      },
    ],
    ["GET", /^\/environment$/, async (req) => ok(EnvironmentDay, await uc.environment.day(req.userId, date(req)))],
    [
      "PUT",
      /^\/environment\/location$/,
      async (req) => {
        await uc.environment.setLocation(req.userId, json(req, SetEnvironmentLocationRequest).place);
        return ok(EnvironmentDay, await uc.environment.day(req.userId));
      },
    ],
    [
      "PUT",
      /^\/environment\/check$/,
      async (req) => {
        const body = json(req, EnvironmentCheckRequest);
        await uc.environment.check(req.userId, body);
        return ok(EnvironmentDay, await uc.environment.day(req.userId, body.date));
      },
    ],
    ["GET", /^\/level$/, async (req) => ok(LevelResponse, await uc.getLevel.execute(req))],
    ["GET", /^\/pantry$/, async (req) => ok(PantryResponse, { items: await uc.pantry.list(req.userId) })],
    ["POST", /^\/pantry$/, async (req) => ok(PantryResponse, { items: await uc.pantry.add(req.userId, json(req, AddPantryItemsRequest).names) })],
    [
      "POST",
      /^\/pantry\/recipes$/,
      async (req) => {
        await uc.gate.require(req);
        await uc.aiAllowance.spend(req, "generate");
        return ok(PantryRecipesResponse, { recipes: await uc.pantry.recipes(req.userId) });
      },
    ],
    [
      "DELETE",
      /^\/pantry\/([^/]+)$/,
      async (req, [id]) => {
        await uc.pantry.remove(req.userId, id!);
        return { status: 204 };
      },
    ],
    ["POST", /^\/exercises$/, async (req) => ok(Exercise, toExercise(await uc.exercise.log(req.userId, json(req, LogExerciseRequest))), 201)],
    ["GET", /^\/exercises$/, async (req) => ok(ExerciseDay, toExerciseDay(await uc.exercise.day(req.userId, date(req))))],
    [
      "DELETE",
      /^\/exercises\/([^/]+)$/,
      async (req, [id]) => {
        await uc.exercise.remove(req.userId, id!);
        return { status: 204 };
      },
    ],
    [
      "GET",
      /^\/stack$/,
      async (req) => {
        const s = await uc.stack.get(req.userId);
        return ok(StackResponse, { date: s.date, items: s.items, flags: s.flags });
      },
    ],
    ["POST", /^\/stack$/, async (req) => ok(StackItem, await uc.stack.add(req.userId, json(req, AddStackItemRequest)), 201)],
    ["PUT", /^\/stack\/([^/]+)$/, async (req, [id]) => ok(StackItem, await uc.stack.update(req.userId, id!, json(req, UpdateStackItemRequest)))],
    [
      "DELETE",
      /^\/stack\/([^/]+)$/,
      async (req, [id]) => {
        await uc.stack.remove(req.userId, id!);
        return { status: 204 };
      },
    ],
    [
      "PUT",
      /^\/stack\/([^/]+)\/taken$/,
      async (req, [id]) => {
        const { taken } = json(req, SetTakenRequest);
        await uc.stack.setTaken(req.userId, id!, taken);
        return ok(SetTakenRequest, { taken });
      },
    ],
    [
      "PUT",
      /^\/stack\/([^/]+)\/feeling$/,
      async (req, [id]) => {
        const { feeling } = json(req, SetFeelingRequest);
        await uc.stack.setFeeling(req.userId, id!, feeling);
        return ok(SetFeelingRequest, { feeling });
      },
    ],
    ["GET", /^\/fasting$/, async (req) => ok(FastingStatus, toFasting(await uc.getFasting.execute(req)))],
    ["GET", /^\/coffee$/, async (req) => ok(CoffeeDay, toCoffeeDay(await uc.coffee.day(req.userId, date(req))))],
    ["GET", /^\/sessions$/, async (req) => ok(SessionsResponse, toSessionDay(await uc.sessions.day(req.userId)))],
    [
      "POST",
      /^\/sessions$/,
      async (req) => {
        const body = json(req, LogSessionRequest);
        const day = await uc.sessions.log(req.userId, {
          kind: body.kind,
          ...(body.minutes ? { minutes: body.minutes } : {}),
          ...(body.takenAt ? { takenAt: new Date(body.takenAt) } : {}),
        });
        return ok(SessionsResponse, toSessionDay(day), 201);
      },
    ],
    [
      "DELETE",
      /^\/sessions\/([^/]+)$/,
      async (req, [id]) => {
        await uc.sessions.remove(req.userId, id!);
        return { status: 204 };
      },
    ],
    [
      "GET",
      /^\/coffee\/products$/,
      async () => ok(CoffeeProducts, { products: (await uc.coffee.products()).map((item) => toProductRecommendation({ item, similarity: 1 })) }),
    ],
    [
      "POST",
      /^\/coffee$/,
      async (req) => {
        const body = json(req, LogCoffeeRequest);
        const day = await uc.coffee.log(req.userId, { kind: body.kind, addIns: body.addIns, ...(body.takenAt ? { takenAt: new Date(body.takenAt) } : {}) });
        return ok(CoffeeDay, toCoffeeDay(day), 201);
      },
    ],
    [
      "DELETE",
      /^\/coffee\/([^/]+)$/,
      async (req, [id]) => {
        await uc.coffee.remove(req.userId, id!);
        return { status: 204 };
      },
    ],
    [
      "PUT",
      /^\/fasting\/plan$/,
      async (req) => ok(FastingStatus, toFasting(await uc.getFasting.plan(req.userId, new Date(json(req, PlanFastRequest).until)))),
    ],
    ["DELETE", /^\/fasting\/plan$/, async (req) => ok(FastingStatus, toFasting(await uc.getFasting.endPlan(req.userId)))],
    [
      "POST",
      /^\/foods\/scan$/,
      async (req) => {
        await uc.gate.require(req);
        await uc.aiAllowance.spend(req, "read");
        const scan = (req.headers["content-type"] ?? "").startsWith("application/json")
          ? await uc.scanFood.byPhotoKeys({ userId: req.userId, photoKeys: json(req, AnalyzeSupplementRequest).photoKeys })
          : await uc.scanFood.byPhotos(await photosFrom(req, MAX_LABEL_PHOTOS));
        return ok(FoodScanResponse, toFoodScan(scan));
      },
    ],
    [
      "GET",
      /^\/foods\/barcode\/([^/]+)$/,
      async (req, [code]) => {
        await uc.gate.require(req);
        return ok(FoodScanResponse, toFoodScan(await uc.scanFood.byBarcode(code!)));
      },
    ],
    [
      "POST",
      /^\/foods\/better-choice$/,
      async (req) => {
        await uc.gate.require(req);
        await uc.aiAllowance.spend(req, "generate");
        const { device, ...choice } = await uc.betterChoice.execute({ userId: req.userId, ...json(req, BetterChoiceRequest) });
        return ok(BetterChoiceResponse, { ...choice, ...(device ? { device: toProductRecommendation({ item: device, similarity: 1 }) } : {}) });
      },
    ],
    ["GET", /^\/foods$/, async () => ok(FoodCatalog, { foods: (await uc.listFoods.execute()).map(({ kind: _, ...food }) => food) })],
    [
      "POST",
      /^\/supplements\/analyze$/,
      async (req) => {
        await uc.gate.require(req);
        await uc.aiAllowance.spend(req, "read");
        // Same two ways in as a meal photo: photoKeys from uploads, or multipart (one `photo` field per side).
        const analysis = (req.headers["content-type"] ?? "").startsWith("application/json")
          ? await uc.analyzeSupplementLabel.executeForKeys({ userId: req.userId, photoKeys: json(req, AnalyzeSupplementRequest).photoKeys })
          : await uc.analyzeSupplementLabel.execute(await photosFrom(req, MAX_LABEL_PHOTOS));
        return ok(SupplementLabelResponse, toSupplementLabel(analysis));
      },
    ],
    [
      "POST",
      /^\/meals$/,
      async (req) => {
        const body = json(req, CreateMealRequest);
        const saved = await uc.logMeal.execute({
          userId: req.userId,
          meal: { kind: body.kind, eatenAt: new Date(body.eatenAt), items: body.items, ...(body.clientKey ? { clientKey: body.clientKey } : {}) },
        });
        return ok(Meal, toMeal(saved), 201);
      },
    ],
    ["GET", /^\/meals$/, async (req) => ok(z.array(Meal), (await uc.listMeals.execute({ userId: req.userId, date: date(req) })).map(toMeal))],
    [
      "DELETE",
      /^\/me$/,
      async (req) => {
        await uc.deleteAccount.execute(req.userId);
        return { status: 204 };
      },
    ],
    [
      "DELETE",
      /^\/meals\/([^/]+)$/,
      async (req, [mealId]) => {
        await uc.deleteMeal.execute({ userId: req.userId, mealId: mealId! });
        return { status: 204 };
      },
    ],
    [
      "GET",
      /^\/recommendations\/next$/,
      async (req) => {
        await uc.gate.require(req);
        return ok(NextRecommendationsResponse, toRecommendations(await uc.recommendRecipe.execute(req)));
      },
    ],
    [
      "GET",
      /^\/recommendations\/protocols$/,
      async (req) => ok(ProtocolsResponse, toProtocols(await uc.getProtocols.execute({ userId: req.userId }))),
    ],
    [
      "GET",
      /^\/history$/,
      async (req) => {
        const raw = req.query.get("days");
        const days = raw === null ? undefined : Number(raw);
        return ok(HistoryResponse, { days: await uc.getHistory.execute({ userId: req.userId, days }) });
      },
    ],
    ["GET", /^\/focus-score$/, async (req) => ok(FocusScore, toFocusScore(await uc.getFocusScore.execute({ userId: req.userId, date: date(req) })))],
    [
      "GET",
      /^\/today$/,
      async (req) => {
        const day = { userId: req.userId, date: date(req) };
        // The extras only for today, and each on its own: one failing leaves the rest of the day showing.
        const extra = async <T>(name: string, load: () => Promise<T>): Promise<T | undefined> => {
          if (day.date !== undefined) return undefined;
          try {
            return await load();
          } catch (e) {
            console.error(JSON.stringify({ event: "today_extra_failed", extra: name, error: String(e) }));
            return undefined;
          }
        };
        const [focus, bio, meals, exercise, environmentDay, recipes, fasting, stack, brain] = await Promise.all([
          uc.getFocusScore.execute(day),
          uc.getBioState.execute(day),
          uc.listMeals.execute(day),
          // Part of any day, past or present; still left out rather than failing the whole screen.
          uc.exercise.day(req.userId, day.date).then(toExerciseDay, (e: unknown) => {
            console.error(JSON.stringify({ event: "today_extra_failed", extra: "exercise", error: String(e) }));
            return undefined;
          }),
          uc.environment.day(req.userId, day.date).catch((e: unknown) => {
            console.error(JSON.stringify({ event: "today_extra_failed", extra: "environment", error: String(e) }));
            return undefined;
          }),
          extra("recipes", async () => {
            await uc.gate.require(req);
            return toRecommendations(await uc.recommendRecipe.execute(req));
          }),
          extra("fasting", async () => toFasting(await uc.getFasting.execute(req))),
          extra("stack", async () => {
            const s = await uc.stack.get(req.userId);
            return { date: s.date, items: s.items, flags: s.flags };
          }),
          extra("brain", async () => {
            const h = await uc.brainChecks.history(req.userId, 30);
            return { checks: h.checks.map(toBrainCheck), ...(h.baselineScore === undefined ? {} : { baselineScore: h.baselineScore }) };
          }),
        ]);
        return ok(TodayResponse, {
          focus: toFocusScore(focus),
          bio: toBioState(bio),
          meals: meals.map(toMeal),
          ...(exercise ? { exercise } : {}),
          ...(environmentDay ? { environment: environmentDay } : {}),
          ...(recipes ? { recipes } : {}),
          ...(fasting ? { fasting } : {}),
          ...(stack ? { stack } : {}),
          ...(brain ? { brain } : {}),
        });
      },
    ],
    [
      "GET",
      /^\/admin\/knowledge$/,
      async (req) =>
        ok(AdminKnowledge, { sources: (await uc.knowledge.list(admin(req))).map(toKnowledgeSource), watching: uc.knowledge.watching() }),
    ],
    ["POST", /^\/admin\/knowledge\/sources$/, async (req) => ok(KnowledgeSource, toKnowledgeSource(await uc.knowledge.addSource(admin(req), json(req, AddKnowledgeSourceRequest))), 201)],
    [
      "POST",
      /^\/admin\/knowledge\/sources\/([^/]+)\/transcript$/,
      async (req, [id]) => ok(KnowledgeSource, toKnowledgeSource(await uc.knowledge.addTranscript(admin(req), id!, json(req, AddTranscriptRequest).transcript))),
    ],
    [
      "PUT",
      /^\/admin\/knowledge\/techniques\/([^/]+)$/,
      async (req, [id]) => {
        const technique = await uc.knowledge.review(admin(req), id!, json(req, ReviewTechniqueRequest));
        const source = (await uc.knowledge.list(admin(req))).find((s) => s.source.id === technique.sourceId)!.source;
        return ok(KnowledgeTechnique, toTechnique(source.url)(technique));
      },
    ],
    ["POST", /^\/admin\/knowledge\/sync$/, async (req) => ok(KnowledgeSyncResponse, await uc.knowledge.syncAsAdmin(admin(req)))],
    ["GET", /^\/glucose$/, async (req) => ok(GlucoseResponse, { days: await uc.glucose.recent(req.userId) })],
    ["POST", /^\/glucose$/, async (req) => ok(IngestResponse, await uc.glucose.record(req.userId, json(req, RecordGlucoseRequest).days), 201)],
    ["GET", /^\/markers$/, async (req) => ok(HealthMarkersResponse, { markers: (await uc.markers.list(req.userId)).map(toMarkerSummary) })],
    [
      "POST",
      /^\/markers$/,
      async (req) => {
        const readings = json(req, RecordMarkersRequest).readings.map((r) => ({
          marker: r.marker,
          value: r.value,
          source: r.source,
          ...(r.measuredAt ? { measuredAt: new Date(r.measuredAt) } : {}),
        }));
        return ok(IngestResponse, await uc.markers.record(req.userId, readings), 201);
      },
    ],
    [
      "DELETE",
      /^\/markers\/([^/]+)$/,
      async (req, [id]) => {
        await uc.markers.delete(req.userId, id!);
        return { status: 204 };
      },
    ],
    ["GET", /^\/healthspan$/, async (req) => ok(HealthspanResponse, await uc.getHealthspan.execute({ userId: req.userId }))],
    [
      "GET",
      /^\/admin\/devices$/,
      async (req) => ok(AdminDevices, { devices: (await uc.devices.list(admin(req))).map(toDevice), canScan: uc.devices.canScan() }),
    ],
    ["PUT", /^\/admin\/devices\/([^/]+)$/, async (req, [id]) => ok(DeviceCandidateDto, toDevice(await uc.devices.review(admin(req), id!, json(req, ReviewDeviceRequest))))],
    ["POST", /^\/admin\/devices\/scan$/, async (req) => ok(DeviceScanResponse, await uc.devices.scanAsAdmin(admin(req)))],
    ["GET", /^\/admin\/products$/, async (req) => ok(AdminProductList, { products: await uc.adminProducts.list(admin(req)) })],
    ["GET", /^\/admin\/eating-out$/, async (req) => ok(AdminEatingOutList, { items: (await uc.eatingOutAdmin.list(admin(req))).map(toCatalogFood) })],
    ["POST", /^\/admin\/eating-out$/, async (req) => ok(CatalogFood, toCatalogFood(await uc.eatingOutAdmin.save(admin(req), json(req, SaveEatingOutItemRequest))), 201)],
    [
      "DELETE",
      /^\/admin\/eating-out\/([^/]+)$/,
      async (req, [id]) => {
        await uc.eatingOutAdmin.remove(admin(req), decodeURIComponent(id!));
        return { status: 204 };
      },
    ],
    [
      "GET",
      /^\/admin\/waitlist$/,
      async (req) => {
        const overview = await uc.adminWaitlist.execute(admin(req));
        return ok(AdminWaitlist, { ...overview, entries: overview.entries.map((e) => ({ ...e, joinedAt: e.joinedAt.toISOString() })) });
      },
    ],
    [
      "POST",
      /^\/admin\/products$/,
      async (req) => ok(AdminProduct, await uc.adminProducts.create(admin(req), json(req, CreateAdminProductRequest)), 201),
    ],
    [
      "PUT",
      /^\/admin\/products\/([^/]+)$/,
      async (req, [id]) => ok(AdminProduct, await uc.adminProducts.update(admin(req), decodeURIComponent(id!), json(req, UpdateAdminProductRequest))),
    ],
    [
      "DELETE",
      /^\/admin\/products\/([^/]+)$/,
      async (req, [id]) => {
        await uc.adminProducts.remove(admin(req), decodeURIComponent(id!));
        return { status: 204 };
      },
    ],
    [
      "POST",
      /^\/telemetry\/sleep$/,
      async (req) => {
        const { sessions } = json(req, IngestSleepRequest);
        const accepted = await uc.ingestTelemetry.sleep({
          userId: req.userId,
          sessions: sessions.map((s) => ({
            start: new Date(s.start),
            end: new Date(s.end),
            source: s.source,
            ...(s.deepMinutes === undefined ? {} : { deepMinutes: s.deepMinutes }),
          })),
        });
        return ok(IngestResponse, { accepted });
      },
    ],
    [
      "POST",
      /^\/telemetry\/screen-time$/,
      async (req) => {
        const { samples } = json(req, IngestScreenTimeRequest);
        const accepted = await uc.ingestTelemetry.screenTime({
          userId: req.userId,
          samples: samples.map((s) => ({ windowStart: new Date(s.windowStart), windowEnd: new Date(s.windowEnd), minutes: s.minutes, source: s.source })),
        });
        return ok(IngestResponse, { accepted });
      },
    ],
  ];

  async function handle(req: ApiRequest): Promise<ApiResponse> {
    const path = normalise(req.path);
    const matches = routes.filter(([, pattern]) => pattern.test(path));
    const route = matches.find(([method]) => method === req.method);
    if (!route) {
      return matches.length
        ? error(405, "method_not_allowed", `${req.method} isn't supported on ${path}.`)
        : error(404, "not_found", `There's nothing at ${path}.`);
    }
    try {
      return await route[2](req, route[1].exec(path)!.slice(1));
    } catch (e) {
      if (e instanceof BadRequest) return error(400, "invalid_request", e.message);
      if (e instanceof DomainError) return error(STATUS[e.code] ?? 500, e.code, e.message);
      console.error(JSON.stringify({ event: "unhandled_error", path, method: req.method, error: String(e) }));
      await errors?.report(e, { source: "api", method: req.method, route: routeOf(path) });
      return error(500, "internal", "Something went wrong on our side. Try again in a moment.");
    }
  }

  /** True for routes that need no sign-in (the waitlist). */
  const isPublic = (method: string, path: string) => publicRoutes.some(([m, pattern]) => m === method && pattern.test(normalise(path)));
  return Object.assign(handle, { isPublic });
}
