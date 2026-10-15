import { describe, expect, it } from "@jest/globals";
import type { ICatalogRepository } from "../interfaces/ICatalogRepository";
import { FakeShoppingReviewer, InMemoryProfiles, profile } from "../testing/fakes";
import { ReviewShoppingListUseCase } from "./ReviewShoppingListUseCase";
import type { AdminProduct } from "../../domain/types";

const device = (id: string, tag: string, enabled = true): AdminProduct => ({
  id,
  name: id,
  description: "A device.",
  url: `https://example.com/${id}`,
  affiliate: true,
  ownBrand: false,
  supplement: false,
  tags: ["kitchen", tag],
  enabled,
  managedBy: "catalog",
});
const catalog = (products: AdminProduct[]) => ({ listProducts: async () => products }) as unknown as ICatalogRepository;

describe("ReviewShoppingListUseCase", () => {
  it("suggests the enabled device a list calls for, with the items that called for it", async () => {
    const profiles = new InMemoryProfiles();
    await profiles.save(profile());
    const useCase = new ReviewShoppingListUseCase(
      profiles,
      new FakeShoppingReviewer(),
      catalog([device("air-fryer", "kitchen:air-fryer"), device("filter", "kitchen:water-filter", false)]),
    );
    const review = await useCase.execute({ userId: "u1", text: "Chicken nuggets\nBottled water\nSpinach" });
    expect(review.items.find((i) => i.name === "Chicken nuggets")).toMatchObject({ verdict: "swap" });
    // The water filter is switched off in the admin screen, so only the air fryer.
    expect(review.devices.map((d) => [d.product.id, d.because])).toEqual([["air-fryer", ["Chicken nuggets"]]]);
  });

  it("reads a photo when there is no text, and refuses an empty list", async () => {
    const profiles = new InMemoryProfiles();
    await profiles.save(profile());
    const reviewer = new FakeShoppingReviewer();
    const useCase = new ReviewShoppingListUseCase(profiles, reviewer, catalog([]));
    const review = await useCase.execute({ userId: "u1", photo: { bytes: new Uint8Array([0xff, 0xd8]), mediaType: "image/jpeg" } });
    expect(review.items).toHaveLength(1);
    expect(reviewer.calls[0]!.photo).toBeDefined();
    await expect(useCase.execute({ userId: "u1", text: " \n " })).rejects.toThrow("Add your list");
  });
});
