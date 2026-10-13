import { describe, expect, it } from "@jest/globals";
import { FOODS } from "../infrastructure/catalog/foods";
import { dietsFor } from "./foods";

const food = (id: string) => FOODS.find((f) => f.id === id)!;

describe("the food catalog", () => {
  it("has unique ids that work as photo file names, and sensible numbers", () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    for (const f of FOODS) {
      expect(f.id).toMatch(/^[a-z0-9-]+$/);
      expect(f.calories).toBeGreaterThanOrEqual(0);
      // Calories roughly match the macros (USDA uses food-specific factors, so allow some slack).
      const fromMacros = f.macros.proteinG * 4 + f.macros.carbsG * 4 + f.macros.fatG * 9;
      if (f.calories > 30) expect(Math.abs(fromMacros - f.calories) / f.calories).toBeLessThan(0.25);
    }
  });

  it("fits diets by plain rules", () => {
    expect(dietsFor(food("salmon"))).toEqual(expect.arrayContaining(["pescatarian", "keto", "paleo", "carnivore", "mediterranean"]));
    expect(dietsFor(food("salmon"))).not.toContain("vegetarian");
    expect(dietsFor(food("lentils"))).toEqual(expect.arrayContaining(["vegan", "vegetarian", "mediterranean"]));
    expect(dietsFor(food("lentils"))).not.toContain("paleo");
    expect(dietsFor(food("oats"))).not.toContain("keto");
    expect(dietsFor(food("avocado"))).toContain("keto"); // 8.5 g carbs, 6.7 g fibre
    expect(dietsFor(food("greek-yogurt"))).not.toContain("paleo");
    expect(dietsFor(food("butter"))).toEqual(expect.arrayContaining(["paleo", "carnivore", "keto"]));
    expect(dietsFor(food("sirloin-steak"))).not.toContain("mediterranean");
    expect(dietsFor(food("white-rice"))).toContain("low_toxin");
    expect(dietsFor(food("cashews"))).not.toContain("low_toxin");
  });
});
