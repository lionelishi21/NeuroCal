import { EMBEDDING_DIMENSIONS, type IEmbeddingProvider } from "../../application/interfaces/IEmbeddingProvider";

/**
 * Keyless stand-in for text-embedding-3-small in local dev: a bag-of-words vector,
 * so texts that share words still land near each other. Never used in the Lambda.
 */
export const keywordEmbedder: IEmbeddingProvider = {
  async embed(texts) {
    return texts.map((text) => {
      const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
      for (const word of text.toLowerCase().match(/[a-z]{4,}/g) ?? []) {
        let h = 0;
        for (const ch of word.slice(0, 5)) h = (h * 31 + ch.charCodeAt(0)) % EMBEDDING_DIMENSIONS;
        v[h]! += 1;
      }
      const norm = Math.hypot(...v) || 1;
      return v.map((x) => x / norm);
    });
  },
};
