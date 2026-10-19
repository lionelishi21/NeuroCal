import type { GlucoseDay } from "../../domain/glucose";

/** Daily glucose-sensor summaries. Sending a day again replaces it (a later sync may have more readings). */
export interface IGlucoseRepository {
  upsertDays(userId: string, days: GlucoseDay[]): Promise<number>;
  /** Between two dates (YYYY-MM-DD, inclusive), oldest first. */
  listBetween(userId: string, from: string, to: string): Promise<GlucoseDay[]>;
}
