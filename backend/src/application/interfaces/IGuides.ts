import type { GuideRecord } from "../../domain/guides";
import type { Checkpoint } from "../../domain/program";

/** Guides saved from the admin screen; one replaces the guide that comes with the app under the same id. */
export interface IGuideRepository {
  list(): Promise<GuideRecord[]>;
  get(id: string): Promise<GuideRecord | null>;
  save(guide: GuideRecord): Promise<void>;
}

/** Someone's program (domain/program.ts); one at a time. */
export interface ProgramState {
  guideId: string;
  /** YYYY-MM-DD, day 1. */
  startedOn: string;
  /** Per local day: habits ticked by hand, and every habit seen done that day (for counting full days). */
  days: Record<string, { ticked: string[]; done: string[] }>;
  checks: { checkpoint: Checkpoint; date: string; answers: number[] }[];
}

/** Scoped to one user (ARCHITECTURE §10). */
export interface IProgramRepository {
  get(userId: string): Promise<ProgramState | null>;
  save(userId: string, state: ProgramState): Promise<void>;
  delete(userId: string): Promise<void>;
}
