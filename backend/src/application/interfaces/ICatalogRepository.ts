import type { AdminProduct, Product, ProductSettings, Protocol } from "../../domain/types";

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
  /** Removes catalog entries no longer in the source list. Products added by an admin are kept. */
  retain(ids: { protocols: string[]; products: string[] }): Promise<void>;
  nearestProtocols(embedding: number[], limit: number): Promise<{ item: Protocol; similarity: number }[]>;
  /**
   * Enabled products only, with admin links and labels applied.
   * `only: "ownSupplements"` searches just the own-brand supplements.
   */
  nearestProducts(embedding: number[], limit: number, only?: "ownSupplements"): Promise<{ item: Product; similarity: number }[]>;

  /** Every product, disabled ones included, for the admin screen. */
  listProducts(): Promise<AdminProduct[]>;
  /** Changes a product's link, affiliate label or on/off state. Null when there is no such product. */
  updateProductSettings(id: string, settings: ProductSettings): Promise<AdminProduct | null>;
  /** Stores a product added from the admin screen. */
  addProduct(product: Embedded<Product>): Promise<AdminProduct>;
  /** Removes a product added from the admin screen. False for catalog products and unknown ids. */
  removeAdminProduct(id: string): Promise<boolean>;
}
