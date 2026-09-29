import { InvalidError, NotFoundError } from "../../domain/errors";
import { isIsoDate, localDateOf } from "../../domain/localDay";
import type { Meal } from "../../domain/types";
import type { IClock } from "../interfaces/IClock";
import type { IMealRepository, IProfileRepository } from "../interfaces/IRepositories";

/** The user's meals on a local day, oldest first. `date` defaults to today in their time zone. */
export class ListMealsUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly meals: IMealRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: { userId: string; date?: string }): Promise<Meal[]> {
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    if (input.date !== undefined && !isIsoDate(input.date)) throw new InvalidError("Use a date like 2026-09-29.");
    const date = input.date ?? localDateOf(this.clock.now(), profile.timeZone);
    return this.meals.listForDay(input.userId, { date, timeZone: profile.timeZone });
  }
}
