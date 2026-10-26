import { InvalidError, NotFoundError } from "../../domain/errors";
import { MAX_LIST_ITEMS, type ShoppingListItem, aisleOf, listText, sameItem, sortList } from "../../domain/shoppingList";
import type { IClock } from "../interfaces/IClock";
import type { IPantryRepository } from "../interfaces/IPantry";
import type { IShoppingListRepository } from "../interfaces/IRepositories";

export interface ShoppingListView {
  /** Aisle order, then the order they were added. */
  items: ShoppingListItem[];
  /** What's still to buy, as text to share. */
  text: string;
}

const MAX_NAME = 80;
const MAX_QUANTITY = 40;

/** The shopping list someone keeps (domain/shoppingList.ts), and moving what's bought into the pantry. */
export class ShoppingListUseCases {
  constructor(
    private readonly list: IShoppingListRepository,
    private readonly pantry: Pick<IPantryRepository, "add">,
    private readonly clock: IClock,
  ) {}

  async get(userId: string): Promise<ShoppingListView> {
    return view(await this.list.list(userId));
  }

  /**
   * Adds items; one already on the list stays one line (a ticked one is unticked, and a quantity fills
   * in when it had none). Blank names are skipped.
   */
  async add(userId: string, entries: { name: string; quantity?: string }[], source: ShoppingListItem["source"] = "manual"): Promise<ShoppingListView> {
    const existing = await this.list.list(userId);
    const fresh: Omit<ShoppingListItem, "id">[] = [];
    const now = this.clock.now();
    for (const e of entries) {
      const name = e.name.trim().replace(/\s+/g, " ");
      const quantity = e.quantity?.trim() || undefined;
      if (!name) continue;
      if (name.length > MAX_NAME) throw new InvalidError(`Keep each item under ${MAX_NAME} characters.`);
      if (quantity && quantity.length > MAX_QUANTITY) throw new InvalidError(`Keep each amount under ${MAX_QUANTITY} characters.`);
      const onList = existing.find((i) => sameItem(i.name, name));
      if (onList) {
        const patch = { ...(onList.checked ? { checked: false } : {}), ...(!onList.quantity && quantity ? { quantity } : {}) };
        if (Object.keys(patch).length) await this.list.update(userId, onList.id, patch);
        continue;
      }
      if (fresh.some((i) => sameItem(i.name, name))) continue;
      fresh.push({ name, ...(quantity ? { quantity } : {}), aisle: aisleOf(name), checked: false, source, addedAt: now });
    }
    if (existing.length + fresh.length > MAX_LIST_ITEMS) throw new InvalidError(`A list holds ${MAX_LIST_ITEMS} items. Finish some shopping first.`);
    await this.list.add(userId, fresh);
    return this.get(userId);
  }

  async update(userId: string, id: string, patch: { checked?: boolean; quantity?: string | null; name?: string }): Promise<ShoppingListView> {
    const name = patch.name?.trim();
    if (name !== undefined && (!name || name.length > MAX_NAME)) throw new InvalidError(`Name it in 1 to ${MAX_NAME} characters.`);
    const quantity = patch.quantity === null ? undefined : patch.quantity?.trim() || undefined;
    if (quantity && quantity.length > MAX_QUANTITY) throw new InvalidError(`Keep the amount under ${MAX_QUANTITY} characters.`);
    const saved = await this.list.update(userId, id, {
      ...(patch.checked !== undefined ? { checked: patch.checked } : {}),
      ...(patch.quantity !== undefined ? { quantity } : {}),
      ...(name ? { name, aisle: aisleOf(name) } : {}),
    });
    if (!saved) throw new NotFoundError("That item isn't on your list.");
    return this.get(userId);
  }

  async remove(userId: string, id: string): Promise<ShoppingListView> {
    if (!(await this.list.delete(userId, id))) throw new NotFoundError("That item isn't on your list.");
    return this.get(userId);
  }

  /** Done shopping: the ticked items leave the list and, unless [toPantry] is false, go into the pantry. */
  async finish(userId: string, toPantry = true): Promise<ShoppingListView & { movedToPantry: number }> {
    const bought = await this.list.deleteChecked(userId);
    if (toPantry && bought.length) await this.pantry.add(userId, bought.map((b) => b.name));
    return { ...(await this.get(userId)), movedToPantry: toPantry ? bought.length : 0 };
  }
}

const view = (items: ShoppingListItem[]): ShoppingListView => ({ items: sortList(items), text: listText(items) });
