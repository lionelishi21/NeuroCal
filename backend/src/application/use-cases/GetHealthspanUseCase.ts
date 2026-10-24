import { wakeHourOf } from "../../domain/coffee";
import { conditionsOf } from "../../domain/conditions";
import { NotFoundError } from "../../domain/errors";
import { healthspanScore, type HealthspanHabit, healthspanWeek, weekSoFar } from "../../domain/healthspan";
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

/** The middle of the week's logged bedtimes, or 16 hours after the wake time from onboarding. */
function usualBedtime(bedMinutes: number[], wakeHour: number): number {
  if (!bedMinutes.length) return Math.round((wakeHour + 16) * 60);
  const sorted = [...bedMinutes].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
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
    const today = localDateOf(this.clock.now(), timeZone);
    const days = weekSoFar(today);
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
          const night = sleep.reduce<(typeof sleep)[number] | null>((latest, s) => (!latest || s.end > latest.end ? s : latest), null);
          const wake = night ? localTimeOf(night.end, timeZone) : null;
          const bed = night ? localTimeOf(night.start, timeZone) : null;
          const minutes = (t: Date) => {
            const { hour, minute } = localTimeOf(t, timeZone);
            return hour * 60 + minute;
          };
          const times = meals.map((m) => minutes(m.eatenAt));
          return {
            meals: items.length
              ? {
                  // Today isn't over, so only a finished day's window counts.
                  ...(date === today ? {} : { firstMinutes: Math.min(...times), lastMinutes: Math.max(...times) }),
                  proteinG: items.reduce((s, i) => s + i.macros.proteinG, 0),
                  kcal: items.reduce((s, i) => s + i.calories, 0),
                  ultraProcessedKcal: graded.filter((i) => i.processing === "ultra_processed").reduce((s, i) => s + i.calories, 0),
                  gradedKcal: graded.reduce((s, i) => s + i.calories, 0),
                }
              : null,
            wakeMinutes: wake ? wake.hour * 60 + wake.minute : null,
            // A bedtime after midnight runs on past 24:00.
            bedMinutes: bed ? bed.hour * 60 + bed.minute + (bed.hour < 12 ? 1440 : 0) : null,
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
      bedMinutes: usualBedtime(
        perDay.flatMap((d) => (d.bedMinutes === null ? [] : [d.bedMinutes])),
        wakeHourOf(profile.bioProfile),
      ),
      daylightDays: perDay.filter((d) => d.daylight).length,
      conditions: conditionsOf(profile),
    });
    const score = healthspanScore(habits, days.length);
    return { weekStart: days[0]!, days: days.length, habits, ...(score === null ? {} : { score }) };
  }
}
