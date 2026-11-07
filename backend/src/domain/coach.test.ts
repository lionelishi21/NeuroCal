import { describe, expect, it } from "@jest/globals";
import { coachContext } from "./coach";
import type { Meal, Profile } from "./types";

const profile: Profile = {
  userId: "u1",
  displayName: "Lionel",
  timeZone: "America/Chicago",
  dietaryPreference: "omnivore",
  cognitiveGoals: [],
  dailyCalorieTarget: 2100,
  macroTargets: { proteinG: 150, carbsG: 180, fatG: 70 },
  weightGoal: { startKg: 108, targetKg: 95, startedOn: "2026-10-01", pacePctPerWeek: 0.75, fastingCaution: false },
};
const meal = (at: string, name: string, kcal: number, carbsG: number): Meal => ({
  id: at,
  userId: "u1",
  kind: "dinner",
  eatenAt: new Date(at),
  items: [{ name, portion: "1 plate", calories: kcal, macros: { proteinG: 30, carbsG, fatG: 40 } }],
});

describe("coachContext", () => {
  const text = coachContext({
    profile,
    today: "2026-11-06",
    unit: "lb",
    weights: [
      { date: "2026-11-05", kg: 105.23 },
      { date: "2026-11-06", kg: 107.95 },
    ],
    meals: [
      { date: "2026-11-05", meals: [meal("2026-11-05T18:00:00Z", "Pepperoni pizza", 1400, 160), meal("2026-11-06T03:30:00Z", "Ramen", 900, 110)] },
      { date: "2026-11-06", meals: [] },
    ],
    sleep: [{ date: "2026-11-06", sessions: [{ start: new Date("2026-11-06T06:00:00Z"), end: new Date("2026-11-06T11:30:00Z"), source: "health_connect" }] }],
    sessions: [{ id: "s1", kind: "quantum_upgrade", takenAt: new Date("2026-11-01T12:00:00Z"), endsAt: null }],
  });

  it("gives weigh-ins in the person's unit with the change from the one before", () => {
    expect(text).toContain("answer in lb");
    expect(text).toContain("2026-11-05: 232 lb");
    expect(text).toContain("2026-11-06: 238 lb (+6 lb since 2026-11-05)");
    expect(text).toContain("Weight goal: from 238.1 lb to 209.4 lb");
  });

  it("sums each day's food, with the foods and the last meal's local time", () => {
    expect(text).toContain("2026-11-05: 2300 kcal, carbs 270 g, protein 60 g, fat 80 g; last meal at 21:30. 12:00 Pepperoni pizza (1 plate); 21:30 Ramen (1 plate).");
    expect(text).toContain("2026-11-06: nothing logged.");
  });

  it("adds sleep and practices", () => {
    expect(text).toContain("2026-11-06: 5.5 h");
    expect(text).toContain("Quantum Upgrade: running from 2026-11-01, ongoing");
  });
});
