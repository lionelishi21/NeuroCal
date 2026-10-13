import { describe, expect, it } from "@jest/globals";
import { addDays, plannedWeeklyLossKg, progressOf, trendOf, type WeightEntry, type WeightGoal } from "./weight";

const goal: WeightGoal = { startKg: 100, targetKg: 90, startedOn: "2026-09-01", pacePctPerWeek: 0.75, fastingCaution: false };
/** Daily weigh-ins losing `perDay` kg, with ±0.6 kg of water noise. */
const days = (n: number, from: number, perDay: number): WeightEntry[] =>
  Array.from({ length: n }, (_, i) => ({ date: addDays("2026-09-01", i), kg: from - perDay * i + (i % 2 ? 0.6 : -0.6) }));

describe("weight trend", () => {
  it("is empty without weigh-ins and starts at the first one", () => {
    expect(trendOf([])).toBeNull();
    expect(trendOf([{ date: "2026-09-01", kg: 100 }])).toEqual({ trendKg: 100, weeklyChangeKg: null });
  });

  it("smooths day-to-day swings and reads the weekly change from the trend", () => {
    const t = trendOf(days(42, 100, 0.1))!;
    // Six weeks at 0.7 kg a week, read through a lagging average: close to the real rate.
    expect(t.weeklyChangeKg!).toBeLessThan(-0.55);
    expect(t.weeklyChangeKg!).toBeGreaterThan(-0.8);
  });

  it("carries the trend across missed days", () => {
    const t = trendOf([
      { date: "2026-09-01", kg: 100 },
      { date: "2026-09-10", kg: 99 },
    ])!;
    expect(t.trendKg).toBe(99.9);
  });

  it("projects when the goal is reached, or not at all when it isn't heading there", () => {
    const losing = progressOf(days(42, 100, 0.1), goal)!;
    expect(losing.toGoKg).toBeGreaterThan(5);
    expect(losing.projectedOn! > "2026-10-12").toBe(true);
    const flat = progressOf(days(42, 100, 0), goal)!;
    expect(flat.projectedOn).toBeNull();
    const there = progressOf([{ date: "2026-10-01", kg: 89 }], goal)!;
    expect(there).toMatchObject({ toGoKg: 0, projectedOn: "2026-10-01" });
  });

  it("plans the weekly loss from the starting weight and pace", () => {
    expect(plannedWeeklyLossKg(goal)).toBe(0.75);
  });
});
