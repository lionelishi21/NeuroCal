import { describe, expect, it } from "vitest";
import { BioState, CreateMealRequest, caloriesRemaining, mealCalories } from "./index";

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
