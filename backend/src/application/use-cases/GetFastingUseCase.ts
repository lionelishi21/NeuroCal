import {
  FAST_HOURS,
  FAST_SAFE_KCAL,
  type FastPlan,
  type FastingProtocol,
  type FastingState,
  activePlan,
  fastingProtocolOf,
  fastingState,
  fastingStreak,
  plannedFastLimit,
} from "../../domain/fasting";
import { InvalidError, NotFoundError } from "../../domain/errors";
import { localDateOf } from "../../domain/localDay";
import type { IClock } from "../interfaces/IClock";
import type { IFastPlanRepository, IMealRepository, IProfileRepository } from "../interfaces/IRepositories";

/** Enough history for the streak shown (a month) plus the fast running into it. */
const LOOKBACK_DAYS = 32;
const HOUR_MS = 3_600_000;
/** A planned fast ends at least this far ahead. */
const MIN_PLAN_MS = 30 * 60_000;

export interface FastingStatus {
  protocol: FastingProtocol;
  fastHours?: number;
  state: FastingState | { kind: "off" };
  streakDays: number;
  /** A planned fast still running; the state then counts down to its end. */
  plan?: FastPlan;
  /** The longest fast that can be planned, in hours from the last meal; 0 when none can. */
  planLimitHours: number;
}

/**
 * The fasting timer from logged meals and the protocol chosen in onboarding, and planned fasts
 * ("until noon tomorrow"). Drinks under FAST_SAFE_KCAL don't count as meals.
 */
export class GetFastingUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly meals: IMealRepository,
    private readonly clock: IClock,
    private readonly plans: IFastPlanRepository,
  ) {}

  async execute(input: { userId: string }): Promise<FastingStatus> {
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const now = this.clock.now();
    const eaten = await this.eaten(input.userId, now);
    const planLimitHours = plannedFastLimit(profile);
    // The safety answer caps fasting at 12 hours, whatever was chosen in onboarding.
    const protocol: FastingProtocol = fastingProtocolOf(profile);
    const fastHours = protocol === "none" ? undefined : FAST_HOURS[protocol];
    const streakDays = fastHours ? fastingStreak(eaten, now, fastHours, (d) => localDateOf(d, profile.timeZone)) : 0;

    const plan = planLimitHours > 0 ? activePlan(await this.plans.get(input.userId), eaten, now) : null;
    if (plan) {
      const since = eaten.filter((m) => m <= now).at(-1) ?? plan.startedAt;
      return { protocol, ...(fastHours ? { fastHours } : {}), state: { kind: "fasting", since, goalAt: plan.until }, streakDays, plan, planLimitHours };
    }
    if (!fastHours) return { protocol, state: { kind: "off" }, streakDays: 0, planLimitHours };
    return { protocol, fastHours, state: fastingState(eaten, now, fastHours), streakDays, planLimitHours };
  }

  /** Fast until [until], counted from the last meal; replaces a plan already running. */
  async plan(userId: string, until: Date): Promise<FastingStatus> {
    const profile = await this.profiles.get(userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const limit = plannedFastLimit(profile);
    if (limit === 0) throw new InvalidError("Fasting isn't advised with the health conditions in your profile. Check with your clinician first.");
    const now = this.clock.now();
    if (until.getTime() - now.getTime() < MIN_PLAN_MS) throw new InvalidError("Pick an end at least half an hour from now.");
    const last = (await this.eaten(userId, now)).filter((m) => m <= now).at(-1);
    // Measured from the last meal while that is within the limit, otherwise from now.
    const from = last && now.getTime() - last.getTime() < limit * HOUR_MS ? last : now;
    if (until.getTime() - from.getTime() > limit * HOUR_MS) {
      throw new InvalidError(`A planned fast can last up to ${limit} hours from your last meal. Pick an earlier time.`);
    }
    await this.plans.set(userId, { startedAt: now, until });
    return this.execute({ userId });
  }

  /** "End my fast": the timer goes back to counting from meals. */
  async endPlan(userId: string): Promise<FastingStatus> {
    await this.plans.set(userId, null);
    return this.execute({ userId });
  }

  private eaten(userId: string, now: Date) {
    return this.meals.eatenSince(userId, new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000), FAST_SAFE_KCAL);
  }
}
