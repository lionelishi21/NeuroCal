import { and, asc, cosineDistance, eq, notInArray, sql } from "drizzle-orm";
import type { Embedded, ICatalogRepository } from "../../application/interfaces/ICatalogRepository";
import type { AdminProduct, Product, ProductSettings, Protocol } from "../../domain/types";
import type { Database } from "./client";
import { products, protocols } from "./schema";

/** Catalog storage and nearest-neighbour search with pgvector (cosine, HNSW index). */
export class DrizzleCatalogRepository implements ICatalogRepository {
  constructor(private readonly db: Database) {}

  async hashes() {
    const [p, q] = await Promise.all([
      this.db.select({ id: protocols.id, hash: protocols.contentHash }).from(protocols),
      this.db.select({ id: products.id, hash: products.contentHash }).from(products).where(eq(products.managedBy, "catalog")),
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
          supplement: item.supplement,
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
          supplement: sql`excluded.supplement`,
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
    const fromCatalog = eq(products.managedBy, "catalog");
    await this.db.delete(products).where(ids.products.length ? and(fromCatalog, notInArray(products.id, ids.products)) : fromCatalog);
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

  async nearestProducts(embedding: number[], limit: number, only?: "ownSupplements") {
    const distance = cosineDistance(products.embedding, embedding);
    const shown = eq(products.enabled, true);
    const rows = await this.db
      .select({ ...productColumns, distance })
      .from(products)
      .where(only === "ownSupplements" ? and(shown, eq(products.ownBrand, true), eq(products.supplement, true)) : shown)
      .orderBy(distance)
      .limit(limit);
    return rows.map(({ distance: d, ...row }) => ({ item: toProduct(row), similarity: toSimilarity(d) }));
  }

  async listProducts() {
    const rows = await this.db.select(productColumns).from(products).orderBy(asc(products.name));
    return rows.map(toAdminProduct);
  }

  async updateProductSettings(id: string, settings: ProductSettings) {
    const [row] = await this.db
      .update(products)
      .set({
        ...(settings.url !== undefined ? { urlOverride: settings.url } : {}),
        ...(settings.affiliate !== undefined ? { affiliateOverride: settings.affiliate } : {}),
        ...(settings.enabled !== undefined ? { enabled: settings.enabled } : {}),
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning(productColumns);
    return row ? toAdminProduct(row) : null;
  }

  async addProduct({ item, embedding, contentHash }: Embedded<Product>) {
    const [row] = await this.db
      .insert(products)
      .values({
        id: item.id,
        name: item.name,
        description: item.description,
        url: item.url ?? null,
        affiliate: item.affiliate,
        ownBrand: item.ownBrand,
        supplement: item.supplement,
        tags: item.tags,
        embedding,
        contentHash,
        managedBy: "admin",
      })
      .returning(productColumns);
    return toAdminProduct(row!);
  }

  async removeAdminProduct(id: string) {
    const removed = await this.db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.managedBy, "admin")))
      .returning({ id: products.id });
    return removed.length > 0;
  }
}

const productColumns = {
  id: products.id,
  name: products.name,
  description: products.description,
  url: products.url,
  affiliate: products.affiliate,
  ownBrand: products.ownBrand,
  supplement: products.supplement,
  tags: products.tags,
  managedBy: products.managedBy,
  enabled: products.enabled,
  urlOverride: products.urlOverride,
  affiliateOverride: products.affiliateOverride,
};
type ProductRow = Pick<typeof products.$inferSelect, keyof typeof productColumns>;

/** What users are shown: the admin's link and label where set, the catalog's otherwise. */
function toProduct(row: ProductRow): Product {
  const url = row.urlOverride ?? row.url;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ...(url ? { url } : {}),
    affiliate: row.affiliateOverride ?? row.affiliate,
    ownBrand: row.ownBrand,
    supplement: row.supplement,
    tags: row.tags,
  };
}

function toAdminProduct(row: ProductRow): AdminProduct {
  return {
    ...toProduct(row),
    enabled: row.enabled,
    managedBy: row.managedBy === "admin" ? "admin" : "catalog",
    ...(row.urlOverride && row.url ? { catalogUrl: row.url } : {}),
  };
}

/** Cosine distance (0–2) → similarity clamped to 0–1. */
const toSimilarity = (distance: unknown) => Math.min(1, Math.max(0, 1 - Number(distance)));
