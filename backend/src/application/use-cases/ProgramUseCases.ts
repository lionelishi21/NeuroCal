import { InvalidError, NotFoundError } from "../../domain/errors";
import { localDateOf, localTimeOf } from "../../domain/localDay";
import {
  type Checkpoint,
  ENERGY_AREAS,
  FINISHED_SHOWN_DAYS,
  PROGRAM_DAYS,
  type Phase,
  type ProgramDayFacts,
  type EnergyBand,
  autoDone,
  checkDue,
  dateOfDay,
  dayOf,
  energyBand,
  isFullDay,
  phaseOf,
  rulesFor,
  tipFor,
} from "../../domain/program";
import type { IClock } from "../interfaces/IClock";
import type { IProgramRepository, ProgramState } from "../interfaces/IGuides";
import type { IFocusScoreRepository, IProfileRepository } from "../interfaces/IRepositories";
import type { Access, GuideUseCases } from "./GuideUseCases";

export interface ProgramView {
  guideId: string;
  title: string;
  startedOn: string;
  date: string;
  day: number;
  days: number;
  phase: Phase;
  rules: { id: string; label: string; detail: string; done: boolean; auto: boolean }[];
  tip: { title: string; detail: string };
  checkDue: Checkpoint | null;
  checks: { checkpoint: Checkpoint; date: string; answers: number[]; total: number; band: EnergyBand }[];
  fullDays: number;
  focusScore: { firstWeek: number | null; lastWeek: number | null };
}

/** What's logged on one local day, from the use cases that log it (presentation/compose.ts). */
export type ProgramFacts = (userId: string, date: string, timeZone: string) => Promise<ProgramDayFacts>;

/**
 * A guide's day-by-day program (docs/NCBM.md §11, domain/program.ts): today's habits, ticked from
 * what's logged where NeuroCal can see it and by hand otherwise, the day's tip, and the energy
 * check on days 1, 15 and 30. Each look records what was done that day, for counting full days.
 */
export class ProgramUseCases {
  constructor(
    private readonly programs: IProgramRepository,
    private readonly guides: GuideUseCases,
    private readonly profiles: IProfileRepository,
    private readonly clock: IClock,
    private readonly facts: ProgramFacts,
    private readonly scores: IFocusScoreRepository,
  ) {}

  /** Null with no program, or a week after one finished. */
  async get(userId: string): Promise<ProgramView | null> {
    const state = await this.programs.get(userId);
    if (!state) return null;
    const { today, timeZone } = await this.today(userId);
    const day = dayOf(state.startedOn, today);
    if (day > PROGRAM_DAYS + FINISHED_SHOWN_DAYS) return null;
    return this.view(userId, state, today, timeZone);
  }

  /** Starts today, replacing any program already running. */
  async start(userId: string, guideId: string, access: Access): Promise<ProgramView> {
    const guide = await this.guides.get(guideId, access);
    if (!guide.program) throw new InvalidError("That guide has no program to start.");
    const { today, timeZone } = await this.today(userId);
    const state: ProgramState = { guideId, startedOn: today, days: {}, checks: [] };
    await this.programs.save(userId, state);
    return this.view(userId, state, today, timeZone);
  }

  async stop(userId: string): Promise<void> {
    await this.programs.delete(userId);
  }

  /** Ticks or unticks one of today's habits by hand; one ticked from what's logged stays ticked. */
  async tick(userId: string, ruleId: string, done: boolean): Promise<ProgramView> {
    const { state, today, timeZone } = await this.running(userId);
    const day = dayOf(state.startedOn, today);
    const rule = rulesFor(day).find((r) => r.id === ruleId);
    if (!rule) throw new InvalidError("That isn't one of today's habits.");
    const entry = state.days[today] ?? { ticked: [], done: [] };
    const ticked = entry.ticked.filter((id) => id !== ruleId);
    state.days[today] = { ...entry, ticked: done ? [...ticked, ruleId] : ticked };
    await this.programs.save(userId, state);
    return this.view(userId, state, today, timeZone);
  }

  /** The energy check due now: five answers, 0 (best) to 4. */
  async check(userId: string, answers: number[]): Promise<ProgramView> {
    if (answers.length !== ENERGY_AREAS.length || answers.some((a) => !Number.isInteger(a) || a < 0 || a > 4)) {
      throw new InvalidError("Answer each of the five areas with 0 to 4.");
    }
    const { state, today, timeZone } = await this.running(userId);
    const due = checkDue(dayOf(state.startedOn, today), state.checks.map((c) => c.checkpoint));
    if (!due) throw new InvalidError("No energy check is due today.");
    state.checks.push({ checkpoint: due, date: today, answers });
    await this.programs.save(userId, state);
    return this.view(userId, state, today, timeZone);
  }

  private async running(userId: string) {
    const state = await this.programs.get(userId);
    if (!state) throw new NotFoundError("No program is running.");
    return { state, ...(await this.today(userId)) };
  }

  private async today(userId: string) {
    const profile = await this.profiles.get(userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    return { today: localDateOf(this.clock.now(), profile.timeZone), timeZone: profile.timeZone };
  }

  private async view(userId: string, state: ProgramState, today: string, timeZone: string): Promise<ProgramView> {
    const day = dayOf(state.startedOn, today);
    const guide = await this.guides.get(state.guideId, { isAdmin: true }).catch(() => null);
    const now = localTimeOf(this.clock.now(), timeZone);
    const facts = day <= PROGRAM_DAYS ? await this.facts(userId, today, timeZone) : null;
    const entry = state.days[today] ?? { ticked: [], done: [] };
    const rules = rulesFor(day).map((r) => {
      const auto = !!facts && !!r.auto && autoDone(r.auto, facts, now.hour * 60 + now.minute);
      return { id: r.id, label: r.label, detail: r.detail, done: auto || entry.ticked.includes(r.id), auto };
    });

    // Remember what was done today, so full days can be counted later without looking back.
    const done = rules.filter((r) => r.done).map((r) => r.id);
    if (day <= PROGRAM_DAYS && done.join() !== entry.done.join()) {
      state.days[today] = { ...entry, done };
      await this.programs.save(userId, state);
    }

    const fullDays = Object.entries(state.days).filter(([date, d]) => {
      const n = dayOf(state.startedOn, date);
      return n >= 1 && n <= Math.min(day, PROGRAM_DAYS) && isFullDay(n, d.done);
    }).length;

    return {
      guideId: state.guideId,
      title: guide?.title ?? "Your program",
      startedOn: state.startedOn,
      date: today,
      day,
      days: PROGRAM_DAYS,
      phase: phaseOf(day),
      rules,
      tip: tipFor(day),
      checkDue: checkDue(day, state.checks.map((c) => c.checkpoint)),
      checks: state.checks.map((c) => {
        const total = c.answers.reduce((a, b) => a + b, 0);
        return { ...c, total, band: energyBand(total) };
      }),
      fullDays,
      focusScore: await this.focusScore(userId, state.startedOn, day),
    };
  }

  /** Average Focus Score over days 1–7, and over the latest 7 days once past the first week. */
  private async focusScore(userId: string, startedOn: string, day: number) {
    const scores = await this.scores.listSince(userId, startedOn);
    const last = Math.min(day, PROGRAM_DAYS);
    const average = (from: number, to: number) => {
      const values = scores
        .filter((s) => s.date >= dateOfDay(startedOn, from) && s.date <= dateOfDay(startedOn, to))
        .map((s) => s.score)
        .filter((s): s is number => s !== null);
      return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
    };
    return { firstWeek: average(1, 7), lastWeek: last > 7 ? average(last - 6, last) : null };
  }
}
