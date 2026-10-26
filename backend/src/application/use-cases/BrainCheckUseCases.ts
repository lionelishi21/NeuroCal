import { InvalidError } from "../../domain/errors";
import { type LevelChange, MAX_REACTION_MS, MAX_TRIALS, MIN_REACTION_MS, MIN_TRIALS, baselineOf, levelChangeOf, scoreCheck } from "../../domain/brainCheck";
import type { IBrainCheckRepository, SavedBrainCheck } from "../interfaces/IBrainCheckRepository";
import type { IClock } from "../interfaces/IClock";

const DAY_MS = 86_400_000;

/** Saving and reading Brain speed checks. The API scores them, so every client scores the same way. */
export class BrainCheckUseCases {
  constructor(
    private readonly checks: IBrainCheckRepository,
    private readonly clock: IClock,
  ) {}

  async add(userId: string, input: { reactionTimesMs: number[]; falseStarts: number }): Promise<SavedBrainCheck> {
    const rts = input.reactionTimesMs;
    if (rts.length < MIN_TRIALS || rts.length > MAX_TRIALS) throw new InvalidError(`A check needs ${MIN_TRIALS} to ${MAX_TRIALS} reactions.`);
    if (rts.some((x) => !Number.isFinite(x) || x < MIN_REACTION_MS || x > MAX_REACTION_MS)) {
      throw new InvalidError(`Each reaction must be between ${MIN_REACTION_MS} and ${MAX_REACTION_MS} ms.`);
    }
    if (!Number.isInteger(input.falseStarts) || input.falseStarts < 0) throw new InvalidError("False starts must be a whole number.");
    return this.checks.add(userId, { ...scoreCheck(rts, input.falseStarts), takenAt: this.clock.now(), reactionTimesMs: rts.map(Math.round) });
  }

  async history(userId: string, days = 30): Promise<{ checks: SavedBrainCheck[]; baselineScore?: number; newLevel?: LevelChange }> {
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new InvalidError("Ask for 1 to 365 days.");
    const now = this.clock.now();
    // Enough to see a level change (eight weeks) and, usually, the very first check.
    const LOOK_BACK = 120;
    const all = await this.checks.listSince(userId, new Date(now.getTime() - Math.max(days, LOOK_BACK) * DAY_MS));
    const checks = all.filter((c) => c.takenAt.getTime() >= now.getTime() - days * DAY_MS);
    // "Your usual" leaves out the latest check, so it can be compared with it.
    const baseline = baselineOf(checks.slice(1).map((c) => c.score));
    // Newest first: the oldest is the first ever unless the window cut into earlier checks.
    const oldest = all.at(-1)?.takenAt;
    const firstEver = oldest && oldest.getTime() > now.getTime() - (LOOK_BACK - 7) * DAY_MS ? oldest : undefined;
    const level = levelChangeOf(all, now, firstEver);
    return { checks, ...(baseline === null ? {} : { baselineScore: baseline }), ...(level ? { newLevel: level } : {}) };
  }
}
