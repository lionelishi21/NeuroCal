import { type Food, dietsFor } from "../../domain/foods";
import type { DietaryPreference } from "../../domain/types";
import type { IEatingOutRepository } from "../interfaces/IEatingOut";

export type CatalogFood = Food & { diets: DietaryPreference[] };

const withDiets = (food: Food): CatalogFood => ({ ...food, diets: dietsFor(food) });

/**
 * The whole food catalog with the diets each food fits, then the chain-restaurant items (eating out):
 * the built-in ones and those admins added. Small enough for clients to search and filter themselves.
 */
export class ListFoodsUseCase {
  private readonly foods: CatalogFood[];

  constructor(
    foods: readonly Food[],
    eatingOut: readonly Food[] = [],
    private readonly added?: IEatingOutRepository,
  ) {
    this.foods = [...[...foods].sort((a, b) => a.name.localeCompare(b.name)), ...eatingOut].map(withDiets);
  }

  async execute(): Promise<CatalogFood[]> {
    const added = (await this.added?.list()) ?? [];
    if (!added.length) return this.foods;
    // An admin's item with a built-in id replaces it.
    const ids = new Set(added.map((f) => f.id));
    return [...this.foods.filter((f) => !ids.has(f.id)), ...added.map(withDiets)];
  }
}
