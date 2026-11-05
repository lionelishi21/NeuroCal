import { describe, expect, it } from "@jest/globals";
import { UpstreamError } from "../../domain/errors";
import { FOODS } from "../../infrastructure/catalog/foods";
import { stubDishRecipes } from "../../infrastructure/dev/StubProviders";
import type { IDishRecipeWriter } from "../interfaces/IDishRecipeWriter";
import { CookThisUseCase } from "./CookThisUseCase";
import { GetBioStateUseCase } from "./GetBioStateUseCase";
import { FixedClock, InMemoryCheckIns, InMemoryMeals, InMemoryStorage, InMemoryPantry, InMemoryProfiles, profile } from "../testing/fakes";

const photo = { bytes: new Uint8Array([1, 2, 3]), mediaType: "image/jpeg" };

async function build(writer: IDishRecipeWriter) {
  const profiles = new InMemoryProfiles();
  await profiles.save(profile());
  const pantry = new InMemoryPantry();
  await pantry.add("u1", ["olive oil", "Zucchinis"]);
  const clock = new FixedClock(new Date("2026-09-29T15:00:00Z"));
  const bio = new GetBioStateUseCase(profiles, new InMemoryMeals(), new InMemoryCheckIns(), clock);
  const calls: Parameters<IDishRecipeWriter["write"]>[0][] = [];
  const spy: IDishRecipeWriter = {
    write: (input) => {
      calls.push(input);
      return writer.write(input);
    },
  };
  return { useCase: new CookThisUseCase(spy, new InMemoryStorage(), profiles, pantry, bio, FOODS), calls };
}

describe("CookThisUseCase", () => {
  it("writes the dish for the person, works out nutrition per serving from the catalog and marks the pantry", async () => {
    const { useCase, calls } = await build(stubDishRecipes);
    const result = await useCase.execute({ userId: "u1", photo });
    if ("problem" in result) throw new Error("expected a recipe");
    expect(calls[0]!.context.proteinPerServingG).toBeGreaterThanOrEqual(20);
    expect(calls[0]!.catalog.length).toBe(FOODS.length);
    expect(result.ingredients.filter((i) => i.inPantry).map((i) => i.name)).toEqual(["Zucchini", "Olive oil"]);
    // Per serving: the stub's six ingredients for two.
    expect(result.servings).toBe(2);
    expect(result.calories).toBeGreaterThan(400);
    expect(result.calories).toBeLessThan(550);
    expect(result.swaps).toHaveLength(2);
  });

  it("passes on a photo with no dish in it", async () => {
    const { useCase } = await build({ write: async () => ({ problem: "no_food_found" }) });
    expect(await useCase.execute({ userId: "u1", photo })).toEqual({ problem: "no_food_found" });
  });

  it("says the reader is down when the model fails", async () => {
    const { useCase } = await build({
      write: async () => {
        throw new Error("429 quota");
      },
    });
    await expect(useCase.execute({ userId: "u1", photo })).rejects.toBeInstanceOf(UpstreamError);
  });
});
