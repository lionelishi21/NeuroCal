import { describe, expect, it } from "@jest/globals";
import {
  computeFocusComponents,
  fallbackExplanation,
  focusScoreFrom,
  glycemicComponent,
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
  it("weights sleep at 40% and the rest at 20%", () => {
    expect(focusScoreFrom({ sleep: 0.5, timing: 1, glycemic: 1, stress: 1 })).toBe(80);
  });

  it("renormalises over the components that have data", () => {
    expect(focusScoreFrom({ sleep: 0.5, timing: null, glycemic: null, stress: null })).toBe(50);
    expect(focusScoreFrom({ sleep: null, timing: null, glycemic: null, stress: null })).toBeNull();
  });
});

describe("computeFocusComponents + fallbackExplanation", () => {
  it("names the weakest input", () => {
    const components = computeFocusComponents({
      ...empty,
      sleep: [{ start: at("2026-09-29T07:00:00Z"), end: at("2026-09-29T11:00:00Z"), source: "manual" }],
      checkIns: [checkIn(["sharp"])],
    });
    expect(components).toEqual({ sleep: 0.5, timing: null, glycemic: null, stress: 1 });
    expect(fallbackExplanation(focusScoreFrom(components), components)).toBe(
      "Last night's sleep is pulling your score down the most today.",
    );
  });

  it("asks for data when there is none", () => {
    expect(fallbackExplanation(null, { sleep: null, timing: null, glycemic: null, stress: null })).toMatch(/Log last night's sleep/);
  });
});
