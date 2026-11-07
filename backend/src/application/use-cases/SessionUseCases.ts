import { InvalidError, NotFoundError } from "../../domain/errors";
import { type Experiment, type Measure, measureFor } from "../../domain/experiment";
import { localDateOf } from "../../domain/localDay";
import {
  COMPARE_DAYS,
  MAX_PERIOD_BACK_DAYS,
  MAX_PERIOD_DAYS,
  MAX_SESSION_MINUTES,
  PERIOD_COMPARE_DAYS,
  PERIOD_KINDS,
  SESSION_KIND,
  SESSION_KINDS,
  type Session,
  type SessionKind,
  isPeriod,
  periodDays,
  sessionExperimentOf,
} from "../../domain/session";
import { addDays } from "../../domain/weight";
import type { IClock } from "../interfaces/IClock";
import type { IProfileRepository, ISessionRepository } from "../interfaces/IRepositories";
import type { ExperimentSources } from "./StackUseCases";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** Far enough ahead to stand for "no end". */
const NEVER = new Date(8.64e15);

/** A kind someone has used lately: what to expect, and the days after it against the days without. */
export interface SessionInsight {
  kind: SessionKind;
  /** Sessions logged; for a period, the days it ran. */
  sessions: number;
  lastAt: Date;
  experiment: Experiment;
}

export interface SessionDay {
  date: string;
  /** Today's sessions, oldest first. */
  sessions: Session[];
  /** Periods running now or set to start later, oldest first. */
  running: Session[];
  /** Each kind used in the last eight weeks (a period: the last 120 days), most recent first. */
  insights: SessionInsight[];
}

/** Gadget and practice sessions (domain/session.ts): logged in a tap, each tested against days without. */
export class SessionUseCases {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly sessions: ISessionRepository,
    private readonly clock: IClock,
    private readonly sources?: ExperimentSources,
  ) {}

  async log(userId: string, input: { kind: SessionKind; minutes?: number; takenAt?: Date; endsAt?: Date | null }): Promise<SessionDay> {
    if (!SESSION_KINDS.includes(input.kind)) throw new InvalidError("That kind of session isn't supported.");
    const profile = await this.profiles.get(userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    if (isPeriod(input.kind)) return this.start(userId, input);
    if (input.endsAt !== undefined) throw new InvalidError(`A ${SESSION_KIND[input.kind].label.toLowerCase()} session is logged in minutes, not with an end date.`);
    if (input.minutes !== undefined && (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > MAX_SESSION_MINUTES)) {
      throw new InvalidError(`Minutes are between 1 and ${MAX_SESSION_MINUTES}.`);
    }
    const now = this.clock.now();
    const takenAt = input.takenAt ?? now;
    if (takenAt.getTime() > now.getTime() + 5 * 60_000) throw new InvalidError("That session is in the future.");
    if (now.getTime() - takenAt.getTime() > 48 * HOUR_MS) throw new InvalidError("Log a session from the last two days.");
    await this.sessions.add(userId, { kind: input.kind, takenAt, ...(input.minutes ? { minutes: input.minutes } : {}) });
    return this.day(userId);
  }

  /** A period: from takenAt (now when left out) to endsAt, or running until stopped when endsAt is null or left out. */
  private async start(userId: string, input: { kind: SessionKind; minutes?: number; takenAt?: Date; endsAt?: Date | null }): Promise<SessionDay> {
    const label = SESSION_KIND[input.kind].label;
    if (input.minutes !== undefined) throw new InvalidError(`${label} runs for days, so it takes start and end dates rather than minutes.`);
    const now = this.clock.now();
    const startsAt = input.takenAt ?? now;
    const endsAt = input.endsAt ?? null;
    if (startsAt.getTime() > now.getTime() + 31 * DAY_MS) throw new InvalidError("Start it within the next month.");
    if (now.getTime() - startsAt.getTime() > MAX_PERIOD_BACK_DAYS * DAY_MS) throw new InvalidError("Start it within the last year.");
    if (endsAt && endsAt.getTime() <= startsAt.getTime()) throw new InvalidError("The end is before the start.");
    if (endsAt && endsAt.getTime() - startsAt.getTime() > MAX_PERIOD_DAYS * DAY_MS) throw new InvalidError("Set it to run for a year at most, or until you stop it.");
    if ((await this.sessions.listPeriods(userId, [input.kind], startsAt, endsAt ?? NEVER)).length) {
      throw new InvalidError(`Those dates overlap ${label} you've already added. Change or remove that one first.`);
    }
    await this.sessions.add(userId, { kind: input.kind, takenAt: startsAt, endsAt });
    return this.day(userId);
  }

  /** Stops a period: it ends at [at] (now when left out). */
  async end(userId: string, id: string, at?: Date): Promise<SessionDay> {
    const endsAt = at ?? this.clock.now();
    const found = (await this.sessions.listPeriods(userId, PERIOD_KINDS, new Date(0), NEVER)).find((s) => s.id === id);
    if (!found) throw new NotFoundError("No such session.");
    if (endsAt.getTime() <= found.takenAt.getTime()) throw new InvalidError("The end is before the start.");
    if (endsAt.getTime() - found.takenAt.getTime() > MAX_PERIOD_DAYS * DAY_MS) throw new InvalidError("Set it to run for a year at most, or until you stop it.");
    await this.sessions.setEnd(userId, id, endsAt);
    return this.day(userId);
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.sessions.delete(userId, id))) throw new NotFoundError("No such session.");
  }

  async day(userId: string): Promise<SessionDay> {
    const profile = await this.profiles.get(userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const now = this.clock.now();
    const today = localDateOf(now, profile.timeZone);
    const since = addDays(today, -COMPARE_DAYS);
    const periodSince = addDays(today, -PERIOD_COMPARE_DAYS);
    const end = new Date(now.getTime() + 26 * HOUR_MS);
    const [all, periods] = await Promise.all([
      this.sessions.listBetween(userId, new Date(Date.parse(`${since}T00:00:00Z`) - 26 * HOUR_MS), end),
      this.sessions.listPeriods(userId, PERIOD_KINDS, new Date(Date.parse(`${periodSince}T00:00:00Z`) - 26 * HOUR_MS), NEVER),
    ]);
    const sittings = all.filter((s) => !isPeriod(s.kind));
    const started = periods.filter((p) => p.takenAt <= now);
    const dayOf = (d: Date) => localDateOf(d, profile.timeZone);
    const used = [...new Set([...sittings.map((s) => s.kind), ...started.map((p) => p.kind)])];
    const series = used.length ? await this.series(profile.userId, profile.timeZone, periodSince) : null;
    const insights = used
      .map((kind): SessionInsight => {
        const measure = measureFor(SESSION_KIND[kind].purpose)!;
        if (isPeriod(kind)) {
          const mine = started.filter((p) => p.kind === kind);
          const days = [...new Set(mine.flatMap((p) => periodDays(p, today, dayOf)))].filter((d) => d > periodSince);
          const last = mine.at(-1)!;
          return {
            kind,
            sessions: days.length,
            lastAt: last.endsAt && last.endsAt < now ? last.endsAt : now,
            experiment: sessionExperimentOf({ kind, sessionDays: days, series: series?.[measure] ?? new Map(), today }),
          };
        }
        const mine = sittings.filter((s) => s.kind === kind);
        return {
          kind,
          sessions: mine.length,
          lastAt: mine.at(-1)!.takenAt,
          experiment: sessionExperimentOf({ kind, sessionDays: mine.map((s) => dayOf(s.takenAt)), series: series?.[measure] ?? new Map(), today }),
        };
      })
      .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
    return {
      date: today,
      sessions: sittings.filter((s) => dayOf(s.takenAt) === today),
      running: periods.filter((p) => !p.endsAt || p.endsAt > now),
      insights,
    };
  }

  /** The three measures by local date, from stored Focus Scores and Brain speed checks. */
  private async series(userId: string, timeZone: string, since: string): Promise<Record<Measure, Map<string, number>>> {
    const out: Record<Measure, Map<string, number>> = { brain_speed: new Map(), sleep: new Map(), stress: new Map() };
    if (!this.sources) return out;
    const [scores, checks] = await Promise.all([
      this.sources.scores.listSince(userId, since),
      this.sources.brainChecks?.listSince(userId, new Date(`${addDays(since, -1)}T00:00:00Z`)) ?? Promise.resolve([]),
    ]);
    for (const c of checks) {
      const day = localDateOf(c.takenAt, timeZone);
      if (!out.brain_speed.has(day)) out.brain_speed.set(day, c.score);
    }
    for (const s of scores) {
      if (s.components.sleep !== null) out.sleep.set(s.date, s.components.sleep * 100);
      if (s.components.stress !== null) out.stress.set(s.date, s.components.stress * 100);
    }
    return out;
  }
}
