import { describe, expect, it } from "@jest/globals";
import { coffeeCheck, isCoffee } from "./coffee";

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
