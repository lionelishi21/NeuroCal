import { productText, protocolText, recordHash } from "../../domain/recommendations";
import type { Product, Protocol } from "../../domain/types";
import type { ICatalogRepository } from "../interfaces/ICatalogRepository";
import type { IEmbeddingProvider } from "../interfaces/IEmbeddingProvider";

/**
 * Embeds and stores new or edited catalog entries (any field); unchanged entries cost nothing.
 * [embeddingKind] names a stand-in embedder ("keyword" while there's no OpenAI key): it is stored with
 * each entry's hash, so a later sync with the real embedder sees every stand-in entry as changed and
 * embeds it again.
 */
export class SyncCatalogUseCase {
  constructor(
    private readonly catalog: ICatalogRepository,
    private readonly embedder: IEmbeddingProvider,
    private readonly embeddingKind?: string,
  ) {}

  private hash(item: Protocol | Product): string {
    return this.embeddingKind ? `${this.embeddingKind}:${recordHash(item)}` : recordHash(item);
  }

  async execute(source: { protocols: Protocol[]; products: Product[] }): Promise<{ embedded: number }> {
    const stored = await this.catalog.hashes();
    const changedProtocols = source.protocols.filter((p) => stored.protocols.get(p.id) !== this.hash(p));
    const changedProducts = source.products.filter((p) => stored.products.get(p.id) !== this.hash(p));

    const texts = [...changedProtocols.map(protocolText), ...changedProducts.map(productText)];
    const vectors = texts.length ? await this.embedder.embed(texts) : [];

    await this.catalog.upsertProtocols(
      changedProtocols.map((item, i) => ({ item, embedding: vectors[i]!, contentHash: this.hash(item) })),
    );
    await this.catalog.upsertProducts(
      changedProducts.map((item, i) => ({
        item,
        embedding: vectors[changedProtocols.length + i]!,
        contentHash: this.hash(item),
      })),
    );
    await this.catalog.retain({ protocols: source.protocols.map((p) => p.id), products: source.products.map((p) => p.id) });
    return { embedded: texts.length };
  }
}
