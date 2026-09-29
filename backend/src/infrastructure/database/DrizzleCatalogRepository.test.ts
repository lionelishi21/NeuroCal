import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { FakeEmbedder } from "../../application/testing/fakes";
import { SyncCatalogUseCase } from "../../application/use-cases/SyncCatalogUseCase";
import { PRODUCTS, PROTOCOLS } from "../catalog/catalog";
import type { Database } from "./client";
import { DrizzleCatalogRepository } from "./DrizzleCatalogRepository";
import { createPgliteDatabase } from "./pglite";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createPgliteDatabase());
}, 60_000);
afterAll(() => close());

describe("DrizzleCatalogRepository (pgvector)", () => {
  it("syncs the catalog and finds nearest entries by cosine distance", async () => {
    const repo = new DrizzleCatalogRepository(db);
    const embedder = new FakeEmbedder();
    expect(await new SyncCatalogUseCase(repo, embedder).execute({ protocols: PROTOCOLS, products: PRODUCTS })).toEqual({
      embedded: PROTOCOLS.length + PRODUCTS.length,
    });
    expect((await repo.hashes()).protocols.size).toBe(PROTOCOLS.length);

    const [query] = await embedder.embed(["Help with stress and low focus."]);
    const nearest = await repo.nearestProtocols(query!, 2);
    expect(nearest.map((n) => n.item.id)).toEqual(expect.arrayContaining(["box-breathing"]));
    expect(nearest[0]!.similarity).toBeGreaterThan(nearest[1]!.similarity - 1e-9);
    expect(nearest[0]!.item.steps.length).toBeGreaterThan(0);

    const products = await repo.nearestProducts(query!, 1);
    expect(products[0]!.item).toMatchObject({ affiliate: false });
    expect(products[0]!.item).not.toHaveProperty("url");
  });

  it("keeps affiliate, own-brand, supplement and url, and drops entries removed from the source", async () => {
    const repo = new DrizzleCatalogRepository(db);
    const partner = { ...PRODUCTS[0]!, url: "https://example.com/alarm", affiliate: true, ownBrand: true, supplement: true };
    await new SyncCatalogUseCase(repo, new FakeEmbedder()).execute({ protocols: PROTOCOLS.slice(0, 2), products: [partner] });
    const [query] = await new FakeEmbedder().embed([partner.description]);
    expect((await repo.nearestProducts(query!, 5)).map((p) => p.item)).toEqual([
      expect.objectContaining({ id: partner.id, affiliate: true, ownBrand: true, supplement: true, url: "https://example.com/alarm" }),
    ]);
    expect((await repo.hashes()).protocols.size).toBe(2);
  });
});
