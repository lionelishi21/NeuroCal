import { FAST_HOURS, type FastingProtocol, type FastingState, fastingProtocolOf, fastingState, fastingStreak } from "../../domain/fasting";
import { NotFoundError } from "../../domain/errors";
import { localDateOf } from "../../domain/localDay";
import type { IClock } from "../interfaces/IClock";
import type { IMealRepository, IProfileRepository } from "../interfaces/IRepositories";

/** Enough history for the streak shown (a month) plus the fast running into it. */
const LOOKBACK_DAYS = 32;

export interface FastingStatus {
  protocol: FastingProtocol;
  fastHours?: number;
  state: FastingState | { kind: "off" };
  streakDays: number;
}

/** The fasting timer from logged meals and the protocol chosen in onboarding. */
export class GetFastingUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly meals: IMealRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: { userId: string }): Promise<FastingStatus> {
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    // The safety answer caps fasting at 12 hours, whatever was chosen in onboarding.
    const protocol: FastingProtocol = fastingProtocolOf(profile);
    if (protocol === "none") return { protocol, state: { kind: "off" }, streakDays: 0 };

    const fastHours = FAST_HOURS[protocol];
    const now = this.clock.now();
    const eaten = await this.meals.eatenSince(input.userId, new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000));
    return {
      protocol,
      fastHours,
      state: fastingState(eaten, now, fastHours),
      streakDays: fastingStreak(eaten, now, fastHours, (d) => localDateOf(d, profile.timeZone)),
    };
  }
}
