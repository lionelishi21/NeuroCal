import { describe, expect, it } from "@jest/globals";
import { exerciseKcal } from "./exercise";

describe("exerciseKcal", () => {
  it("counts the exercise above resting: MET − 1, times weight and hours", () => {
    // A 30-minute brisk walk at 80 kg: (3.5 − 1) × 80 × 0.5.
    expect(exerciseKcal("walk", "moderate", 30, 80)).toBe(100);
    // An hour's moderate run at 70 kg: (9.8 − 1) × 70.
    expect(exerciseKcal("run", "moderate", 60, 70)).toBe(616);
  });

  it("burns more when harder or heavier", () => {
    expect(exerciseKcal("cycle", "hard", 45, 70)).toBeGreaterThan(exerciseKcal("cycle", "light", 45, 70));
    expect(exerciseKcal("strength", "moderate", 45, 90)).toBeGreaterThan(exerciseKcal("strength", "moderate", 45, 60));
  });
});
