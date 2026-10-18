import { AI_ALLOWANCE, type AiFeature, FREE_READS, limitMessage } from "../../domain/aiAllowance";
import { LimitReachedError } from "../../domain/errors";
import type { IAiUsage } from "../interfaces/IAiUsage";
import type { IClock } from "../interfaces/IClock";

/**
 * Spends one AI call from today's allowance before the work starts; past the limit it refuses with a
 * 429 that says when it resets. Admins aren't limited (they test the features).
 */
export class AiAllowanceUseCase {
  constructor(
    private readonly usage: IAiUsage,
    private readonly clock: IClock,
  ) {}

  /**
   * An account's first few photo reads (FREE_READS) don't need a subscription, so onboarding can show a
   * meal being read before the trial starts. After them, reads need the subscription like everything else.
   */
  async isFree(caller: { userId: string }, feature: AiFeature): Promise<boolean> {
    return feature === "read" && (await this.usage.total(caller.userId, feature)) < FREE_READS;
  }

  async spend(caller: { userId: string; isAdmin?: boolean }, feature: AiFeature): Promise<void> {
    if (caller.isAdmin) return;
    const day = this.clock.now().toISOString().slice(0, 10);
    const used = await this.usage.spend(caller.userId, day, feature);
    if (used > AI_ALLOWANCE[feature]) {
      console.warn(JSON.stringify({ event: "ai_limit_reached", feature, used }));
      throw new LimitReachedError(limitMessage(feature));
    }
  }
}
