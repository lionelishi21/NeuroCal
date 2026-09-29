import { InvalidError, NotFoundError } from "../../domain/errors";
import { computeFocusComponents, focusScoreFrom, sleepMinutes } from "../../domain/focusScore";
import { localDateOf, localTimeOf, previousDate } from "../../domain/localDay";
import { mealCalories, sumMacros } from "../../domain/meal";
import type { CognitiveFlag } from "../../domain/types";
import type { IClock } from "../interfaces/IClock";
import type { ICheckInRepository, IMealRepository, IProfileRepository, ITelemetryRepository } from "../interfaces/IRepositories";
import { loadFocusInputs } from "./GetFocusScoreUseCase";

export const MAX_HISTORY_DAYS = 31;

export interface HistoryDay {
  date: string;
  calorieTarget: number;
  caloriesEaten: number;
  proteinG: number;
  focusScore: number | null;
  sleepMinutes: number | null;
  lastMealAt: string | null;
  flags: CognitiveFlag[];
}

/**
 * The last N days, oldest first, ending today in the user's time zone.
 * Focus scores are recomputed with the same inputs as GET /focus-score, without
 * the AI explanation (history never calls a model).
 */
export class GetHistoryUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly meals: IMealRepository,
    private readonly checkIns: ICheckInRepository,
    private readonly telemetry: ITelemetryRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: { userId: string; days?: number }): Promise<HistoryDay[]> {
    const days = input.days ?? 7;
    if (!Number.isInteger(days) || days < 1 || days > MAX_HISTORY_DAYS) {
      throw new InvalidError(`Ask for between 1 and ${MAX_HISTORY_DAYS} days.`);
    }
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const { timeZone } = profile;

    const dates: string[] = [localDateOf(this.clock.now(), timeZone)];
    while (dates.length < days) dates.unshift(previousDate(dates[0]!));

    const repos = { meals: this.meals, checkIns: this.checkIns, telemetry: this.telemetry };
    return Promise.all(
      dates.map(async (date): Promise<HistoryDay> => {
        const [meals, checkIns, focusInputs] = await Promise.all([
          this.meals.listForDay(profile.userId, { date, timeZone }),
          this.checkIns.listForDay(profile.userId, { date, timeZone }),
          loadFocusInputs(repos, profile, date),
        ]);
        const last = meals.at(-1);
        const time = last ? localTimeOf(last.eatenAt, timeZone) : null;
        return {
          date,
          calorieTarget: profile.dailyCalorieTarget,
          caloriesEaten: meals.reduce((sum, m) => sum + mealCalories(m), 0),
          proteinG: Math.round(sumMacros(meals.flatMap((m) => m.items)).proteinG),
          focusScore: focusScoreFrom(computeFocusComponents(focusInputs)),
          sleepMinutes: focusInputs.sleep.length ? Math.round(sleepMinutes(focusInputs.sleep)) : null,
          lastMealAt: time ? `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}` : null,
          flags: [...new Set(checkIns.flatMap((c) => c.flags))],
        };
      }),
    );
  }
}
