import OpenAI from "openai";
import { z } from "zod";
import { EMBEDDING_DIMENSIONS, type IEmbeddingProvider } from "../../application/interfaces/IEmbeddingProvider";

export const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_BATCH = 100;

const Vector = z.array(z.number()).length(EMBEDDING_DIMENSIONS);

export type CreateEmbeddings = Pick<OpenAI["embeddings"], "create">;

/** ARCHITECTURE §7.3. Batches of up to 100 texts; every vector is length-checked. */
export class OpenAiEmbeddingProvider implements IEmbeddingProvider {
  private readonly embeddings: CreateEmbeddings;

  constructor(options: { apiKey: string } | { embeddings: CreateEmbeddings }) {
    this.embeddings =
      "embeddings" in options
        ? options.embeddings
        : new OpenAI({ apiKey: options.apiKey, maxRetries: 1, timeout: 15_000 }).embeddings;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += MAX_BATCH) {
      const batch = texts.slice(i, i + MAX_BATCH);
      const started = Date.now();
      const response = await this.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
      console.info(
        JSON.stringify({ event: "embedding_call", model: EMBEDDING_MODEL, ms: Date.now() - started, inputs: batch.length, tokens: response.usage?.total_tokens }),
      );
      const sorted = [...response.data].sort((a, b) => a.index - b.index);
      if (sorted.length !== batch.length) throw new Error(`Expected ${batch.length} embeddings, got ${sorted.length}`);
      out.push(...sorted.map((d) => Vector.parse(d.embedding)));
    }
    return out;
  }
}
