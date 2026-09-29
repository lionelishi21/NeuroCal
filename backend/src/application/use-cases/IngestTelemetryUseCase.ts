import { InvalidError } from "../../domain/errors";
import type { ScreenTimeSample, SleepSession } from "../../domain/types";
import type { IClock } from "../interfaces/IClock";
import type { ITelemetryRepository } from "../interfaces/IRepositories";

const DAY_MS = 24 * 3_600_000;
const FUTURE_TOLERANCE_MS = 5 * 60_000;

/** Store sleep and screen-time data from any source (ARCHITECTURE §6.7). Idempotent. */
export class IngestTelemetryUseCase {
  constructor(
    private readonly telemetry: ITelemetryRepository,
    private readonly clock: IClock,
  ) {}

  async sleep(input: { userId: string; sessions: SleepSession[] }): Promise<number> {
    const now = this.clock.now().getTime();
    for (const s of input.sessions) {
      const length = s.end.getTime() - s.start.getTime();
      if (length <= 0) throw new InvalidError("Sleep must end after it starts.");
      if (length > DAY_MS) throw new InvalidError("A sleep session can't be longer than 24 hours.");
      if (s.end.getTime() - now > FUTURE_TOLERANCE_MS) throw new InvalidError("Sleep can't end in the future.");
      if (s.deepMinutes !== undefined && s.deepMinutes * 60_000 > length) {
        throw new InvalidError("Deep sleep can't be longer than the whole session.");
      }
    }
    return this.telemetry.upsertSleep(input.userId, input.sessions);
  }

  async screenTime(input: { userId: string; samples: ScreenTimeSample[] }): Promise<number> {
    for (const s of input.samples) {
      const windowMinutes = (s.windowEnd.getTime() - s.windowStart.getTime()) / 60_000;
      if (windowMinutes <= 0) throw new InvalidError("A screen-time window must end after it starts.");
      if (s.minutes < 0 || s.minutes > windowMinutes) throw new InvalidError("Screen minutes must fit inside their window.");
    }
    return this.telemetry.upsertScreenTime(input.userId, input.samples);
  }
}
