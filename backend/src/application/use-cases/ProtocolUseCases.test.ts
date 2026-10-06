import { describe, expect, it } from "@jest/globals";
import { PRODUCTS, PROTOCOLS } from "../../infrastructure/catalog/catalog";
import {
  FakeEmbedder,
  FixedClock,
  InMemoryCatalog,
  InMemoryCheckIns,
  InMemoryMeals,
  InMemoryProfiles,
  InMemoryTelemetry,
  profile,
} from "../testing/fakes";
import { ForbiddenError, InvalidError, NotFoundError } from "../../domain/errors";
import type { Product, Profile } from "../../domain/types";
import { AdminProductUseCases } from "./AdminProductUseCases";
import { GetProtocolsUseCase } from "./GetProtocolsUseCase";
import { SyncCatalogUseCase } from "./SyncCatalogUseCase";

describe("SyncCatalogUseCase", () => {
  it("embeds everything once, then only what changed, and drops removed entries", async () => {
    const catalog = new InMemoryCatalog();
    const embedder = new FakeEmbedder();
    const sync = new SyncCatalogUseCase(catalog, embedder);

    expect(await sync.execute({ protocols: PROTOCOLS, products: PRODUCTS })).toEqual({ embedded: PROTOCOLS.length + PRODUCTS.length });
    expect(await sync.execute({ protocols: PROTOCOLS, products: PRODUCTS })).toEqual({ embedded: 0 });

    const edited = [{ ...PROTOCOLS[0]!, summary: "Changed summary." }, ...PROTOCOLS.slice(1, -1)];
    expect(await sync.execute({ protocols: edited, products: PRODUCTS })).toEqual({ embedded: 1 });
    expect(catalog.protocols.size).toBe(PROTOCOLS.length - 1);

    // A new partner URL or affiliate flag counts as a change even though the embedded text is the same.
    const partnered = [{ ...PRODUCTS[0]!, url: "https://example.com/p", affiliate: true }, ...PRODUCTS.slice(1)];
    expect(await sync.execute({ protocols: edited, products: partnered })).toEqual({ embedded: 1 });
    expect(catalog.products.get(PRODUCTS[0]!.id)?.item.affiliate).toBe(true);
  });
});

describe("GetProtocolsUseCase", () => {
  async function setup(nights: number[], bioProfile?: Profile["bioProfile"]) {
    const profiles = new InMemoryProfiles();
    const telemetry = new InMemoryTelemetry();
    const catalog = new InMemoryCatalog();
    const embedder = new FakeEmbedder();
    await profiles.save(profile({ timeZone: "UTC", cognitiveGoals: [], ...(bioProfile ? { bioProfile } : {}) }));
    // One night per day ending at 06:00 UTC, for the last N days up to 29 Sep.
    for (const [i, hours] of nights.entries()) {
      const end = new Date(Date.UTC(2026, 8, 29 - (nights.length - 1 - i), 6));
      await telemetry.upsertSleep("u1", [{ start: new Date(end.getTime() - hours * 3_600_000), end, source: "manual" }]);
    }
    await new SyncCatalogUseCase(catalog, embedder).execute({ protocols: PROTOCOLS, products: PRODUCTS });
    const clock = new FixedClock(new Date("2026-09-29T12:00:00Z"));
    const checkIns = new InMemoryCheckIns();
    return {
      embedder,
      checkIns,
      useCase: new GetProtocolsUseCase(profiles, new InMemoryMeals(), checkIns, telemetry, catalog, embedder, clock),
    };
  }

  it("matches sleep protocols to a week of short sleep", async () => {
    const { useCase, embedder } = await setup([5, 5.5, 6, 5, 6, 5.5, 6]);
    const result = await useCase.execute({ userId: "u1" });

    // Daily sleep components (rounded to 2 dp) average 4.89 / 7.
    expect(result.weakPoints).toEqual([{ component: "sleep", label: "short or light sleep", average: 0.7 }]);
    expect(embedder.calls.at(-1)).toEqual(["Help with short or light sleep."]);
    expect(result.protocols).toHaveLength(2);
    expect(result.protocols.map((p) => p.item.tags)).toEqual(expect.arrayContaining([expect.arrayContaining(["sleep"])]));
    expect(result.protocols[0]!.item.id).toMatch(/wind-down-hour|consistent-wake-time/);
    expect(result.products).toHaveLength(2);
    expect(result.products[0]!.similarity).toBeGreaterThan(0);
  });

  it("addresses each weak point with its own match", async () => {
    const { useCase, embedder, checkIns } = await setup([5, 5.5, 5, 5.5, 5, 5.5, 5]);
    for (const day of [23, 24, 25, 26, 27, 28, 29]) {
      await checkIns.create("u1", { at: new Date(Date.UTC(2026, 8, day, 15)), flags: ["stressed", "low_focus"] });
    }
    const result = await useCase.execute({ userId: "u1" });
    expect(result.weakPoints.map((w) => w.component)).toEqual(["stress", "sleep"]);
    expect(embedder.calls.at(-1)).toEqual(["Help with stress and low focus.", "Help with short or light sleep."]);
    const ids = result.protocols.map((p) => p.item.id);
    expect(ids).toHaveLength(2);
    expect(ids.some((id) => ["box-breathing", "focus-blocks"].includes(id))).toBe(true);
    expect(ids.some((id) => ["wind-down-hour", "consistent-wake-time"].includes(id))).toBe(true);
  });

  it("still suggests something when nothing is weak", async () => {
    const { useCase, embedder } = await setup([8, 8, 8]);
    const result = await useCase.execute({ userId: "u1" });
    expect(result.weakPoints).toEqual([]);
    expect(embedder.calls.at(-1)).toEqual(["Maintain steady focus, energy and sleep."]);
    expect(result.protocols.length).toBeGreaterThan(0);
  });

  it("searches for the onboarding friction point first, even with no data yet", async () => {
    const fresh = await setup([], { friction: "night_waking" });
    await fresh.useCase.execute({ userId: "u1" });
    expect(fresh.embedder.calls.at(-1)).toEqual(["Help with waking in the night."]);

    // The crash at 2pm is what the coffee routine is for.
    const crashing = await setup([], { friction: "afternoon_crash" });
    const suggested = await crashing.useCase.execute({ userId: "u1" });
    expect(suggested.protocols[0]!.item.id).toBe("coffee-without-the-crash");

    const tired = await setup([5, 5.5, 6, 5, 6, 5.5, 6], { friction: "afternoon_crash" });
    const result = await tired.useCase.execute({ userId: "u1" });
    expect(tired.embedder.calls.at(-1)).toEqual(["Help with afternoon energy crashes.", "Help with short or light sleep."]);
    expect(result.weakPoints.map((w) => w.component)).toEqual(["sleep"]);
  });
});

describe("product admin and own-brand priority", () => {
  const admin = { isAdmin: true };
  const base = { affiliate: false, ownBrand: false, supplement: false };
  const sleepMask: Product = { ...base, id: "mask", name: "Sleep mask", description: "Blocks light.", tags: ["sleep"] };
  const otherMagnesium: Product = { ...base, id: "other-mag", name: "Brand X magnesium", description: "Magnesium for sleep.", url: "https://brandx.example/", supplement: true, tags: ["sleep", "short sleep"] };
  const ownWhey: Product = { ...base, id: "own-whey", name: "Own whey", description: "Protein powder.", url: "https://own.example/whey", ownBrand: true, supplement: true, tags: ["protein"] };
  const ownMagnesium: Product = { ...base, id: "own-mag", name: "Own magnesium", description: "Magnesium for sleep.", url: "https://own.example/mag", ownBrand: true, supplement: true, tags: ["sleep", "short sleep"] };

  async function setup(products: Product[]) {
    const catalog = new InMemoryCatalog();
    const embedder = new FakeEmbedder();
    await new SyncCatalogUseCase(catalog, embedder).execute({ protocols: PROTOCOLS, products });
    return { catalog, embedder, admin: new AdminProductUseCases(catalog, embedder) };
  }

  it("refuses everyone who isn't an admin", async () => {
    const { admin: useCases } = await setup([sleepMask]);
    const visitor = { isAdmin: false };
    await expect(useCases.list(visitor)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(useCases.update(visitor, "mask", { enabled: false })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(useCases.create(visitor, { ...base, name: "X", description: "Y", tags: [] })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(useCases.remove(visitor, "mask")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("swaps a link and label, keeps them through a catalog sync, and can go back", async () => {
    const { catalog, embedder, admin: useCases } = await setup([otherMagnesium]);
    const updated = await useCases.update(admin, "other-mag", { url: "https://brandx.example/?ref=neurocal", affiliate: true });
    expect(updated).toMatchObject({ url: "https://brandx.example/?ref=neurocal", catalogUrl: "https://brandx.example/", affiliate: true, enabled: true, managedBy: "catalog" });

    // A deploy edits the catalog entry and syncs: the admin's link and label stay.
    await new SyncCatalogUseCase(catalog, embedder).execute({ protocols: PROTOCOLS, products: [{ ...otherMagnesium, description: "Magnesium, reworded." }] });
    const [shown] = await catalog.nearestProducts((await embedder.embed(["sleep"]))[0]!, 1);
    expect(shown!.item).toMatchObject({ url: "https://brandx.example/?ref=neurocal", affiliate: true, description: "Magnesium, reworded." });

    expect(await useCases.update(admin, "other-mag", { url: null })).toMatchObject({ url: "https://brandx.example/" });
    await expect(useCases.update(admin, "other-mag", { url: "http://not-secure.example" })).rejects.toBeInstanceOf(InvalidError);
    await expect(useCases.update(admin, "missing", { enabled: false })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("never suggests a product that is turned off", async () => {
    const { catalog, embedder, admin: useCases } = await setup([sleepMask]);
    await useCases.update(admin, "mask", { enabled: false });
    expect(await catalog.nearestProducts((await embedder.embed(["sleep"]))[0]!, 5)).toEqual([]);
    expect((await useCases.list(admin)).map((p) => [p.id, p.enabled])).toEqual([["mask", false]]);
  });

  it("adds a product that survives catalog syncs, and removes only products it added", async () => {
    const { catalog, embedder, admin: useCases } = await setup([sleepMask]);
    const created = await useCases.create(admin, { ...base, name: " Vitamin ADK ", description: "Vitamins A, D and K.", url: "https://own.example/adk", ownBrand: true, supplement: true, tags: ["Vitamins", "vitamins", " energy "] });
    expect(created).toMatchObject({ name: "Vitamin ADK", ownBrand: true, supplement: true, tags: ["vitamins", "energy"], managedBy: "admin", enabled: true });
    expect(created.id).toMatch(/^admin-/);

    await new SyncCatalogUseCase(catalog, embedder).execute({ protocols: PROTOCOLS, products: [sleepMask] });
    expect((await useCases.list(admin)).map((p) => p.id).sort()).toEqual([created.id, "mask"].sort());

    await expect(useCases.create(admin, { ...base, name: "No link", description: "x", ownBrand: true, tags: [] })).rejects.toBeInstanceOf(InvalidError);
    await expect(useCases.remove(admin, "mask")).rejects.toBeInstanceOf(NotFoundError);
    await useCases.remove(admin, created.id);
    expect((await useCases.list(admin)).map((p) => p.id)).toEqual(["mask"]);
  });

  it("puts an own-brand supplement in place of another brand's supplement", async () => {
    const { catalog, embedder } = await setup([sleepMask, otherMagnesium, ownWhey, ownMagnesium]);
    const [vector] = await embedder.embed(["Magnesium for sleep. sleep, short sleep"]);
    const profiles = new InMemoryProfiles();
    await profiles.save(profile());
    const useCase = new GetProtocolsUseCase(profiles, new InMemoryMeals(), new InMemoryCheckIns(), new InMemoryTelemetry(), catalog, { embed: async () => [vector!] }, new FixedClock(new Date("2026-09-29T17:00:00Z")), { protocols: 1, products: 3 });
    const { products } = await useCase.execute({ userId: "u1" });

    const ids = products.map((p) => p.item.id);
    expect(ids).not.toContain("other-mag");
    expect(ids).toContain("own-mag");
    // Non-supplements are left alone.
    expect(ids).toContain("mask");
  });

  it("keeps another brand's supplement when there is no own-brand one", async () => {
    const { catalog, embedder } = await setup([otherMagnesium]);
    const [vector] = await embedder.embed(["Magnesium for sleep."]);
    const profiles = new InMemoryProfiles();
    await profiles.save(profile());
    const useCase = new GetProtocolsUseCase(profiles, new InMemoryMeals(), new InMemoryCheckIns(), new InMemoryTelemetry(), catalog, { embed: async () => [vector!] }, new FixedClock(new Date("2026-09-29T17:00:00Z")));
    expect((await useCase.execute({ userId: "u1" })).products.map((p) => p.item.id)).toEqual(["other-mag"]);
  });
});
