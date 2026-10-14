import { describe, expect, it } from "@jest/globals";
import { type FoodLabelReading, displayName, estimatedGlycemicLoad, foodFlags, foodItemOf, processingOf } from "./foodLabel";

const today = new Date("2026-10-14T12:00:00Z");

describe("processing from the ingredient list (NOVA)", () => {
  it("calls anything with industrial ingredients ultra-processed, and names them", () => {
    expect(processingOf(["Rolled oats", "sugar", "canola oil", "soy lecithin", "natural flavor", "maltodextrin"])).toEqual({
      level: "ultra_processed",
      markers: ["maltodextrin", "emulsifier", "flavouring"],
    });
  });

  it("calls simple foods made with kitchen ingredients processed, and single foods whole", () => {
    expect(processingOf(["Rolled oats", "honey", "almonds", "coconut oil"])).toEqual({ level: "processed", markers: [] });
    expect(processingOf(["Peanuts", "salt"]).level).toBe("processed");
    expect(processingOf(["Peanuts"]).level).toBe("whole");
    expect(processingOf(["Rolled oats", "almonds", "raisins"]).level).toBe("whole");
  });

  it("takes the more processed of the list and the database's group, and reads other languages", () => {
    expect(processingOf([], 4).level).toBe("ultra_processed");
    expect(processingOf([], 3).level).toBe("processed");
    expect(processingOf(["Peanuts"], 4).level).toBe("ultra_processed");
    expect(processingOf(["Oats", "soy lecithin"], 1).level).toBe("ultra_processed");
    // Nutella's French list, as Open Food Facts sends it.
    expect(processingOf(["Sucre", "huile de palme", "NOISETTES 13%", "émulsifiants: lécithines [SOJA]", "vanilline"])).toEqual({
      level: "ultra_processed",
      markers: ["emulsifier"],
    });
  });
});

describe("food label flags and logging", () => {
  const granola: FoodLabelReading = {
    brand: "Crunchy Co",
    productName: "Honey Granola",
    servingSize: "1/2 cup (55 g)",
    nutrition: { calories: 260, proteinG: 5, carbsG: 36, fatG: 10.25, fiberG: 3, sugarsG: 14, addedSugarsG: 12, sodiumMg: 150 },
    ingredients: ["Whole grain oats", "sugar", "canola oil", "soy lecithin"],
    bestBefore: "2026-10-16",
    source: "label",
  };

  it("flags ultra-processed, added sugar and a close best-before date", () => {
    const flags = foodFlags(granola, processingOf(granola.ingredients), today);
    expect(flags.map((f) => f.kind)).toEqual(["ultra_processed", "high_added_sugar", "expires_soon"]);
    expect(flags[1]!.message).toBe("12 g of added sugar per serving: 24% of a day's limit.");
    const spread = foodFlags({ ...granola, servingSize: "100 g", nutrition: { ...granola.nutrition!, addedSugarsG: 52 } }, processingOf([]), today);
    expect(spread[0]!.message).toBe("52 g of added sugar per 100 g: more than a whole day's limit (50 g).");
    expect(flags[0]!.message).toBe("Ultra-processed: it contains emulsifier. Foods like this are easy to overeat.");
  });

  it("turns the label into one serving to log, with an estimated glycemic load", () => {
    expect(foodItemOf(granola, processingOf(granola.ingredients))).toEqual({
      name: "Crunchy Co Honey Granola",
      portion: "1/2 cup (55 g)",
      calories: 260,
      macros: { proteinG: 5, carbsG: 36, fatG: 10.3 },
      glycemicLoad: "high",
      processing: "ultra_processed",
    });
    expect(foodItemOf({ ...granola, nutrition: undefined }, processingOf([]))).toBeNull();
    expect(estimatedGlycemicLoad({ calories: 0, proteinG: 0, carbsG: 12, fatG: 0, fiberG: 4 })).toBe("low");
  });
});

describe("display name", () => {
  it("doesn't repeat a brand that's already in the product name", () => {
    expect(displayName({ brand: "Nutella", productName: "Nutella" })).toBe("Nutella");
    expect(displayName({ brand: "Crunchy Co", productName: "Crunchy Co Granola" })).toBe("Crunchy Co Granola");
    expect(displayName({ brand: "Crunchy Co", productName: "Granola" })).toBe("Crunchy Co Granola");
    expect(displayName({})).toBe("Packaged food");
  });
});
