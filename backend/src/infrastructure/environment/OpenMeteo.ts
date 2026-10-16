import type { IAirQuality, IGeocoder } from "../../application/interfaces/IEnvironment";
import { dailyAqi } from "../../domain/environment";

/**
 * Open-Meteo (https://open-meteo.com): air quality and geocoding without an account. The free API is
 * for non-commercial use; with an API key (a paid plan) the calls go to the customer endpoints.
 */
const host = (api: string, apiKey?: string) => `https://${apiKey ? "customer-" : ""}${api}.open-meteo.com`;

export class OpenMeteoAirQuality implements IAirQuality {
  constructor(private readonly options: { apiKey?: string; fetch?: typeof fetch } = {}) {}

  async dailyAqi(latitude: number, longitude: number, date: string, timeZone: string) {
    const url = new URL("/v1/air-quality", host("air-quality-api", this.options.apiKey));
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      hourly: "us_aqi",
      start_date: date,
      end_date: date,
      timezone: timeZone,
      ...(this.options.apiKey ? { apikey: this.options.apiKey } : {}),
    }).toString();
    const res = await (this.options.fetch ?? fetch)(url, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) throw new Error(`Air quality lookup failed: ${res.status}`);
    const body = (await res.json()) as { hourly?: { us_aqi?: (number | null)[] } };
    return dailyAqi(body.hourly?.us_aqi ?? []);
  }
}

export class OpenMeteoGeocoder implements IGeocoder {
  constructor(private readonly options: { apiKey?: string; fetch?: typeof fetch } = {}) {}

  async find(place: string) {
    const url = new URL("/v1/search", host("geocoding-api", this.options.apiKey));
    url.search = new URLSearchParams({ name: place, count: "1", language: "en", format: "json", ...(this.options.apiKey ? { apikey: this.options.apiKey } : {}) }).toString();
    const res = await (this.options.fetch ?? fetch)(url, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) throw new Error(`Place lookup failed: ${res.status}`);
    const body = (await res.json()) as { results?: { name: string; latitude: number; longitude: number; admin1?: string; country?: string }[] };
    const r = body.results?.[0];
    if (!r) return null;
    return { name: [r.name, r.admin1, r.country].filter(Boolean).join(", "), latitude: r.latitude, longitude: r.longitude };
  }
}
