import type { Subscription } from "../../domain/subscription";

/** One subscription per user, as last reported by the store. */
export interface ISubscriptionRepository {
  get(userId: string): Promise<Subscription | null>;
  /** False when there is no such user (an event for an account that was deleted, or a test id). */
  save(userId: string, subscription: Subscription): Promise<boolean>;
}

/** Asks the subscription service directly, for when its webhook hasn't arrived yet (right after a purchase). */
export interface ISubscriptionLookup {
  lookup(userId: string): Promise<Subscription | null>;
}
