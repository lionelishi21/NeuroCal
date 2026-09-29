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
  async function setup(nights: number[]) {
    const profiles = new InMemoryProfiles();
    const telemetry = new InMemoryTelemetry();
    const catalog = new InMemoryCatalog();
    const embedder = new FakeEmbedder();
    await profiles.save(profile({ timeZone: "UTC", cognitiveGoals: [] }));
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
});
