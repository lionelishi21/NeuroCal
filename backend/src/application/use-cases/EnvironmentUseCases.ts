import { InvalidError, NotFoundError, UpstreamError } from "../../domain/errors";
import {
  ENVIRONMENT_ITEMS,
  type AirLocation,
  type AqiCategory,
  type EnvironmentCheck,
  aqiCategory,
  environmentSignal,
  roundCoordinate,
} from "../../domain/environment";
import { isIsoDate, localDateOf } from "../../domain/localDay";
import type { IClock } from "../interfaces/IClock";
import type { IAirQuality, IEnvironmentRepository, IGeocoder } from "../interfaces/IEnvironment";
import type { IProfileRepository } from "../interfaces/IRepositories";

export interface EnvironmentDay {
  date: string;
  location: AirLocation | null;
  air: { aqi: number; category: AqiCategory } | null;
  check: EnvironmentCheck | null;
  /** The Focus Score's environment input for this day, 0–1. */
  signal: number | null;
}

/** The environment pillar: where the air is measured, the daily check, and a day's environment. */
export class EnvironmentUseCases {
  constructor(
    private readonly environment: IEnvironmentRepository,
    private readonly air: IAirQuality,
    private readonly geocoder: IGeocoder,
    private readonly profiles: IProfileRepository,
    private readonly clock: IClock,
  ) {}

  private async timeZone(userId: string) {
    const profile = await this.profiles.get(userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    return profile.timeZone;
  }

  /** A town or postcode; stored rounded to about 10 km. Null or empty clears it. */
  async setLocation(userId: string, place: string | null): Promise<AirLocation | null> {
    if (!place?.trim()) {
      await this.environment.setLocation(userId, null);
      return null;
    }
    if (place.trim().length > 100) throw new InvalidError("Enter a town or postcode.");
    let found;
    try {
      found = await this.geocoder.find(place.trim());
    } catch {
      throw new UpstreamError("Places can't be looked up right now. Try again in a moment.");
    }
    if (!found) throw new InvalidError(`We couldn't find "${place.trim()}". Try the nearest town.`);
    const location = { place: found.name, latitude: roundCoordinate(found.latitude), longitude: roundCoordinate(found.longitude) };
    await this.environment.setLocation(userId, location);
    return location;
  }

  async check(userId: string, input: { date?: string; items: EnvironmentCheck }): Promise<EnvironmentCheck> {
    const timeZone = await this.timeZone(userId);
    if (input.date !== undefined && !isIsoDate(input.date)) throw new InvalidError("Use a date like 2026-09-29.");
    const items = Object.fromEntries(ENVIRONMENT_ITEMS.filter((k) => typeof input.items[k] === "boolean").map((k) => [k, input.items[k]]));
    if (Object.keys(items).length === 0) throw new InvalidError("Answer at least one item.");
    return this.environment.saveCheck(userId, input.date ?? localDateOf(this.clock.now(), timeZone), items);
  }

  /** A day's environment; today when no date is given. Air is fetched once per town and day. */
  async day(userId: string, date?: string): Promise<EnvironmentDay> {
    const timeZone = await this.timeZone(userId);
    if (date !== undefined && !isIsoDate(date)) throw new InvalidError("Use a date like 2026-09-29.");
    const day = date ?? localDateOf(this.clock.now(), timeZone);
    const [location, check] = await Promise.all([this.environment.getLocation(userId), this.environment.getCheck(userId, day)]);
    const aqi = location ? await this.aqiFor(location, day, timeZone) : null;
    return {
      date: day,
      location,
      air: aqi === null ? null : { aqi, category: aqiCategory(aqi) },
      check,
      signal: environmentSignal(aqi, check),
    };
  }

  /** Read by the Focus Score: a day's air and check, with the air left out if it can't be fetched. */
  async inputsFor(userId: string, date: string, timeZone: string): Promise<{ aqi: number | null; check: EnvironmentCheck | null }> {
    const [location, check] = await Promise.all([this.environment.getLocation(userId), this.environment.getCheck(userId, date)]);
    const aqi = location ? await this.aqiFor(location, date, timeZone) : null;
    return { aqi, check };
  }

  private async aqiFor(location: AirLocation, date: string, timeZone: string): Promise<number | null> {
    const cached = await this.environment.cachedAqi(location.latitude, location.longitude, date);
    // Today's reading changes through the day: fetch it again until tomorrow, then keep it.
    const today = date === localDateOf(this.clock.now(), timeZone);
    if (cached !== undefined && !today) return cached;
    try {
      const aqi = await this.air.dailyAqi(location.latitude, location.longitude, date, timeZone);
      await this.environment.cacheAqi(location.latitude, location.longitude, date, aqi);
      return aqi;
    } catch (error) {
      console.error(JSON.stringify({ event: "air_quality_failed", error: String(error).slice(0, 200) }));
      return cached ?? null;
    }
  }
}
