import { InvalidError, NotFoundError } from "../../domain/errors";
import {
  FOCUS_MODEL_VERSION,
  computeFocusComponents,
  fallbackExplanation,
  focusScoreFrom,
  type FocusInputs,
} from "../../domain/focusScore";
import { isIsoDate, localDateOf, previousDate } from "../../domain/localDay";
import type { FocusComponents, FocusScore, Profile } from "../../domain/types";
import type { IClock } from "../interfaces/IClock";
import type { IFocusExplainer } from "../interfaces/IFocusExplainer";
import type {
  ICheckInRepository,
  IFocusScoreRepository,
  IMealRepository,
  IProfileRepository,
  ITelemetryRepository,
} from "../interfaces/IRepositories";

/**
 * ARCHITECTURE §6.8. Computed on read and stored; the AI explanation is only
 * requested when the score or its inputs changed. If the explainer fails, a
 * plain fallback is used: the explanation is never worth failing the request.
 */
export class GetFocusScoreUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly meals: IMealRepository,
    private readonly checkIns: ICheckInRepository,
    private readonly telemetry: ITelemetryRepository,
    private readonly scores: IFocusScoreRepository,
    private readonly explainer: IFocusExplainer,
    private readonly clock: IClock,
  ) {}

  async execute(input: { userId: string; date?: string }): Promise<FocusScore> {
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    if (input.date !== undefined && !isIsoDate(input.date)) throw new InvalidError("Use a date like 2026-09-29.");

    const { userId } = profile;
    const date = input.date ?? localDateOf(this.clock.now(), profile.timeZone);
    const [inputs, stored] = await Promise.all([
      loadFocusInputs({ meals: this.meals, checkIns: this.checkIns, telemetry: this.telemetry }, profile, date),
      this.scores.get(userId, date),
    ]);

    const components = computeFocusComponents(inputs);
    const score = focusScoreFrom(components);

    if (stored && stored.score === score && sameComponents(stored.components, components)) return stored;

    const result: FocusScore = {
      userId,
      date,
      score,
      components,
      explanation: await this.explain(score, components),
      modelVersion: FOCUS_MODEL_VERSION,
    };
    await this.scores.put(result);
    return result;
  }

  private async explain(score: number | null, components: FocusComponents): Promise<string> {
    if (score === null) return fallbackExplanation(score, components);
    try {
      return await this.explainer.explain({ score, components });
    } catch {
      return fallbackExplanation(score, components);
    }
  }
}

const sameComponents = (a: FocusComponents, b: FocusComponents) =>
  a.sleep === b.sleep && a.timing === b.timing && a.glycemic === b.glycemic && a.stress === b.stress;

/** Everything the Focus Score for `date` reads (ARCHITECTURE §6.8). Shared with GetHistoryUseCase. */
export async function loadFocusInputs(
  repos: { meals: IMealRepository; checkIns: ICheckInRepository; telemetry: ITelemetryRepository },
  profile: Profile,
  date: string,
): Promise<FocusInputs> {
  const { userId, timeZone } = profile;
  const yesterday = previousDate(date);
  const [sleep, previousDayMeals, screenTime, checkInsYesterday, checkInsToday] = await Promise.all([
    repos.telemetry.sleepEndingOn(userId, { date, timeZone }),
    repos.meals.listForDay(userId, { date: yesterday, timeZone }),
    repos.telemetry.screenTimeStartingOn(userId, [yesterday, date], timeZone),
    repos.checkIns.listForDay(userId, { date: yesterday, timeZone }),
    repos.checkIns.listForDay(userId, { date, timeZone }),
  ]);
  return { date, timeZone, sleep, previousDayMeals, screenTime, checkIns: [...checkInsYesterday, ...checkInsToday] };
}
