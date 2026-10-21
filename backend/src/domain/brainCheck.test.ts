import { describe, expect, it } from "@jest/globals";
import { baselineOf, scoreCheck } from "./brainCheck";

const repeat = (ms: number, n: number) => Array.from({ length: n }, () => ms);

describe("Brain speed check", () => {
  it("gives a rested result full marks and summarises it", () => {
    const r = scoreCheck([...repeat(240, 18), 200, 210], 0);
    expect(r).toEqual({ trials: 20, medianMs: 240, fastestMs: 205, lapses: 0, falseStarts: 0, score: 100 });
  });

  it("takes points for a slower median, lapses and false starts, calibrated for a phone", () => {
    const tired = scoreCheck([...repeat(380, 16), ...repeat(650, 4)], 2);
    // 100 - (380-300)/4 - 20% of 50 for lapses - 2×2 = 100 - 20 - 10 - 4
    expect(tired).toMatchObject({ medianMs: 380, lapses: 4, falseStarts: 2, score: 66 });
    // A slow phone check with a few lapses and early taps is low, not zero.
    expect(scoreCheck([...repeat(443, 8), ...repeat(560, 2)], 4).score).toBe(46);
    expect(scoreCheck(repeat(300, 12), 0).score).toBe(100);
    expect(scoreCheck(repeat(900, 12), 10).score).toBe(0);
  });

  it("needs three earlier checks for a baseline", () => {
    expect(baselineOf([80, 90])).toBeNull();
    expect(baselineOf([80, 90, 70, 100])).toBe(85);
  });
});
