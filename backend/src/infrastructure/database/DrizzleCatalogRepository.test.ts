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

    // A generic product has no link, and the property is left out rather than null.
    const timer = PRODUCTS.find((p) => p.id === "focus-timer")!;
    const [timerQuery] = await embedder.embed([`${timer.name}. ${timer.description} ${timer.tags.join(", ")}`]);
    const products = await repo.nearestProducts(timerQuery!, 1);
    expect(products[0]!.item).toMatchObject({ id: "focus-timer", affiliate: false });
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

  it("stores admin settings apart from the catalog: links, labels, on/off and added products survive a sync", async () => {
    const repo = new DrizzleCatalogRepository(db);
    const embedder = new FakeEmbedder();
    const sync = new SyncCatalogUseCase(repo, embedder);
    const glasses = { id: "glasses", name: "Evening glasses", description: "Amber lenses for the evening.", url: "https://brand.example/", affiliate: false, ownBrand: false, supplement: false, tags: ["sleep"] };
    await sync.execute({ protocols: PROTOCOLS.slice(0, 1), products: [glasses] });

    expect(await repo.updateProductSettings("glasses", { url: "https://brand.example/?ref=neurocal", affiliate: true })).toEqual({
      ...glasses,
      url: "https://brand.example/?ref=neurocal",
      catalogUrl: "https://brand.example/",
      affiliate: true,
      enabled: true,
      managedBy: "catalog",
    });
    expect(await repo.updateProductSettings("nope", { enabled: false })).toBeNull();

    const own = { id: "admin-adk", name: "Vitamin ADK", description: "Vitamins A, D and K.", url: "https://own.example/adk", affiliate: false, ownBrand: true, supplement: true, tags: ["vitamins"] };
    const [vector] = await embedder.embed([own.description]);
    expect(await repo.addProduct({ item: own, embedding: vector!, contentHash: "h" })).toMatchObject({ id: "admin-adk", managedBy: "admin", enabled: true });

    // The catalog entry is reworded and synced again.
    await sync.execute({ protocols: PROTOCOLS.slice(0, 1), products: [{ ...glasses, description: "Amber lenses, reworded." }] });
    const listed = await repo.listProducts();
    expect(listed.map((p) => p.id)).toEqual(["glasses", "admin-adk"]);
    expect(listed[0]).toMatchObject({ description: "Amber lenses, reworded.", url: "https://brand.example/?ref=neurocal", affiliate: true });

    // Only own-brand supplements, on request; a disabled product is never returned.
    expect((await repo.nearestProducts(vector!, 5, "ownSupplements")).map((p) => p.item.id)).toEqual(["admin-adk"]);
    await repo.updateProductSettings("glasses", { enabled: false });
    expect((await repo.nearestProducts(vector!, 5)).map((p) => p.item.id)).toEqual(["admin-adk"]);
    expect((await repo.updateProductSettings("glasses", { url: null, enabled: true }))!.url).toBe("https://brand.example/");

    expect(await repo.removeAdminProduct("glasses")).toBe(false);
    expect(await repo.removeAdminProduct("admin-adk")).toBe(true);
  });
});
