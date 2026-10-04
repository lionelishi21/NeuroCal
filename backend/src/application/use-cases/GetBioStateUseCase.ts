import { computeBioState } from "../../domain/bioState";
import { InvalidError, NotFoundError } from "../../domain/errors";
import { isIsoDate, localDateOf } from "../../domain/localDay";
import type { BioState, Profile } from "../../domain/types";
import type { IClock } from "../interfaces/IClock";
import type { ICheckInRepository, IMealRepository, IProfileRepository } from "../interfaces/IRepositories";

/** ARCHITECTURE §6.5. `date` defaults to today in the user's time zone. */
export class GetBioStateUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly meals: IMealRepository,
    private readonly checkIns: ICheckInRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: { userId: string; date?: string }): Promise<BioState> {
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    return this.forProfile(profile, input.date);
  }

  /** Shared with RecommendRecipeUseCase so both read the day the same way. */
  async forProfile(profile: Profile, date?: string): Promise<BioState> {
    if (date !== undefined && !isIsoDate(date)) throw new InvalidError("Use a date like 2026-09-29.");
    const day = { date: date ?? localDateOf(this.clock.now(), profile.timeZone), timeZone: profile.timeZone };
    const [meals, latestCheckIn] = await Promise.all([
      this.meals.listForDay(profile.userId, day),
      this.checkIns.latestForDay(profile.userId, day),
    ]);
    return computeBioState(profile, day.date, meals, latestCheckIn);
  }
}
