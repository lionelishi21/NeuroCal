import { AI_ALLOWANCE, type AiFeature, limitMessage } from "../../domain/aiAllowance";
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
