import { ForbiddenError } from "../../domain/errors";
import { type FunnelCounts, type FunnelWeek, fillWeeks, mondayOf, totalOf } from "../../domain/funnel";
import type { IClock } from "../interfaces/IClock";
import type { IFunnelRepository } from "../interfaces/ISubscriptions";

/** How many weeks the admin funnel shows. */
export const FUNNEL_WEEKS = 12;

export interface FunnelOverview {
  /** Newest first, this week included. */
  weeks: FunnelWeek[];
  total: FunnelCounts;
}

/** The sign-up funnel by week, for admins. */
export class AdminFunnelUseCase {
  constructor(
    private readonly funnel: IFunnelRepository,
    private readonly clock: IClock,
  ) {}

  async execute(caller: { isAdmin: boolean }): Promise<FunnelOverview> {
    if (!caller.isAdmin) throw new ForbiddenError("Only an admin can see the funnel.");
    const now = this.clock.now();
    const since = new Date(mondayOf(now).getTime() - (FUNNEL_WEEKS - 1) * 7 * 86_400_000);
    const weeks = fillWeeks(await this.funnel.weeksSince(since), now, FUNNEL_WEEKS);
    return { weeks, total: totalOf(weeks) };
  }
}
