export const EMBEDDING_DIMENSIONS = 1536;

export interface IEmbeddingProvider {
  /** One vector of EMBEDDING_DIMENSIONS per input text, in order. */
  embed(texts: string[]): Promise<number[][]>;
}
