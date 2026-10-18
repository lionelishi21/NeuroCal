import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { Database } from "./client";
import {
  DrizzleCheckInRepository,
  DrizzleFocusScoreRepository,
  DrizzleMealRepository,
  DrizzleProfileRepository,
  DrizzleRecommendationRepository,
  DrizzleTelemetryRepository,
  DrizzleUserRepository,
  DrizzleBrainCheckRepository,
  DrizzleExerciseRepository,
  DrizzlePantryRepository,
  DrizzleKnowledgeRepository,
  DrizzleDeviceCandidateRepository,
  DrizzleAiUsageRepository,
  DrizzleEnvironmentRepository,
  DrizzleStackRepository,
  DrizzleSubscriptionRepository,
  DrizzleWaitlistRepository,
  DrizzleWeightRepository,
} from "./DrizzleRepositories";
import { eq } from "drizzle-orm";
import { createPgliteDatabase } from "./pglite";
import * as schema from "./schema";
import { item, profile } from "../../application/testing/fakes";

let db: Database;
let close: () => Promise<void>;
let alice: string;
let bob: string;

beforeAll(async () => {
  ({ db, close } = await createPgliteDatabase());
  const users = new DrizzleUserRepository(db);
  alice = await users.findOrCreateByAuthSubject("sub-alice", "alice@example.com");
  bob = await users.findOrCreateByAuthSubject("sub-bob", "bob@example.com");
}, 60_000);
afterAll(() => close());

describe("DrizzleUserRepository", () => {
  it("returns the same id for the same subject", async () => {
    expect(await new DrizzleUserRepository(db).findOrCreateByAuthSubject("sub-alice", "new@example.com")).toBe(alice);
  });
});

describe("DrizzleProfileRepository", () => {
  it("saves, reads back and updates a profile", async () => {
    const repo = new DrizzleProfileRepository(db);
    await repo.save(profile({ userId: alice }));
    expect(await repo.get(alice)).toEqual(profile({ userId: alice }));
    await repo.save(profile({ userId: alice, dailyCalorieTarget: 2000 }));
    expect((await repo.get(alice))?.dailyCalorieTarget).toBe(2000);
    expect(await repo.get(bob)).toBeNull();
  });
});

describe("DrizzleMealRepository", () => {
  const repo = () => new DrizzleMealRepository(db);
  const chicagoDay = { date: "2026-09-29", timeZone: "America/Chicago" };

  it("keeps the first meal when the same client key is saved again, even at the same moment or after a delete", async () => {
    const meal = {
      kind: "snack" as const,
      eatenAt: new Date("2026-09-29T20:00:00Z"),
      items: [{ name: "Apple", portion: "1", calories: 95, macros: { proteinG: 0, carbsG: 25, fatG: 0 } }],
      clientKey: "0b8f4c1e-6f0a-4b7e-9a51-2f3d7c9e1a10",
    };
    const [first, twin] = await Promise.all([repo().create(alice, meal), repo().create(alice, meal)]);
    expect(twin.id).toBe(first.id);
    expect((await repo().create(alice, meal)).items).toEqual(meal.items);
    expect(await repo().listForDay(alice, { date: "2026-09-29", timeZone: "UTC" })).toHaveLength(1);

    // Another person's identical key is their own meal.
    expect((await repo().create(bob, meal)).id).not.toBe(first.id);

    // A late retry after the meal was removed must not bring it back.
    await repo().softDelete(alice, first.id);
    expect((await repo().create(alice, meal)).id).toBe(first.id);
    expect(await repo().listForDay(alice, { date: "2026-09-29", timeZone: "UTC" })).toHaveLength(0);
  });

  it("stores items in order and reads meals by the user's local day", async () => {
    const created = await repo().create(alice, {
      kind: "dinner",
      eatenAt: new Date("2026-09-30T01:00:00Z"), // 20:00 on the 29th in Chicago
      items: [{ ...item("Cod", 400, 40, 10, 12), confidence: 0.9, glycemicLoad: "low" }, item("Rice", 240, 5, 52, 1)],
    });
    await repo().create(alice, { kind: "lunch", eatenAt: new Date("2026-09-28T17:00:00Z"), items: [item("Old", 500, 20, 50, 20)] });
    await repo().create(bob, { kind: "lunch", eatenAt: new Date("2026-09-29T17:00:00Z"), items: [item("Bob's", 700, 30, 70, 30)] });

    const day = await repo().listForDay(alice, chicagoDay);
    expect(day.map((m) => m.id)).toEqual([created.id]);
    expect(day[0]!.items.map((i) => i.name)).toEqual(["Cod", "Rice"]);
    expect(day[0]!.items[0]).toMatchObject({ calories: 400, confidence: expect.closeTo(0.9, 5), glycemicLoad: "low" });
    expect(day[0]!.items[1]).not.toHaveProperty("confidence");
    expect(await repo().listForDay(alice, { ...chicagoDay, timeZone: "UTC" })).toHaveLength(0);
  });

  it("soft-deletes only the owner's meal", async () => {
    const meal = await repo().create(alice, { kind: "snack", eatenAt: new Date(), items: [item("Apple", 95, 0.5, 25, 0.3)] });
    expect(await repo().softDelete(bob, meal.id)).toBe(false);
    expect(await repo().softDelete(alice, meal.id)).toBe(true);
    expect(await repo().get(alice, meal.id)).toBeNull();
    expect(await repo().softDelete(alice, meal.id)).toBe(false);
  });
});

describe("DrizzleCheckInRepository", () => {
  it("returns the latest check-in of the local day", async () => {
    const repo = new DrizzleCheckInRepository(db);
    await repo.create(alice, { at: new Date("2026-09-29T15:00:00Z"), flags: ["brain_fog"] });
    await repo.create(alice, { at: new Date("2026-09-29T20:00:00Z"), flags: ["low_focus", "low_energy"], note: "long meeting" });
    await repo.create(bob, { at: new Date("2026-09-29T21:00:00Z"), flags: ["sharp"] });
    const latest = await repo.latestForDay(alice, { date: "2026-09-29", timeZone: "America/Chicago" });
    expect(latest).toMatchObject({ flags: ["low_focus", "low_energy"], note: "long meeting" });
    const all = await repo.listForDay(alice, { date: "2026-09-29", timeZone: "America/Chicago" });
    expect(all.map((c) => c.flags[0])).toEqual(["brain_fog", "low_focus"]);
  });
});

describe("DrizzleRecommendationRepository", () => {
  it("assigns ids in order", async () => {
    const base = {
      sourceName: "Serious Eats",
      sourceUrl: "https://www.seriouseats.com/x",
      minutes: 30,
      calories: 600,
      macros: { proteinG: 40, carbsG: 50, fatG: 20 },
      reasoning: "Fits.",
      searchQuery: "q",
    };
    const saved = await new DrizzleRecommendationRepository(db).saveRecipes(alice, [
      { ...base, title: "A" },
      { ...base, title: "B" },
    ]);
    expect(saved.map((r) => r.title)).toEqual(["A", "B"]);
    expect(new Set(saved.map((r) => r.id)).size).toBe(2);
  });

  it("finds the newest batch saved under a context key, per user", async () => {
    const base = {
      sourceName: "Serious Eats",
      sourceUrl: "https://www.seriouseats.com/a",
      minutes: 30,
      calories: 600,
      macros: { proteinG: 40, carbsG: 50, fatG: 20 },
      reasoning: "Fits.",
      searchQuery: "q",
    };
    const repo = new DrizzleRecommendationRepository(db);
    await repo.saveRecipes(alice, [{ ...base, title: "Old" }], "key-1");
    await new Promise((resolve) => setTimeout(resolve, 5));
    const newer = await repo.saveRecipes(alice, [{ ...base, title: "A" }, { ...base, title: "B", imageUrl: "https://img.example/b.jpg" }], "key-1");
    await repo.saveRecipes(alice, [{ ...base, title: "Unkeyed" }]);

    const found = await repo.latestRecipes(alice, "key-1");
    expect(found.map((r) => r.title).sort()).toEqual(["A", "B"]);
    expect(found.find((r) => r.title === "B")).toEqual({ ...base, title: "B", imageUrl: "https://img.example/b.jpg", id: newer[1]!.id });
    expect(await repo.latestRecipes(alice, "key-2")).toEqual([]);
    expect(await repo.latestRecipes(bob, "key-1")).toEqual([]);
  });
});

describe("DrizzleWaitlistRepository", () => {
  it("adds an address once, keeps a later platform, and starts over after an unsubscribe", async () => {
    const repo = new DrizzleWaitlistRepository(db);
    const first = await repo.join("sam@example.com", undefined, "token-aaaaaaaaaaaaaaaa");
    expect(first).toMatchObject({ fresh: true, entry: { email: "sam@example.com", unsubscribeToken: "token-aaaaaaaaaaaaaaaa" } });
    expect(first.entry.platform).toBeUndefined();

    await repo.markConfirmationSent(first.entry.id, new Date("2026-10-07T09:00:00Z"));
    const again = await repo.join("sam@example.com", "iphone", "token-bbbbbbbbbbbbbbbb");
    expect(again.fresh).toBe(false);
    // The first token stays: links already emailed keep working.
    expect(again.entry).toMatchObject({ id: first.entry.id, platform: "iphone", unsubscribeToken: "token-aaaaaaaaaaaaaaaa", confirmationSentAt: new Date("2026-10-07T09:00:00Z") });

    expect(await repo.leave("token-bbbbbbbbbbbbbbbb")).toBe(false);
    expect(await repo.leave("token-aaaaaaaaaaaaaaaa")).toBe(true);
    expect(await repo.leave("token-aaaaaaaaaaaaaaaa")).toBe(true);

    await repo.join("lee@example.com", "android", "token-dddddddddddddddd");
    const overview = await repo.overview(new Date(Date.now() - 60_000), 10);
    expect(overview).toMatchObject({ total: 1, iphone: 0, android: 1, thisWeek: 1, unsubscribed: 1 });
    expect(overview.entries.map((e) => [e.email, e.unsubscribed])).toEqual([
      ["lee@example.com", false],
      ["sam@example.com", true],
    ]);

    const back = await repo.join("sam@example.com", undefined, "token-cccccccccccccccc");
    expect(back.fresh).toBe(true);
    expect(back.entry.confirmationSentAt).toBeUndefined();
    expect(back.entry.platform).toBe("iphone");
  });
});

describe("DrizzleTelemetryRepository", () => {
  const day = { date: "2026-09-29", timeZone: "America/Chicago" };

  it("replaces overlapping sleep from the same source and reads sleep that ended on the local day", async () => {
    const repo = new DrizzleTelemetryRepository(db);
    const night = { start: new Date("2026-09-29T04:00:00Z"), end: new Date("2026-09-29T11:00:00Z"), source: "manual" as const };
    const corrected = { start: new Date("2026-09-29T05:00:00Z"), end: new Date("2026-09-29T12:00:00Z"), source: "manual" as const, deepMinutes: 70 };
    await repo.upsertSleep(alice, [night]);
    await repo.upsertSleep(alice, [corrected]);
    await repo.upsertSleep(bob, [night]);
    expect(await repo.sleepEndingOn(alice, day)).toEqual([corrected]);
  });

  it("reads screen time by local start date", async () => {
    const repo = new DrizzleTelemetryRepository(db);
    const sample = (iso: string) => ({
      windowStart: new Date(iso),
      windowEnd: new Date(new Date(iso).getTime() + 3_600_000),
      minutes: 30,
      source: "wearable" as const,
    });
    await repo.upsertScreenTime(alice, [sample("2026-09-29T04:00:00Z"), sample("2026-09-27T04:00:00Z")]); // 23:00 on the 28th; the 26th
    const rows = await repo.screenTimeStartingOn(alice, ["2026-09-28", "2026-09-29"], "America/Chicago");
    expect(rows.map((r) => r.windowStart.toISOString())).toEqual(["2026-09-29T04:00:00.000Z"]);
  });
});

describe("DrizzleFocusScoreRepository", () => {
  it("stores one score per user and day, including empty components", async () => {
    const repo = new DrizzleFocusScoreRepository(db);
    const score = {
      userId: alice,
      date: "2026-09-29",
      score: 65,
      components: { sleep: 0.75, timing: 1, glycemic: 0, stress: null, movement: null, environment: null },
      explanation: "Sleep matters most today.",
      modelVersion: "v0",
    };
    await repo.put(score);
    await repo.put({ ...score, score: 70 });
    expect(await repo.get(alice, "2026-09-29")).toEqual({ ...score, score: 70 });
    expect(await repo.get(bob, "2026-09-29")).toBeNull();
  });
});

describe("DrizzleWeightRepository", () => {
  it("keeps one weigh-in per day, lists from a date and deletes", async () => {
    const repo = new DrizzleWeightRepository(db);
    await repo.upsert(alice, { date: "2026-09-01", kg: 95.2 });
    await repo.upsert(alice, { date: "2026-09-02", kg: 94.9 });
    await repo.upsert(alice, { date: "2026-09-02", kg: 94.6 }); // replaces
    await repo.upsert(bob, { date: "2026-09-02", kg: 80 });
    expect(await repo.list(alice, "2026-09-02")).toEqual([{ date: "2026-09-02", kg: 94.6 }]);
    expect(await repo.list(alice, "2026-01-01")).toHaveLength(2);
    expect(await repo.delete(alice, "2026-09-01")).toBe(true);
    expect(await repo.delete(alice, "2026-09-01")).toBe(false);
  });

  it("stores the weight goal on the profile and lists meal times for the fasting timer", async () => {
    const profiles = new DrizzleProfileRepository(db);
    const weightGoal = { startKg: 95, targetKg: 85, startedOn: "2026-09-01", pacePctPerWeek: 0.75, fastingCaution: false };
    await profiles.save(profile({ userId: alice, weightGoal }));
    expect((await profiles.get(alice))?.weightGoal).toEqual(weightGoal);

    const times = await new DrizzleMealRepository(db).eatenSince(alice, new Date("2026-09-29T00:00:00Z"));
    expect(times.length).toBeGreaterThan(0);
    expect(times.every((t) => t >= new Date("2026-09-29T00:00:00Z"))).toBe(true);
    expect([...times].sort((a, b) => a.getTime() - b.getTime())).toEqual(times);
  });
});

describe("DrizzleSubscriptionRepository", () => {
  it("keeps one subscription per user and skips ids that aren't users", async () => {
    const repo = new DrizzleSubscriptionRepository(db);
    const trial = { status: "trial" as const, productId: "neurocal_pro_yearly", expiresAt: new Date("2026-10-15T12:00:00Z"), willRenew: true, eventAt: new Date("2026-10-01T12:00:00Z") };
    expect(await repo.save(alice, trial)).toBe(true);
    expect(await repo.save(alice, { ...trial, status: "active" })).toBe(true);
    expect(await repo.get(alice)).toEqual({ ...trial, status: "active" });
    expect(await repo.save("00000000-0000-0000-0000-000000000000", trial)).toBe(false);
    expect(await repo.get(bob)).toBeNull();
  });

  it("finds trials ending in a window until each is reminded", async () => {
    const repo = new DrizzleSubscriptionRepository(db);
    const endsAt = new Date("2026-10-27T05:00:00Z");
    await repo.save(bob, { status: "trial", expiresAt: endsAt, willRenew: true, eventAt: new Date("2026-10-13T00:00:00Z") });
    const window = [new Date("2026-10-26T15:00:00Z"), new Date("2026-10-27T15:00:00Z")] as const;
    expect(await repo.trialsEndingBetween(...window)).toEqual([{ userId: bob, email: "bob@example.com", endsAt, timeZone: "UTC" }]);
    await repo.markTrialReminded(bob, endsAt);
    expect(await repo.trialsEndingBetween(...window)).toEqual([]);
  });
});

describe("DrizzleStackRepository", () => {
  it("adds, updates, ticks and removes a user's own supplements only", async () => {
    const repo = new DrizzleStackRepository(db);
    const ingredients = [{ name: "Magnesium", amount: 200, unit: "mg", inBlend: false }];
    const item = await repo.add(alice, { name: "Magnesium", ingredients, servingsPerDay: 1, timing: "evening", servingsPerContainer: 60, startedOn: "2026-10-01" });
    expect(await repo.list(alice)).toEqual([item]);
    expect(await repo.list(bob)).toEqual([]);

    expect(await repo.update(alice, item.id, { servingsPerDay: 2, servingsPerContainer: null })).toEqual({ ...item, servingsPerDay: 2, servingsPerContainer: undefined });
    expect(await repo.update(bob, item.id, { servingsPerDay: 3 })).toBeNull();

    expect(await repo.setTaken(alice, item.id, "2026-10-02", true)).toBe(true);
    expect(await repo.setTaken(alice, item.id, "2026-10-02", true)).toBe(true); // twice is fine
    expect(await repo.setTaken(bob, item.id, "2026-10-02", true)).toBe(false);
    expect([...(await repo.takenOn(alice, "2026-10-02"))]).toEqual([item.id]);
    expect(await repo.setTaken(alice, item.id, "2026-10-02", false)).toBe(true);
    expect(await repo.takenOn(alice, "2026-10-02")).toEqual(new Set());

    // Kept for the account-deletion test below.
    await repo.setTaken(alice, item.id, "2026-10-03", true);
    expect(await repo.delete(bob, item.id)).toBe(false);
  });
});

describe("DrizzleEnvironmentRepository", () => {
  it("keeps a place per user, merges the day's check answers, and caches air per place and day", async () => {
    const repo = new DrizzleEnvironmentRepository(db);
    await repo.setLocation(alice, { place: "Austin", latitude: 30.3, longitude: -97.7 });
    expect(await repo.getLocation(alice)).toEqual({ place: "Austin", latitude: 30.3, longitude: -97.7 });
    expect(await repo.getLocation(bob)).toBeNull();

    await repo.saveCheck(alice, "2026-10-01", { daylight: true });
    expect(await repo.saveCheck(alice, "2026-10-01", { darkBedroom: false })).toEqual({ daylight: true, darkBedroom: false });
    expect(await repo.getCheck(bob, "2026-10-01")).toBeNull();

    expect(await repo.cachedAqi(30.3, -97.7, "2026-10-01")).toBeUndefined();
    await repo.cacheAqi(30.3, -97.7, "2026-10-01", null);
    expect(await repo.cachedAqi(30.3, -97.7, "2026-10-01")).toBeNull();
    await repo.cacheAqi(30.3, -97.7, "2026-10-01", 48);
    expect(await repo.cachedAqi(30.3, -97.7, "2026-10-01")).toBe(48);
  });
});

describe("DrizzleKnowledgeRepository", () => {
  it("keeps one source per link, its techniques, and their review", async () => {
    const repo = new DrizzleKnowledgeRepository(db);
    const source = await repo.addSource({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Your second heart", channel: "Dave Asprey" });
    expect(await repo.addSource({ url: source.url, title: "Again" })).toMatchObject({ id: source.id, title: "Your second heart", status: "queued" });
    const [t] = await repo.addTechniques(source.id, [
      { title: "Calf raises", pillar: "movement", summary: "s", steps: ["a"], evidence: "e", cautions: "", quote: "q", timestampSeconds: 90 },
    ]);
    await repo.setSourceStatus(source.id, "extracted");
    expect(await repo.updateTechnique(t!.id, { status: "approved", protocolId: "knowledge-x", title: "Ten calf raises" })).toMatchObject({
      status: "approved",
      title: "Ten calf raises",
      timestampSeconds: 90,
    });
    const [listed] = await repo.list();
    expect(listed!.source.status).toBe("extracted");
    expect(listed!.techniques).toHaveLength(1);
    expect(await repo.getTechnique("not-an-id")).toBeNull();
  });
});

describe("DrizzleDeviceCandidateRepository", () => {
  it("adds a device once, however its name is written, and records the review", async () => {
    const repo = new DrizzleDeviceCandidateRepository(db);
    const device = { tag: "kitchen:ice-cream-maker" as const, name: "Ninja CREAMi NC301", maker: "Ninja", url: "https://www.ninjakitchen.com/creami", description: "d" };
    const [added] = await repo.add([device]);
    expect(await repo.add([{ ...device, name: "ninja creami nc-301" }])).toEqual([]);
    expect(await repo.update(added!.id, { status: "approved", productId: "admin-1", name: "Ninja Creami" })).toMatchObject({ status: "approved", productId: "admin-1", name: "Ninja Creami" });
    expect((await repo.list()).map((d) => d.name)).toEqual(["Ninja Creami"]);
    expect(await repo.get("nope")).toBeNull();
  });
});

describe("DrizzleAiUsageRepository", () => {
  it("counts per person, day and feature", async () => {
    const repo = new DrizzleAiUsageRepository(db);
    expect(await repo.spend(alice, "2026-10-17", "read")).toBe(1);
    expect(await repo.spend(alice, "2026-10-17", "read")).toBe(2);
    expect(await repo.spend(alice, "2026-10-17", "generate")).toBe(1);
    expect(await repo.spend(bob, "2026-10-17", "read")).toBe(1);
    expect(await repo.spend(alice, "2026-10-18", "read")).toBe(1);
  });
});

describe("DrizzlePantryRepository", () => {
  it("keeps one of each item per user, alphabetically, and deletes only their own", async () => {
    const repo = new DrizzlePantryRepository(db);
    await repo.add(alice, ["Oats", "eggs"]);
    const items = await repo.add(alice, ["Egg", "spinach"]);
    expect(items.map((i) => i.name)).toEqual(["eggs", "Oats", "spinach"]);
    expect(await repo.list(bob)).toEqual([]);
    expect(await repo.delete(bob, items[0]!.id)).toBe(false);
    expect(await repo.delete(alice, items[0]!.id)).toBe(true);
    expect((await repo.list(alice)).map((i) => i.name)).toEqual(["Oats", "spinach"]);
  });
});

describe("DrizzleExerciseRepository", () => {
  it("lists a user's own exercise in a window, earliest first, and deletes only their own", async () => {
    const repo = new DrizzleExerciseRepository(db);
    const walk = await repo.add(alice, { kind: "walk", intensity: "moderate", minutes: 30, startedAt: new Date("2026-10-01T18:00:00Z"), kcal: 100 });
    const run = await repo.add(alice, { kind: "run", intensity: "hard", minutes: 20, startedAt: new Date("2026-10-01T07:00:00Z"), kcal: 240 });
    const from = new Date("2026-10-01T00:00:00Z");
    const to = new Date("2026-10-02T00:00:00Z");
    expect(await repo.listBetween(alice, from, to)).toEqual([run, walk]);
    expect(await repo.listBetween(bob, from, to)).toEqual([]);
    expect(await repo.delete(bob, walk.id)).toBe(false);
    expect(await repo.delete(alice, "not-a-uuid")).toBe(false);
    expect(await repo.delete(alice, walk.id)).toBe(true);
    expect(await repo.listBetween(alice, from, to)).toEqual([run]);
  });
});

describe("DrizzleBrainCheckRepository", () => {
  it("stores checks with their raw times and lists a user's own, newest first", async () => {
    const repo = new DrizzleBrainCheckRepository(db);
    const check = { trials: 12, medianMs: 260, fastestMs: 210, lapses: 1, falseStarts: 0, score: 90 };
    await repo.add(alice, { ...check, takenAt: new Date("2026-10-01T08:00:00Z"), reactionTimesMs: Array.from({ length: 12 }, () => 260) });
    const later = await repo.add(alice, { ...check, score: 80, takenAt: new Date("2026-10-02T08:00:00Z"), reactionTimesMs: Array.from({ length: 12 }, () => 280) });
    expect((await repo.listSince(alice, new Date("2026-09-01T00:00:00Z"))).map((c) => c.score)).toEqual([80, 90]);
    expect(await repo.listSince(alice, new Date("2026-10-02T00:00:00Z"))).toEqual([later]);
    expect(await repo.listSince(bob, new Date("2026-09-01T00:00:00Z"))).toEqual([]);
  });
});

// Last on purpose: by now the earlier tests have given alice rows in every user table.
describe("DrizzleUserRepository.delete", () => {
  it("removes the user, everything they own and their waitlist entry, and nobody else's", async () => {
    // Her sign-in email is new@example.com since the first test.
    await new DrizzleWaitlistRepository(db).join("new@example.com", "iphone", "token-alice-0000000000");
    const owned = [schema.profiles, schema.meals, schema.checkIns, schema.recipeRecommendations, schema.sleepSessions, schema.screenTimeSamples, schema.focusScores, schema.weightEntries, schema.subscriptions, schema.stackItems, schema.stackDoses, schema.brainChecks];
    const rowsOf = async (userId: string) => Promise.all(owned.map(async (t) => (await db.select().from(t).where(eq(t.userId, userId))).length));
    const before = await rowsOf(alice);
    const bobBefore = await rowsOf(bob);

    const users = new DrizzleUserRepository(db);
    expect(await users.delete(alice)).toEqual({ authSubject: "sub-alice" });

    expect(await rowsOf(alice)).toEqual(owned.map(() => 0));
    expect(await db.select().from(schema.waitlist).where(eq(schema.waitlist.email, "new@example.com"))).toEqual([]);
    expect(await db.select().from(schema.users).where(eq(schema.users.id, alice))).toEqual([]);
    expect(await rowsOf(bob)).toEqual(bobBefore);
    expect(before.every((n) => n > 0)).toBe(true);
    // Deleting twice finds nobody.
    expect(await users.delete(alice)).toBeNull();
  });
});
