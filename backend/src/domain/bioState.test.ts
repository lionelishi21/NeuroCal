import { describe, expect, it } from "@jest/globals";
import { computeBioState, macroFocus, processingOf } from "./bioState";
import type { Meal } from "./types";
import { item, profile } from "../application/testing/fakes";

const targets = { proteinG: 130, carbsG: 240, fatG: 75 };

describe("macroFocus", () => {
  it("picks the macro with the clearly largest gap", () => {
    // Same numbers as the web mock's seeded day: gaps 0.64 / 0.44 / 0.52.
    expect(macroFocus({ proteinG: 47, carbsG: 135, fatG: 36 }, targets)).toBe("protein");
  });

  it("is balanced when the top two gaps are within 0.10", () => {
    expect(macroFocus({ proteinG: 65, carbsG: 125, fatG: 75 }, targets)).toBe("balanced");
  });

  it("maps carbs and fats to their focus names", () => {
    expect(macroFocus({ proteinG: 130, carbsG: 0, fatG: 70 }, targets)).toBe("complex_carbs");
    expect(macroFocus({ proteinG: 130, carbsG: 240, fatG: 0 }, targets)).toBe("healthy_fats");
  });
});

describe("computeBioState", () => {
  it("sums the day's meals and takes flags from the latest check-in", () => {
    const meals: Meal[] = [
      { id: "m1", userId: "u1", kind: "breakfast", eatenAt: new Date(), items: [item("Oats", 440, 12.8, 67, 15)] },
      { id: "m2", userId: "u1", kind: "lunch", eatenAt: new Date(), items: [item("Poke bowl", 610, 34, 68, 21)] },
    ];
    const state = computeBioState(profile(), "2026-09-29", meals, {
      id: "c1",
      userId: "u1",
      at: new Date(),
      flags: ["low_focus"],
    });
    expect(state).toMatchObject({
      date: "2026-09-29",
      calorieTarget: 2200,
      caloriesEaten: 1050,
      macroFocus: "protein",
      cognitiveFlags: ["low_focus"],
      dietaryPreference: "pescatarian",
    });
    expect(state.macrosEaten.carbsG).toBe(135);
  });

  it("has no flags and nothing eaten on an empty day", () => {
    const state = computeBioState(profile(), "2026-09-29", [], null);
    expect(state.caloriesEaten).toBe(0);
    expect(state.cognitiveFlags).toEqual([]);
  });
});

describe("processingOf", () => {
  it("adds up calories by processing level and leaves out items without one", () => {
    const item = (calories: number, processing?: "whole" | "processed" | "ultra_processed") => ({
      name: "x",
      portion: "1",
      calories,
      macros: { proteinG: 0, carbsG: 0, fatG: 0 },
      ...(processing ? { processing } : {}),
    });
    expect(processingOf([item(300.4, "whole"), item(150, "processed"), item(250.6, "ultra_processed"), item(99.6, "ultra_processed"), item(500)])).toEqual({
      wholeKcal: 300,
      processedKcal: 150,
      ultraProcessedKcal: 350,
    });
  });
});
