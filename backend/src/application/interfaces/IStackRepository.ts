import type { StackItem } from "../../domain/stack";

export type NewStackItem = Omit<StackItem, "id">;
export type StackItemPatch = Partial<Pick<StackItem, "servingsPerDay" | "timing" | "startedOn">> & { servingsPerContainer?: number | null };

/** Every method is scoped to one user (ARCHITECTURE §10): another user's item reads as missing. */
export interface IStackRepository {
  /** Oldest first. */
  list(userId: string): Promise<StackItem[]>;
  add(userId: string, item: NewStackItem): Promise<StackItem>;
  /** Null when there is no such item for this user. */
  update(userId: string, id: string, patch: StackItemPatch): Promise<StackItem | null>;
  delete(userId: string, id: string): Promise<boolean>;
  /** Ids of the items ticked as taken on a day. */
  takenOn(userId: string, date: string): Promise<Set<string>>;
  /** False when there is no such item for this user. */
  setTaken(userId: string, id: string, date: string, taken: boolean): Promise<boolean>;
}
