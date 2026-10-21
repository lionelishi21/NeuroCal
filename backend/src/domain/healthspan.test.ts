import { describe, expect, it } from "@jest/globals";
import { type HealthspanInputs, healthspanScore, healthspanWeek, weekSoFar } from "./healthspan";

const base: HealthspanInputs = { exercises: [], mealDays: [], proteinTargetG: 120, wakeMinutes: [], daylightDays: 0, conditions: [] };
const habit = (w: HealthspanInputs, id: string) => healthspanWeek(w).find((h) => h.id === id)!;

describe("healthspanWeek", () => {
  it("counts easy cardio, strength and hard sessions from the exercise log", () => {
    const w = {
      ...base,
      exercises: [
        { kind: "walk" as const, intensity: "moderate" as const, minutes: 60 },
        { kind: "cycle" as const, intensity: "light" as const, minutes: 95 },
        { kind: "walk" as const, intensity: "light" as const, minutes: 30 }, // a stroll isn't zone 2
        { kind: "strength" as const, intensity: "moderate" as const, minutes: 45 },
        { kind: "hiit" as const, intensity: "hard" as const, minutes: 12 },
      ],
    };
    expect(habit(w, "zone2")).toMatchObject({ progress: 155, done: true });
    expect(habit(w, "strength")).toMatchObject({ progress: 1, done: false });
    expect(habit(w, "hard_cardio")).toMatchObject({ progress: 1, done: true });
  });

  it("checks protein days, the ultra-processed share and a steady wake time", () => {
    const day = (proteinG: number, upf: number) => ({ proteinG, kcal: 2000, ultraProcessedKcal: upf, gradedKcal: 2000 });
    const w = { ...base, mealDays: [day(110, 0), day(100, 200), day(50, 0), day(120, 0), day(97, 0), day(130, 400)], wakeMinutes: [390, 400, 410, 480, 395, 405] };
    expect(habit(w, "protein")).toMatchObject({ progress: 5, done: true });
    expect(habit(w, "whole_food")).toMatchObject({ progress: 5, done: true });
    expect(habit(w, "steady_wake")).toMatchObject({ progress: 5, done: true });
    expect(habit({ ...base }, "whole_food")).toMatchObject({ done: false, detail: expect.stringContaining("Log meals") });
  });

  it("leaves hard cardio out with a heart condition, and suggests joint-friendly cardio with joint pain", () => {
    expect(habit({ ...base, conditions: ["heart_condition"] }, "hard_cardio").skipped).toMatch(/clinician/);
    expect(habit({ ...base, conditions: ["joint_pain"] }, "zone2").detail).toMatch(/Kind to joints/);
    expect(habit(base, "hard_cardio").skipped).toBeUndefined();
  });

  it("finds the days from Monday", () => {
    expect(weekSoFar("2026-10-19")).toEqual(["2026-10-19"]); // a Monday
    expect(weekSoFar("2026-10-21")).toEqual(["2026-10-19", "2026-10-20", "2026-10-21"]);
    expect(weekSoFar("2026-10-25")).toHaveLength(7);
  });
});

describe("healthspanScore", () => {
  const h = (unit: string, progress: number, target: number, done = false, skipped?: string) =>
    ({ id: "zone2", title: "", detail: "", unit, progress, target, done, ...(skipped ? { skipped } : {}) }) as const;

  it("scales weekly targets to the days so far, so a good Wednesday scores full", () => {
    // 65 of 150 minutes by Wednesday is on pace (150 × 3/7 ≈ 64).
    expect(healthspanScore([h("min", 65, 150)], 3)).toBe(100);
    expect(healthspanScore([h("min", 32, 150)], 3)).toBe(50);
    expect(healthspanScore([h("min", 0, 150)], 1)).toBe(0);
  });

  it("scores the ultra-processed share down from its limit, and leaves out skipped habits", () => {
    expect(healthspanScore([h("%", 10, 20, true)], 3)).toBe(100);
    expect(healthspanScore([h("%", 30, 20)], 3)).toBe(50);
    expect(healthspanScore([h("%", 0, 20)], 3)).toBeNull();
    expect(healthspanScore([h("sessions", 0, 1, false, "Not with a heart condition."), h("days", 3, 5, true)], 5)).toBe(100);
  });
});
