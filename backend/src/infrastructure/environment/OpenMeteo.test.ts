import { describe, expect, it } from "@jest/globals";
import { OpenMeteoAirQuality, OpenMeteoGeocoder } from "./OpenMeteo";

const reply = (body: object) => {
  const asked: string[] = [];
  const fetch = (async (url: URL) => {
    asked.push(url.toString());
    return new Response(JSON.stringify(body));
  }) as unknown as typeof globalThis.fetch;
  return { asked, fetch };
};

describe("Open-Meteo", () => {
  it("averages a day's hourly US AQI at a place", async () => {
    const { asked, fetch } = reply({ hourly: { us_aqi: [30, 50, null] } });
    expect(await new OpenMeteoAirQuality({ fetch }).dailyAqi(30.3, -97.7, "2026-10-14", "America/Chicago")).toBe(40);
    expect(asked[0]).toContain("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=30.3&longitude=-97.7&hourly=us_aqi&start_date=2026-10-14");
  });

  it("finds a town, and uses the customer endpoint with a paid key", async () => {
    const { asked, fetch } = reply({ results: [{ name: "Austin", admin1: "Texas", country: "United States", latitude: 30.267, longitude: -97.743 }] });
    expect(await new OpenMeteoGeocoder({ fetch, apiKey: "k" }).find("Austin")).toEqual({ name: "Austin, Texas, United States", latitude: 30.267, longitude: -97.743 });
    expect(asked[0]).toMatch(/^https:\/\/customer-geocoding-api\.open-meteo\.com\/v1\/search\?name=Austin.*apikey=k/);
    expect(await new OpenMeteoGeocoder({ fetch: reply({}).fetch }).find("Nowhere")).toBeNull();
  });
});
