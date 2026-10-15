import { describe, expect, it } from "@jest/globals";
import { devicesFor, itemsFromText } from "./shopping";

describe("shopping list rules", () => {
  it("suggests a device only when the list shows a swap it makes easy", () => {
    expect(devicesFor(["Frozen french fries", "Chicken nuggets", "Bottled water 24 pack", "Spinach"])).toEqual([
      { tag: "kitchen:air-fryer", because: ["Frozen french fries", "Chicken nuggets"] },
      { tag: "kitchen:water-filter", because: ["Bottled water 24 pack"] },
    ]);
    expect(devicesFor(["Eggs", "Oats", "Blueberries"])).toEqual([]);
  });

  it("reads a pasted list: lines or commas, without bullets and numbers", () => {
    expect(itemsFromText("- Eggs\n2. Granola, oat milk\n\n• Ice cream  ")).toEqual(["Eggs", "Granola", "oat milk", "Ice cream"]);
  });
});
