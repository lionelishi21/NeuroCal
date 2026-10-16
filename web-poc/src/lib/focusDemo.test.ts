import { describe, expect, it } from "vitest";
import { biggestDrag, clock, parts, score, sleepMinutes } from "./focusDemo";

const steady = { dinner: 19.5, bedtime: 22.5, wake: 6.5, screens: 0, highGlycemicShare: 0, flags: ["calm"], exercise: 30 };

describe("focusDemo", () => {
  it("scores a steady evening at 100 with nothing dragging", () => {
    const values = parts(steady);
    expect(values).toEqual({ sleep: 1, timing: 1, glycemic: 1, stress: 1, movement: 1 });
    expect(score(values)).toBe(100);
    expect(biggestDrag(values)).toBeNull();
  });

  it("follows the app's formula for a late, short night", () => {
    // Dinner 45 min past 21:00, 30 min of late screens, 7 h of sleep, a quarter high-glycemic, one negative feeling, 15 min of exercise.
    const values = parts({ dinner: 21.75, bedtime: 23.5, wake: 6.5, screens: 30, highGlycemicShare: 0.25, flags: ["low_focus", "calm"], exercise: 15 });
    expect(values.sleep).toBeCloseTo(0.875);
    expect(values.timing).toBeCloseTo(0.5);
    expect(values.glycemic).toBeCloseTo(0.75);
    expect(values.stress).toBeCloseTo(0.75);
    expect(values.movement).toBeCloseTo(0.5);
    // 100 × (0.3·0.875 + 0.2·0.5 + 0.15·0.75 + 0.15·0.75 + 0.1·0.5) / 0.9, the app's v1.1 weights without environment.
    expect(score(values)).toBe(71);
    expect(biggestDrag(values)).toEqual({ part: "timing", points: 11 });
  });

  it("counts sleep across midnight and floors every input at zero", () => {
    expect(sleepMinutes({ bedtime: 0.5, wake: 6.5 })).toBe(360);
    const worst = parts({ dinner: 23.5, bedtime: 2, wake: 6.5, screens: 120, highGlycemicShare: 1, flags: ["stressed", "brain_fog", "low_focus", "wired"], exercise: 0 });
    expect(worst.timing).toBe(0);
    expect(worst.stress).toBe(0);
    expect(worst.movement).toBe(0);
    expect(score(worst)).toBe(19);
  });

  it("writes clock times", () => {
    expect(clock(21.75)).toBe("21:45");
    expect(clock(24.5)).toBe("00:30");
  });
});
