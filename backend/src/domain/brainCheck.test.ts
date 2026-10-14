import { describe, expect, it } from "@jest/globals";
import { baselineOf, scoreCheck } from "./brainCheck";

const repeat = (ms: number, n: number) => Array.from({ length: n }, () => ms);

describe("Brain speed check", () => {
  it("gives a rested result full marks and summarises it", () => {
    const r = scoreCheck([...repeat(240, 18), 200, 210], 0);
    expect(r).toEqual({ trials: 20, medianMs: 240, fastestMs: 205, lapses: 0, falseStarts: 0, score: 100 });
  });

  it("takes points for a slower median, lapses and false starts", () => {
    const tired = scoreCheck([...repeat(340, 16), ...repeat(650, 4)], 2);
    // 100 - (340-250)/3 - 20% lapses - 2×3 = 100 - 30 - 20 - 6
    expect(tired).toMatchObject({ medianMs: 340, lapses: 4, falseStarts: 2, score: 44 });
    expect(scoreCheck(repeat(900, 12), 10).score).toBe(0);
  });

  it("needs three earlier checks for a baseline", () => {
    expect(baselineOf([80, 90])).toBeNull();
    expect(baselineOf([80, 90, 70, 100])).toBe(85);
  });
});
