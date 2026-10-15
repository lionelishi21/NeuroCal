import { DomainError, ForbiddenError, InvalidError, NotFoundError, UpstreamError } from "../../domain/errors";
import {
  MAX_TRANSCRIPT_CHARS,
  MIN_TRANSCRIPT_CHARS,
  type KnowledgeSource,
  type Technique,
  protocolFromTechnique,
} from "../../domain/knowledge";
import { protocolText, recordHash } from "../../domain/recommendations";
import type { ICatalogRepository } from "../interfaces/ICatalogRepository";
import type { IEmbeddingProvider } from "../interfaces/IEmbeddingProvider";
import type { IKnowledgeRepository, ITechniqueExtractor, IVideoFeed } from "../interfaces/IKnowledge";
import type { AdminCaller } from "./AdminProductUseCases";

function requireAdmin(caller: AdminCaller) {
  if (!caller.isAdmin) throw new ForbiddenError("Only an admin can review knowledge.");
}

function cleanUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new InvalidError("Enter the video's link, starting with https://.");
  }
  if (parsed.protocol !== "https:") throw new InvalidError("The link must start with https://.");
  return parsed.toString();
}

export type Review = { decision: "approve"; title?: string; summary?: string; steps?: string[] } | { decision: "reject" };

/**
 * The knowledge pipeline (docs/NCBM.md §7) for the admin Knowledge screen: videos come in from the
 * channel sync or by hand, techniques are taken from a pasted transcript, and only those an admin
 * approves become routines in the catalog, each linked to the moment it was said.
 */
export class KnowledgeUseCases {
  constructor(
    private readonly knowledge: IKnowledgeRepository,
    private readonly extractor: ITechniqueExtractor,
    private readonly catalog: ICatalogRepository,
    private readonly embedder: IEmbeddingProvider,
    private readonly feed: IVideoFeed | null,
    /** YouTube channel ids to watch (KNOWLEDGE_CHANNELS). */
    private readonly channels: string[],
  ) {}

  /** The channels the monthly sync checks; empty when it can't run. */
  watching(): string[] {
    return this.feed ? this.channels : [];
  }

  async list(caller: AdminCaller) {
    requireAdmin(caller);
    return this.knowledge.list();
  }

  async addSource(caller: AdminCaller, input: { url: string; title: string; transcript?: string }): Promise<{ source: KnowledgeSource; techniques: Technique[] }> {
    requireAdmin(caller);
    const title = input.title.trim();
    if (!title) throw new InvalidError("Give the video a title.");
    const source = await this.knowledge.addSource({ url: cleanUrl(input.url), title });
    return input.transcript ? this.extractFrom(source, input.transcript) : { source, techniques: [] };
  }

  async addTranscript(caller: AdminCaller, sourceId: string, transcript: string) {
    requireAdmin(caller);
    const source = await this.knowledge.getSource(sourceId);
    if (!source) throw new NotFoundError("That video is no longer in the list.");
    return this.extractFrom(source, transcript);
  }

  private async extractFrom(source: KnowledgeSource, transcript: string) {
    const text = transcript.trim();
    if (text.length < MIN_TRANSCRIPT_CHARS) throw new InvalidError("That transcript is too short. Paste the whole thing.");
    if (text.length > MAX_TRANSCRIPT_CHARS) throw new InvalidError("That transcript is too long. Split it in two and add each half.");
    let found;
    try {
      found = await this.extractor.extract({ title: source.title, transcript: text });
    } catch (error) {
      await this.knowledge.setSourceStatus(source.id, "failed");
      if (error instanceof DomainError) throw error;
      console.error(JSON.stringify({ event: "technique_extraction_failed", error: String(error).slice(0, 300) }));
      throw new UpstreamError("The transcript couldn't be read right now. Try again in a moment.");
    }
    const techniques = await this.knowledge.addTechniques(source.id, found);
    await this.knowledge.setSourceStatus(source.id, "extracted");
    return { source: { ...source, status: "extracted" as const }, techniques };
  }

  /** Approve (optionally edited) into the catalog as a routine, or reject. */
  async review(caller: AdminCaller, techniqueId: string, review: Review): Promise<Technique> {
    requireAdmin(caller);
    const technique = await this.knowledge.getTechnique(techniqueId);
    if (!technique) throw new NotFoundError("That technique is no longer in the list.");
    if (technique.status === "approved") throw new InvalidError("That technique is already in the catalog.");
    if (review.decision === "reject") return this.knowledge.updateTechnique(techniqueId, { status: "rejected" });

    const edited = {
      ...technique,
      ...(review.title?.trim() ? { title: review.title.trim() } : {}),
      ...(review.summary?.trim() ? { summary: review.summary.trim() } : {}),
      ...(review.steps?.some((s) => s.trim()) ? { steps: review.steps.filter((s) => s.trim()) } : {}),
    };
    const source = await this.knowledge.getSource(technique.sourceId);
    if (!source) throw new NotFoundError("That technique's video is no longer in the list.");
    const protocol = protocolFromTechnique(edited, source);
    let embedding: number[] | undefined;
    try {
      [embedding] = await this.embedder.embed([protocolText(protocol)]);
    } catch {
      embedding = undefined;
    }
    if (!embedding) throw new UpstreamError("The routine couldn't be prepared for matching right now. Try again in a moment.");
    await this.catalog.addProtocol({ item: protocol, embedding, contentHash: recordHash(protocol) });
    return this.knowledge.updateTechnique(techniqueId, {
      status: "approved",
      protocolId: protocol.id,
      title: edited.title,
      summary: edited.summary,
      steps: edited.steps,
    });
  }

  /** New uploads on the watched channels go into the list as "queued", waiting for a transcript. */
  async sync(): Promise<{ added: number }> {
    if (!this.feed || this.channels.length === 0) return { added: 0 };
    const before = new Set((await this.knowledge.list()).map(({ source }) => source.url));
    let added = 0;
    for (const channel of this.channels) {
      for (const video of await this.feed.latest(channel)) {
        if (before.has(video.url)) continue;
        await this.knowledge.addSource(video);
        before.add(video.url);
        added++;
      }
    }
    return { added };
  }

  async syncAsAdmin(caller: AdminCaller) {
    requireAdmin(caller);
    if (!this.feed) throw new InvalidError("Add YOUTUBE_API_KEY to the app secret to check channels for new videos.");
    return this.sync();
  }
}
