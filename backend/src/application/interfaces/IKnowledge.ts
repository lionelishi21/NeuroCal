import type { KnowledgeSource, SourceStatus, Technique, TechniqueStatus } from "../../domain/knowledge";

export type NewTechnique = Omit<Technique, "id" | "sourceId" | "status" | "protocolId">;

/** Videos and the techniques taken from them, for the admin Knowledge screen. */
export interface IKnowledgeRepository {
  /** Newest first, each with its techniques. */
  list(): Promise<{ source: KnowledgeSource; techniques: Technique[] }[]>;
  getSource(id: string): Promise<KnowledgeSource | null>;
  /** Adds a source unless one with the same link exists; returns the stored one either way. */
  addSource(source: Omit<KnowledgeSource, "id" | "addedAt" | "status"> & { status?: SourceStatus }): Promise<KnowledgeSource>;
  setSourceStatus(id: string, status: SourceStatus): Promise<void>;
  addTechniques(sourceId: string, techniques: NewTechnique[]): Promise<Technique[]>;
  getTechnique(id: string): Promise<Technique | null>;
  updateTechnique(id: string, patch: Partial<Pick<Technique, "title" | "summary" | "steps">> & { status: TechniqueStatus; protocolId?: string }): Promise<Technique>;
}

/** Transcript → techniques (an LLM; its output is schema-checked). */
export interface ITechniqueExtractor {
  extract(input: { title: string; transcript: string }): Promise<NewTechnique[]>;
}

/** New uploads on a channel (YouTube Data API: titles, links and dates only, never transcripts). */
export interface IVideoFeed {
  latest(channelId: string): Promise<{ url: string; title: string; channel: string; publishedAt: Date }[]>;
}
