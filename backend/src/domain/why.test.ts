import { describe, expect, it } from "@jest/globals";
import type { CoachData } from "./coach";
import type { Meal, Profile } from "./types";
import { caloriesWhy, weightWhy } from "./why";

const profile: Profile = {
  userId: "u1",
  displayName: "Lionel",
  timeZone: "America/Chicago",
  dietaryPreference: "omnivore",
  cognitiveGoals: [],
  dailyCalorieTarget: 2100,
  macroTargets: { proteinG: 150, carbsG: 180, fatG: 70 },
};
const meal = (at: string, name: string, kcal: number, carbsG: number, proteinG = 20): Meal => ({
  id: at + name,
  userId: "u1",
  kind: "dinner",
  eatenAt: new Date(at),
  items: [{ name, portion: "1", calories: kcal, macros: { proteinG, carbsG, fatG: 30 } }],
});
const data = (over: Partial<CoachData>): CoachData => ({ profile, today: "2026-11-06", unit: "lb", weights: [], meals: [], sleep: [], sessions: [], ...over });

describe("weightWhy", () => {
  // 232 lb on the 5th, 238 lb on the 6th, after pizza and a late ramen on the 5th.
  const up = data({
    weights: [
      { date: "2026-11-05", kg: 105.23 },
      { date: "2026-11-06", kg: 107.95 },
    ],
    meals: [
      { date: "2026-11-03", meals: [meal("2026-11-03T18:00:00Z", "Chicken salad", 600, 40)] },
      { date: "2026-11-04", meals: [meal("2026-11-04T18:00:00Z", "Salmon and rice", 700, 80)] },
      { date: "2026-11-05", meals: [meal("2026-11-05T18:00:00Z", "Pepperoni pizza", 1400, 160), meal("2026-11-06T03:30:00Z", "Ramen", 1100, 110)] },
      { date: "2026-11-06", meals: [] },
    ],
    sleep: [{ date: "2026-11-06", sessions: [{ start: new Date("2026-11-06T07:00:00Z"), end: new Date("2026-11-06T12:12:00Z"), source: "health_connect" }] }],
  });

  it("names the day before's carbs, salt, late meal and calories, the sleep, and the fat arithmetic", () => {
    expect(weightWhy(up)).toEqual({
      headline: "Up 6 lb: most likely water, not fat",
      reasons: [
        "270 g of carbs yesterday, against about 60 g usually. Each gram the body stores holds about 3 g of water.",
        "Salty food yesterday (Pepperoni pizza, Ramen). Salt makes the body hold water for a day or two.",
        "Last meal at 21:30, so more food was still in your gut at the weigh-in.",
        "2,500 kcal yesterday, 400 kcal over your target.",
        "5.2 h of sleep. Short sleep raises cortisol, which holds water.",
        "Gaining 6 lb of fat would take about 21,000 kcal more than you burn, so this is mostly water.",
      ],
    });
  });

  it("says when the day before wasn't logged, and stays quiet for a change under a pound or weigh-ins far apart", () => {
    expect(weightWhy({ ...up, meals: [] })?.reasons[0]).toBe("Nothing logged yesterday. Log meals to see what moves your weight.");
    expect(weightWhy(data({ weights: [{ date: "2026-11-05", kg: 100 }, { date: "2026-11-06", kg: 100.3 }] }))).toBeNull();
    expect(weightWhy(data({ weights: [{ date: "2026-10-30", kg: 100 }, { date: "2026-11-06", kg: 103 }] }))).toBeNull();
  });

  it("explains a drop as partly water, in kilograms when that's the unit", () => {
    const down = weightWhy(data({ unit: "kg", weights: [{ date: "2026-11-05", kg: 100 }, { date: "2026-11-06", kg: 99 }] }));
    expect(down?.headline).toBe("Down 1 kg: part of it is water");
    expect(down?.reasons).toContain("Some of a quick drop is water and an emptier gut too; the trend shows the real change.");
  });
});

describe("caloriesWhy", () => {
  it("names the biggest items, and protein when it lags", () => {
    const d = data({ meals: [{ date: "2026-11-06", meals: [meal("2026-11-06T18:00:00Z", "Pepperoni pizza", 1400, 160, 50), meal("2026-11-06T22:00:00Z", "Ice cream", 900, 100, 10)] }] });
    expect(caloriesWhy(d, "2026-11-06")).toEqual({
      headline: "200 kcal over: here's where it came from",
      reasons: [
        "Most came from Pepperoni pizza (1,400 kcal) and Ice cream (900 kcal).",
        "Protein is at 60 of 150 g. Protein keeps you full for longer and protects muscle while you lose weight.",
      ],
    });
    expect(caloriesWhy(data({}), "2026-11-06")).toBeNull();
  });
});
