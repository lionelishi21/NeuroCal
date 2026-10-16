import { describe, expect, it } from "@jest/globals";
import { LEVEL_WINDOW_DAYS, type LevelDay, levelOf } from "./levels";

const day = (over: Partial<LevelDay> = {}): LevelDay => ({
  foodLogged: true,
  sleepLogged: true,
  ultraKcal: 100,
  gradedKcal: 2000,
  proteinRatio: 0.9,
  timing: 0.9,
  sleep: 0.85,
  stress: 0.8,
  movement: 0.8,
  environment: 0.8,
  keptFast: null,
  ...over,
});
const month = (over: Partial<LevelDay> = {}) => Array.from({ length: LEVEL_WINDOW_DAYS }, () => day(over));
const steady = { recent: 75, usual: 70 };

describe("levelOf", () => {
  it("reaches Upgraded when every habit holds", () => {
    expect(levelOf(month(), steady)).toMatchObject({ level: 5, name: "Upgraded" });
  });

  it("starts at 0 until food and sleep are logged on most days", () => {
    const result = levelOf(month({ sleepLogged: false }), steady);
    expect(result).toMatchObject({ level: 0, name: "Getting started" });
    expect(result.requirements.find((r) => r.title === "Log sleep on most nights")).toMatchObject({ met: false, progress: "0 of the last 28 nights (needs 14)" });
  });

  it("stops at the first level whose habit isn't held, even if higher ones are", () => {
    // A quarter of calories ultra-processed: Aware, not Fuelled, whatever the sleep and movement.
    expect(levelOf(month({ ultraKcal: 500 }), steady).level).toBe(1);
    // Late most evenings: Fuelled, not In rhythm.
    expect(levelOf(month({ timing: 0.4 }), steady).level).toBe(2);
    // Brain speed under the usual: In rhythm, not Recovered.
    expect(levelOf(month(), { recent: 60, usual: 70 }).level).toBe(3);
    // Not moving: Recovered, not Upgraded.
    expect(levelOf(month({ movement: 0.2 }), steady).level).toBe(4);
  });

  it("asks for the fasting window only from people who fast", () => {
    expect(levelOf(month({ keptFast: false }), steady).level).toBe(2);
    expect(levelOf(month({ keptFast: true }), steady).level).toBe(5);
    expect(levelOf(month(), steady).requirements.some((r) => r.title.includes("fasting"))).toBe(false);
  });

  it("needs enough days with data before an average counts", () => {
    const days = month({ movement: null });
    const move = levelOf(days, steady).requirements.find((r) => r.title === "Move most days")!;
    expect(move).toMatchObject({ met: false, progress: "Movement: 0 of 10 days with data so far" });
  });
});
