import { beforeEach, describe, expect, it } from "@jest/globals";
import { PRODUCTS, PROTOCOLS } from "../infrastructure/catalog/catalog";
import { SyncCatalogUseCase } from "../application/use-cases/SyncCatalogUseCase";
import {
  FakeEmail,
  FakeEmbedder,
  FakeExplainer,
  FakeReasoning,
  FakeSearch,
  FakeVision,
  FixedClock,
  InMemoryCatalog,
  InMemoryCheckIns,
  InMemoryFocusScores,
  InMemoryMeals,
  InMemoryProfiles,
  InMemoryStorage,
  InMemoryRecommendations,
  InMemoryTelemetry,
  InMemoryWaitlist,
  item,
  profile,
} from "../application/testing/fakes";
import { buildUseCases } from "./compose";
import { createApi, type ApiRequest } from "./routes";

const clock = new FixedClock(new Date("2026-09-29T22:00:00Z")); // 17:00 in Chicago
let api: ReturnType<typeof createApi>;
let profiles: InMemoryProfiles;
let storage: InMemoryStorage;
let waitlist: InMemoryWaitlist;
let email: FakeEmail;

beforeEach(async () => {
  profiles = new InMemoryProfiles();
  storage = new InMemoryStorage();
  waitlist = new InMemoryWaitlist();
  email = new FakeEmail();
  const meals = new InMemoryMeals();
  await profiles.save(profile());
  await meals.create("u1", { kind: "breakfast", eatenAt: new Date("2026-09-29T13:10:00Z"), items: [item("Oats", 440, 12.8, 67, 15)] });
  const catalog = new InMemoryCatalog();
  await new SyncCatalogUseCase(catalog, new FakeEmbedder()).execute({
    protocols: PROTOCOLS,
    products: [{ ...PRODUCTS[0]!, affiliate: true, url: "https://example.com/alarm" }, ...PRODUCTS.slice(1)],
  });
  api = createApi(
    buildUseCases({
      profiles,
      meals,
      checkIns: new InMemoryCheckIns(),
      recommendations: new InMemoryRecommendations(),
      telemetry: new InMemoryTelemetry(),
      focusScores: new InMemoryFocusScores(),
      catalog,
      embedder: new FakeEmbedder(),
      explainer: new FakeExplainer("Short sleep is holding you back."),
      storage,
      vision: new FakeVision({ items: [{ ...item("Quinoa", 166, 6, 29, 2.7), confidence: 0.8, glycemicLoad: "medium" }] }),
      reasoning: new FakeReasoning({ searchQuery: "pescatarian dinner", contextualReasoning: "Fits your day." }),
      search: new FakeSearch([
        {
          title: "Cod",
          url: "https://www.seriouseats.com/cod",
          sourceName: "Serious Eats",
          snippet: "",
          minutes: 30,
          calories: 640,
          macros: { proteinG: 46, carbsG: 62, fatG: 18 },
        },
      ]),
      clock,
      recipeDomains: ["seriouseats.com"],
      waitlist,
      email,
      webUrl: "https://neurocal.ai",
    }),
  );
});

const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, isAdmin = false) => {
  const url = new URL(path, "http://x");
  const req: ApiRequest = {
    method,
    path: url.pathname,
    query: url.searchParams,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    userId: "u1",
    isAdmin,
    ...(body === undefined ? {} : { body: new TextEncoder().encode(typeof body === "string" ? body : JSON.stringify(body)) }),
  };
  return api(req);
};

describe("API routes", () => {
  it("GET /me returns the contract profile", async () => {
    const res = await call("GET", "/me");
    expect(res).toEqual({ status: 200, body: expect.objectContaining({ id: "u1", timeZone: "America/Chicago" }) });
  });

  it("GET /bio-state and GET /meals use today in the user's time zone", async () => {
    expect((await call("GET", "/bio-state")).body).toMatchObject({ date: "2026-09-29", caloriesEaten: 440 });
    const meals = await call("GET", "/meals");
    expect(meals.body).toEqual([expect.objectContaining({ kind: "breakfast", eatenAt: "2026-09-29T13:10:00.000Z" })]);
  });

  it("POST /meals twice with the same clientKey logs one meal", async () => {
    const meal = {
      kind: "snack",
      eatenAt: "2026-09-29T16:30:00-05:00",
      items: [{ name: "Apple", portion: "1", calories: 95, macros: { proteinG: 0.5, carbsG: 25, fatG: 0.3 } }],
      clientKey: "0b8f4c1e-6f0a-4b7e-9a51-2f3d7c9e1a10",
    };
    const first = await call("POST", "/meals", meal);
    const again = await call("POST", "/meals", meal);
    expect(again.status).toBe(201);
    expect((again.body as { id: string }).id).toBe((first.body as { id: string }).id);
    expect((await call("POST", "/meals", { ...meal, clientKey: "not-a-uuid" })).status).toBe(400);
  });

  it("POST /meals then DELETE /meals/:id", async () => {
    const created = await call("POST", "/meals", {
      kind: "snack",
      eatenAt: "2026-09-29T16:30:00-05:00",
      items: [{ name: "Apple", portion: "1", calories: 95, macros: { proteinG: 0.5, carbsG: 25, fatG: 0.3 } }],
    });
    expect(created.status).toBe(201);
    const id = (created.body as { id: string }).id;
    expect((await call("DELETE", `/meals/${id}`)).status).toBe(204);
    expect(await call("DELETE", `/meals/${id}`)).toMatchObject({ status: 404, body: { code: "not_found" } });
  });

  it("POST /check-ins validates against the contract", async () => {
    expect((await call("POST", "/check-ins", { at: "2026-09-29T17:00:00-05:00", flags: ["sharp"] })).status).toBe(201);
    expect(await call("POST", "/check-ins", { at: "2026-09-29T17:00:00-05:00", flags: [] })).toMatchObject({
      status: 400,
      body: { code: "invalid_request" },
    });
  });

  it("POST /meals/analyze reads a multipart photo and returns contract items", async () => {
    const form = new FormData();
    form.append("photo", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "plate.jpg");
    const request = new Request("http://x", { method: "POST", body: form });
    const res = await api({
      method: "POST",
      path: "/meals/analyze",
      query: new URLSearchParams(),
      headers: { "content-type": request.headers.get("content-type")! },
      body: new Uint8Array(await request.arrayBuffer()),
      userId: "u1",
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [{ name: "Quinoa", portion: "1 serving", calories: 166, macros: expect.any(Object), confidence: 0.8, glycemicLoad: "medium" }],
    });
  });

  it("POST /uploads/meal-photo issues an upload, and /meals/analyze reads it by key", async () => {
    const created = await call("POST", "/uploads/meal-photo", { mediaType: "image/jpeg", sizeBytes: 3 });
    expect(created.status).toBe(201);
    const upload = created.body as { photoKey: string; uploadUrl: string; headers: Record<string, string>; expiresAt: string };
    expect(upload).toEqual({ photoKey: expect.stringMatching(/^uploads\/u1\//), uploadUrl: `https://storage.test/${upload.photoKey}`, headers: { "content-type": "image/jpeg" }, expiresAt: "2026-09-29T17:05:00.000Z" });

    // Before the bytes arrive the key reads as missing; after, it is analyzed.
    expect((await call("POST", "/meals/analyze", { photoKey: upload.photoKey })).status).toBe(404);
    storage.objects.set(upload.photoKey, { bytes: new Uint8Array([1, 2, 3]), mediaType: "image/jpeg" });
    const analyzed = await call("POST", "/meals/analyze", { photoKey: upload.photoKey });
    expect(analyzed.status).toBe(200);
    expect(analyzed.body).toMatchObject({ items: [{ name: "Quinoa" }] });

    expect((await call("POST", "/uploads/meal-photo", { mediaType: "image/jpeg", sizeBytes: 9 * 1024 * 1024 })).status).toBe(400);
    expect((await call("POST", "/meals/analyze", { photoKey: "uploads/someone-else/x" })).status).toBe(404);
  });

  it("GET /recommendations/next returns recipes without internal fields", async () => {
    const res = await call("GET", "/recommendations/next");
    expect(res.body).toEqual({
      searchQuery: "pescatarian dinner",
      recipes: [expect.objectContaining({ title: "Cod", reasoning: "Fits your day." })],
    });
    expect((res.body as { recipes: object[] }).recipes[0]).not.toHaveProperty("searchQuery");
  });

  it("PUT /me/profile applies a partial update", async () => {
    const res = await call("PUT", "/me/profile", { dailyCalorieTarget: 2000 });
    expect(res.body).toMatchObject({ dailyCalorieTarget: 2000, displayName: "Lionel" });
  });

  it("POST /telemetry/sleep feeds GET /focus-score", async () => {
    expect((await call("GET", "/focus-score")).body).toEqual({
      date: "2026-09-29",
      score: null,
      components: { sleep: null, timing: null, glycemic: null, stress: null },
      explanation: expect.stringMatching(/Log last night's sleep/),
    });
    const ingest = await call("POST", "/telemetry/sleep", {
      sessions: [{ start: "2026-09-28T23:00:00-05:00", end: "2026-09-29T05:00:00-05:00", source: "manual" }],
    });
    expect(ingest).toEqual({ status: 200, body: { accepted: 1 } });
    expect((await call("GET", "/focus-score")).body).toMatchObject({
      score: 75,
      components: { sleep: 0.75 },
      explanation: "Short sleep is holding you back.",
    });
  });

  it("POST /telemetry/screen-time validates the window", async () => {
    const res = await call("POST", "/telemetry/screen-time", {
      samples: [{ windowStart: "2026-09-28T22:00:00-05:00", windowEnd: "2026-09-28T23:00:00-05:00", minutes: 90, source: "wearable" }],
    });
    expect(res).toMatchObject({ status: 400, body: { code: "invalid_request" } });
  });

  it("GET /history returns the last N days in contract shape", async () => {
    const res = await call("GET", "/history?days=2");
    expect(res.status).toBe(200);
    expect((res.body as { days: { date: string }[] }).days.map((d) => d.date)).toEqual(["2026-09-28", "2026-09-29"]);
    expect((res.body as { days: object[] }).days[1]).toMatchObject({ caloriesEaten: 440, lastMealAt: "08:10" });
    expect((await call("GET", "/history?days=abc")).status).toBe(400);
  });

  it("GET /recommendations/protocols returns matches with the affiliate flag intact", async () => {
    const res = await call("GET", "/recommendations/protocols");
    expect(res.status).toBe(200);
    const body = res.body as { protocols: { steps: string[]; match: number }[]; products: { affiliate: boolean; url?: string }[] };
    expect(body.protocols).toHaveLength(2);
    expect(body.protocols[0]!.steps.length).toBeGreaterThan(0);
    expect(body.products.every((p) => typeof p.affiliate === "boolean")).toBe(true);
    // The catalog has several partner products; whichever is matched must keep its flag and link.
    for (const partner of body.products.filter((p) => p.affiliate)) expect(partner.url).toMatch(/^https:\/\//);
  });

  it("keeps the admin product routes to admins", async () => {
    expect((await call("GET", "/admin/products")).status).toBe(403);
    expect((await call("PUT", "/admin/products/sunrise-alarm", { enabled: false })).status).toBe(403);

    const asAdmin = (method: string, path: string, body?: unknown) => call(method, path, body, {}, true);
    const list = (await asAdmin("GET", "/admin/products")).body as { products: { id: string; enabled: boolean; managedBy: string }[] };
    expect(list.products.find((p) => p.id === "truedark-evening-glasses")).toMatchObject({ enabled: true, managedBy: "catalog", affiliate: true });

    const swapped = await asAdmin("PUT", "/admin/products/truedark-evening-glasses", { url: "https://truedark.com/?ref=neurocal" });
    expect(swapped.status).toBe(200);
    expect(swapped.body).toMatchObject({ url: "https://truedark.com/?ref=neurocal", catalogUrl: "https://truedark.com/" });
    expect((await asAdmin("PUT", "/admin/products/truedark-evening-glasses", { url: "http://plain.example" })).status).toBe(400);
    expect((await asAdmin("PUT", "/admin/products/unknown", { enabled: false })).status).toBe(404);

    const created = await asAdmin("POST", "/admin/products", { name: "Vitamin ADK", description: "Vitamins A, D and K.", url: "https://www.mitoproof.com/products/adk", affiliate: false, ownBrand: true, supplement: true, tags: ["vitamins"] });
    expect(created.status).toBe(201);
    const id = (created.body as { id: string }).id;
    expect((await asAdmin("DELETE", `/admin/products/${id}`)).status).toBe(204);
    expect((await asAdmin("DELETE", "/admin/products/sunrise-alarm")).status).toBe(404);
  });

  it("POST /waitlist is public, answers the same way twice, and its link unsubscribes", async () => {
    expect(api.isPublic("POST", "/waitlist")).toBe(true);
    expect(api.isPublic("POST", "/waitlist/unsubscribe/")).toBe(true);
    expect(api.isPublic("GET", "/waitlist")).toBe(false);
    expect(api.isPublic("POST", "/meals")).toBe(false);

    const first = await call("POST", "/waitlist", { email: "Sam@Example.com", platform: "android" });
    expect(first).toEqual({ status: 201, body: { status: "joined" } });
    expect(await call("POST", "/waitlist", { email: "sam@example.com" })).toEqual(first);
    expect(waitlist.rows).toHaveLength(1);
    expect(email.sent).toHaveLength(1);

    expect((await call("POST", "/waitlist", { email: "nope" })).status).toBe(400);
    expect((await call("POST", "/waitlist", { email: "sam@example.com", platform: "windows" })).status).toBe(400);

    const token = waitlist.rows[0]!.unsubscribeToken;
    expect(await call("POST", "/waitlist/unsubscribe", { token })).toEqual({ status: 200, body: { status: "unsubscribed" } });
    expect(waitlist.rows[0]!.unsubscribed).toBe(true);
  });

  it("answers bad JSON, unknown paths and wrong methods clearly", async () => {
    expect((await call("POST", "/meals", "{nope")).body).toEqual({ code: "invalid_request", message: "The request body isn't valid JSON." });
    expect((await call("GET", "/nothing")).status).toBe(404);
    expect((await call("PATCH", "/meals")).status).toBe(405);
  });
});
