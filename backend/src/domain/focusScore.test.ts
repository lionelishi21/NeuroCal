import { describe, expect, it } from "@jest/globals";
import {
  withWeight,
  computeFocusComponents,
  fallbackExplanation,
  focusScoreFrom,
  FOCUS_WEIGHTS,
  MIN_TUNING_DAYS,
  glycemicComponent,
  keptFast,
  movementComponent,
  personalWeights,
  sleepComponent,
  stressComponent,
  timingComponent,
  type FocusInputs,
} from "./focusScore";
import type { CheckIn, Meal } from "./types";

const tz = "America/Chicago";
const at = (iso: string) => new Date(iso);
const meal = (eatenAt: string, calories: number, glycemicLoad?: "low" | "high"): Meal => ({
  id: eatenAt,
  userId: "u1",
  kind: "dinner",
  eatenAt: at(eatenAt),
  items: [{ name: "Food", portion: "1", calories, macros: { proteinG: 0, carbsG: 0, fatG: 0 }, ...(glycemicLoad ? { glycemicLoad } : {}) }],
});
const checkIn = (flags: CheckIn["flags"]): CheckIn => ({ id: flags.join(), userId: "u1", at: at("2026-09-28T20:00:00Z"), flags });
const empty: FocusInputs = { date: "2026-09-29", timeZone: tz, sleep: [], previousDayMeals: [], screenTime: [], checkIns: [] };

describe("sleepComponent", () => {
  it("scores duration against 8 hours", () => {
    expect(sleepComponent([{ start: at("2026-09-29T05:00:00Z"), end: at("2026-09-29T11:00:00Z"), source: "manual" }])).toBe(0.75);
  });

  it("blends in deep sleep when every session measures it", () => {
    const s = { start: at("2026-09-29T04:00:00Z"), end: at("2026-09-29T12:00:00Z"), source: "wearable" as const, deepMinutes: 45 };
    expect(sleepComponent([s])).toBeCloseTo(0.7 * 1 + 0.3 * 0.5);
  });

  it("counts overlapping sessions from different sources once", () => {
    const watch = { start: at("2026-09-29T04:00:00Z"), end: at("2026-09-29T10:00:00Z"), source: "wearable" as const };
    const manual = { start: at("2026-09-29T05:00:00Z"), end: at("2026-09-29T12:00:00Z"), source: "manual" as const };
    expect(sleepComponent([watch, manual])).toBe(1); // 04:00–12:00 = 8 h, not 13 h
    expect(sleepComponent([watch, { ...manual, start: at("2026-09-29T05:00:00Z"), end: at("2026-09-29T06:00:00Z") }])).toBe(0.75);
  });

  it("is null without sleep data", () => {
    expect(sleepComponent([])).toBeNull();
  });
});

describe("timingComponent", () => {
  it("penalises a late dinner and late screen time on the previous evening", () => {
    const inputs: FocusInputs = {
      ...empty,
      previousDayMeals: [meal("2026-09-29T03:00:00Z", 500)], // 22:00 on the 28th in Chicago → 60 min late
      screenTime: [
        { windowStart: at("2026-09-29T04:00:00Z"), windowEnd: at("2026-09-29T05:00:00Z"), minutes: 60, source: "wearable" }, // 23:00
        { windowStart: at("2026-09-28T18:00:00Z"), windowEnd: at("2026-09-28T19:00:00Z"), minutes: 60, source: "wearable" }, // 13:00, ignored
      ],
    };
    expect(timingComponent(inputs)).toBeCloseTo(1 - 0.5 - 0.5 * 0.5);
  });

  it("is perfect for an early dinner and no late screens", () => {
    expect(timingComponent({ ...empty, previousDayMeals: [meal("2026-09-28T23:30:00Z", 600)] })).toBe(1); // 18:30
  });
});

describe("glycemicComponent", () => {
  it("is the share of calories that were not high-glycemic", () => {
    expect(glycemicComponent([meal("2026-09-28T17:00:00Z", 300, "high"), meal("2026-09-28T23:00:00Z", 900, "low")])).toBe(0.75);
  });
});

describe("stressComponent", () => {
  it("counts distinct negative flags", () => {
    expect(stressComponent([checkIn(["low_focus", "calm"]), checkIn(["low_focus", "stressed"])])).toBe(0.5);
    expect(stressComponent([checkIn(["sharp"])])).toBe(1);
  });
});

describe("focusScoreFrom", () => {
  it("weights sleep 30%, timing 20%, food and stress 15% each, movement and environment 10% each", () => {
    // Movement and environment have no data, so the other four are renormalised over 0.8: 100 × 0.65 / 0.8.
    expect(focusScoreFrom({ sleep: 0.5, timing: 1, glycemic: 1, stress: 1, movement: null })).toBe(81);
    expect(focusScoreFrom({ sleep: 0.5, timing: 1, glycemic: 1, stress: 1, movement: 1 })).toBe(83);
  });

  it("renormalises over the components that have data", () => {
    expect(focusScoreFrom({ sleep: 0.5, timing: null, glycemic: null, stress: null, movement: null })).toBe(50);
    expect(focusScoreFrom({ sleep: null, timing: null, glycemic: null, stress: null, movement: null })).toBeNull();
  });
});

describe("computeFocusComponents + fallbackExplanation", () => {
  it("names the weakest input", () => {
    const components = computeFocusComponents({
      ...empty,
      sleep: [{ start: at("2026-09-29T07:00:00Z"), end: at("2026-09-29T11:00:00Z"), source: "manual" }],
      checkIns: [checkIn(["sharp"])],
    });
    expect(components).toEqual({ sleep: 0.5, timing: null, glycemic: null, stress: 1, movement: null, environment: null });
    expect(fallbackExplanation(focusScoreFrom(components), components)).toBe(
      "Last night's sleep is pulling your score down the most today.",
    );
  });

  it("asks for data when there is none", () => {
    expect(fallbackExplanation(null, { sleep: null, timing: null, glycemic: null, stress: null, movement: null })).toMatch(/Log last night's sleep/);
  });
});

describe("movementComponent (v1)", () => {
  it("has no data for people who haven't logged exercise lately, so they aren't marked down", () => {
    expect(movementComponent({ ...empty, previousDayExercise: [] })).toBeNull();
  });

  it("scores yesterday's exercise against 30 moderate minutes, hard counting double and light half", () => {
    expect(movementComponent({ ...empty, logsExercise: true, previousDayExercise: [] })).toBe(0);
    expect(movementComponent({ ...empty, logsExercise: true, previousDayExercise: [{ minutes: 15, intensity: "moderate" }] })).toBe(0.5);
    expect(movementComponent({ ...empty, logsExercise: true, previousDayExercise: [{ minutes: 15, intensity: "hard" }] })).toBe(1);
    expect(movementComponent({ ...empty, logsExercise: true, previousDayExercise: [{ minutes: 30, intensity: "light" }] })).toBe(0.5);
  });
});

describe("keptFast (v1)", () => {
  // Dinner at 19:00 Chicago (00:00Z), first meal the next day at 11:30 (16:30Z): a 16.5-hour fast.
  const inputs = { ...empty, previousDayMeals: [meal("2026-09-29T00:00:00Z", 600)], todayMeals: [meal("2026-09-29T16:30:00Z", 400)] };

  it("is true when the overnight fast reached the protocol's hours, and lifts evening timing", () => {
    expect(keptFast({ ...inputs, fastHours: 16 })).toBe(true);
    expect(keptFast({ ...inputs, fastHours: 23 })).toBe(false);
    // A late dinner (21:30) costs timing points; keeping the fast to 14:00 the next day wins some back.
    const late = { ...inputs, previousDayMeals: [meal("2026-09-29T02:30:00Z", 600)], todayMeals: [meal("2026-09-29T19:00:00Z", 400)] };
    expect(timingComponent({ ...late, fastHours: 16 })).toBeGreaterThan(timingComponent(late)!);
  });

  it("is false with fasting off or before the first meal of the day", () => {
    expect(keptFast(inputs)).toBe(false);
    expect(keptFast({ ...inputs, fastHours: 16, todayMeals: [] })).toBe(false);
  });
});

describe("personalWeights (v1)", () => {
  const components = (sleep: number, stress: number) => ({ sleep, timing: 0.8, glycemic: 0.8, stress, movement: null });

  it("keeps the standard weights until there are enough days with a Brain speed check", () => {
    const few = Array.from({ length: MIN_TUNING_DAYS - 1 }, (_, i) => ({ components: components(i / 20, 0.5), brainScore: 50 + i }));
    expect(personalWeights(few)).toEqual({ weights: FOCUS_WEIGHTS, tuned: false });
  });

  it("gives more weight to the input that tracks this person's reaction time, still adding up to 1", () => {
    // Sleep rises with Brain speed; stress moves against it.
    const days = Array.from({ length: 20 }, (_, i) => ({ components: components(i / 20, 1 - i / 20), brainScore: 50 + i }));
    const { weights, tuned } = personalWeights(days);
    expect(tuned).toBe(true);
    expect(weights.sleep).toBeGreaterThan(FOCUS_WEIGHTS.sleep);
    expect(weights.stress).toBeLessThan(FOCUS_WEIGHTS.stress);
    // Never below half of its standard weight before renormalising.
    expect(weights.stress).toBeGreaterThan(0);
    expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2);
  });
});


describe("withWeight", () => {
  it("sets one input's weight and keeps the total at 1", () => {
    const base = { sleep: 0.3, timing: 0.2, glycemic: 0.15, stress: 0.15, movement: 0.1, environment: 0.1 };
    const w = withWeight(base, "glycemic", 0.25);
    expect(w.glycemic).toBe(0.25);
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(w.sleep / w.timing).toBeCloseTo(1.5, 10);
  });
});
