import { describe, expect, it } from "@jest/globals";
import { type StackItem, daysLeft, stackFlags } from "./stack";

const item = (id: string, name: string, ingredients: StackItem["ingredients"], over: Partial<StackItem> = {}): StackItem => ({
  id,
  name,
  ingredients,
  servingsPerDay: 1,
  timing: "morning",
  startedOn: "2026-10-01",
  addedOn: "2026-10-01",
  ...over,
});
const zinc = (mg: number) => ({ name: "Zinc (as zinc picolinate)", amount: mg, unit: "mg", inBlend: false });

describe("stack checks", () => {
  it("adds up a nutrient across products and servings, and flags the total above the upper limit", () => {
    const flags = stackFlags([
      item("a", "Multivitamin", [zinc(15), { name: "Vitamin C", amount: 500, unit: "mg", inBlend: false }]),
      item("b", "Zinc 25", [zinc(25)], { servingsPerDay: 2 }),
    ]);
    expect(flags).toEqual([
      {
        kind: "above_upper_limit",
        message: "Together your supplements give 65 mg of zinc a day, above the 40 mg upper limit for adults (from Multivitamin and Zinc 25). Check with your doctor.",
        itemIds: ["a", "b"],
      },
    ]);
  });

  it("notes the same nutrient in two products when the total is still fine", () => {
    const flags = stackFlags([item("a", "Multivitamin", [zinc(10)]), item("b", "Immune blend", [zinc(10)])]);
    expect(flags.map((f) => f.kind)).toEqual(["duplicate"]);
    expect(flags[0]!.message).toContain("20 mg a day together");
  });

  it("flags caffeine taken in the evening, and nothing for a quiet stack", () => {
    const pre = item("c", "Focus blend", [{ name: "Caffeine", amount: 100, unit: "mg", inBlend: false }], { timing: "evening" });
    expect(stackFlags([pre]).map((f) => f.kind)).toEqual(["late_caffeine"]);
    expect(stackFlags([{ ...pre, timing: "morning" }])).toEqual([]);
  });

  it("counts the days of a bottle left from when it was started", () => {
    const bottle = item("d", "Magnesium", [], { servingsPerContainer: 60, servingsPerDay: 2, startedOn: "2026-10-01" });
    expect(daysLeft(bottle, "2026-10-01")).toBe(30);
    expect(daysLeft(bottle, "2026-10-25")).toBe(6);
    expect(daysLeft(bottle, "2026-12-01")).toBe(0);
    expect(daysLeft({ ...bottle, servingsPerContainer: undefined }, "2026-10-25")).toBeNull();
  });
});

describe("stackFlags with health conditions", () => {
  it("flags an ingredient that interacts with a condition's medicines", () => {
    const omega = { id: "o", name: "Omega-3", ingredients: [{ name: "Fish oil", amount: 1000, unit: "mg", inBlend: false }], servingsPerDay: 1, timing: "with_food" as const, startedOn: "2026-10-01", addedOn: "2026-10-01" };
    expect(stackFlags([omega]).some((f) => f.kind === "interaction")).toBe(false);
    const [flag] = stackFlags([omega], ["blood_thinners"]).filter((f) => f.kind === "interaction");
    expect(flag).toEqual({ kind: "interaction", message: expect.stringMatching(/^Omega-3: Fish oil can add to the effect of blood thinners/), itemIds: ["o"] });
  });
});
