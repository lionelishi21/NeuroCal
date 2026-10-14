import { NotFoundError, InvalidError } from "../../domain/errors";
import {
  DEFAULT_WEIGHT_KG,
  EXERCISE_KINDS,
  INTENSITIES,
  MAX_EXERCISE_MINUTES,
  exerciseKcal,
  type ExerciseKind,
  type Intensity,
} from "../../domain/exercise";
import { isIsoDate, isOnLocalDay, localDateOf } from "../../domain/localDay";
import type { Exercise, IExerciseRepository } from "../interfaces/IExerciseRepository";
import type { IClock } from "../interfaces/IClock";
import type { IProfileRepository, IWeightRepository } from "../interfaces/IRepositories";

const DAY_MS = 86_400_000;

export interface ExerciseDay {
  date: string;
  exercises: Exercise[];
  totalMinutes: number;
  totalKcal: number;
  /** "weigh_in" when calories used the latest weigh-in, "default" when there wasn't one. */
  weightSource: "weigh_in" | "default";
}

/** Logging exercise, with the calories it burned worked out from the latest weigh-in. */
export class ExerciseUseCases {
  constructor(
    private readonly exercises: IExerciseRepository,
    private readonly weights: IWeightRepository,
    private readonly profiles: IProfileRepository,
    private readonly clock: IClock,
  ) {}

  private async weight(userId: string): Promise<{ kg: number; source: ExerciseDay["weightSource"] }> {
    const since = new Date(this.clock.now().getTime() - 365 * DAY_MS).toISOString().slice(0, 10);
    const latest = (await this.weights.list(userId, since)).at(-1);
    return latest ? { kg: latest.kg, source: "weigh_in" } : { kg: DEFAULT_WEIGHT_KG, source: "default" };
  }

  async log(
    userId: string,
    input: { kind: ExerciseKind; intensity: Intensity; minutes: number; startedAt?: string },
  ): Promise<Exercise> {
    if (!EXERCISE_KINDS.includes(input.kind)) throw new InvalidError("Choose a kind of exercise.");
    if (!INTENSITIES.includes(input.intensity)) throw new InvalidError("Choose light, moderate or hard.");
    if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > MAX_EXERCISE_MINUTES) {
      throw new InvalidError(`Minutes must be a whole number from 1 to ${MAX_EXERCISE_MINUTES}.`);
    }
    const now = this.clock.now();
    const startedAt = input.startedAt ? new Date(input.startedAt) : new Date(now.getTime() - input.minutes * 60_000);
    if (Number.isNaN(startedAt.getTime())) throw new InvalidError("startedAt must be a date and time.");
    if (startedAt.getTime() > now.getTime() + 5 * 60_000) throw new InvalidError("That exercise hasn't started yet.");
    const { kg } = await this.weight(userId);
    return this.exercises.add(userId, {
      kind: input.kind,
      intensity: input.intensity,
      minutes: input.minutes,
      startedAt,
      kcal: exerciseKcal(input.kind, input.intensity, input.minutes, kg),
    });
  }

  /** A day's exercise in the profile's time zone; today when no date is given. */
  async day(userId: string, date?: string): Promise<ExerciseDay> {
    const profile = await this.profiles.get(userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    if (date !== undefined && !isIsoDate(date)) throw new InvalidError("Use a date like 2026-09-29.");
    const day = { date: date ?? localDateOf(this.clock.now(), profile.timeZone), timeZone: profile.timeZone };
    // A window wide enough for any time zone, then the exact local day.
    const noon = Date.parse(`${day.date}T12:00:00Z`);
    const rows = await this.exercises.listBetween(userId, new Date(noon - 2 * DAY_MS), new Date(noon + 2 * DAY_MS));
    const exercises = rows.filter((e) => isOnLocalDay(e.startedAt, day));
    return {
      date: day.date,
      exercises,
      totalMinutes: exercises.reduce((s, e) => s + e.minutes, 0),
      totalKcal: exercises.reduce((s, e) => s + e.kcal, 0),
      weightSource: (await this.weight(userId)).source,
    };
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.exercises.delete(userId, id))) throw new NotFoundError("No such exercise.");
  }
}
