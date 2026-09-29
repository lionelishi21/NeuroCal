import { describe, expect, it } from "@jest/globals";
import { InvalidError } from "../../domain/errors";
import { FixedClock, InMemoryCheckIns, InMemoryMeals, InMemoryProfiles, InMemoryTelemetry, item, profile } from "../testing/fakes";
import { GetHistoryUseCase } from "./GetHistoryUseCase";

describe("GetHistoryUseCase", () => {
  async function setup() {
    const profiles = new InMemoryProfiles();
    const meals = new InMemoryMeals();
    const checkIns = new InMemoryCheckIns();
    const telemetry = new InMemoryTelemetry();
    await profiles.save(profile());
    // 28 Sep (Chicago): breakfast and a late dinner, a stressed check-in.
    await meals.create("u1", { kind: "breakfast", eatenAt: new Date("2026-09-28T13:00:00Z"), items: [item("Oats", 400, 12, 60, 10)] });
    await meals.create("u1", { kind: "dinner", eatenAt: new Date("2026-09-29T02:40:00Z"), items: [item("Curry", 900, 35, 90, 40)] }); // 21:40
    await checkIns.create("u1", { at: new Date("2026-09-28T20:00:00Z"), flags: ["stressed", "wired"] });
    await checkIns.create("u1", { at: new Date("2026-09-28T22:00:00Z"), flags: ["stressed"] });
    // Night of 28→29 Sep: 6 hours.
    await telemetry.upsertSleep("u1", [{ start: new Date("2026-09-29T05:00:00Z"), end: new Date("2026-09-29T11:00:00Z"), source: "manual" }]);
    const clock = new FixedClock(new Date("2026-09-29T17:00:00Z"));
    return new GetHistoryUseCase(profiles, meals, checkIns, telemetry, clock);
  }

  it("returns the last N days oldest first, ending today in the user's time zone", async () => {
    const days = await (await setup()).execute({ userId: "u1", days: 3 });
    expect(days.map((d) => d.date)).toEqual(["2026-09-27", "2026-09-28", "2026-09-29"]);

    expect(days[1]).toEqual({
      date: "2026-09-28",
      calorieTarget: 2200,
      caloriesEaten: 1300,
      proteinG: 47,
      focusScore: 50, // only stress has data: two distinct negative flags → 0.5
      sleepMinutes: null,
      lastMealAt: "21:40",
      flags: ["stressed", "wired"],
    });
    // sleep 0.75, timing 1 − 40/120, glycemic 1, stress 0.5 → 100 × (0.3 + 0.133 + 0.2 + 0.1)
    expect(days[2]).toMatchObject({ focusScore: 73, sleepMinutes: 360, caloriesEaten: 0, lastMealAt: null, flags: [] });
  });

  it("rejects out-of-range day counts", async () => {
    await expect((await setup()).execute({ userId: "u1", days: 0 })).rejects.toBeInstanceOf(InvalidError);
    await expect((await setup()).execute({ userId: "u1", days: 32 })).rejects.toBeInstanceOf(InvalidError);
  });
});
