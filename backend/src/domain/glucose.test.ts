import { describe, expect, it } from "@jest/globals";
import { MIN_SENSOR_READINGS, glucoseComponent, summarizeGlucose } from "./glucose";

describe("glucose", () => {
  it("summarises a sensor day and ignores a few finger-pricks", () => {
    expect(summarizeGlucose([95, 140, 110])).toBeNull();
    const day = summarizeGlucose([...Array(200).fill(100), ...Array(40).fill(160), ...Array(10).fill(200)])!;
    expect(day).toMatchObject({ meanMgdl: 114, inRange140Pct: 80, inRange180Pct: 96, readings: 250 });
    expect(day.cvPct).toBeGreaterThan(15);
    expect(MIN_SENSOR_READINGS).toBe(144);
  });

  it("scores time in range against the right range, less a little for big swings", () => {
    const day = { inRange140Pct: 80, inRange180Pct: 96, cvPct: 20 };
    expect(glucoseComponent(day, false)).toBeCloseTo(0.8);
    expect(glucoseComponent(day, true)).toBeCloseTo(0.96);
    expect(glucoseComponent({ ...day, cvPct: 46 }, false)).toBeCloseTo(0.7);
  });
});
