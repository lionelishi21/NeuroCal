import { KIND as COFFEE } from "../../domain/coffee";
import { InvalidError, NotFoundError } from "../../domain/errors";
import { localDateOf, localTimeOf } from "../../domain/localDay";
import {
  ACTIVITIES,
  ACTIVITY,
  type Activity,
  type ActivitySummary,
  MAX_GAME_NAME,
  MAX_GAMES,
  MAX_PERFORMANCE_MINUTES,
  MAX_RATING,
  PATTERN_DAYS,
  type PerformanceSession,
  type SessionContext,
  summaryOf,
} from "../../domain/performance";
import { addDays } from "../../domain/weight";
import type { IClock } from "../interfaces/IClock";
import type { ICoffeeRepository, IFocusScoreRepository, IMealRepository, IPerformanceRepository, IProfileRepository } from "../interfaces/IRepositories";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** Sessions listed as recent. */
const RECENT_DAYS = 14;
/** A cup with at least this much caffeine counts; decaf doesn't. */
const CAFFEINE_MG = 30;
/** A meal of at least this many kcal counts as a meal before; a snack doesn't. */
const MEAL_KCAL = 300;

export interface PerformanceView {
  date: string;
  /** The last two weeks' sessions, newest first. */
  recent: PerformanceSession[];
  /** Each activity done in the last eight weeks, most recently done first. */
  summaries: ActivitySummary[];
}

export type LogPerformanceInput = Omit<PerformanceSession, "id" | "startedAt"> & { startedAt?: Date };

/** Where what came before a session is read from. */
export interface PerformanceSources {
  scores: Pick<IFocusScoreRepository, "listSince">;
  coffee: Pick<ICoffeeRepository, "listBetween">;
  meals: Pick<IMealRepository, "eatenSince">;
}

/** Performance sessions (domain/performance.ts): logged in a few taps, and what goes with the best ones. */
export class PerformanceUseCases {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly sessions: IPerformanceRepository,
    private readonly clock: IClock,
    private readonly sources: PerformanceSources,
  ) {}

  async log(userId: string, input: LogPerformanceInput): Promise<PerformanceView> {
    const p = ACTIVITY[input.activity];
    if (!ACTIVITIES.includes(input.activity)) throw new InvalidError("That activity isn't supported.");
    const whole = (n: number | undefined, min: number, max: number) => n === undefined || (Number.isInteger(n) && n >= min && n <= max);
    if (!whole(input.minutes, 1, MAX_PERFORMANCE_MINUTES)) throw new InvalidError(`Minutes are between 1 and ${MAX_PERFORMANCE_MINUTES}.`);
    if (!whole(input.sharpness, 1, 5)) throw new InvalidError("Sharpness is between 1 and 5.");
    if (input.result !== undefined) {
      if (!p.result) throw new InvalidError(`${p.label} doesn't take a result.`);
      if (!(input.result >= 0 && input.result <= p.result.max)) throw new InvalidError(`${p.result.label} is between 0 and ${p.result.max}.`);
    }
    const gaming = [input.game, input.wins, input.losses, input.ratingBefore, input.ratingAfter].some((x) => x !== undefined);
    if (gaming && input.activity !== "gaming") throw new InvalidError("Games and ratings are for gaming sessions.");
    if (!whole(input.wins, 0, MAX_GAMES) || !whole(input.losses, 0, MAX_GAMES)) throw new InvalidError(`Wins and losses are between 0 and ${MAX_GAMES}.`);
    if (!whole(input.ratingBefore, 0, MAX_RATING) || !whole(input.ratingAfter, 0, MAX_RATING)) throw new InvalidError(`A rating is between 0 and ${MAX_RATING}.`);
    const game = input.game?.trim();
    if (game !== undefined && game.length > MAX_GAME_NAME) throw new InvalidError(`A game's name is at most ${MAX_GAME_NAME} characters.`);

    const profile = await this.profiles.get(userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const now = this.clock.now();
    // Logged once it's over: it started its length ago unless the time is given.
    const startedAt = input.startedAt ?? new Date(now.getTime() - input.minutes * MINUTE_MS);
    if (startedAt.getTime() > now.getTime() + 5 * MINUTE_MS) throw new InvalidError("That session is in the future.");
    if (now.getTime() - startedAt.getTime() > 48 * HOUR_MS) throw new InvalidError("Log a session from the last two days.");
    const { startedAt: _, game: __, ...rest } = input;
    await this.sessions.add(userId, { ...rest, startedAt, ...(game ? { game } : {}) });
    return this.view(userId);
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.sessions.delete(userId, id))) throw new NotFoundError("No such session.");
  }

  async view(userId: string): Promise<PerformanceView> {
    const profile = await this.profiles.get(userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const tz = profile.timeZone;
    const now = this.clock.now();
    const today = localDateOf(now, tz);
    const since = addDays(today, -PATTERN_DAYS);
    const from = new Date(Date.parse(`${since}T00:00:00Z`) - 26 * HOUR_MS);
    const all = (await this.sessions.listBetween(userId, from, new Date(now.getTime() + 26 * HOUR_MS))).filter((s) => localDateOf(s.startedAt, tz) > since);
    const recentFrom = addDays(today, -RECENT_DAYS);
    const recent = all.filter((s) => localDateOf(s.startedAt, tz) > recentFrom).reverse();
    if (!all.length) return { date: today, recent, summaries: [] };

    // What came before each session.
    const before = new Date(from.getTime() - 2 * HOUR_MS);
    const [scores, cups, meals] = await Promise.all([
      this.sources.scores.listSince(userId, since),
      this.sources.coffee.listBetween(userId, before, now),
      this.sources.meals.eatenSince(userId, before, MEAL_KCAL),
    ]);
    const sleep = new Map(scores.map((s) => [s.date, s.components.sleep]));
    const caffeine = cups.filter((c) => COFFEE[c.kind].caffeineMg >= CAFFEINE_MG).map((c) => c.takenAt.getTime());
    const eaten = meals.map((m) => m.getTime());
    const contextOf = (s: PerformanceSession): SessionContext => {
      const start = s.startedAt.getTime();
      return {
        sleep: sleep.get(localDateOf(s.startedAt, tz)) ?? null,
        caffeineBefore: caffeine.some((t) => t >= start - 2 * HOUR_MS && t <= start - 15 * MINUTE_MS),
        mealBefore: eaten.some((t) => t >= start - 2 * HOUR_MS && t < start),
        hour: localTimeOf(s.startedAt, tz).hour,
      };
    };

    const lastDone = (a: Activity) => Math.max(...all.filter((s) => s.activity === a).map((s) => s.startedAt.getTime()));
    const summaries = ACTIVITIES.filter((a) => all.some((s) => s.activity === a))
      .sort((a, b) => lastDone(b) - lastDone(a))
      .map((a) =>
        summaryOf(
          a,
          all.filter((s) => s.activity === a).map((session) => ({ session, context: contextOf(session) })),
        ),
      );
    return { date: today, recent, summaries };
  }
}
