import type { Product, Protocol } from "../../domain/types";

export interface Embedded<T> {
  item: T;
  embedding: number[];
  contentHash: string;
}

/** Protocols and products with their embeddings; nearest-neighbour search uses pgvector HNSW (ARCHITECTURE §4). */
export interface ICatalogRepository {
  /** id → content hash of what is stored, to skip re-embedding unchanged items. */
  hashes(): Promise<{ protocols: Map<string, string>; products: Map<string, string> }>;
  upsertProtocols(items: Embedded<Protocol>[]): Promise<void>;
  upsertProducts(items: Embedded<Product>[]): Promise<void>;
  /** Removes catalog entries no longer in the source list. */
  retain(ids: { protocols: string[]; products: string[] }): Promise<void>;
  nearestProtocols(embedding: number[], limit: number): Promise<{ item: Protocol; similarity: number }[]>;
  nearestProducts(embedding: number[], limit: number): Promise<{ item: Product; similarity: number }[]>;
}
