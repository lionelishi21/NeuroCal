import { describe, expect, it } from "@jest/globals";
import { DEVICE_CATEGORIES, deviceKey, linkFromResults } from "../../domain/devices";
import { DEVICE_RULES } from "../../domain/shopping";
import { FakeDeviceExtractor, FakeEmbedder, FakeWebSearch, InMemoryCatalog, InMemoryDeviceCandidates } from "../testing/fakes";
import { AdminProductUseCases } from "./AdminProductUseCases";
import { DeviceScoutUseCases } from "./DeviceScoutUseCases";

const admin = { isAdmin: true };

function build(search: FakeWebSearch | null = new FakeWebSearch()) {
  const candidates = new InMemoryDeviceCandidates();
  const catalog = new InMemoryCatalog();
  const useCase = new DeviceScoutUseCases(candidates, search, new FakeDeviceExtractor(), new AdminProductUseCases(catalog, new FakeEmbedder()));
  return { candidates, catalog, useCase };
}

describe("DeviceScoutUseCases", () => {
  it("finds devices per category, keeps only links from the results, and doesn't add one twice", async () => {
    const { candidates, useCase } = build();
    expect(await useCase.scan()).toEqual({ added: DEVICE_CATEGORIES.length });
    expect(candidates.items.map((d) => d.tag)).toEqual(DEVICE_CATEGORIES.map((c) => c.tag));
    expect(candidates.items.every((d) => d.status === "pending" && d.url.startsWith("https://maker"))).toBe(true);
    expect(candidates.items.some((d) => d.name === "Made-up device")).toBe(false);
  });

  it("an approved device becomes a product tagged for its category; nothing is a product before", async () => {
    const { candidates, catalog, useCase } = build();
    await useCase.scan();
    expect(catalog.products.size).toBe(0);
    const device = candidates.items[0]!;
    const approved = await useCase.review(admin, device.id, { decision: "approve", name: "Ceramic air fryer" });
    expect(approved).toMatchObject({ status: "approved", name: "Ceramic air fryer" });
    const product = catalog.products.get(approved.productId!)!.item;
    expect(product).toMatchObject({ name: "Ceramic air fryer", url: device.url, affiliate: false });
    expect(product.tags).toContain("kitchen:air-fryer");
    await expect(useCase.review(admin, device.id, { decision: "approve" })).rejects.toThrow("already a product");
    expect((await useCase.review(admin, candidates.items[1]!.id, { decision: "dismiss" })).status).toBe("dismissed");
  });

  it("is for admins only, and says what's missing without a search key", async () => {
    const { useCase } = build(null);
    await expect(useCase.list({ isAdmin: false })).rejects.toThrow("Only an admin");
    expect(useCase.canScan()).toBe(false);
    expect(await useCase.scan()).toEqual({ added: 0 });
    await expect(useCase.scanAsAdmin(admin)).rejects.toThrow("TAVILY_API_KEY");
  });

  it("every device the shopping review asks for is a category the scout searches", () => {
    expect(DEVICE_RULES.map((r) => r.tag).sort()).toEqual(DEVICE_CATEGORIES.map((c) => c.tag).sort());
  });

  it("matches names loosely and refuses links that weren't in the results", () => {
    expect(deviceKey("Ninja CREAMi® NC301")).toBe(deviceKey("ninja creami nc301"));
    expect(linkFromResults("https://a.example/p#top", ["https://a.example/p"])).toBe("https://a.example/p");
    expect(linkFromResults("http://a.example/p", ["http://a.example/p"])).toBeNull();
    expect(linkFromResults("https://b.example/p", ["https://a.example/p"])).toBeNull();
  });
});
