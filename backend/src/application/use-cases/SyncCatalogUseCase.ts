import { productText, protocolText, recordHash } from "../../domain/recommendations";
import type { Product, Protocol } from "../../domain/types";
import type { ICatalogRepository } from "../interfaces/ICatalogRepository";
import type { IEmbeddingProvider } from "../interfaces/IEmbeddingProvider";

/** Embeds and stores new or edited catalog entries (any field); unchanged entries cost nothing. */
export class SyncCatalogUseCase {
  constructor(
    private readonly catalog: ICatalogRepository,
    private readonly embedder: IEmbeddingProvider,
  ) {}

  async execute(source: { protocols: Protocol[]; products: Product[] }): Promise<{ embedded: number }> {
    const stored = await this.catalog.hashes();
    const changedProtocols = source.protocols.filter((p) => stored.protocols.get(p.id) !== recordHash(p));
    const changedProducts = source.products.filter((p) => stored.products.get(p.id) !== recordHash(p));

    const texts = [...changedProtocols.map(protocolText), ...changedProducts.map(productText)];
    const vectors = texts.length ? await this.embedder.embed(texts) : [];

    await this.catalog.upsertProtocols(
      changedProtocols.map((item, i) => ({ item, embedding: vectors[i]!, contentHash: recordHash(item) })),
    );
    await this.catalog.upsertProducts(
      changedProducts.map((item, i) => ({
        item,
        embedding: vectors[changedProtocols.length + i]!,
        contentHash: recordHash(item),
      })),
    );
    await this.catalog.retain({ protocols: source.protocols.map((p) => p.id), products: source.products.map((p) => p.id) });
    return { embedded: texts.length };
  }
}
