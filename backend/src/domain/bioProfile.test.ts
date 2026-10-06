import { describe, expect, it } from "@jest/globals";
import { frictionNeed, mealHabits } from "./bioProfile";

describe("mealHabits", () => {
  it("turns friction, fasting and training into sentences for the recipe prompt", () => {
    expect(mealHabits({ friction: "post_meal_fog", fasting: "omad", movement: "heavy_lifting" })).toEqual([
      "Gets brain fog after meals: prefer a low-glycemic meal of moderate size.",
      "Eats one meal a day: it should be a large, complete meal.",
      "Lifts heavy weights: protein matters.",
    ]);
  });

  it("says nothing for answers that don't change the meal, unknown ids or no profile", () => {
    expect(mealHabits({ friction: "something_new", fasting: "none", movement: "mobility", moldSensitive: true })).toEqual([]);
    expect(mealHabits(undefined)).toEqual([]);
  });
});

describe("frictionNeed", () => {
  it("names the friction point for the catalog search", () => {
    expect(frictionNeed({ friction: "afternoon_crash" })).toBe("afternoon energy crashes");
    expect(frictionNeed({ friction: ["afternoon_crash"] })).toBeUndefined();
    expect(frictionNeed(undefined)).toBeUndefined();
  });
});
