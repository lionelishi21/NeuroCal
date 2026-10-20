import { type Food, dietsFor } from "../../domain/foods";
import type { DietaryPreference } from "../../domain/types";

export type CatalogFood = Food & { diets: DietaryPreference[] };

/**
 * The whole food catalog with the diets each food fits, then the chain-restaurant items (eating out).
 * Small enough for clients to search and filter themselves.
 */
export class ListFoodsUseCase {
  private readonly foods: CatalogFood[];

  constructor(foods: readonly Food[], eatingOut: readonly Food[] = []) {
    this.foods = [...[...foods].sort((a, b) => a.name.localeCompare(b.name)), ...eatingOut].map((food) => ({ ...food, diets: dietsFor(food) }));
  }

  execute(): CatalogFood[] {
    return this.foods;
  }
}
