import type { AiFeature } from "../../domain/aiAllowance";

/** AI calls counted per person, day and feature. */
export interface IAiUsage {
  /** Counts one more call and returns the day's total including it. */
  spend(userId: string, day: string, feature: AiFeature): Promise<number>;

  /** All the calls of this kind this person has ever made. */
  total(userId: string, feature: AiFeature): Promise<number>;
}
