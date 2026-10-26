import { InvalidError, NotFoundError } from "../../domain/errors";
import { type Experiment, type Measure, measureFor } from "../../domain/experiment";
import { localDateOf } from "../../domain/localDay";
import { COMPARE_DAYS, MAX_SESSION_MINUTES, SESSION_KIND, SESSION_KINDS, type Session, type SessionKind, sessionExperimentOf } from "../../domain/session";
import { addDays } from "../../domain/weight";
import type { IClock } from "../interfaces/IClock";
import type { IProfileRepository, ISessionRepository } from "../interfaces/IRepositories";
import type { ExperimentSources } from "./StackUseCases";

const HOUR_MS = 3_600_000;

/** A kind someone has used lately: what to expect, and the days after it against the days without. */
export interface SessionInsight {
  kind: SessionKind;
  sessions: number;
  lastAt: Date;
  experiment: Experiment;
}

export interface SessionDay {
  date: string;
  /** Today's sessions, oldest first. */
  sessions: Session[];
  /** Each kind used in the last eight weeks, most recent first. */
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

  async log(userId: string, input: { kind: SessionKind; minutes?: number; takenAt?: Date }): Promise<SessionDay> {
    if (!SESSION_KINDS.includes(input.kind)) throw new InvalidError("That kind of session isn't supported.");
    if (input.minutes !== undefined && (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > MAX_SESSION_MINUTES)) {
      throw new InvalidError(`Minutes are between 1 and ${MAX_SESSION_MINUTES}.`);
    }
    const profile = await this.profiles.get(userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const now = this.clock.now();
    const takenAt = input.takenAt ?? now;
    if (takenAt.getTime() > now.getTime() + 5 * 60_000) throw new InvalidError("That session is in the future.");
    if (now.getTime() - takenAt.getTime() > 48 * HOUR_MS) throw new InvalidError("Log a session from the last two days.");
    await this.sessions.add(userId, { kind: input.kind, takenAt, ...(input.minutes ? { minutes: input.minutes } : {}) });
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
    const all = await this.sessions.listBetween(userId, new Date(Date.parse(`${since}T00:00:00Z`) - 26 * HOUR_MS), new Date(now.getTime() + 26 * HOUR_MS));
    const dayOf = (s: Session) => localDateOf(s.takenAt, profile.timeZone);
    const used = [...new Set(all.map((s) => s.kind))];
    const series = used.length ? await this.series(profile.userId, profile.timeZone, since) : null;
    const insights = used
      .map((kind) => {
        const mine = all.filter((s) => s.kind === kind);
        const measure = measureFor(SESSION_KIND[kind].purpose)!;
        return {
          kind,
          sessions: mine.length,
          lastAt: mine.at(-1)!.takenAt,
          experiment: sessionExperimentOf({ kind, sessionDays: mine.map(dayOf), series: series?.[measure] ?? new Map(), today }),
        };
      })
      .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
    return { date: today, sessions: all.filter((s) => dayOf(s) === today), insights };
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
