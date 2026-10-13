import { InvalidError, NotFoundError } from "../../domain/errors";
import { isIsoDate, localDateOf } from "../../domain/localDay";
import { MAX_KG, MIN_KG, addDays, plannedWeeklyLossKg, progressOf, trendOf, type WeightEntry } from "../../domain/weight";
import type { IClock } from "../interfaces/IClock";
import type { IProfileRepository, IWeightRepository } from "../interfaces/IRepositories";

const DEFAULT_DAYS = 90;
const MAX_DAYS = 730;
/** The trend needs a run-up before the window shown, or it starts cold at the first weigh-in. */
const RUN_UP_DAYS = 30;

export interface WeightHistory {
  entries: WeightEntry[];
  trendKg?: number;
  weeklyChangeKg?: number;
  goal?: { targetKg: number; toGoKg: number; plannedWeeklyLossKg: number; projectedOn?: string };
}

async function timeZoneOf(profiles: IProfileRepository, userId: string) {
  const profile = await profiles.get(userId);
  if (!profile) throw new NotFoundError("Set up your profile first.");
  return profile;
}

export class LogWeightUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly weights: IWeightRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: { userId: string; kg: number; date?: string }): Promise<WeightEntry> {
    const profile = await timeZoneOf(this.profiles, input.userId);
    const today = localDateOf(this.clock.now(), profile.timeZone);
    const date = input.date ?? today;
    if (!isIsoDate(date)) throw new InvalidError("Use a date like 2026-10-13.");
    if (date > today) throw new InvalidError("You can't log a weigh-in for a day that hasn't happened yet.");
    if (!Number.isFinite(input.kg) || input.kg < MIN_KG || input.kg > MAX_KG) throw new InvalidError(`Enter a weight between ${MIN_KG} and ${MAX_KG} kg.`);
    return this.weights.upsert(input.userId, { date, kg: Math.round(input.kg * 100) / 100 });
  }
}

export class GetWeightHistoryUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly weights: IWeightRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: { userId: string; days?: number }): Promise<WeightHistory> {
    const profile = await timeZoneOf(this.profiles, input.userId);
    const days = input.days ?? DEFAULT_DAYS;
    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) throw new InvalidError(`Ask for 1 to ${MAX_DAYS} days.`);
    const today = localDateOf(this.clock.now(), profile.timeZone);
    const from = addDays(today, -(days - 1));
    const all = await this.weights.list(input.userId, addDays(from, -RUN_UP_DAYS));
    const entries = all.filter((e) => e.date >= from);

    const trend = trendOf(all);
    const history: WeightHistory = { entries };
    if (trend) {
      history.trendKg = trend.trendKg;
      if (trend.weeklyChangeKg !== null) history.weeklyChangeKg = trend.weeklyChangeKg;
    }
    const goal = profile.weightGoal;
    const progress = goal ? progressOf(all, goal) : null;
    if (goal && progress) {
      history.goal = {
        targetKg: goal.targetKg,
        toGoKg: progress.toGoKg,
        plannedWeeklyLossKg: plannedWeeklyLossKg(goal),
        ...(progress.projectedOn ? { projectedOn: progress.projectedOn } : {}),
      };
    }
    return history;
  }
}

export class DeleteWeightUseCase {
  constructor(private readonly weights: IWeightRepository) {}

  async execute(input: { userId: string; date: string }): Promise<void> {
    if (!(await this.weights.delete(input.userId, input.date))) throw new NotFoundError("There's no weigh-in on that day.");
  }
}
