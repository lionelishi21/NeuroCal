import { InvalidError } from "../../domain/errors";
import type { GlucoseDay } from "../../domain/glucose";
import { isIsoDate, localDateOf, previousDate } from "../../domain/localDay";
import type { IClock } from "../interfaces/IClock";
import type { IGlucoseRepository } from "../interfaces/IGlucose";
import type { IProfileRepository } from "../interfaces/IRepositories";

/** Glucose-sensor days: sent by the app from Health Connect / Apple Health, listed for Progress → Body. */
export class GlucoseUseCases {
  constructor(
    private readonly glucose: IGlucoseRepository,
    private readonly profiles: IProfileRepository,
    private readonly clock: IClock,
  ) {}

  async record(userId: string, days: GlucoseDay[]): Promise<{ accepted: number }> {
    for (const d of days) {
      if (!isIsoDate(d.date)) throw new InvalidError("Use dates like 2026-10-18.");
      const pcts = [d.inRange140Pct, d.inRange180Pct, d.cvPct];
      if (pcts.some((p) => !Number.isFinite(p) || p < 0 || p > 100) || d.inRange180Pct < d.inRange140Pct) throw new InvalidError("Time in range and variability are percentages.");
      if (!(d.meanMgdl >= 30 && d.meanMgdl <= 600)) throw new InvalidError("Average glucose should be between 30 and 600 mg/dL.");
    }
    return { accepted: await this.glucose.upsertDays(userId, days) };
  }

  /** The last [days] days, oldest first. */
  async recent(userId: string, days = 14): Promise<GlucoseDay[]> {
    const profile = await this.profiles.get(userId);
    const today = localDateOf(this.clock.now(), profile?.timeZone ?? "UTC");
    let from = today;
    for (let i = 1; i < days; i++) from = previousDate(from);
    return this.glucose.listBetween(userId, from, today);
  }
}
