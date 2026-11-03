import { conditionsOf } from "../../domain/conditions";
import { InvalidError, NotFoundError } from "../../domain/errors";
import {
  BEFORE_DAYS,
  DAY_EFFECT_DAYS,
  type DayEffect,
  type Experiment,
  type Feeling,
  type Measure,
  type SupplementProfile,
  WATCH_AFTER_STOP_DAYS,
  afterStopOf,
  dayEffectOf,
  experimentOf,
  measureFor,
  profileOf,
} from "../../domain/experiment";
import { localDateOf } from "../../domain/localDay";
import { shopUrlFor } from "../../domain/shop";
import { type StackFlag, type StackItem, daysLeft, mimicsFasting, stackFlags } from "../../domain/stack";
import type { Profile } from "../../domain/types";
import { addDays } from "../../domain/weight";
import type { IBrainCheckRepository } from "../interfaces/IBrainCheckRepository";
import type { IClock } from "../interfaces/IClock";
import type { IFocusScoreRepository, IProfileRepository } from "../interfaces/IRepositories";
import type { IStackRepository, NewStackItem } from "../interfaces/IStackRepository";

export const MAX_STACK_ITEMS = 30;

export type StackItemView = StackItem & {
  startsFast: boolean;
  /** Our brand's store page, for a reorder. */
  shopUrl?: string;
  daysLeft?: number;
  takenToday: boolean;
  /** What it's for, how long it takes and what to expect (domain/experiment.ts). */
  profile?: SupplementProfile;
  /** Whether it's working for this person, from their own data. */
  experiment?: Experiment;
  /** Quick-acting or unknown ones: days it was ticked against days it wasn't. */
  dayEffect?: DayEffect;
};

/** Where an experiment's numbers come from: stored Focus Scores and Brain speed checks. */
export interface ExperimentSources {
  scores: Pick<IFocusScoreRepository, "listSince">;
  brainChecks?: Pick<IBrainCheckRepository, "listSince">;
}

export const FEELINGS: readonly Feeling[] = ["better", "same", "worse"];

export interface StackView {
  date: string;
  items: StackItemView[];
  /** Stopped in the last four weeks, each with whether the gain lasted. */
  stopped: StackItemView[];
  flags: StackFlag[];
}

async function todayFor(profiles: IProfileRepository, userId: string, clock: IClock): Promise<{ profile: Profile; today: string }> {
  const profile = await profiles.get(userId);
  if (!profile) throw new NotFoundError("Set up your profile first.");
  return { profile, today: localDateOf(clock.now(), profile.timeZone) };
}

const view = (item: StackItem, today: string, taken: Set<string>): StackItemView => {
  const left = daysLeft(item, today);
  return { ...item, startsFast: item.startsFast ?? false, ...(left === null ? {} : { daysLeft: left }), takenToday: taken.has(item.id) };
};

/** The supplements someone takes, what they've ticked today, and the checks across all of them. */
export class StackUseCases {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly stack: IStackRepository,
    private readonly clock: IClock,
    private readonly sources?: ExperimentSources,
    /** Our brand's supplements and their store pages, for a reorder link (domain/shop.ts). */
    private readonly ownProducts?: () => Promise<{ name: string; url?: string }[]>,
    /** Starts a fast for a fasting-mimicking supplement; its end, or null when none was started. */
    private readonly startFast?: (userId: string) => Promise<Date | null>,
  ) {}

  async get(userId: string): Promise<StackView> {
    const { profile, today } = await todayFor(this.profiles, userId, this.clock);
    const [items, stopped, taken] = await Promise.all([
      this.stack.list(userId),
      this.stack.listStopped(userId, addDays(today, -WATCH_AFTER_STOP_DAYS)),
      this.stack.takenOn(userId, today),
    ]);
    const [experiments, shop] = await Promise.all([
      this.experiments(profile, [...items, ...stopped], today),
      this.ownProducts ? this.ownProducts().catch(() => []) : Promise.resolve([]),
    ]);
    const withExperiment = (i: StackItem): StackItemView => {
      const shopUrl = shopUrlFor(i.name, shop);
      return { ...view(i, today, taken), ...(experiments.get(i.id) ?? {}), ...(shopUrl ? { shopUrl } : {}) };
    };
    return {
      date: today,
      items: items.map(withExperiment),
      stopped: stopped.map(withExperiment),
      flags: stackFlags(items, conditionsOf(profile)),
    };
  }

  /** Stopped taking it: off the daily list, and watched for four weeks to see if the gain lasts. */
  async stop(userId: string, id: string): Promise<StackItemView> {
    const { today } = await todayFor(this.profiles, userId, this.clock);
    const saved = await this.stack.update(userId, id, { stoppedOn: today });
    if (!saved) throw new NotFoundError("That supplement isn't in your stack.");
    return view(saved, today, new Set());
  }

  /** "How does it make you feel?", answered for today. */
  async setFeeling(userId: string, id: string, feeling: Feeling): Promise<void> {
    if (!FEELINGS.includes(feeling)) throw new InvalidError("Answer better, same or worse.");
    const { today } = await todayFor(this.profiles, userId, this.clock);
    if (!(await this.stack.setFeeling(userId, id, today, feeling))) throw new NotFoundError("That supplement isn't in your stack.");
  }

  /** Each item's profile and experiment, from one read of each source. */
  private async experiments(
    profile: Profile,
    items: StackItem[],
    today: string,
  ): Promise<Map<string, { profile: SupplementProfile; experiment: Experiment; dayEffect?: DayEffect }>> {
    const out = new Map<string, { profile: SupplementProfile; experiment: Experiment; dayEffect?: DayEffect }>();
    if (!this.sources || items.length === 0) return out;
    const since = [addDays(today, -DAY_EFFECT_DAYS), ...items.map((i) => addDays(i.addedOn, -BEFORE_DAYS))].reduce((a, b) => (a < b ? a : b));
    const [scores, checks, doses, feelings] = await Promise.all([
      this.sources.scores.listSince(profile.userId, since),
      this.sources.brainChecks?.listSince(profile.userId, new Date(`${addDays(since, -1)}T00:00:00Z`)) ?? Promise.resolve([]),
      this.stack.dosesSince(profile.userId, since),
      this.stack.feelings(profile.userId),
    ]);
    const series: Record<Measure, Map<string, number>> = { brain_speed: new Map(), sleep: new Map(), stress: new Map() };
    // Newest first: the first check seen on a day is its latest.
    for (const c of checks) {
      const day = localDateOf(c.takenAt, profile.timeZone);
      if (!series.brain_speed.has(day)) series.brain_speed.set(day, c.score);
    }
    for (const s of scores) {
      if (s.components.sleep !== null) series.sleep.set(s.date, s.components.sleep * 100);
      if (s.components.stress !== null) series.stress.set(s.date, s.components.stress * 100);
    }
    for (const item of items) {
      const p = profileOf(item);
      const measure = measureFor(p.purpose);
      const ownSeries = measure ? series[measure] : new Map<string, number>();
      const taken = doses.filter((d) => d.itemId === item.id).map((d) => d.date);
      // Taking it scores nothing. One that acts the same day (or one we don't know) shows what it does
      // by the days it was taken against the days it wasn't.
      const dayEffect =
        measure && !item.stoppedOn && (p.purpose === null || p.onsetDays <= 1)
          ? dayEffectOf({ measure, doneDays: taken, series: ownSeries, today, what: `you took ${item.name}` })
          : null;
      out.set(item.id, {
        profile: p,
        ...(dayEffect ? { dayEffect } : {}),
        experiment: item.stoppedOn
          ? afterStopOf({ name: item.name, profile: p, added: item.addedOn, stopped: item.stoppedOn, today, series: ownSeries })
          : experimentOf({
              name: item.name,
              profile: p,
              added: item.addedOn,
              today,
              series: ownSeries,
              doses: taken,
              feelings: feelings.filter((f) => f.itemId === item.id),
            }),
      });
    }
    return out;
  }

  async add(userId: string, item: Omit<NewStackItem, "startedOn" | "addedOn">): Promise<StackItemView> {
    const { today } = await todayFor(this.profiles, userId, this.clock);
    if ((await this.stack.list(userId)).length >= MAX_STACK_ITEMS) {
      throw new InvalidError(`Your stack can hold ${MAX_STACK_ITEMS} supplements. Remove one to add another.`);
    }
    const name = item.name.trim();
    const startsFast = item.startsFast ?? mimicsFasting(name, item.ingredients);
    const saved = await this.stack.add(userId, { ...item, name, startedOn: today, addedOn: today, ...(startsFast ? { startsFast } : {}) });
    return view(saved, today, new Set());
  }

  async update(
    userId: string,
    id: string,
    patch: { servingsPerDay?: number; timing?: StackItem["timing"]; servingsPerContainer?: number | null; newBottle?: boolean; startsFast?: boolean },
  ): Promise<StackItemView> {
    const { today } = await todayFor(this.profiles, userId, this.clock);
    const { newBottle, ...rest } = patch;
    const saved = await this.stack.update(userId, id, { ...rest, ...(newBottle ? { startedOn: today } : {}) });
    if (!saved) throw new NotFoundError("That supplement isn't in your stack.");
    return view(saved, today, await this.stack.takenOn(userId, today));
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.stack.delete(userId, id))) throw new NotFoundError("That supplement isn't in your stack.");
  }

  /** Ticks a supplement for today. A fasting-mimicking one starts a fast; [fastUntil] is when it ends. */
  async setTaken(userId: string, id: string, taken: boolean): Promise<{ fastUntil?: Date }> {
    const { today } = await todayFor(this.profiles, userId, this.clock);
    if (!(await this.stack.setTaken(userId, id, today, taken))) throw new NotFoundError("That supplement isn't in your stack.");
    if (!taken || !this.startFast) return {};
    const item = (await this.stack.list(userId)).find((i) => i.id === id);
    if (!item?.startsFast) return {};
    const until = await this.startFast(userId);
    return until ? { fastUntil: until } : {};
  }
}
