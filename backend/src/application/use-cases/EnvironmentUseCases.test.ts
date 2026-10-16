import { describe, expect, it } from "@jest/globals";
import { FakeAirQuality, FakeGeocoder, FixedClock, InMemoryEnvironment, InMemoryProfiles, profile } from "../testing/fakes";
import { EnvironmentUseCases } from "./EnvironmentUseCases";

const clock = new FixedClock(new Date("2026-09-29T15:00:00Z")); // 10:00 on the 29th in Chicago

async function build(aqi: number | null = 42) {
  const profiles = new InMemoryProfiles();
  await profiles.save(profile());
  const air = new FakeAirQuality(aqi);
  const repo = new InMemoryEnvironment();
  return { air, repo, useCase: new EnvironmentUseCases(repo, air, new FakeGeocoder(), profiles, clock) };
}

describe("EnvironmentUseCases", () => {
  it("stores the town rounded to about 10 km, and refuses a place it can't find", async () => {
    const { useCase } = await build();
    expect(await useCase.setLocation("u1", "Austin")).toEqual({ place: "Austin, Texas, United States", latitude: 30.3, longitude: -97.7 });
    await expect(useCase.setLocation("u1", "Nowhere")).rejects.toThrow("couldn't find");
    expect(await useCase.setLocation("u1", null)).toBeNull();
  });

  it("merges check answers through the day, and scores air and the check together", async () => {
    const { useCase } = await build(75);
    await useCase.setLocation("u1", "Austin");
    await useCase.check("u1", { items: { daylight: true } });
    await useCase.check("u1", { items: { darkBedroom: false } });
    const day = await useCase.day("u1");
    expect(day.check).toEqual({ daylight: true, darkBedroom: false });
    expect(day.air).toEqual({ aqi: 75, category: "moderate" });
    // (air 0.75 + check 1 of 2) / 2.
    expect(day.signal).toBe(0.63);
    await expect(useCase.check("u1", { items: {} })).rejects.toThrow("Answer at least one item");
  });

  it("fetches a past day's air once per town, and today's again until it's over", async () => {
    const { air, useCase } = await build();
    await useCase.setLocation("u1", "Austin");
    await useCase.day("u1", "2026-09-28");
    await useCase.day("u1", "2026-09-28");
    expect(air.calls).toBe(1);
    await useCase.day("u1");
    await useCase.day("u1");
    expect(air.calls).toBe(3);
  });
});
