import { cosineDistance, notInArray, sql } from "drizzle-orm";
import type { Embedded, ICatalogRepository } from "../../application/interfaces/ICatalogRepository";
import type { Product, Protocol } from "../../domain/types";
import type { Database } from "./client";
import { products, protocols } from "./schema";

/** Catalog storage and nearest-neighbour search with pgvector (cosine, HNSW index). */
export class DrizzleCatalogRepository implements ICatalogRepository {
  constructor(private readonly db: Database) {}

  async hashes() {
    const [p, q] = await Promise.all([
      this.db.select({ id: protocols.id, hash: protocols.contentHash }).from(protocols),
      this.db.select({ id: products.id, hash: products.contentHash }).from(products),
    ]);
    return { protocols: new Map(p.map((r) => [r.id, r.hash])), products: new Map(q.map((r) => [r.id, r.hash])) };
  }

  async upsertProtocols(items: Embedded<Protocol>[]) {
    if (!items.length) return;
    await this.db
      .insert(protocols)
      .values(
        items.map(({ item, embedding, contentHash }) => ({
          id: item.id,
          title: item.title,
          summary: item.summary,
          steps: item.steps,
          tags: item.tags,
          embedding,
          contentHash,
        })),
      )
      .onConflictDoUpdate({
        target: protocols.id,
        set: {
          title: sql`excluded.title`,
          summary: sql`excluded.summary`,
          steps: sql`excluded.steps`,
          tags: sql`excluded.tags`,
          embedding: sql`excluded.embedding`,
          contentHash: sql`excluded.content_hash`,
          updatedAt: new Date(),
        },
      });
  }

  async upsertProducts(items: Embedded<Product>[]) {
    if (!items.length) return;
    await this.db
      .insert(products)
      .values(
        items.map(({ item, embedding, contentHash }) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          url: item.url ?? null,
          affiliate: item.affiliate,
          ownBrand: item.ownBrand,
          tags: item.tags,
          embedding,
          contentHash,
        })),
      )
      .onConflictDoUpdate({
        target: products.id,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          url: sql`excluded.url`,
          affiliate: sql`excluded.affiliate`,
          ownBrand: sql`excluded.own_brand`,
          tags: sql`excluded.tags`,
          embedding: sql`excluded.embedding`,
          contentHash: sql`excluded.content_hash`,
          updatedAt: new Date(),
        },
      });
  }

  async retain(ids: { protocols: string[]; products: string[] }) {
    if (ids.protocols.length) await this.db.delete(protocols).where(notInArray(protocols.id, ids.protocols));
    else await this.db.delete(protocols);
    if (ids.products.length) await this.db.delete(products).where(notInArray(products.id, ids.products));
    else await this.db.delete(products);
  }

  async nearestProtocols(embedding: number[], limit: number) {
    const distance = cosineDistance(protocols.embedding, embedding);
    const rows = await this.db
      .select({
        id: protocols.id,
        title: protocols.title,
        summary: protocols.summary,
        steps: protocols.steps,
        tags: protocols.tags,
        distance,
      })
      .from(protocols)
      .orderBy(distance)
      .limit(limit);
    return rows.map(({ distance: d, ...item }) => ({ item, similarity: toSimilarity(d) }));
  }

  async nearestProducts(embedding: number[], limit: number) {
    const distance = cosineDistance(products.embedding, embedding);
    const rows = await this.db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        url: products.url,
        affiliate: products.affiliate,
        ownBrand: products.ownBrand,
        tags: products.tags,
        distance,
      })
      .from(products)
      .orderBy(distance)
      .limit(limit);
    return rows.map(({ distance: d, url, ...item }) => ({
      item: { ...item, ...(url ? { url } : {}) },
      similarity: toSimilarity(d),
    }));
  }
}

/** Cosine distance (0–2) → similarity clamped to 0–1. */
const toSimilarity = (distance: unknown) => Math.min(1, Math.max(0, 1 - Number(distance)));
