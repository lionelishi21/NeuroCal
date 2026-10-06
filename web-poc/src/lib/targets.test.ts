import { describe, expect, it } from "vitest";
import { macroCalories, suggestMacros } from "./targets";

describe("suggestMacros", () => {
  it("splits 25/45/30 for most diets", () => {
    expect(suggestMacros(2200, "pescatarian")).toEqual({ proteinG: 140, carbsG: 250, fatG: 75 });
  });

  it("keeps carbs low for keto", () => {
    expect(suggestMacros(2000, "keto")).toEqual({ proteinG: 125, carbsG: 25, fatG: 155 });
  });

  it("adds back up to roughly the calorie target", () => {
    expect(Math.abs(macroCalories(suggestMacros(2400, "vegan")) - 2400)).toBeLessThan(40);
  });
});
