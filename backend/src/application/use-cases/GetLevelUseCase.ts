import { NotFoundError } from "../../domain/errors";
import { processingOf } from "../../domain/bioState";
import { baselineOf, levelChangeOf } from "../../domain/brainCheck";
import { computeFocusComponents, keptFast } from "../../domain/focusScore";
import { LEVEL_WINDOW_DAYS, type LevelDay, type LevelResult, levelOf } from "../../domain/levels";
import { localDateOf } from "../../domain/localDay";
import { addDays } from "../../domain/weight";
import type { IBrainCheckRepository } from "../interfaces/IBrainCheckRepository";
import type { IClock } from "../interfaces/IClock";
import type { IExerciseRepository } from "../interfaces/IExerciseRepository";
import type { ICheckInRepository, IMealRepository, IProfileRepository, ITelemetryRepository } from "../interfaces/IRepositories";
import { type EnvironmentInputs, loadFocusInputs } from "./GetFocusScoreUseCase";

const DAY_MS = 86_400_000;

/** The biohacking level (docs/NCBM.md §8) from the last 28 days, read the same way as the Focus Score. */
export class GetLevelUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly meals: IMealRepository,
    private readonly checkIns: ICheckInRepository,
    private readonly telemetry: ITelemetryRepository,
    private readonly exercises: IExerciseRepository,
    private readonly brainChecks: IBrainCheckRepository,
    private readonly clock: IClock,
    private readonly environment?: EnvironmentInputs,
  ) {}

  async execute(input: { userId: string }): Promise<LevelResult> {
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const now = this.clock.now();
    const today = localDateOf(now, profile.timeZone);
    const repos = { meals: this.meals, checkIns: this.checkIns, telemetry: this.telemetry, exercises: this.exercises, environment: this.environment };
    const dates = Array.from({ length: LEVEL_WINDOW_DAYS }, (_, i) => addDays(today, i - LEVEL_WINDOW_DAYS + 1));
    const proteinTarget = profile.macroTargets.proteinG;

    const days = await Promise.all(
      dates.map(async (date): Promise<LevelDay> => {
        const inputs = await loadFocusInputs(repos, profile, date);
        const c = computeFocusComponents(inputs);
        // The food of the day before `date`, as the Focus Score reads it.
        const items = inputs.previousDayMeals.flatMap((m) => m.items);
        const p = processingOf(items);
        const protein = items.reduce((s, i) => s + i.macros.proteinG, 0);
        return {
          foodLogged: items.length > 0,
          sleepLogged: inputs.sleep.length > 0,
          ultraKcal: p.ultraProcessedKcal,
          gradedKcal: p.wholeKcal + p.processedKcal + p.ultraProcessedKcal,
          proteinRatio: items.length > 0 && proteinTarget > 0 ? protein / proteinTarget : null,
          timing: c.timing,
          sleep: c.sleep,
          stress: c.stress,
          movement: c.movement,
          environment: c.environment ?? null,
          keptFast: inputs.fastHours && inputs.previousDayMeals.length && inputs.todayMeals?.length ? keptFast(inputs) : null,
        };
      }),
    );

    // Eight weeks and a bit: enough for the usual and for a lasting change in it.
    const checks = await this.brainChecks.listSince(input.userId, new Date(now.getTime() - 60 * DAY_MS));
    const weekAgo = now.getTime() - 7 * DAY_MS;
    const recent = checks.filter((c) => c.takenAt.getTime() >= weekAgo).map((c) => c.score);
    const earlier = checks.filter((c) => c.takenAt.getTime() < weekAgo).map((c) => c.score);
    const sorted = [...recent].sort((a, b) => a - b);
    const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2]! : Math.round((sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2)) : null;
    const change = levelChangeOf(checks, now);
    return levelOf(days, {
      recent: median,
      usual: baselineOf(earlier),
      ...(change?.direction === "up" ? { raised: { from: change.from, to: change.to } } : {}),
    });
  }
}
