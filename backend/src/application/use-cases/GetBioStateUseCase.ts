import { computeBioState } from "../../domain/bioState";
import { InvalidError, NotFoundError } from "../../domain/errors";
import { isIsoDate, isOnLocalDay, localDateOf } from "../../domain/localDay";
import type { BioState, Meal, Profile } from "../../domain/types";
import { cupName, cupNutrition } from "../../domain/coffee";
import type { IClock } from "../interfaces/IClock";
import type { ICheckInRepository, ICoffeeRepository, IMealRepository, IProfileRepository } from "../interfaces/IRepositories";

/** ARCHITECTURE §6.5. `date` defaults to today in the user's time zone. */
export class GetBioStateUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly meals: IMealRepository,
    private readonly checkIns: ICheckInRepository,
    private readonly clock: IClock,
    private readonly coffee?: ICoffeeRepository,
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
    const noon = Date.parse(`${day.date}T12:00:00Z`);
    const [meals, latestCheckIn, cups] = await Promise.all([
      this.meals.listForDay(profile.userId, day),
      this.checkIns.latestForDay(profile.userId, day),
      this.coffee?.listBetween(profile.userId, new Date(noon - 26 * 3_600_000), new Date(noon + 26 * 3_600_000)) ?? Promise.resolve([]),
    ]);
    // Coffee isn't a meal, but what's stirred into it counts toward the day's calories.
    const drinks: Meal[] = cups
      .filter((c) => isOnLocalDay(c.takenAt, day))
      .map((c) => {
        const n = cupNutrition(c);
        return {
          id: c.id,
          userId: profile.userId,
          kind: "snack" as const,
          eatenAt: c.takenAt,
          items: [{ name: cupName(c), portion: "1 cup", calories: n.kcal, macros: { proteinG: n.proteinG, carbsG: n.carbsG, fatG: n.fatG } }],
        };
      });
    return computeBioState(profile, day.date, [...meals, ...drinks], latestCheckIn);
  }
}
