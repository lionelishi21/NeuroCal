import { describe, expect, it } from "@jest/globals";
import { airScore, aqiCategory, dailyAqi, environmentSignal, roundCoordinate } from "./environment";

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

  it("rounds a place to about a town", () => {
    expect(roundCoordinate(30.26715)).toBe(30.3);
    expect(roundCoordinate(-97.74306)).toBe(-97.7);
  });
});
