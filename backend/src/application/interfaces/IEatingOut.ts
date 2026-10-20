import type { Food } from "../../domain/foods";

/** Eating-out items admins add from chains' published figures (the built-in ones live in the catalog). */
export interface IEatingOutRepository {
  /** Oldest first. */
  list(): Promise<Food[]>;
  /** Adds the item, or replaces the one with the same id. */
  save(food: Food): Promise<void>;
  delete(id: string): Promise<boolean>;
}
