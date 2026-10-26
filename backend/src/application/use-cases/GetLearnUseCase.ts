import { NotFoundError } from "../../domain/errors";
import { fastingProtocolOf } from "../../domain/fasting";
import { BECAUSE, type Book, type LearnTopic, bookLinks, shelfFor } from "../../domain/learn";
import { localDateOf } from "../../domain/localDay";
import type { FocusComponents } from "../../domain/types";
import { addDays } from "../../domain/weight";
import type { IClock } from "../interfaces/IClock";
import type { IFocusScoreRepository, IProfileRepository } from "../interfaces/IRepositories";
import type { IStackRepository } from "../interfaces/IStackRepository";

export interface LearnBook extends Pick<Book, "id" | "title" | "author" | "summary"> {
  /** Why it's on this person's shelf. */
  because: string;
  bookUrl: string;
  audioUrl: string;
}

/** Score inputs that point at a topic when they're weak. */
const TOPIC_OF: Partial<Record<keyof FocusComponents, LearnTopic>> = { sleep: "sleep", timing: "timing", glycemic: "food", stress: "stress", movement: "movement" };
/** Below this an input counts as weak. */
const WEAK = 0.8;

/** The Learn shelf (domain/learn.ts): books for the weakest parts of the latest score, fasting and the stack first. */
export class GetLearnUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly scores: Pick<IFocusScoreRepository, "listSince">,
    private readonly stack: Pick<IStackRepository, "list">,
    private readonly clock: IClock,
    private readonly options: { amazonTag?: string } = {},
  ) {}

  async execute(input: { userId: string }): Promise<LearnBook[]> {
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const today = localDateOf(this.clock.now(), profile.timeZone);
    const [scores, items] = await Promise.all([this.scores.listSince(profile.userId, addDays(today, -7)), this.stack.list(profile.userId)]);
    const latest = scores.at(-1)?.components;
    const weak = latest
      ? (Object.entries(latest) as [keyof FocusComponents, number | null][])
          .filter(([k, v]) => v !== null && v < WEAK && TOPIC_OF[k])
          .sort((a, b) => a[1]! - b[1]!)
          .map(([k]) => TOPIC_OF[k]!)
      : [];
    const topics: LearnTopic[] = [
      ...weak,
      ...(fastingProtocolOf(profile) === "none" ? [] : (["fasting"] as const)),
      ...(items.length ? (["supplements"] as const) : []),
      "focus",
      "longevity",
    ];
    return shelfFor(topics).map(({ book, because }) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      summary: book.summary,
      because: BECAUSE[because],
      ...bookLinks(book, this.options.amazonTag),
    }));
  }
}
