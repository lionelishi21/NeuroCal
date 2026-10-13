import { describe, expect, it } from "@jest/globals";
import { PRODUCTS, PROTOCOLS } from "../../infrastructure/catalog/catalog";
import type { SupplementLabelReading } from "../../domain/supplement";
import { FakeEmbedder, FakeLabelReader, FixedClock, InMemoryCatalog, InMemoryStorage } from "../testing/fakes";
import { AnalyzeSupplementLabelUseCase } from "./AnalyzeSupplementLabelUseCase";
import { SyncCatalogUseCase } from "./SyncCatalogUseCase";

const photo = { bytes: new Uint8Array([0xff, 0xd8]), mediaType: "image/jpeg" };
const magnesium: SupplementLabelReading = {
  brand: "Calm Labs",
  productName: "Magnesium Glycinate",
  ingredients: [{ name: "Magnesium glycinate", amount: 200, unit: "mg", inBlend: false }],
  proprietaryBlend: false,
  testing: [],
};

async function setup(reading: SupplementLabelReading | Error, minAlternativeMatch = 0) {
  const catalog = new InMemoryCatalog();
  const embedder = new FakeEmbedder();
  await new SyncCatalogUseCase(catalog, embedder).execute({ protocols: PROTOCOLS, products: PRODUCTS });
  const reader = new FakeLabelReader(reading);
  const storage = new InMemoryStorage();
  const useCase = new AnalyzeSupplementLabelUseCase(reader, storage, catalog, embedder, new FixedClock(new Date("2026-10-13T12:00:00Z")), { minAlternativeMatch });
  return { useCase, reader, storage };
}

describe("AnalyzeSupplementLabelUseCase", () => {
  it("returns the label, the flags and a close own-brand alternative", async () => {
    const { useCase } = await setup(magnesium);
    const result = await useCase.execute(photo);
    expect(result.summary).toBe("Calm Labs Magnesium Glycinate: 1 ingredient.");
    expect(result.flags.map((f) => f.kind)).toEqual(["no_third_party_testing"]);
    expect(result.alternative?.item).toMatchObject({ ownBrand: true, supplement: true });
  });

  it("offers no alternative when nothing is close enough, or the product is already ours", async () => {
    expect((await (await setup(magnesium, 1.01)).useCase.execute(photo)).alternative).toBeUndefined();
    expect((await (await setup({ ...magnesium, brand: "MitoProof" })).useCase.execute(photo)).alternative).toBeUndefined();
  });

  it("reads only the caller's own uploads", async () => {
    const { useCase, storage, reader } = await setup(magnesium);
    storage.objects.set("uploads/u2/x", photo);
    await expect(useCase.executeForKey({ userId: "u1", photoKey: "uploads/u2/x" })).rejects.toThrow("That photo isn't there");
    expect(reader.calls).toHaveLength(0);
  });

  it("turns a reader failure into a retryable error and refuses non-images", async () => {
    await expect((await setup(new Error("timeout"))).useCase.execute(photo)).rejects.toThrow("The label couldn't be read right now");
    await expect((await setup(magnesium)).useCase.execute({ ...photo, mediaType: "application/pdf" })).rejects.toThrow("Attach a photo of the label.");
  });
});
