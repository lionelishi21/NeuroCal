/**
 * The environment pillar (docs/NCBM.md §3): the air where you live, from the US AQI, and a daily check
 * of the "junk" exposures the biohacking canon names: morning daylight, a dark bedroom, a quiet bedroom
 * and filtered water. Self-reported, because a phone can't measure most of them reliably.
 */

export const ENVIRONMENT_ITEMS = ["daylight", "darkBedroom", "quietBedroom", "filteredWater"] as const;
export type EnvironmentItem = (typeof ENVIRONMENT_ITEMS)[number];

/** One day's check: which habits were kept. Items left out weren't answered. */
export type EnvironmentCheck = Partial<Record<EnvironmentItem, boolean>>;

/** A place someone set for air quality, rounded so it identifies a town, not a home. */
export interface AirLocation {
  place: string;
  latitude: number;
  longitude: number;
}

/** About 11 km at the equator: enough for air quality, too coarse to find anyone. */
export const roundCoordinate = (n: number) => Math.round(n * 10) / 10;

export type AqiCategory = "good" | "moderate" | "sensitive" | "unhealthy" | "very_unhealthy" | "hazardous";

/** The US EPA's AQI bands. */
export function aqiCategory(aqi: number): AqiCategory {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "moderate";
  if (aqi <= 150) return "sensitive";
  if (aqi <= 200) return "unhealthy";
  if (aqi <= 300) return "very_unhealthy";
  return "hazardous";
}

/** Air as a 0–1 signal: clean air is 1, and each band down costs more. */
export function airScore(aqi: number): number {
  return { good: 1, moderate: 0.75, sensitive: 0.45, unhealthy: 0.2, very_unhealthy: 0.05, hazardous: 0 }[aqiCategory(aqi)];
}

/** The day's mean of the hourly readings that came back; null when none did. */
export function dailyAqi(hourly: (number | null)[]): number | null {
  const known = hourly.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : null;
}

/**
 * The environment signal for a day: the average of the air score (when a place is set and the AQI is
 * known) and the share of answered check items kept (when the check was done). Null with neither.
 */
export function environmentSignal(aqi: number | null, check: EnvironmentCheck | null): number | null {
  const parts: number[] = [];
  if (aqi !== null) parts.push(airScore(aqi));
  const answered = check ? ENVIRONMENT_ITEMS.filter((k) => typeof check[k] === "boolean") : [];
  if (answered.length) parts.push(answered.filter((k) => check![k]).length / answered.length);
  return parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) / 100 : null;
}
