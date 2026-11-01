/**
 * The environment pillar (docs/NCBM.md §3): the air where you live, from the US AQI, and a daily check
 * of the "junk" exposures the biohacking canon names: morning daylight, a dark bedroom, a quiet bedroom
 * and filtered water. Self-reported, because a phone can't measure most of them reliably.
 */

export const ENVIRONMENT_ITEMS = ["daylight", "darkBedroom", "quietBedroom", "filteredWater"] as const;
export type EnvironmentItem = (typeof ENVIRONMENT_ITEMS)[number];

/** One day's check: which habits were kept. Items left out weren't answered. */
export type EnvironmentCheck = Partial<Record<EnvironmentItem, boolean>>;

/** Water drunk on a day, and whether salt or electrolytes went in (not scored). */
export interface WaterDay {
  ml: number;
  electrolytes: boolean;
}

/** About what most people need to drink: 33 ml per kg, kept within reason for very light or heavy people. */
const WATER_ML_PER_KG = 33;
const WATER_MIN_ML = 1500;
const WATER_MAX_ML = 3500;
/** Without a weigh-in, the common 2 litres. */
const WATER_DEFAULT_ML = 2000;
/** Sweat lost to exercise, roughly half a litre an hour, counted for up to two hours. */
const WATER_ML_PER_EXERCISE_MIN = 500 / 60;
const WATER_MAX_EXERCISE_MIN = 120;

/** The day's water target, rounded to 50 ml: from the latest weight, plus the day's exercise. */
export function waterTargetMl(weightKg: number | null, exerciseMinutes: number): number {
  const base = weightKg === null ? WATER_DEFAULT_ML : Math.min(WATER_MAX_ML, Math.max(WATER_MIN_ML, weightKg * WATER_ML_PER_KG));
  const exercise = Math.min(WATER_MAX_EXERCISE_MIN, Math.max(0, exerciseMinutes)) * WATER_ML_PER_EXERCISE_MIN;
  return Math.round((base + exercise) / 50) * 50;
}

/** Water against the target, 0–1. Drinking past it earns nothing more, so nobody is pushed to over-drink. */
export const waterScore = (ml: number, targetMl: number) => Math.min(1, Math.max(0, ml / targetMl));

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
 * known), the share of answered check items kept (when the check was done) and water against the
 * target (when any was logged). Null with none of them.
 */
export function environmentSignal(
  aqi: number | null,
  check: EnvironmentCheck | null,
  water?: { ml: number; targetMl: number } | null,
): number | null {
  const parts: number[] = [];
  if (aqi !== null) parts.push(airScore(aqi));
  const answered = check ? ENVIRONMENT_ITEMS.filter((k) => typeof check[k] === "boolean") : [];
  if (answered.length) parts.push(answered.filter((k) => check![k]).length / answered.length);
  if (water && water.ml > 0) parts.push(waterScore(water.ml, water.targetMl));
  return parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) / 100 : null;
}
