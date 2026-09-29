import { describe, expect, it } from "@jest/globals";
import { BioState, CreateMealRequest, FocusScore, ScreenTimeSample, SleepSession, caloriesRemaining, mealCalories } from "./index";

const item = { name: "Greek yogurt", portion: "200 g", calories: 190, macros: { proteinG: 20, carbsG: 8, fatG: 9 } };

describe("contracts", () => {
  it("accepts a valid meal request", () => {
    const meal = CreateMealRequest.parse({ kind: "breakfast", eatenAt: "2026-09-29T08:10:00-05:00", items: [item] });
    expect(mealCalories(meal)).toBe(190);
  });

  it("rejects a meal with no items", () => {
    expect(CreateMealRequest.safeParse({ kind: "lunch", eatenAt: "2026-09-29T12:00:00Z", items: [] }).success).toBe(false);
  });

  it("computes calories remaining, allowing negatives when over target", () => {
    const state = BioState.parse({
      date: "2026-09-29",
      calorieTarget: 2000,
      caloriesEaten: 2150,
      macrosEaten: { proteinG: 90, carbsG: 200, fatG: 70 },
      macroTargets: { proteinG: 120, carbsG: 220, fatG: 70 },
      macroFocus: "protein",
      cognitiveFlags: ["low_focus"],
      dietaryPreference: "omnivore",
    });
    expect(caloriesRemaining(state)).toBe(-150);
  });
});

describe("telemetry and focus score contracts", () => {
  it("rejects sleep that ends before it starts or runs past 24 hours", () => {
    const ok = { start: "2026-09-28T23:00:00-05:00", end: "2026-09-29T07:00:00-05:00", source: "manual" };
    expect(SleepSession.safeParse(ok).success).toBe(true);
    expect(SleepSession.safeParse({ ...ok, end: "2026-09-28T22:00:00-05:00" }).success).toBe(false);
    expect(SleepSession.safeParse({ ...ok, end: "2026-09-30T07:00:00-05:00" }).success).toBe(false);
  });

  it("rejects screen time longer than its window", () => {
    const sample = { windowStart: "2026-09-28T22:00:00Z", windowEnd: "2026-09-28T23:00:00Z", source: "wearable" };
    expect(ScreenTimeSample.safeParse({ ...sample, minutes: 45 }).success).toBe(true);
    expect(ScreenTimeSample.safeParse({ ...sample, minutes: 61 }).success).toBe(false);
  });

  it("allows a focus score with no data yet", () => {
    const empty = { date: "2026-09-29", score: null, components: { sleep: null, timing: null, glycemic: null, stress: null }, explanation: "" };
    expect(FocusScore.safeParse(empty).success).toBe(true);
  });
});
