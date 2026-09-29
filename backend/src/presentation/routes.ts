import {
  AnalyzeMealResponse,
  BioState,
  CheckIn,
  CreateCheckInRequest,
  CreateMealRequest,
  FocusScore,
  IngestResponse,
  IngestScreenTimeRequest,
  IngestSleepRequest,
  Meal,
  NextRecommendationsResponse,
  Profile,
  UpdateProfileRequest,
  type ApiError,
} from "@neurocal/contracts";
import { z } from "zod";
import type { AnalyzeMealPhotoUseCase } from "../application/use-cases/AnalyzeMealPhotoUseCase";
import type { DeleteMealUseCase } from "../application/use-cases/DeleteMealUseCase";
import type { GetBioStateUseCase } from "../application/use-cases/GetBioStateUseCase";
import type { GetFocusScoreUseCase } from "../application/use-cases/GetFocusScoreUseCase";
import type { IngestTelemetryUseCase } from "../application/use-cases/IngestTelemetryUseCase";
import type { ListMealsUseCase } from "../application/use-cases/ListMealsUseCase";
import type { LogMealUseCase } from "../application/use-cases/LogMealUseCase";
import type { GetProfileUseCase, UpdateProfileUseCase } from "../application/use-cases/ProfileUseCases";
import type { RecommendRecipeUseCase } from "../application/use-cases/RecommendRecipeUseCase";
import type { RecordCheckInUseCase } from "../application/use-cases/RecordCheckInUseCase";
import { DomainError } from "../domain/errors";
import { toAnalysis, toBioState, toCheckIn, toFocusScore, toMeal, toProfile, toRecommendations } from "./mappers";

/** Transport-neutral request: the Lambda adapter and the dev server both build one of these. */
export interface ApiRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string | undefined>;
  body?: Uint8Array;
  /** Set by the transport from the verified identity; never read from the request. */
  userId: string;
}

export interface ApiResponse {
  status: number;
  body?: unknown;
}

export interface UseCases {
  getProfile: GetProfileUseCase;
  updateProfile: UpdateProfileUseCase;
  getBioState: GetBioStateUseCase;
  recordCheckIn: RecordCheckInUseCase;
  analyzeMealPhoto: AnalyzeMealPhotoUseCase;
  logMeal: LogMealUseCase;
  listMeals: ListMealsUseCase;
  deleteMeal: DeleteMealUseCase;
  recommendRecipe: RecommendRecipeUseCase;
  ingestTelemetry: IngestTelemetryUseCase;
  getFocusScore: GetFocusScoreUseCase;
}

class BadRequest extends Error {}

const STATUS: Record<string, number> = { invalid_request: 400, not_found: 404, upstream_failed: 502 };

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
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.startsWith("multipart/form-data")) throw new BadRequest("Send the photo as multipart/form-data.");
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
  const photo = form.get("photo");
  if (!photo || typeof photo === "string") throw new BadRequest("Attach a photo of the meal.");
  return { bytes: new Uint8Array(await photo.arrayBuffer()), mediaType: photo.type || "application/octet-stream" };
}

const date = (req: ApiRequest) => req.query.get("date") ?? undefined;

export function createApi(uc: UseCases) {
  const routes: [method: string, pattern: RegExp, handler: (req: ApiRequest, params: string[]) => Promise<ApiResponse>][] = [
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
    ["POST", /^\/meals\/analyze$/, async (req) => ok(AnalyzeMealResponse, toAnalysis(await uc.analyzeMealPhoto.execute(await photoFrom(req))))],
    [
      "POST",
      /^\/meals$/,
      async (req) => {
        const body = json(req, CreateMealRequest);
        const saved = await uc.logMeal.execute({
          userId: req.userId,
          meal: { kind: body.kind, eatenAt: new Date(body.eatenAt), items: body.items },
        });
        return ok(Meal, toMeal(saved), 201);
      },
    ],
    ["GET", /^\/meals$/, async (req) => ok(z.array(Meal), (await uc.listMeals.execute({ userId: req.userId, date: date(req) })).map(toMeal))],
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
      async (req) => ok(NextRecommendationsResponse, toRecommendations(await uc.recommendRecipe.execute(req))),
    ],
    ["GET", /^\/focus-score$/, async (req) => ok(FocusScore, toFocusScore(await uc.getFocusScore.execute({ userId: req.userId, date: date(req) })))],
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

  return async function handle(req: ApiRequest): Promise<ApiResponse> {
    const path = req.path.replace(/\/+$/, "") || "/";
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
  };
}
