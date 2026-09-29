import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { Database } from "./client";
import {
  DrizzleCheckInRepository,
  DrizzleMealRepository,
  DrizzleProfileRepository,
  DrizzleRecommendationRepository,
  DrizzleUserRepository,
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
});
