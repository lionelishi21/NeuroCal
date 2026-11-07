import { createHash } from "node:crypto";
import { COACH_MEAL_DAYS, COACH_SLEEP_NIGHTS, COACH_WEIGH_IN_DAYS, type CoachData, type WeightUnit, coachContext } from "../../domain/coach";
import { InvalidError, NotFoundError } from "../../domain/errors";
import { isIsoDate, localDateOf } from "../../domain/localDay";
import { PERIOD_KINDS } from "../../domain/session";
import { addDays } from "../../domain/weight";
import { type WhyReasons, type WhyTopic, caloriesWhy, weightWhy } from "../../domain/why";
import type { IClock } from "../interfaces/IClock";
import type { IWhyCache, IWhyExplainer } from "../interfaces/IWhy";
import type { IFocusScoreRepository, IMealRepository, IProfileRepository, ISessionRepository, ITelemetryRepository, IWeightRepository } from "../interfaces/IRepositories";

const DAY_MS = 86_400_000;

export interface WhyDay {
  date: string;
  weight: WhyReasons | null;
  calories: WhyReasons | null;
}

/**
 * "Why?" under results (domain/why.ts): the rule-based reasons for a day, free, and a fuller
 * explanation on a tap, written once per topic and day and reused until the data behind it changes.
 */
export class WhyUseCases {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly weights: IWeightRepository,
    private readonly meals: IMealRepository,
    private readonly telemetry: ITelemetryRepository,
    private readonly sessions: ISessionRepository,
    private readonly focusScores: IFocusScoreRepository,
    private readonly explainer: IWhyExplainer,
    private readonly cache: IWhyCache,
    private readonly clock: IClock,
  ) {}

  async reasons(userId: string, input: { date?: string; unit: WeightUnit }): Promise<WhyDay> {
    const d = await this.data(userId, input);
    return { date: d.today, weight: weightWhy(d), calories: caloriesWhy(d, d.today) };
  }

  /**
   * The fuller explanation. [spend] takes one from the day's AI allowance; it runs only when a new
   * explanation has to be written, so opening the same one again is free.
   */
  async explain(
    userId: string,
    input: { topic: WhyTopic; date?: string; unit: WeightUnit },
    spend: () => Promise<void>,
  ): Promise<{ explanation: string }> {
    const d = await this.data(userId, input);
    const reasons = input.topic === "weight" ? weightWhy(d) : input.topic === "calories" ? caloriesWhy(d, d.today) : null;
    const context = coachContext(d);
    const hash = createHash("sha256").update(`${input.topic}\n${input.unit}\n${context}`).digest("hex").slice(0, 32);
    const cached = await this.cache.get(userId, input.topic, d.today);
    if (cached?.hash === hash) return { explanation: cached.text };
    await spend();
    const text = await this.explainer.explain({ topic: input.topic, context, reasons });
    await this.cache.put(userId, input.topic, d.today, { hash, text });
    return { explanation: text };
  }

  /** The day's data: the person's own "today" unless [date] names an earlier day. */
  private async data(userId: string, input: { date?: string; unit: WeightUnit }): Promise<CoachData> {
    const profile = await this.profiles.get(userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const tz = profile.timeZone;
    const now = this.clock.now();
    const localToday = localDateOf(now, tz);
    if (input.date !== undefined && (!isIsoDate(input.date) || input.date > localToday)) throw new InvalidError("Pick today or an earlier day.");
    const today = input.date ?? localToday;
    const end = today === localToday ? now : new Date(`${addDays(today, 1)}T12:00:00Z`);
    const days = (n: number) => Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
    const [weights, meals, sleep, sittings, periods, focus] = await Promise.all([
      this.weights.list(userId, addDays(today, -COACH_WEIGH_IN_DAYS + 1)),
      Promise.all(days(COACH_MEAL_DAYS).map(async (date) => ({ date, meals: await this.meals.listForDay(userId, { date, timeZone: tz }) }))),
      Promise.all(days(COACH_SLEEP_NIGHTS).map(async (date) => ({ date, sessions: await this.telemetry.sleepEndingOn(userId, { date, timeZone: tz }) }))),
      this.sessions.listBetween(userId, new Date(end.getTime() - 14 * DAY_MS), end),
      this.sessions.listPeriods(userId, PERIOD_KINDS, new Date(end.getTime() - 60 * DAY_MS), end),
      Promise.all([addDays(today, -1), today].map((date) => this.focusScores.get(userId, date))),
    ]);
    return {
      profile,
      today,
      unit: input.unit,
      weights: weights.filter((w) => w.date <= today),
      meals: meals.map((m) => ({ ...m, meals: [...m.meals].sort((a, b) => a.eatenAt.getTime() - b.eatenAt.getTime()) })),
      sleep,
      sessions: [...sittings.filter((s) => !PERIOD_KINDS.includes(s.kind)), ...periods],
      focus: focus.filter((f) => f !== null),
    };
  }
}
