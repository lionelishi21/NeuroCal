import type { AirLocation, EnvironmentCheck } from "../../domain/environment";

/** Scoped to one user (ARCHITECTURE §10), except the air readings, which belong to a place and day. */
export interface IEnvironmentRepository {
  getLocation(userId: string): Promise<AirLocation | null>;
  setLocation(userId: string, location: AirLocation | null): Promise<void>;
  getCheck(userId: string, date: string): Promise<EnvironmentCheck | null>;
  /** Merges into the day's check: items not sent keep their answer. */
  saveCheck(userId: string, date: string, check: EnvironmentCheck): Promise<EnvironmentCheck>;
  /** A day's AQI already fetched for a (rounded) place; undefined when not fetched yet, null when there was none. */
  cachedAqi(latitude: number, longitude: number, date: string): Promise<number | null | undefined>;
  cacheAqi(latitude: number, longitude: number, date: string, aqi: number | null): Promise<void>;
}

/** A day's mean US AQI at a place (Open-Meteo's air quality API). */
export interface IAirQuality {
  dailyAqi(latitude: number, longitude: number, date: string, timeZone: string): Promise<number | null>;
}

/** A town or postcode → coordinates (Open-Meteo's geocoding API). */
export interface IGeocoder {
  find(place: string): Promise<{ name: string; latitude: number; longitude: number } | null>;
}
