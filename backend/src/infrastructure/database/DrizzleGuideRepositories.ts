import { eq } from "drizzle-orm";
import type { IGuideRepository, IProgramRepository, ProgramState } from "../../application/interfaces/IGuides";
import type { GuideRecord } from "../../domain/guides";
import type { Database } from "./client";
import { guides, programs } from "./schema";

export class DrizzleGuideRepository implements IGuideRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<GuideRecord[]> {
    return this.db.select().from(guides);
  }

  async get(id: string): Promise<GuideRecord | null> {
    const [row] = await this.db.select().from(guides).where(eq(guides.id, id));
    return row ?? null;
  }

  async save(guide: GuideRecord): Promise<void> {
    await this.db.insert(guides).values(guide).onConflictDoUpdate({ target: guides.id, set: { ...guide } });
  }
}

export class DrizzleProgramRepository implements IProgramRepository {
  constructor(private readonly db: Database) {}

  async get(userId: string): Promise<ProgramState | null> {
    const [row] = await this.db.select().from(programs).where(eq(programs.userId, userId));
    return row ? { guideId: row.guideId, startedOn: row.startedOn, days: row.days, checks: row.checks } : null;
  }

  async save(userId: string, state: ProgramState): Promise<void> {
    const values = { userId, ...state, updatedAt: new Date() };
    await this.db.insert(programs).values(values).onConflictDoUpdate({ target: programs.userId, set: values });
  }

  async delete(userId: string): Promise<void> {
    await this.db.delete(programs).where(eq(programs.userId, userId));
  }
}
