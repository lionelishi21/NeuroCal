import { afterCurfew, cupNutrition, wakeHourOf } from "../../domain/coffee";
import { glucoseComponent } from "../../domain/glucose";
import type { IGlucoseRepository } from "../interfaces/IGlucose";
import { conditionsOf, glycemicWeightFor } from "../../domain/conditions";
import { InvalidError, NotFoundError } from "../../domain/errors";
import { FAST_HOURS, fastingProtocolOf } from "../../domain/fasting";
import {
  FOCUS_MODEL_VERSION,
  computeFocusComponents,
  fallbackExplanation,
  focusScoreFrom,
  measuredFocus,
  personalWeights,
  withMeasured,
  type MeasuredFocus,
  withWeight,
  type FocusInputs,
  type FocusWeights,
} from "../../domain/focusScore";
import { addDays } from "../../domain/weight";
import { localTimeOf, isIsoDate, localDateOf, previousDate } from "../../domain/localDay";
import type { IBrainCheckRepository } from "../interfaces/IBrainCheckRepository";
import type { IExerciseRepository } from "../interfaces/IExerciseRepository";
import type { EnvironmentCheck } from "../../domain/environment";

/** Reads a day's air and environment check for the score (EnvironmentUseCases). */
export interface EnvironmentInputs {
  inputsFor(userId: string, date: string, timeZone: string): Promise<{ aqi: number | null; check: EnvironmentCheck | null }>;
}
import type { FocusComponents, FocusScore, Profile } from "../../domain/types";
import type { IClock } from "../interfaces/IClock";
import type { IFocusExplainer } from "../interfaces/IFocusExplainer";
import type { ICoffeeRepository,
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
    private readonly exercises?: IExerciseRepository,
    private readonly brainChecks?: IBrainCheckRepository,
    private readonly environment?: EnvironmentInputs,
    private readonly glucose?: IGlucoseRepository,
    private readonly coffee?: ICoffeeRepository,
  ) {}

  async execute(input: { userId: string; date?: string }): Promise<FocusScore> {
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    if (input.date !== undefined && !isIsoDate(input.date)) throw new InvalidError("Use a date like 2026-09-29.");

    const { userId } = profile;
    const date = input.date ?? localDateOf(this.clock.now(), profile.timeZone);
    const [inputs, stored, tuning, measured] = await Promise.all([
      loadFocusInputs(
        { meals: this.meals, checkIns: this.checkIns, telemetry: this.telemetry, exercises: this.exercises, environment: this.environment, glucose: this.glucose, coffee: this.coffee },
        profile,
        date,
      ),
      this.scores.get(userId, date),
      this.weightsFor(profile, date),
      this.measuredFor(profile, date),
    ]);

    const components = computeFocusComponents(inputs);
    const foundation = focusScoreFrom(components, tuning.weights);
    // The measured layer moves a score that exists; it doesn't make one on its own.
    const score = foundation !== null && measured ? withMeasured(foundation, measured) : foundation;
    const tuned = {
      ...(tuning.tuned ? { tuned: true } : {}),
      ...(inputs.previousDayGlucose !== undefined ? { glycemicFromSensor: true } : {}),
      ...(foundation !== null && measured ? { foundation, measured } : {}),
    };

    if (stored && stored.score === score && sameComponents(stored.components, components)) return { ...stored, ...tuned };

    const result: FocusScore = {
      userId,
      date,
      score,
      components,
      explanation: await this.explain(score, components),
      modelVersion: FOCUS_MODEL_VERSION,
    };
    await this.scores.put(result);
    return { ...result, ...tuned };
  }

  /**
   * NCBM §3.2: the weights tuned to this person from the last 8 weeks of stored scores and the Brain
   * speed checks taken on the same days (the day's latest check). Standard weights until there are enough.
   */
  private async weightsFor(profile: Profile, date: string): Promise<{ weights: FocusWeights; tuned: boolean }> {
    const found = await this.personalWeightsFor(profile, date);
    // Diabetes: blood sugar counts for more, until the person's own Brain speed data says otherwise.
    const glycemic = glycemicWeightFor(conditionsOf(profile));
    return found.tuned || glycemic === null ? found : { weights: withWeight(found.weights, "glycemic", glycemic), tuned: false };
  }

  /** The day's latest Brain speed check against the checks before that day, or null without one. */
  private async measuredFor(profile: Profile, date: string): Promise<MeasuredFocus | null> {
    if (!this.brainChecks) return null;
    const checks = await this.brainChecks.listSince(profile.userId, new Date(`${addDays(date, -57)}T00:00:00Z`));
    const dayOf = (c: { takenAt: Date }) => localDateOf(c.takenAt, profile.timeZone);
    // Newest first: the first check on the day is its latest.
    const today = checks.find((c) => dayOf(c) === date);
    if (!today) return null;
    return measuredFocus(
      today.score,
      checks.filter((c) => dayOf(c) < date).map((c) => c.score),
    );
  }

  private async personalWeightsFor(profile: Profile, date: string): Promise<{ weights: FocusWeights; tuned: boolean }> {
    if (!this.brainChecks) return personalWeights([]);
    const since = addDays(date, -56);
    const [scores, checks] = await Promise.all([
      this.scores.listSince(profile.userId, since),
      this.brainChecks.listSince(profile.userId, new Date(`${since}T00:00:00Z`)),
    ]);
    const brainByDay = new Map<string, number>();
    // Newest first: the first check seen for a day is its latest.
    for (const c of checks) {
      const day = localDateOf(c.takenAt, profile.timeZone);
      if (!brainByDay.has(day)) brainByDay.set(day, c.score);
    }
    const days = scores
      .filter((s) => s.date < date && brainByDay.has(s.date))
      .map((s) => ({ components: s.components, brainScore: brainByDay.get(s.date)! }));
    return personalWeights(days);
  }

  private async explain(score: number | null, components: FocusComponents): Promise<string> {
    // Without sleep the AI would explain an incomplete score as if it were the whole day.
    if (score === null || components.sleep === null) return fallbackExplanation(score, components);
    try {
      return await this.explainer.explain({ score, components });
    } catch {
      return fallbackExplanation(score, components);
    }
  }
}

const sameComponents = (a: FocusComponents, b: FocusComponents) =>
  a.sleep === b.sleep && a.timing === b.timing && a.glycemic === b.glycemic && a.stress === b.stress && (a.movement ?? null) === (b.movement ?? null) && (a.environment ?? null) === (b.environment ?? null);

/** Everything the Focus Score for `date` reads (ARCHITECTURE §6.8). Shared with GetHistoryUseCase. */
export async function loadFocusInputs(
  repos: {
    meals: IMealRepository;
    checkIns: ICheckInRepository;
    telemetry: ITelemetryRepository;
    exercises?: IExerciseRepository | undefined;
    /** Yesterday's air and environment check (EnvironmentUseCases.inputsFor). */
    environment?: EnvironmentInputs | undefined;
    /** Glucose-sensor days, when the person has a sensor. */
    glucose?: IGlucoseRepository | undefined;
    coffee?: ICoffeeRepository | undefined;
  },
  profile: Profile,
  date: string,
): Promise<FocusInputs> {
  const { userId, timeZone } = profile;
  const yesterday = previousDate(date);
  const protocol = fastingProtocolOf(profile);
  const noon = Date.parse(`${date}T12:00:00Z`);
  const [sleep, previousDayMeals, screenTime, checkInsYesterday, checkInsToday, todayMeals, exercise, environment, glucose] = await Promise.all([
    repos.telemetry.sleepEndingOn(userId, { date, timeZone }),
    repos.meals.listForDay(userId, { date: yesterday, timeZone }),
    repos.telemetry.screenTimeStartingOn(userId, [yesterday, date], timeZone),
    repos.checkIns.listForDay(userId, { date: yesterday, timeZone }),
    repos.checkIns.listForDay(userId, { date, timeZone }),
    protocol === "none" ? Promise.resolve([]) : repos.meals.listForDay(userId, { date, timeZone }),
    // The week before D, wide enough for any time zone; split into "yesterday" and "lately" below.
    repos.exercises?.listBetween(userId, new Date(noon - 8 * 86_400_000), new Date(noon - 86_400_000 / 2)) ?? Promise.resolve([]),
    repos.environment?.inputsFor(userId, yesterday, timeZone) ?? Promise.resolve(undefined),
    repos.glucose?.listBetween(userId, yesterday, yesterday) ?? Promise.resolve([]),
  ]);
  // Yesterday's cups, from a window wide enough for any time zone.
  const yesterdayNoon = noon - 86_400_000;
  const cups = repos.coffee
    ? (await repos.coffee.listBetween(userId, new Date(yesterdayNoon - 26 * 3_600_000), new Date(yesterdayNoon + 26 * 3_600_000))).filter(
        (c) => localDateOf(c.takenAt, timeZone) === yesterday,
      )
    : [];
  const wake = wakeHourOf(profile.bioProfile);
  const lateCaffeineMg = cups.filter((c) => afterCurfew(localTimeOf(c.takenAt, timeZone), wake)).reduce((s, c) => s + cupNutrition(c).caffeineMg, 0);
  const sensorDay = glucose[0];
  const diabetic = conditionsOf(profile).some((c) => c === "type1_diabetes" || c === "type2_diabetes");
  const lastWeek = exercise.filter((e) => {
    const day = localDateOf(e.startedAt, timeZone);
    return day < date && day >= addDays(date, -7);
  });
  return {
    date,
    timeZone,
    sleep,
    previousDayMeals,
    screenTime,
    checkIns: [...checkInsYesterday, ...checkInsToday],
    previousDayExercise: lastWeek.filter((e) => localDateOf(e.startedAt, timeZone) === yesterday),
    logsExercise: lastWeek.length > 0,
    ...(protocol === "none" ? {} : { fastHours: FAST_HOURS[protocol], todayMeals }),
    ...(environment ? { environment } : {}),
    ...(sensorDay ? { previousDayGlucose: glucoseComponent(sensorDay, diabetic) } : {}),
    ...(cups.length ? { previousDayLateCaffeineMg: lateCaffeineMg } : {}),
  };
}
