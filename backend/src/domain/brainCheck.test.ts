import { describe, expect, it } from "@jest/globals";
import { baselineOf, levelChangeOf, scoreCheck } from "./brainCheck";

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

describe("levelChangeOf", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const daysAgo = (d: number, score: number) => ({ takenAt: new Date(now.getTime() - d * 86_400_000), score });
  // Eight weeks of checks every other day: [before] for the older four weeks, [after] for the last four.
  const run = (before: number, after: number) => Array.from({ length: 28 }, (_, i) => daysAgo(55 - i * 2, i < 14 ? before : after));

  it("finds a rise that has held, and when it started", () => {
    const change = levelChangeOf(run(68, 76), now);
    expect(change).toMatchObject({ direction: "up", from: 68, to: 76, weeksHeld: 4 });
    expect(change!.since.toISOString().slice(0, 10)).toBe("2026-09-28");
  });

  it("finds a fall too, and ignores small moves", () => {
    expect(levelChangeOf(run(76, 66), now)).toMatchObject({ direction: "down", from: 76, to: 66 });
    expect(levelChangeOf(run(70, 73), now)).toBeNull();
  });

  it("wants two weeks at the new level, and enough checks either side", () => {
    // Only the last week is up: not a level yet.
    const late = Array.from({ length: 28 }, (_, i) => daysAgo(55 - i * 2, i < 24 ? 68 : 80));
    expect(levelChangeOf(late, now)).toBeNull();
    expect(levelChangeOf(run(68, 76).slice(10), now)).toBeNull(); // too few before
  });

  it("leaves out the first week as practice", () => {
    // The first week was slow while learning; without it, there's no change.
    const checks = [...Array.from({ length: 4 }, (_, i) => daysAgo(55 - i, 55)), ...Array.from({ length: 24 }, (_, i) => daysAgo(50 - i * 2, 75))];
    expect(levelChangeOf(checks, now, checks[0]!.takenAt)).toBeNull();
  });
});
