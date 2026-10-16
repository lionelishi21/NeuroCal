import { describe, expect, it } from "@jest/globals";
import type { Food } from "./foods";
import { buildMealPlan, mealSlotsFor } from "./mealPlan";
import type { ParsedIngredient } from "./recipe";

const eggs: Food = {
  id: "eggs",
  name: "Eggs",
  category: "eggs_dairy",
  kind: "eggs_dairy",
  serving: "2 eggs",
  grams: 100,
  calories: 155,
  macros: { proteinG: 12.6, carbsG: 1.1, fatG: 10.6 },
  fiberG: 0,
  glycemicLoad: "low",
  processing: "whole",
  goals: [],
  why: "",
  fdcId: 1,
};
const ing = (name: string, grams: number, catalogId: string | null = null): ParsedIngredient => ({
  name,
  quantity: `${grams} g`,
  grams,
  catalogId,
  estimate: { calories: grams, proteinG: 1, carbsG: 1, fatG: 1 },
  processing: "whole",
});

describe("meal plans", () => {
  it("fits the fasting plan: one meal for OMAD, two in a 16:8 window, else three", () => {
    expect(mealSlotsFor("omad")).toEqual(["dinner"]);
    expect(mealSlotsFor("16_8")).toEqual(["lunch", "dinner"]);
    expect(mealSlotsFor("none")).toEqual(["breakfast", "lunch", "dinner"]);
  });

  it("works out each meal and day from the catalog, and lists only what isn't in the pantry, combined", () => {
    const plan = buildMealPlan(
      [
        [
          { kind: "breakfast", title: "Eggs and spinach", ingredients: [ing("Eggs", 100, "eggs"), ing("Spinach", 60)], steps: ["Cook."] },
          { kind: "dinner", title: "Salmon and spinach", ingredients: [ing("Salmon", 120), ing("Spinach", 90)], steps: ["Bake."] },
        ],
      ],
      { catalog: [eggs], pantry: ["eggs"], targets: { calories: 2000, macros: { proteinG: 120, carbsG: 200, fatG: 70 } }, createdAt: new Date("2026-10-16") },
    );
    const [breakfast] = plan.days[0]!.meals;
    expect(breakfast!.ingredients[0]).toMatchObject({ name: "Eggs", inPantry: true, source: "catalog" });
    expect(breakfast!.calories).toBe(155 + 60);
    expect(plan.days[0]!.calories).toBe(155 + 60 + 120 + 90);
    // Spinach is in two meals: one line, 150 g.
    expect(plan.shoppingList).toEqual([
      { name: "Spinach", grams: 150, meals: 2 },
      { name: "Salmon", grams: 120, meals: 1 },
    ]);
  });
});
