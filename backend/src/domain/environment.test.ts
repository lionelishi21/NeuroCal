import { describe, expect, it } from "@jest/globals";
import { airScore, aqiCategory, dailyAqi, environmentSignal, roundCoordinate, waterScore, waterTargetMl } from "./environment";

describe("environment", () => {
  it("bands the US AQI as the EPA does, and scores cleaner air higher", () => {
    expect([42, 75, 120, 180, 250, 320].map(aqiCategory)).toEqual(["good", "moderate", "sensitive", "unhealthy", "very_unhealthy", "hazardous"]);
    expect(airScore(30)).toBe(1);
    expect(airScore(160)).toBeLessThan(airScore(90));
  });

  it("averages the hourly readings that came back", () => {
    expect(dailyAqi([40, null, 60])).toBe(50);
    expect(dailyAqi([null, null])).toBeNull();
  });

  it("combines air and the daily check, using whichever there is", () => {
    expect(environmentSignal(null, null)).toBeNull();
    expect(environmentSignal(40, null)).toBe(1);
    // Daylight and filtered water kept, the bedroom wasn't dark; quiet not answered.
    expect(environmentSignal(null, { daylight: true, filteredWater: true, darkBedroom: false })).toBe(0.67);
    expect(environmentSignal(75, { daylight: true, darkBedroom: true, quietBedroom: true, filteredWater: true })).toBe(0.88);
  });

  it("sets the water target from weight and the day's exercise, within reason", () => {
    expect(waterTargetMl(null, 0)).toBe(2000);
    expect(waterTargetMl(80, 0)).toBe(2650);
    expect(waterTargetMl(80, 60)).toBe(3150);
    // Very light and very heavy people stay within 1.5–3.5 l, and exercise counts for two hours at most.
    expect(waterTargetMl(40, 0)).toBe(1500);
    expect(waterTargetMl(150, 300)).toBe(4500);
  });

  it("scores water against the target, with nothing extra for drinking past it", () => {
    expect(waterScore(1000, 2000)).toBe(0.5);
    expect(waterScore(5000, 2000)).toBe(1);
    // Water joins air and the check; none logged leaves it out.
    expect(environmentSignal(40, null, { ml: 1000, targetMl: 2000 })).toBe(0.75);
    expect(environmentSignal(40, null, { ml: 0, targetMl: 2000 })).toBe(1);
    expect(environmentSignal(null, null, { ml: 0, targetMl: 2000 })).toBeNull();
  });

  it("rounds a place to about a town", () => {
    expect(roundCoordinate(30.26715)).toBe(30.3);
    expect(roundCoordinate(-97.74306)).toBe(-97.7);
  });
});
