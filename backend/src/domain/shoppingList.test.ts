import { describe, expect, it } from "@jest/globals";
import { type ShoppingListItem, aisleOf, listText, planQuantity, sortList } from "./shoppingList";

describe("aisleOf", () => {
  it("places items in the aisle you'd find them in", () => {
    expect(["Spinach", "Chicken thighs", "Greek yogurt", "Sourdough", "Rolled oats", "Frozen peas", "Sparkling water", "Batteries"].map(aisleOf)).toEqual([
      "produce",
      "meat_fish",
      "dairy_eggs",
      "bakery",
      "pantry",
      "frozen",
      "drinks",
      "other",
    ]);
  });

  it("keeps cupboard things named after fresh ones in the cupboard", () => {
    expect(["Peanut butter", "Black pepper", "Chicken stock", "Chopped tomatoes", "Coconut milk"].map(aisleOf)).toEqual(Array(5).fill("pantry"));
    expect(aisleOf("Green beans")).toBe("produce");
  });
});

describe("the list", () => {
  const at = (m: number) => new Date(Date.UTC(2026, 9, 26, 10, m));
  const item = (name: string, aisle: ShoppingListItem["aisle"], m: number, extra: Partial<ShoppingListItem> = {}): ShoppingListItem => ({
    id: name,
    name,
    aisle,
    checked: false,
    source: "manual",
    addedAt: at(m),
    ...extra,
  });
  const items = [item("Eggs", "dairy_eggs", 1, { quantity: "12" }), item("Spinach", "produce", 2), item("Apples", "produce", 3, { checked: true }), item("Salmon", "meat_fish", 0)];

  it("sorts by aisle, then by when each was added", () => {
    expect(sortList(items).map((i) => i.name)).toEqual(["Spinach", "Apples", "Salmon", "Eggs"]);
  });

  it("shares what's still to buy, under aisle names", () => {
    expect(listText(items)).toBe("Fruit and veg:\n- Spinach\n\nMeat and fish:\n- Salmon\n\nDairy and eggs:\n- Eggs (12)");
  });

  it("rounds a plan's grams into a shopping amount", () => {
    expect([planQuantity(37), planQuantity(342), planQuantity(1240)]).toEqual(["about 35 g", "about 340 g", "about 1.2 kg"]);
  });
});
