import { describe, expect, it } from "@jest/globals";
import { coffeeCheck, coffeeFatCheck, isCoffee } from "./coffee";

const bag = (productName: string, ingredients: string[], brand?: string) => ({ productName, ingredients, ...(brand ? { brand } : {}) });

describe("coffeeCheck", () => {
  it("knows coffee from coffee-flavoured food", () => {
    expect(isCoffee(bag("Medium Roast Ground Coffee", ["100% Arabica coffee"]))).toBe(true);
    expect(isCoffee(bag("Coffee Walnut Cake", ["Sugar", "wheat flour", "walnuts", "coffee extract"]))).toBe(false);
    expect(coffeeCheck(bag("Granola", ["Oats"]))).toBeNull();
  });

  it("takes a stated mycotoxin test, or a maker that says it tests", () => {
    expect(coffeeCheck(bag("Whole Bean Coffee, mycotoxin tested", ["Arabica coffee"]))).toMatchObject({ moldTested: true });
    expect(coffeeCheck(bag("The Original Whole Bean Coffee", ["Coffee"], "Bulletproof"))).toMatchObject({ moldTested: true, detail: expect.stringContaining("Bulletproof") });
  });

  it("says what to look for when testing isn't stated, without calling it unsafe", () => {
    const check = coffeeCheck(bag("Classic Roast Ground Coffee", ["Coffee"], "Store Brand"))!;
    expect(check.moldTested).toBe(false);
    expect(check.detail).toMatch(/doesn't say/);
    expect(check.detail).not.toMatch(/unsafe|dangerous/);
  });
});

describe("coffeeFatCheck", () => {
  const label = (productName: string, ingredients: string[] = [], brand?: string) => ({ productName, ingredients, brand });

  it("tells pure C8 from a C8/C10 blend, and says when a label doesn't say", () => {
    expect(coffeeFatCheck(label("Brain Octane C8 MCT Oil", ["Caprylic acid triglycerides from coconut"], "Bulletproof"))).toMatchObject({ addIn: "mct_c8", good: true });
    expect(coffeeFatCheck(label("MCT Oil", ["Caprylic acid (C8)", "Capric acid (C10)"]))).toMatchObject({ addIn: "mct_c8_c10", good: false, detail: expect.stringContaining("blend") });
    expect(coffeeFatCheck(label("Organic MCT Oil", ["Medium chain triglycerides from coconut"]))).toMatchObject({ addIn: "mct_c8_c10", detail: expect.stringContaining("doesn't say") });
  });

  it("checks butter and ghee for grass-fed, by claim or maker", () => {
    expect(coffeeFatCheck(label("Pure Irish Butter", ["Pasteurised cream", "salt"], "Kerrygold"))).toMatchObject({ addIn: "butter_grass_fed", good: true, detail: expect.stringContaining("Kerrygold") });
    expect(coffeeFatCheck(label("Grass-Fed Ghee", ["Organic butter"]))).toMatchObject({ addIn: "ghee_grass_fed", good: true });
    expect(coffeeFatCheck(label("Salted Butter", ["Cream", "salt"], "Store Brand"))).toMatchObject({ addIn: "butter", good: false });
    expect(coffeeFatCheck(label("Clarified Butter", ["Butter"]))).toMatchObject({ addIn: "ghee" });
  });

  it("leaves other foods alone", () => {
    expect(coffeeFatCheck(label("Crunchy Peanut Butter", ["Peanuts"]))).toBeNull();
    expect(coffeeFatCheck(label("Extra Virgin Coconut Oil", ["Coconut oil"]))).toBeNull();
    expect(coffeeFatCheck(label("Granola", ["Oats"]))).toBeNull();
  });
});
