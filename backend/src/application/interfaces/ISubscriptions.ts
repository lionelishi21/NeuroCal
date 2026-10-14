import type { Subscription } from "../../domain/subscription";

/** One subscription per user, as last reported by the store. */
export interface ISubscriptionRepository {
  get(userId: string): Promise<Subscription | null>;
  /** False when there is no such user (an event for an account that was deleted, or a test id). */
  save(userId: string, subscription: Subscription): Promise<boolean>;
  /** Trials that will renew and end between `from` and `to`, not yet reminded for that end. */
  trialsEndingBetween(from: Date, to: Date): Promise<EndingTrial[]>;
  /** Records the reminder for this trial end. */
  markTrialReminded(userId: string, endsAt: Date): Promise<void>;
}

export interface EndingTrial {
  userId: string;
  email: string;
  endsAt: Date;
  /** IANA; UTC when the profile has none. */
  timeZone: string;
}

/** Asks the subscription service directly, for when its webhook hasn't arrived yet (right after a purchase). */
export interface ISubscriptionLookup {
  lookup(userId: string): Promise<Subscription | null>;
}
