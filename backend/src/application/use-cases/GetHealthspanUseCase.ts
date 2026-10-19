import { conditionsOf } from "../../domain/conditions";
import { NotFoundError } from "../../domain/errors";
import { type HealthspanHabit, healthspanWeek, weekSoFar } from "../../domain/healthspan";
import { localDateOf, localTimeOf } from "../../domain/localDay";
import type { IClock } from "../interfaces/IClock";
import type { IEnvironmentRepository } from "../interfaces/IEnvironment";
import type { IExerciseRepository } from "../interfaces/IExerciseRepository";
import type { IMealRepository, IProfileRepository, ITelemetryRepository } from "../interfaces/IRepositories";

const DAY_MS = 86_400_000;

export interface HealthspanWeek {
  /** Monday, YYYY-MM-DD. */
  weekStart: string;
  /** Days of the week so far, today included. */
  days: number;
  habits: HealthspanHabit[];
}

/** This week's healthspan habits, Monday to today in the person's time zone (domain/healthspan.ts). */
export class GetHealthspanUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly meals: IMealRepository,
    private readonly telemetry: ITelemetryRepository,
    private readonly exercises: IExerciseRepository,
    private readonly environment: IEnvironmentRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: { userId: string }): Promise<HealthspanWeek> {
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const { userId } = input;
    const timeZone = profile.timeZone;
    const days = weekSoFar(localDateOf(this.clock.now(), timeZone));
    const inWeek = new Set(days);

    // A window wide enough for any time zone, then the exact local days.
    const from = new Date(Date.parse(`${days[0]}T12:00:00Z`) - 2 * DAY_MS);
    const to = new Date(Date.parse(`${days.at(-1)}T12:00:00Z`) + 2 * DAY_MS);
    const [exercises, perDay] = await Promise.all([
      this.exercises.listBetween(userId, from, to),
      Promise.all(
        days.map(async (date) => {
          const day = { date, timeZone };
          const [meals, sleep, check] = await Promise.all([
            this.meals.listForDay(userId, day),
            this.telemetry.sleepEndingOn(userId, day),
            this.environment.getCheck(userId, date),
          ]);
          const items = meals.flatMap((m) => m.items);
          const graded = items.filter((i) => i.processing !== undefined);
          const lastWake = sleep.reduce<Date | null>((latest, s) => (!latest || s.end > latest ? s.end : latest), null);
          const wake = lastWake ? localTimeOf(lastWake, timeZone) : null;
          return {
            meals: items.length
              ? {
                  proteinG: items.reduce((s, i) => s + i.macros.proteinG, 0),
                  kcal: items.reduce((s, i) => s + i.calories, 0),
                  ultraProcessedKcal: graded.filter((i) => i.processing === "ultra_processed").reduce((s, i) => s + i.calories, 0),
                  gradedKcal: graded.reduce((s, i) => s + i.calories, 0),
                }
              : null,
            wakeMinutes: wake ? wake.hour * 60 + wake.minute : null,
            daylight: check?.daylight === true,
          };
        }),
      ),
    ]);

    const habits = healthspanWeek({
      exercises: exercises.filter((e) => inWeek.has(localDateOf(e.startedAt, timeZone))),
      mealDays: perDay.flatMap((d) => (d.meals ? [d.meals] : [])),
      proteinTargetG: profile.macroTargets.proteinG,
      wakeMinutes: perDay.flatMap((d) => (d.wakeMinutes === null ? [] : [d.wakeMinutes])),
      daylightDays: perDay.filter((d) => d.daylight).length,
      conditions: conditionsOf(profile),
    });
    return { weekStart: days[0]!, days: days.length, habits };
  }
}
