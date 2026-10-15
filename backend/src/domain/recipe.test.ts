import { describe, expect, it } from "@jest/globals";
import type { Food } from "./foods";
import { recipeNutrition, type ParsedIngredient } from "./recipe";

const oats: Food = {
  id: "oats",
  name: "Oats",
  category: "grains",
  kind: "plant",
  serving: "1/2 cup (40 g)",
  grams: 40,
  calories: 150,
  macros: { proteinG: 5, carbsG: 27, fatG: 3 },
  fiberG: 4,
  glycemicLoad: "low",
  processing: "whole",
  goals: [],
  why: "",
  fdcId: 1,
};
const ingredient = (over: Partial<ParsedIngredient>): ParsedIngredient => ({
  name: "Oats",
  quantity: "1 cup",
  grams: 80,
  catalogId: "oats",
  estimate: { calories: 999, proteinG: 99, carbsG: 99, fatG: 99 },
  processing: "whole",
  ...over,
});

describe("recipeNutrition", () => {
  it("uses catalog values scaled by weight, not the estimate, and divides by servings", () => {
    const r = recipeNutrition({ title: "Porridge", servings: 2, ingredients: [ingredient({})] }, [oats]);
    // 80 g is two 40 g servings of oats: 300 kcal in all, 150 a serving.
    expect(r.ingredients[0]).toMatchObject({ calories: 300, source: "catalog", macros: { proteinG: 10, carbsG: 54, fatG: 6 } });
    expect(r).toMatchObject({ calories: 150, macros: { proteinG: 5, carbsG: 27, fatG: 3 }, catalogShare: 1 });
  });

  it("falls back to the estimate for unknown foods, and takes the most processed ingredient's grade", () => {
    const r = recipeNutrition(
      {
        title: "Porridge with syrup",
        servings: 1,
        ingredients: [
          ingredient({}),
          ingredient({ name: "Flavoured syrup", catalogId: null, grams: 30, estimate: { calories: 100, proteinG: 0, carbsG: 25, fatG: 0 }, processing: "ultra_processed" }),
        ],
      },
      [oats],
    );
    expect(r.ingredients[1]).toMatchObject({ calories: 100, source: "estimate" });
    expect(r.calories).toBe(400);
    expect(r.processing).toBe("ultra_processed");
    expect(r.catalogShare).toBe(0.75);
  });

  it("ignores a catalog id that isn't in the catalog", () => {
    const r = recipeNutrition({ title: "x", servings: 1, ingredients: [ingredient({ catalogId: "made-up" })] }, [oats]);
    expect(r.ingredients[0]!.source).toBe("estimate");
  });
});
