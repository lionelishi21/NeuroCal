import { type EatingOutEntry, eatingOutFood } from "../../domain/eatingOut";
import { ForbiddenError, NotFoundError } from "../../domain/errors";
import type { Food } from "../../domain/foods";
import type { IEatingOutRepository } from "../interfaces/IEatingOut";
import type { AdminCaller } from "./AdminProductUseCases";

const requireAdmin = (caller: AdminCaller) => {
  if (!caller.isAdmin) throw new ForbiddenError("Only an admin can manage eating-out menus.");
};

/**
 * Admins add chain menu items that can't be read automatically (McDonald's, KFC and Burger King UK
 * block it), typing each from the chain's own nutrition page. They appear in GET /foods next to the
 * built-in ones.
 */
export class EatingOutAdminUseCases {
  constructor(private readonly items: IEatingOutRepository) {}

  async list(caller: AdminCaller): Promise<Food[]> {
    requireAdmin(caller);
    return this.items.list();
  }

  async save(caller: AdminCaller, entry: EatingOutEntry): Promise<Food> {
    requireAdmin(caller);
    const food = eatingOutFood(entry);
    await this.items.save(food);
    return food;
  }

  async remove(caller: AdminCaller, id: string): Promise<void> {
    requireAdmin(caller);
    if (!(await this.items.delete(id))) throw new NotFoundError("That item isn't on the list.");
  }
}
