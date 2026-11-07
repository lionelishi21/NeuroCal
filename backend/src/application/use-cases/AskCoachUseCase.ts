import { COACH_MEAL_DAYS, COACH_SLEEP_NIGHTS, COACH_WEIGH_IN_DAYS, type ChatTurn, MAX_QUESTION_CHARS, MAX_TURNS, MAX_TURN_CHARS, type WeightUnit, coachContext } from "../../domain/coach";
import { InvalidError, NotFoundError } from "../../domain/errors";
import { localDateOf } from "../../domain/localDay";
import { PERIOD_KINDS } from "../../domain/session";
import { addDays } from "../../domain/weight";
import type { IClock } from "../interfaces/IClock";
import type { ICoach } from "../interfaces/ICoach";
import type { IMealRepository, IProfileRepository, ISessionRepository, ITelemetryRepository, IWeightRepository } from "../interfaces/IRepositories";

const DAY_MS = 86_400_000;

/**
 * Ask NeuroCal (domain/coach.ts): gathers the person's recent weigh-ins, meals, sleep and sessions,
 * and has the coach answer the latest question from them.
 */
export class AskCoachUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly weights: IWeightRepository,
    private readonly meals: IMealRepository,
    private readonly telemetry: ITelemetryRepository,
    private readonly sessions: ISessionRepository,
    private readonly coach: ICoach,
    private readonly clock: IClock,
  ) {}

  async execute(userId: string, input: { turns: ChatTurn[]; unit: WeightUnit }): Promise<{ reply: string }> {
    const turns = input.turns.slice(-MAX_TURNS);
    const question = turns.at(-1);
    if (!question || question.role !== "user" || !question.content.trim()) throw new InvalidError("Ask a question.");
    if (question.content.length > MAX_QUESTION_CHARS) throw new InvalidError(`Keep a question under ${MAX_QUESTION_CHARS} characters.`);
    if (turns[0]!.role !== "user") turns.shift();
    const profile = await this.profiles.get(userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const now = this.clock.now();
    const tz = profile.timeZone;
    const today = localDateOf(now, tz);
    const days = (n: number) => Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
    const [weights, meals, sleep, sittings, periods] = await Promise.all([
      this.weights.list(userId, addDays(today, -COACH_WEIGH_IN_DAYS + 1)),
      Promise.all(days(COACH_MEAL_DAYS).map(async (date) => ({ date, meals: await this.meals.listForDay(userId, { date, timeZone: tz }) }))),
      Promise.all(days(COACH_SLEEP_NIGHTS).map(async (date) => ({ date, sessions: await this.telemetry.sleepEndingOn(userId, { date, timeZone: tz }) }))),
      this.sessions.listBetween(userId, new Date(now.getTime() - 14 * DAY_MS), now),
      this.sessions.listPeriods(userId, PERIOD_KINDS, new Date(now.getTime() - 60 * DAY_MS), now),
    ]);
    const context = coachContext({
      profile,
      today,
      unit: input.unit,
      weights,
      meals: meals.map((d) => ({ ...d, meals: [...d.meals].sort((a, b) => a.eatenAt.getTime() - b.eatenAt.getTime()) })),
      sleep,
      sessions: [...sittings.filter((s) => !PERIOD_KINDS.includes(s.kind)), ...periods],
    });
    const reply = await this.coach.reply({ context, turns: turns.map((t) => ({ role: t.role, content: t.content.slice(0, MAX_TURN_CHARS) })) });
    return { reply };
  }
}
