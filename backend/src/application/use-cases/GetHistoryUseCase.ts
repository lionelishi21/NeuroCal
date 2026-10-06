import { InvalidError, NotFoundError } from "../../domain/errors";
import { computeFocusComponents, focusScoreFrom, lateScreenMinutes, sleepMinutes } from "../../domain/focusScore";
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
  bedtime: string | null;
  wakeTime: string | null;
  lateScreenMinutes: number | null;
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
        const clock = (instant: Date | undefined) => {
          if (!instant) return null;
          const { hour, minute } = localTimeOf(instant, timeZone);
          return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        };
        const { sleep } = focusInputs;
        const fellAsleep = sleep.length ? new Date(Math.min(...sleep.map((s) => s.start.getTime()))) : undefined;
        const woke = sleep.length ? new Date(Math.max(...sleep.map((s) => s.end.getTime()))) : undefined;
        return {
          date,
          calorieTarget: profile.dailyCalorieTarget,
          caloriesEaten: meals.reduce((sum, m) => sum + mealCalories(m), 0),
          proteinG: Math.round(sumMacros(meals.flatMap((m) => m.items)).proteinG),
          focusScore: focusScoreFrom(computeFocusComponents(focusInputs)),
          sleepMinutes: focusInputs.sleep.length ? Math.round(sleepMinutes(focusInputs.sleep)) : null,
          lastMealAt: clock(last?.eatenAt),
          bedtime: clock(fellAsleep),
          wakeTime: clock(woke),
          lateScreenMinutes: lateScreenMinutes(focusInputs),
          flags: [...new Set(checkIns.flatMap((c) => c.flags))],
        };
      }),
    );
  }
}
