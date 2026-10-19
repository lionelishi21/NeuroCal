import { beforeEach, describe, expect, it } from "@jest/globals";
import { BrainCheckHistory, FoodCatalog, FoodScanResponse, StackResponse, SupplementLabelResponse, TodayResponse, ExerciseDay, PantryRecipesResponse, PantryResponse, LevelResponse, ShoppingReviewResponse, KnowledgeSource, AdminKnowledge, AdminDevices, DeviceCandidate, HealthspanResponse, HealthMarkersResponse, RecipeAnalysis, EnvironmentDay, MealPlanResponse } from "@neurocal/contracts";
import { PRODUCTS, PROTOCOLS } from "../infrastructure/catalog/catalog";
import { FOODS } from "../infrastructure/catalog/foods";
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
  InMemoryUsers,
  InMemoryWeights,
  InMemorySubscriptions,
  InMemoryStack,
  InMemoryBrainChecks,
  InMemoryExercises,
  InMemoryPantry,
  FakePantryRecipes,
  FakeShoppingReviewer,
  FakeRecipeParser,
  FakeMealPlanner,
  InMemoryMealPlans,
  FakeAirQuality,
  FakeGeocoder,
  InMemoryEnvironment,
  FakeTechniqueExtractor,
  FakeDeviceExtractor,
  FakeWebSearch,
  InMemoryDeviceCandidates,
  InMemoryAiUsage,
  InMemoryMarkers,
  InMemoryKnowledge,
  FakeLabelReader,
  FakeFoodLabelReader,
  FakeProductDatabase,
  FakeIdentity,
  InMemoryRecommendations,
  InMemoryTelemetry,
  InMemoryWaitlist,
  item,
  profile,
} from "../application/testing/fakes";
import { type Ports, buildUseCases } from "./compose";
import { createApi, type ApiRequest } from "./routes";

const clock = new FixedClock(new Date("2026-09-29T22:00:00Z")); // 17:00 in Chicago
let api: ReturnType<typeof createApi>;
let profiles: InMemoryProfiles;
let storage: InMemoryStorage;
let users: InMemoryUsers;
let labels: FakeLabelReader;
let pantryRecipes: FakePantryRecipes;
let subscriptions: InMemorySubscriptions;
let ports: Ports;
let identity: FakeIdentity;
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
  users = new InMemoryUsers();
  users.rows.set("u1", { subject: "sub-1", email: "maya@example.com" });
  identity = new FakeIdentity();
  subscriptions = new InMemorySubscriptions();
  ports = {
    users,
    identity,
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
    foods: FOODS,
    weights: new InMemoryWeights(),
    foodLabels: new FakeFoodLabelReader({
      brand: "Crunchy Co",
      productName: "Granola",
      servingSize: "55 g",
      nutrition: { calories: 260, proteinG: 5, carbsG: 38, fatG: 10, addedSugarsG: 12 },
      ingredients: ["Oats", "sugar", "soy lecithin"],
      source: "label",
    }),
    products: new FakeProductDatabase({
      "0123456789012": {
        productName: "Peanuts",
        servingSize: "28 g",
        nutrition: { calories: 166, proteinG: 7, carbsG: 6, fatG: 14 },
        ingredients: ["Peanuts", "salt"],
        source: "open_food_facts",
        sourceNovaGroup: 3,
      },
    }),
    labels: (labels = new FakeLabelReader({
      brand: "Calm Labs",
      productName: "Zinc",
      ingredients: [{ name: "Zinc", amount: 50, unit: "mg", inBlend: false }],
      proprietaryBlend: false,
      testing: ["usp_verified"],
    })),
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
    subscriptions,
    stack: new InMemoryStack(),
    brainChecks: new InMemoryBrainChecks(),
    exercises: new InMemoryExercises(),
    pantry: new InMemoryPantry(),
    pantryRecipes: (pantryRecipes = new FakePantryRecipes()),
    shoppingReviewer: new FakeShoppingReviewer(),
    recipeParser: new FakeRecipeParser(),
    mealPlanner: new FakeMealPlanner(),
    mealPlans: new InMemoryMealPlans(),
    environment: new InMemoryEnvironment(),
    airQuality: new FakeAirQuality(),
    geocoder: new FakeGeocoder(),
    knowledge: new InMemoryKnowledge(),
    techniqueExtractor: new FakeTechniqueExtractor(),
    videoFeed: null,
    knowledgeChannels: [],
    markers: new InMemoryMarkers(),
    aiUsage: new InMemoryAiUsage(),
    deviceCandidates: new InMemoryDeviceCandidates(),
    deviceExtractor: new FakeDeviceExtractor(),
    webSearch: new FakeWebSearch(),
    subscriptionLookup: null,
    storeWebhookAuth: "Bearer rc-secret",
    paywall: false,
  };
  api = createApi(buildUseCases(ports));
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
  it("DELETE /me deletes the account, its photos and its sign-in", async () => {
    storage.objects.set("uploads/u1/a", { bytes: new Uint8Array(1), mediaType: "image/jpeg" });
    storage.objects.set("uploads/u2/b", { bytes: new Uint8Array(1), mediaType: "image/jpeg" });
    const res = await call("DELETE", "/me");
    expect(res.status).toBe(204);
    expect(users.rows.has("u1")).toBe(false);
    expect(identity.deleted).toEqual(["sub-1"]);
    expect([...storage.objects.keys()]).toEqual(["uploads/u2/b"]);
  });

  it("POST /supplements/analyze takes a multipart photo labelled as a generic file, as the app sends it", async () => {
    const form = new FormData();
    // Two sides of the bottle, as live scan sends them.
    form.append("photo", new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2])], { type: "application/octet-stream" }), "side-1.jpg");
    form.append("photo", new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 3, 4])], { type: "application/octet-stream" }), "side-2.jpg");
    const request = new Request("http://local/", { method: "POST", body: form });
    const body = new Uint8Array(await request.arrayBuffer());
    const res = await api({
      method: "POST",
      path: "/supplements/analyze",
      query: new URLSearchParams(),
      headers: { "content-type": request.headers.get("content-type")! },
      body,
      userId: "u1",
    });
    expect(res.status).toBe(200);
    expect(labels.calls.at(-1)).toHaveLength(2);
    // Bytes that aren't an image are still refused.
    const text = new FormData();
    text.append("photo", new Blob(["not a photo"], { type: "application/octet-stream" }), "notes.txt");
    const textRequest = new Request("http://local/", { method: "POST", body: text });
    const refused = await api({
      method: "POST",
      path: "/supplements/analyze",
      query: new URLSearchParams(),
      headers: { "content-type": textRequest.headers.get("content-type")! },
      body: new Uint8Array(await textRequest.arrayBuffer()),
      userId: "u1",
    });
    expect(refused.status).toBe(400);
  });

  it("POST /supplements/analyze reads an uploaded label photo and flags it", async () => {
    storage.objects.set("uploads/u1/label", { bytes: new Uint8Array([0xff, 0xd8]), mediaType: "image/jpeg" });
    const res = await call("POST", "/supplements/analyze", { photoKeys: ["uploads/u1/label"] });
    expect(res.status).toBe(200);
    expect(SupplementLabelResponse.parse(res.body)).toMatchObject({
      productName: "Zinc",
      testing: ["usp_verified"],
      summary: "Calm Labs Zinc: 1 ingredient, tested by USP.",
      flags: [{ kind: "above_upper_limit" }],
    });
    expect((await call("POST", "/supplements/analyze", { photoKeys: ["uploads/u1/label", "uploads/u2/label"] })).status).toBe(404);
  });

  it("GET /foods returns the catalog with the diets each food fits", async () => {
    const res = await call("GET", "/foods");
    expect(res.status).toBe(200);
    const { foods } = FoodCatalog.parse(res.body);
    expect(foods.length).toBe(FOODS.length);
    const salmon = foods.find((f) => f.id === "salmon")!;
    expect(salmon).toMatchObject({ category: "fish", goals: expect.arrayContaining(["focus"]), fdcId: 175168 });
    expect(salmon.diets).toEqual(expect.arrayContaining(["pescatarian", "keto", "paleo"]));
    expect(salmon.diets).not.toContain("vegan");
  });

  it("logs weigh-ins, sets a weight goal and reports the trend and progress", async () => {
    expect(await call("POST", "/weights", { kg: 92.4 })).toMatchObject({ status: 201, body: { date: "2026-09-29", kg: 92.4 } });
    expect((await call("POST", "/weights", { kg: 92.4, date: "2026-09-30" })).status).toBe(400); // tomorrow in Chicago
    expect((await call("POST", "/weights", { kg: 10 })).status).toBe(400);

    const goal = { startKg: 95, targetKg: 85, startedOn: "2026-09-01", pacePctPerWeek: 0.75, fastingCaution: false };
    expect((await call("PUT", "/me/profile", { weightGoal: { ...goal, targetKg: 96 } })).status).toBe(400);
    expect((await call("PUT", "/me/profile", { weightGoal: goal })).body).toMatchObject({ weightGoal: goal });

    const history = await call("GET", "/weights?days=30");
    expect(history.status).toBe(200);
    expect(history.body).toEqual({
      entries: [{ date: "2026-09-29", kg: 92.4 }],
      trendKg: 92.4,
      goal: { targetKg: 85, toGoKg: 7.4, plannedWeeklyLossKg: 0.71 },
    });
    expect((await call("GET", "/weights?days=0")).status).toBe(400);

    expect((await call("DELETE", "/weights/2026-09-29")).status).toBe(204);
    expect((await call("DELETE", "/weights/2026-09-29")).status).toBe(404);
    expect((await call("PUT", "/me/profile", { weightGoal: null })).body).not.toHaveProperty("weightGoal");
  });

  it("GET /fasting times the fast from logged meals, capped at 12 hours after the safety answer", async () => {
    expect((await call("GET", "/fasting")).body).toEqual({ protocol: "none", state: { kind: "off" }, streakDays: 0 });

    // The day's only meal was at 13:10Z; the 8-hour window closed at 21:10Z and it's 22:00Z now.
    await profiles.save(profile({ bioProfile: { fasting: "16_8" } }));
    expect((await call("GET", "/fasting")).body).toEqual({
      protocol: "16_8",
      fastHours: 16,
      state: { kind: "fasting", since: "2026-09-29T13:10:00.000Z", goalAt: "2026-09-30T05:10:00.000Z" },
      streakDays: 0,
    });

    await profiles.save(
      profile({
        bioProfile: { fasting: "omad" },
        weightGoal: { startKg: 95, targetKg: 85, startedOn: "2026-09-01", pacePctPerWeek: 0.5, fastingCaution: true },
      }),
    );
    expect((await call("GET", "/fasting")).body).toMatchObject({ protocol: "12_12", fastHours: 12 });
  });

  it("takes RevenueCat's webhook only with its secret, and reports the subscription", async () => {
    const trial = {
      event: { type: "INITIAL_PURCHASE", app_user_id: "u1", product_id: "neurocal_pro_yearly", period_type: "TRIAL", expiration_at_ms: Date.parse("2026-10-13T22:00:00Z"), event_timestamp_ms: Date.parse("2026-09-29T21:00:00Z") },
    };
    expect(api.isPublic("POST", "/webhooks/revenuecat")).toBe(true);
    expect((await call("POST", "/webhooks/revenuecat", trial)).status).toBe(403);
    expect((await call("POST", "/webhooks/revenuecat", trial, { authorization: "Bearer wrong" })).status).toBe(403);
    expect(await call("POST", "/webhooks/revenuecat", trial, { authorization: "Bearer rc-secret" })).toMatchObject({ status: 200, body: { result: "applied" } });
    // Events for ids we don't know, and ones we don't use, are acknowledged so RevenueCat stops retrying.
    expect((await call("POST", "/webhooks/revenuecat", { event: { ...trial.event, app_user_id: "someone-else" } }, { authorization: "Bearer rc-secret" })).body).toEqual({ result: "ignored" });
    expect((await call("POST", "/webhooks/revenuecat", { event: { ...trial.event, type: "TEST" } }, { authorization: "Bearer rc-secret" })).body).toEqual({ result: "ignored" });

    expect((await call("GET", "/me/subscription")).body).toEqual({
      active: true,
      status: "trial",
      productId: "neurocal_pro_yearly",
      expiresAt: "2026-10-13T22:00:00.000Z",
      willRenew: true,
    });
  });

  it("with the paywall on, the AI features need a subscription or trial; admins always pass", async () => {
    api = createApi(buildUseCases({ ...ports, paywall: true }));
    const refused = await call("GET", "/recommendations/next");
    expect(refused).toMatchObject({ status: 402, body: { code: "subscription_required" } });
    expect((await call("POST", "/supplements/analyze", { photoKeys: ["uploads/u1/x"] })).status).toBe(402);
    expect((await call("GET", "/recommendations/next", undefined, {}, true)).status).toBe(200);
    // A new account's first few meal photos are read anyway, for onboarding; then the paywall applies.
    storage.objects.set("uploads/u1/meal", { bytes: new Uint8Array([1, 2, 3]), mediaType: "image/jpeg" });
    for (let i = 0; i < 3; i++) expect((await call("POST", "/meals/analyze", { photoKey: "uploads/u1/meal" })).status).toBe(200);
    expect((await call("POST", "/meals/analyze", { photoKey: "uploads/u1/meal" })).status).toBe(402);
    // Everything else keeps working, so people can still see their data and subscribe.
    expect((await call("GET", "/me")).status).toBe(200);

    await subscriptions.save("u1", { status: "active", expiresAt: new Date("2027-01-01T00:00:00Z"), willRenew: true, eventAt: new Date("2026-09-01T00:00:00Z") });
    expect((await call("GET", "/recommendations/next")).status).toBe(200);
  });

  it("builds a supplement stack, ticks today's doses, and checks the stack as a whole", async () => {
    const zinc = (mg: number) => ({ name: "Zinc", amount: mg, unit: "mg", inBlend: false });
    const multi = await call("POST", "/stack", { name: "Daily Multi", ingredients: [zinc(15)], servingsPerDay: 1, timing: "with_food", servingsPerContainer: 30 });
    expect(multi).toMatchObject({ status: 201, body: { name: "Daily Multi", startedOn: "2026-09-29", daysLeft: 30, takenToday: false } });
    const id = (multi.body as { id: string }).id;
    await call("POST", "/stack", { name: "Zinc 25", ingredients: [zinc(25)], servingsPerDay: 2, timing: "evening" });

    expect((await call("PUT", `/stack/${id}/taken`, { taken: true })).body).toEqual({ taken: true });
    const stack = await call("GET", "/stack");
    expect(StackResponse.parse(stack.body)).toMatchObject({
      date: "2026-09-29",
      items: [{ name: "Daily Multi", takenToday: true }, { name: "Zinc 25", takenToday: false }],
      flags: [{ kind: "above_upper_limit", message: expect.stringContaining("65 mg of zinc a day") }],
    });

    expect((await call("PUT", `/stack/${id}`, { servingsPerDay: 2, newBottle: true })).body).toMatchObject({ servingsPerDay: 2, daysLeft: 15 });
    expect((await call("PUT", "/stack/nope/taken", { taken: true })).status).toBe(404);
    expect((await call("POST", "/stack", { name: "", ingredients: [], servingsPerDay: 1, timing: "any" })).status).toBe(400);
    expect((await call("DELETE", `/stack/${id}`)).status).toBe(204);
    // Two 25 mg servings a day is still over the limit on its own.
    expect((await call("GET", "/stack")).body).toMatchObject({
      items: [{ name: "Zinc 25" }],
      flags: [{ message: "You take 50 mg of zinc a day, above the 40 mg upper limit for adults. Check with your doctor." }],
    });
  });

  it("grades a barcode from the product database, and a food label from photos", async () => {
    const peanuts = await call("GET", "/foods/barcode/0123456789012");
    expect(FoodScanResponse.parse(peanuts.body)).toMatchObject({
      productName: "Peanuts",
      source: "open_food_facts",
      processing: { level: "processed", markers: [] },
      flags: [],
      item: { name: "Peanuts", portion: "28 g", calories: 166, processing: "processed", glycemicLoad: "low" },
    });
    expect((await call("GET", "/foods/barcode/99999999")).status).toBe(404);
    expect((await call("GET", "/foods/barcode/12ab")).status).toBe(400);

    storage.objects.set("uploads/u1/pack", { bytes: new Uint8Array([0xff, 0xd8]), mediaType: "image/jpeg" });
    const granola = await call("POST", "/foods/scan", { photoKeys: ["uploads/u1/pack"] });
    expect(FoodScanResponse.parse(granola.body)).toMatchObject({
      source: "label",
      processing: { level: "ultra_processed", markers: ["emulsifier"] },
      flags: [{ kind: "ultra_processed" }, { kind: "high_added_sugar" }],
      item: { name: "Crunchy Co Granola", processing: "ultra_processed" },
    });

    // A paid feature, like photo reading.
    api = createApi(buildUseCases({ ...ports, paywall: true }));
    expect((await call("GET", "/foods/barcode/0123456789012")).status).toBe(402);
  });

  it("scores Brain speed checks from raw reaction times and keeps a usual score", async () => {
    const rested = Array.from({ length: 20 }, () => 240);
    expect(await call("POST", "/brain-checks", { reactionTimesMs: rested, falseStarts: 0 })).toMatchObject({
      status: 201,
      body: { score: 100, medianMs: 240, lapses: 0, takenAt: "2026-09-29T22:00:00.000Z" },
    });
    expect((await call("POST", "/brain-checks", { reactionTimesMs: [240, 250], falseStarts: 0 })).status).toBe(400);
    expect((await call("POST", "/brain-checks", { reactionTimesMs: [...rested.slice(1), 50], falseStarts: 0 })).status).toBe(400);
    for (let i = 0; i < 3; i++) await call("POST", "/brain-checks", { reactionTimesMs: rested, falseStarts: 0 });

    const history = await call("GET", "/brain-checks");
    expect(BrainCheckHistory.parse(history.body)).toMatchObject({ baselineScore: 100 });
    expect((history.body as { checks: unknown[] }).checks).toHaveLength(4);
  });

  it("GET /me returns the contract profile", async () => {
    const res = await call("GET", "/me");
    expect(res).toEqual({ status: 200, body: expect.objectContaining({ id: "u1", timeZone: "America/Chicago" }) });
  });

  it("GET /bio-state splits the day's calories by how processed the food was", async () => {
    await call("POST", "/meals", {
      kind: "snack",
      eatenAt: "2026-09-29T16:30:00-05:00",
      items: [
        { name: "Cola", portion: "1 can", calories: 140, macros: { proteinG: 0, carbsG: 39, fatG: 0 }, processing: "ultra_processed" },
        { name: "Apple", portion: "1", calories: 95, macros: { proteinG: 0.5, carbsG: 25, fatG: 0.3 }, processing: "whole" },
      ],
    });
    // The breakfast logged in setup has no level and isn't counted.
    expect((await call("GET", "/bio-state")).body).toMatchObject({ processing: { wholeKcal: 95, processedKcal: 0, ultraProcessedKcal: 140 } });
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
      components: { sleep: null, timing: null, glycemic: null, stress: null, movement: null, environment: null },
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

  it("POST /shopping/review grades each item and suggests a device only when the list calls for it", async () => {
    const res = await call("POST", "/shopping/review", { text: "- Spinach\n- Chicken nuggets\n- Eggs" });
    expect(res.status).toBe(200);
    const body = ShoppingReviewResponse.parse(res.body);
    expect(body.items.map((i) => [i.name, i.verdict])).toEqual([
      ["Spinach", "keep"],
      ["Chicken nuggets", "swap"],
      ["Eggs", "keep"],
    ]);
    // The catalog fixtures have no air fryer enabled, so no device; the rule still found the reason.
    expect(body.devices.every((d) => d.because.includes("Chicken nuggets"))).toBe(true);
    expect((await call("POST", "/shopping/review", { text: "   " })).status).toBe(400);
  });

  it("admin knowledge: add a video with its transcript, then approve a technique into the catalog", async () => {
    const asAdmin = (method: string, path: string, body?: unknown) => call(method, path, body, {}, true);
    expect((await call("GET", "/admin/knowledge")).status).toBe(403);

    const transcript = "0:00 Welcome.\n1:30 Your calf is your second heart. " + "More talk. ".repeat(60);
    const added = await asAdmin("POST", "/admin/knowledge/sources", { url: "https://youtu.be/dQw4w9WgXcQ", title: "Your second heart", transcript });
    expect(added.status).toBe(201);
    const source = KnowledgeSource.parse(added.body);
    expect(source.status).toBe("extracted");
    const [technique] = source.techniques;
    expect(technique).toMatchObject({ status: "pending", link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s" });

    const approved = await asAdmin("PUT", `/admin/knowledge/techniques/${technique!.id}`, { decision: "approve" });
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ status: "approved", protocolId: `knowledge-${technique!.id}` });
    expect(AdminKnowledge.parse((await asAdmin("GET", "/admin/knowledge")).body)).toMatchObject({ watching: [] });
    // Without a YouTube key, checking channels says what's missing.
    expect((await asAdmin("POST", "/admin/knowledge/sync")).status).toBe(400);
  });

  it("admin devices: look for new ones, then approve one into the products", async () => {
    const asAdmin = (method: string, path: string, body?: unknown) => call(method, path, body, {}, true);
    expect((await call("GET", "/admin/devices")).status).toBe(403);
    expect((await asAdmin("POST", "/admin/devices/scan")).body).toEqual({ added: 4 });
    const { devices, canScan } = AdminDevices.parse((await asAdmin("GET", "/admin/devices")).body);
    expect(canScan).toBe(true);
    const fryer = devices.find((d) => d.tag === "kitchen:air-fryer")!;
    expect(fryer).toMatchObject({ category: "Air fryer", status: "pending" });

    const approved = DeviceCandidate.parse((await asAdmin("PUT", `/admin/devices/${fryer.id}`, { decision: "approve", name: "Ceramic air fryer" })).body);
    expect(approved).toMatchObject({ status: "approved", name: "Ceramic air fryer" });
    const products = (await asAdmin("GET", "/admin/products")).body as { products: { id: string; tags: string[] }[] };
    expect(products.products.find((p) => p.id === approved.productId)!.tags).toContain("kitchen:air-fryer");
    expect((await asAdmin("PUT", `/admin/devices/${fryer.id}`, { decision: "maybe" })).status).toBe(400);
  });

  it("AI features have a daily allowance: the call after it gets a 429 that says when it resets", async () => {
    for (let i = 0; i < 30; i++) expect((await call("POST", "/recipes/analyze", { text: "80 g rolled oats" })).status).toBe(200);
    const over = await call("POST", "/recipes/analyze", { text: "80 g rolled oats" });
    expect(over.status).toBe(429);
    expect(over.body).toMatchObject({ code: "daily_limit", message: expect.stringContaining("resets tomorrow") });
  });

  it("POST /recipes/analyze gives calories per serving, from the catalog where it can", async () => {
    const res = await call("POST", "/recipes/analyze", { text: "80 g rolled oats\n30 g honey drizzle" });
    expect(res.status).toBe(200);
    const body = RecipeAnalysis.parse(res.body);
    expect(body.servings).toBe(2);
    expect(body.ingredients.map((i) => i.source)).toEqual(["catalog", "estimate"]);
    expect(body.calories).toBeGreaterThan(0);
    expect(RecipeAnalysis.parse((await call("POST", "/recipes/analyze", { text: "just some words here" })).body)).toEqual({ problem: "not_a_recipe", ingredients: [] });
    expect((await call("POST", "/recipes/analyze", { text: "80 g rolled oats", servings: 0 })).status).toBe(400);
  });

  it("environment: set the town, answer the check, and Today and the score read it", async () => {
    const located = EnvironmentDay.parse((await call("PUT", "/environment/location", { place: "Austin" })).body);
    expect(located.location).toMatchObject({ place: "Austin, Texas, United States", latitude: 30.3 });
    expect(located.air).toEqual({ aqi: 42, category: "good" });
    const checked = EnvironmentDay.parse((await call("PUT", "/environment/check", { date: "2026-09-28", items: { daylight: true, filteredWater: true } })).body);
    expect(checked.signal).toBe(1);
    expect(TodayResponse.parse((await call("GET", "/today")).body).environment?.location?.place).toBe("Austin, Texas, United States");
    // Yesterday's air and check feed this morning's score.
    expect((await call("GET", "/focus-score")).body).toMatchObject({ components: { environment: 1 } });
  });

  it("meal plans: none at first, then a plan that fits the targets and pantry, kept for later", async () => {
    expect((await call("GET", "/meal-plan")).status).toBe(404);
    await call("POST", "/pantry", { names: ["oats"] });
    const made = await call("POST", "/meal-plan", { days: 2 });
    expect(made.status).toBe(201);
    const plan = MealPlanResponse.parse(made.body);
    expect(plan.days).toHaveLength(2);
    expect(plan.days[0]!.meals.map((m) => m.kind)).toEqual(["breakfast", "lunch", "dinner"]);
    expect(plan.days[0]!.meals[0]!.ingredients[0]).toMatchObject({ name: "Oats", inPantry: true, source: "catalog" });
    // Berries are in six meals over two days, and not in the pantry.
    expect(plan.shoppingList).toEqual([{ name: "Berries", grams: 900, meals: 6 }]);
    expect(MealPlanResponse.parse((await call("GET", "/meal-plan")).body).days).toHaveLength(2);
    expect((await call("POST", "/meal-plan", { days: 7 })).status).toBe(400);
  });

  it("GET /level returns the level from the last 28 days with every habit and how close it is", async () => {
    const res = await call("GET", "/level");
    expect(res.status).toBe(200);
    const body = LevelResponse.parse(res.body);
    // The fixtures have one day of food: still getting started.
    expect(body).toMatchObject({ level: 0, name: "Getting started" });
    expect(body.requirements[0]).toMatchObject({ level: 1, title: "Log food on most days", met: false });
    expect(body.requirements.map((r) => r.level)).toEqual([...body.requirements.map((r) => r.level)].sort());
  });

  it("the pantry: add (skipping repeats), suggest recipes marked by what's in it, and remove", async () => {
    expect((await call("POST", "/pantry/recipes")).status).toBe(400);
    const added = PantryResponse.parse((await call("POST", "/pantry", { names: ["Spinach", " eggs ", "oats", "Egg"] })).body);
    expect(added.items.map((i) => i.name)).toEqual(["eggs", "oats", "Spinach"]);
    expect((await call("POST", "/pantry", { names: [""] })).status).toBe(400);

    const res = await call("POST", "/pantry/recipes");
    expect(res.status).toBe(200);
    const [recipe] = PantryRecipesResponse.parse(res.body).recipes;
    expect(recipe!.ingredients.map((i) => [i.name, i.inPantry])).toEqual([
      ["eggs", true],
      ["feta", false],
    ]);
    // Sized to what's left of the day: 2,000 − 440 eaten in the fixtures.
    expect(pantryRecipes.calls.at(-1)).toMatchObject({ pantry: ["eggs", "oats", "Spinach"], caloriesLeft: expect.any(Number) });

    expect((await call("DELETE", `/pantry/${added.items[0]!.id}`)).status).toBe(204);
    expect(PantryResponse.parse((await call("GET", "/pantry")).body).items).toHaveLength(2);
  });

  it("markers: record readings (imports repeat safely), see the latest with its three-month change, delete one", async () => {
    const post = (readings: unknown[]) => call("POST", "/markers", { readings });
    expect(
      (await post([
        { marker: "resting_hr", value: 68, measuredAt: "2026-06-30T07:00:00Z", source: "health_connect" },
        { marker: "resting_hr", value: 61, measuredAt: "2026-09-28T07:00:00Z", source: "health_connect" },
        { marker: "hba1c", value: 5.4 },
      ])).body,
    ).toEqual({ accepted: 3 });
    // The same import again adds nothing.
    expect((await post([{ marker: "resting_hr", value: 61, measuredAt: "2026-09-28T07:00:00Z", source: "health_connect" }])).body).toEqual({ accepted: 0 });
    expect((await post([{ marker: "resting_hr", value: 400 }])).status).toBe(400);

    const { markers } = HealthMarkersResponse.parse((await call("GET", "/markers")).body);
    const hr = markers.find((m) => m.marker === "resting_hr")!;
    expect(hr).toMatchObject({ label: "Resting heart rate", unit: "bpm", latest: { value: 61 }, change: -7, improving: true });
    const a1c = markers.find((m) => m.marker === "hba1c")!;
    expect(a1c.reference).toMatch(/clinician/);
    expect((await call("DELETE", `/markers/${a1c.latest.id}`)).status).toBe(204);
    expect(HealthMarkersResponse.parse((await call("GET", "/markers")).body).markers.map((m) => m.marker)).toEqual(["resting_hr"]);
  });

  it("GET /healthspan counts this week's habits from what's logged", async () => {
    await call("POST", "/exercises", { kind: "strength", intensity: "moderate", minutes: 40 });
    await call("POST", "/exercises", { kind: "walk", intensity: "moderate", minutes: 50 });
    await call("POST", "/meals", {
      kind: "lunch",
      eatenAt: "2026-09-29T12:30:00-05:00",
      items: [{ name: "Cola", portion: "1 can", calories: 140, macros: { proteinG: 0, carbsG: 39, fatG: 0 }, processing: "ultra_processed" }],
    });
    const week = HealthspanResponse.parse((await call("GET", "/healthspan")).body);
    // 29 Sep 2026 is a Tuesday in Chicago.
    expect(week).toMatchObject({ weekStart: "2026-09-28", days: 2 });
    const byId = Object.fromEntries(week.habits.map((h) => [h.id, h]));
    expect(byId.strength).toMatchObject({ progress: 1, target: 2, done: false });
    expect(byId.zone2).toMatchObject({ progress: 50, target: 150 });
    expect(byId.whole_food!.progress).toBe(100);
  });

  it("POST /exercises logs exercise with calories from the latest weigh-in, and GET /exercises totals the day", async () => {
    const logged = await call("POST", "/exercises", { kind: "walk", intensity: "moderate", minutes: 30 });
    expect(logged.status).toBe(201);
    const exercise = logged.body as { id: string; kcal: number };
    expect(exercise.kcal).toBeGreaterThan(0);
    const day = ExerciseDay.parse((await call("GET", "/exercises")).body);
    expect(day).toMatchObject({ date: "2026-09-29", totalMinutes: 30, totalKcal: exercise.kcal });
    expect(TodayResponse.parse((await call("GET", "/today")).body).exercise?.totalMinutes).toBe(30);

    expect((await call("POST", "/exercises", { kind: "walk", intensity: "moderate", minutes: 0 })).status).toBe(400);
    expect((await call("DELETE", `/exercises/${exercise.id}`)).status).toBe(204);
    expect((await call("DELETE", `/exercises/${exercise.id}`)).status).toBe(404);
    expect(ExerciseDay.parse((await call("GET", "/exercises")).body).totalMinutes).toBe(0);
  });

  it("GET /today returns the whole screen in one call, and only the day itself for a past date", async () => {
    const today = await call("GET", "/today");
    expect(today.status).toBe(200);
    const body = TodayResponse.parse(today.body);
    expect(body.focus.date).toBe("2026-09-29");
    expect(body.bio.date).toBe("2026-09-29");
    expect(body.meals.length).toBeGreaterThan(0);
    expect(body.fasting).toBeDefined();
    expect(body.stack).toBeDefined();
    expect(body.brain).toBeDefined();

    const past = TodayResponse.parse((await call("GET", "/today?date=2026-09-28")).body);
    expect(past.focus.date).toBe("2026-09-28");
    expect(past).not.toHaveProperty("recipes");
    expect(past).not.toHaveProperty("stack");
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

    // Only admins see the list.
    expect((await call("GET", "/admin/waitlist")).status).toBe(403);
    const overview = await call("GET", "/admin/waitlist", undefined, {}, true);
    expect(overview.status).toBe(200);
    expect(overview.body).toMatchObject({ total: 1, android: 1, iphone: 0, unsubscribed: 0, entries: [{ email: "sam@example.com", platform: "android", confirmed: true }] });

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
