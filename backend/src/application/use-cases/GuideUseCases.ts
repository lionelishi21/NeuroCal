import { ForbiddenError, NotFoundError } from "../../domain/errors";
import { type GuideRecord, readingMinutes } from "../../domain/guides";
import type { IClock } from "../interfaces/IClock";
import type { IGuideRepository } from "../interfaces/IGuides";

export interface Access {
  isAdmin: boolean;
}

export type GuideSummaryView = Omit<GuideRecord, "body" | "updatedAt"> & { minutes: number };

export interface SaveGuide {
  title: string;
  subtitle: string;
  summary: string;
  body: string;
  status: GuideRecord["status"];
}

/**
 * Guides (docs/NCBM.md §11): the ones that come with the app ([seeds]), each replaced by the text
 * an admin saved for it. Drafts are seen only by admins, so unreviewed text never reaches users.
 */
export class GuideUseCases {
  constructor(
    private readonly guides: IGuideRepository,
    private readonly seeds: readonly GuideRecord[],
    private readonly clock: IClock,
  ) {}

  async list(access: Access): Promise<GuideSummaryView[]> {
    return (await this.all())
      .filter((g) => access.isAdmin || g.status === "published")
      .map(({ body, updatedAt: _, ...g }) => ({ ...g, minutes: readingMinutes(body) }));
  }

  async get(id: string, access: Access): Promise<GuideRecord & { minutes: number }> {
    const guide = (await this.all()).find((g) => g.id === id);
    if (!guide || (guide.status !== "published" && !access.isAdmin)) throw new NotFoundError("There's no such guide.");
    return { ...guide, minutes: readingMinutes(guide.body) };
  }

  /** Admin only. A new id makes a new general guide without a program. */
  async save(access: Access, id: string, change: SaveGuide): Promise<GuideRecord & { minutes: number }> {
    if (!access.isAdmin) throw new ForbiddenError("Only admins can edit guides.");
    const current = (await this.all()).find((g) => g.id === id);
    const guide: GuideRecord = {
      id,
      ...change,
      brand: current?.brand ?? "general",
      program: current?.program ?? false,
      updatedAt: this.clock.now(),
    };
    await this.guides.save(guide);
    return { ...guide, minutes: readingMinutes(guide.body) };
  }

  private async all(): Promise<GuideRecord[]> {
    const saved = await this.guides.list();
    const byId = new Map(this.seeds.map((g) => [g.id, g]));
    for (const g of saved) byId.set(g.id, g);
    return [...byId.values()];
  }
}
