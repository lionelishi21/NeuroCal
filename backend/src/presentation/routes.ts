import {
  AdminProduct,
  AdminProductList,
  AdminWaitlist,
  AnalyzeMealRequest,
  AnalyzeMealResponse,
  SupplementLabelResponse,
  FoodCatalog,
  AddStackItemRequest,
  SetTakenRequest,
  StackItem,
  StackResponse,
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
import type { StackUseCases } from "../application/use-cases/StackUseCases";
import type { GetFastingUseCase } from "../application/use-cases/GetFastingUseCase";
import type { ListFoodsUseCase } from "../application/use-cases/ListFoodsUseCase";
import type { LogMealUseCase } from "../application/use-cases/LogMealUseCase";
import type { GetProfileUseCase, UpdateProfileUseCase } from "../application/use-cases/ProfileUseCases";
import type { RecommendRecipeUseCase } from "../application/use-cases/RecommendRecipeUseCase";
import type { RecordCheckInUseCase } from "../application/use-cases/RecordCheckInUseCase";
import type { AdminWaitlistUseCase, JoinWaitlistUseCase, LeaveWaitlistUseCase } from "../application/use-cases/WaitlistUseCases";
import { DomainError } from "../domain/errors";
import { storeEventFrom } from "../infrastructure/billing/RevenueCat";
import { imageTypeOf } from "../domain/photo";
import { toAnalysis, toBioState, toCheckIn, toFasting, toFocusScore, toMeal, toProfile, toProtocols, toRecommendations, toSupplementLabel } from "./mappers";

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
  logWeight: LogWeightUseCase;
  getWeightHistory: GetWeightHistoryUseCase;
  deleteWeight: DeleteWeightUseCase;
  getFasting: GetFastingUseCase;
  getSubscription: GetSubscriptionUseCase;
  stack: StackUseCases;
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

const STATUS: Record<string, number> = { invalid_request: 400, subscription_required: 402, forbidden: 403, not_found: 404, upstream_failed: 502 };

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

const admin = (req: ApiRequest) => ({ isAdmin: req.isAdmin === true });
const date = (req: ApiRequest) => req.query.get("date") ?? undefined;

type Route = [method: string, pattern: RegExp, handler: (req: ApiRequest, params: string[]) => Promise<ApiResponse>];
const normalise = (path: string) => path.replace(/\/+$/, "") || "/";

export function createApi(uc: UseCases) {
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
        await uc.gate.require(req);
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
    ["GET", /^\/fasting$/, async (req) => ok(FastingStatus, toFasting(await uc.getFasting.execute(req)))],
    ["GET", /^\/foods$/, async () => ok(FoodCatalog, { foods: uc.listFoods.execute().map(({ kind: _, ...food }) => food) })],
    [
      "POST",
      /^\/supplements\/analyze$/,
      async (req) => {
        await uc.gate.require(req);
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
    ["GET", /^\/admin\/products$/, async (req) => ok(AdminProductList, { products: await uc.adminProducts.list(admin(req)) })],
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
      return error(500, "internal", "Something went wrong on our side. Try again in a moment.");
    }
  }

  /** True for routes that need no sign-in (the waitlist). */
  const isPublic = (method: string, path: string) => publicRoutes.some(([m, pattern]) => m === method && pattern.test(normalise(path)));
  return Object.assign(handle, { isPublic });
}
