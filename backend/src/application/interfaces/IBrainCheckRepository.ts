import type { BrainCheckResult } from "../../domain/brainCheck";

export interface SavedBrainCheck extends BrainCheckResult {
  id: string;
  takenAt: Date;
}

/** Scoped to one user (ARCHITECTURE §10). */
export interface IBrainCheckRepository {
  add(userId: string, check: BrainCheckResult & { takenAt: Date; reactionTimesMs: number[] }): Promise<SavedBrainCheck>;
  /** Taken at or after `since`, newest first. */
  listSince(userId: string, since: Date): Promise<SavedBrainCheck[]>;
}
