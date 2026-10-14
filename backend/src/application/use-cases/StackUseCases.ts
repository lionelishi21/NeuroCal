import { InvalidError, NotFoundError } from "../../domain/errors";
import { localDateOf } from "../../domain/localDay";
import { type StackFlag, type StackItem, daysLeft, stackFlags } from "../../domain/stack";
import type { Profile } from "../../domain/types";
import type { IClock } from "../interfaces/IClock";
import type { IProfileRepository } from "../interfaces/IRepositories";
import type { IStackRepository, NewStackItem } from "../interfaces/IStackRepository";

export const MAX_STACK_ITEMS = 30;

export type StackItemView = StackItem & { daysLeft?: number; takenToday: boolean };

export interface StackView {
  date: string;
  items: StackItemView[];
  flags: StackFlag[];
}

async function todayFor(profiles: IProfileRepository, userId: string, clock: IClock): Promise<{ profile: Profile; today: string }> {
  const profile = await profiles.get(userId);
  if (!profile) throw new NotFoundError("Set up your profile first.");
  return { profile, today: localDateOf(clock.now(), profile.timeZone) };
}

const view = (item: StackItem, today: string, taken: Set<string>): StackItemView => {
  const left = daysLeft(item, today);
  return { ...item, ...(left === null ? {} : { daysLeft: left }), takenToday: taken.has(item.id) };
};

/** The supplements someone takes, what they've ticked today, and the checks across all of them. */
export class StackUseCases {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly stack: IStackRepository,
    private readonly clock: IClock,
  ) {}

  async get(userId: string): Promise<StackView> {
    const { today } = await todayFor(this.profiles, userId, this.clock);
    const [items, taken] = await Promise.all([this.stack.list(userId), this.stack.takenOn(userId, today)]);
    return { date: today, items: items.map((i) => view(i, today, taken)), flags: stackFlags(items) };
  }

  async add(userId: string, item: Omit<NewStackItem, "startedOn">): Promise<StackItemView> {
    const { today } = await todayFor(this.profiles, userId, this.clock);
    if ((await this.stack.list(userId)).length >= MAX_STACK_ITEMS) {
      throw new InvalidError(`Your stack can hold ${MAX_STACK_ITEMS} supplements. Remove one to add another.`);
    }
    const saved = await this.stack.add(userId, { ...item, name: item.name.trim(), startedOn: today });
    return view(saved, today, new Set());
  }

  async update(
    userId: string,
    id: string,
    patch: { servingsPerDay?: number; timing?: StackItem["timing"]; servingsPerContainer?: number | null; newBottle?: boolean },
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

  async setTaken(userId: string, id: string, taken: boolean): Promise<void> {
    const { today } = await todayFor(this.profiles, userId, this.clock);
    if (!(await this.stack.setTaken(userId, id, today, taken))) throw new NotFoundError("That supplement isn't in your stack.");
  }
}
