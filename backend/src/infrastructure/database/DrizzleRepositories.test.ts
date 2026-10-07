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
  DrizzleWaitlistRepository,
} from "./DrizzleRepositories";
import { createPgliteDatabase } from "./pglite";
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
      components: { sleep: 0.75, timing: 1, glycemic: 0, stress: null },
      explanation: "Sleep matters most today.",
      modelVersion: "v0",
    };
    await repo.put(score);
    await repo.put({ ...score, score: 70 });
    expect(await repo.get(alice, "2026-09-29")).toEqual({ ...score, score: 70 });
    expect(await repo.get(bob, "2026-09-29")).toBeNull();
  });
});
