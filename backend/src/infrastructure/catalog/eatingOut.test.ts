import { describe, expect, it } from "@jest/globals";
import { FOODS } from "./foods";
import { EATING_OUT } from "./eatingOut";

describe("EATING_OUT", () => {
  it("has unique ids that never clash with the food catalog", () => {
    const ids = EATING_OUT.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const foodIds = new Set(FOODS.map((f) => f.id));
    expect(ids.filter((id) => foodIds.has(id))).toEqual([]);
  });

  it("gives every item a chain, a region and plausible numbers", () => {
    for (const f of EATING_OUT) {
      expect(f.category).toBe("eating_out");
      expect(f.chain?.name).toBeTruthy();
      expect(f.regions?.length).toBeGreaterThan(0);
      expect(f.calories).toBeGreaterThan(0);
      // Energy from the macros (4/4/9) is close to the stated calories.
      const fromMacros = 4 * f.macros.proteinG + 4 * f.macros.carbsG + 9 * f.macros.fatG;
      expect(Math.abs(fromMacros - f.calories)).toBeLessThan(Math.max(10, 0.15 * f.calories));
      expect(f.serving).toContain(`${f.grams} g`);
    }
  });

  it("points each better pick at an item from the same chain with more protein for its calories, or fewer calories and carbs", () => {
    const byId = new Map(EATING_OUT.map((f) => [f.id, f]));
    type Item = (typeof EATING_OUT)[number];
    const proteinPerKcal = (f: Item) => f.macros.proteinG / f.calories;
    const netCarbs = (f: Item) => f.macros.carbsG - f.fiberG;
    for (const f of EATING_OUT.filter((x) => x.betterPick)) {
      const pick = byId.get(f.betterPick!)!;
      expect(pick.chain?.id).toBe(f.chain?.id);
      const better = proteinPerKcal(pick) > proteinPerKcal(f) || (pick.calories < f.calories && netCarbs(pick) < netCarbs(f));
      expect({ item: f.id, pick: pick.id, better }).toEqual({ item: f.id, pick: pick.id, better: true });
    }
  });

  it("takes the bone out of chicken pieces (KFC Original Recipe breast is about 390 kcal)", () => {
    const breast = EATING_OUT.find((f) => f.id === "kfc-original-breast")!;
    expect(breast.calories).toBeGreaterThan(350);
    expect(breast.calories).toBeLessThan(450);
  });
});
