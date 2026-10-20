import { describe, expect, it, jest } from "@jest/globals";
import type { AdminProduct } from "../../domain/types";
import type { ICatalogRepository } from "../interfaces/ICatalogRepository";
import { FakeBetterChoice, InMemoryPantry, InMemoryProfiles, profile } from "../testing/fakes";
import { BetterChoiceUseCase } from "./BetterChoiceUseCase";

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

async function setUp(products: AdminProduct[] = []) {
  const profiles = new InMemoryProfiles();
  await profiles.save(profile());
  const pantry = new InMemoryPantry();
  await pantry.add("u1", ["Oats"]);
  const advisor = new FakeBetterChoice();
  return { advisor, useCase: new BetterChoiceUseCase(profiles, pantry, advisor, catalog(products)) };
}

const granola = {
  userId: "u1",
  brand: "Crunchy Co",
  productName: "Crunchy Co Honey Granola",
  ingredients: ["Oats", "sugar", "soy lecithin", "natural\nflavor"],
  processing: "ultra_processed" as const,
};

describe("BetterChoiceUseCase", () => {
  it("finds the industrial ingredients itself and marks the homemade recipe by what's in the pantry", async () => {
    const { advisor, useCase } = await setUp();
    const choice = await useCase.execute(granola);
    expect(advisor.calls[0]).toMatchObject({
      food: "Crunchy Co Honey Granola",
      ingredients: ["Oats", "sugar", "soy lecithin", "natural flavor"],
      markers: ["emulsifier", "flavouring"],
      pantry: ["Oats"],
    });
    expect(choice.lookFor).toMatch(/oats/);
    expect(choice.homemade!.ingredients.map((i) => [i.name, i.inPantry])).toEqual([
      ["Oats", true],
      ["coconut oil", false],
    ]);
  });

  it("shows an enabled device only when the recipe's steps use it", async () => {
    const { useCase } = await setUp([device("blender", "kitchen:blender"), device("off-fryer", "kitchen:air-fryer", false), device("fryer", "kitchen:air-fryer")]);
    expect((await useCase.execute(granola)).device?.id).toBe("fryer");

    const { useCase: none } = await setUp([device("blender", "kitchen:blender")]);
    expect((await none.execute(granola)).device).toBeUndefined();
  });

  it("gives only what to look for when there's no homemade version", async () => {
    const { useCase } = await setUp([device("fryer", "kitchen:air-fryer")]);
    expect(await useCase.execute({ ...granola, productName: "Cola soda" })).toEqual({ lookFor: "Look for only oats, nuts and honey." });
  });

  it("turns an advisor failure into a plain retry message", async () => {
    const { advisor, useCase } = await setUp();
    advisor.suggest = async () => {
      throw new Error("timeout");
    };
    const quiet = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(useCase.execute(granola)).rejects.toThrow("Try again in a moment");
    quiet.mockRestore();
  });
});
