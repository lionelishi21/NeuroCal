/**
 * Paid access. RevenueCat (the subscription service the apps buy through) tells the API about
 * purchases, renewals and expiries; this is what the API keeps of it.
 */

export type SubscriptionStatus =
  /** In the free trial, which turns into a paid subscription unless cancelled. */
  | "trial"
  | "active"
  /** A renewal payment failed; access continues while the store retries. */
  | "grace"
  | "expired"
  | "none";

export interface Subscription {
  status: SubscriptionStatus;
  /** The store product, e.g. "neurocal_pro_yearly". */
  productId?: string;
  /** When access ends unless it renews. */
  expiresAt?: Date;
  /** False once the person has cancelled (access lasts until `expiresAt`). */
  willRenew: boolean;
  /** When the store event this came from happened; older events never overwrite newer ones. */
  eventAt: Date;
}

export const NO_SUBSCRIPTION: Subscription = { status: "none", willRenew: false, eventAt: new Date(0) };

export function hasAccess(s: Subscription, now: Date): boolean {
  if (s.status !== "trial" && s.status !== "active" && s.status !== "grace") return false;
  return s.expiresAt === undefined || s.expiresAt > now;
}

/** A RevenueCat webhook event, reduced to what we use (https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields). */
export interface StoreEvent {
  type: string;
  appUserId: string;
  productId?: string;
  /** TRIAL, INTRO, NORMAL or PROMOTIONAL. */
  periodType?: string;
  expiresAt?: Date;
  /** Billing problems: access lasts until this. */
  gracePeriodEndsAt?: Date;
  at: Date;
}

/** What an event changes, or null for events that don't change access (tests, transfers, unknown types). */
export function applyEvent(current: Subscription, event: StoreEvent): Subscription | null {
  if (event.at < current.eventAt) return null;
  const base = { ...(event.productId ? { productId: event.productId } : current.productId ? { productId: current.productId } : {}), eventAt: event.at };
  const paid = event.periodType === "TRIAL" ? "trial" : "active";
  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE":
    case "SUBSCRIPTION_EXTENDED":
      return { ...base, status: paid, ...(event.expiresAt ? { expiresAt: event.expiresAt } : {}), willRenew: event.type !== "NON_RENEWING_PURCHASE" };
    case "CANCELLATION":
      // Still paid up until it expires.
      return { ...current, ...base, ...(event.expiresAt ? { expiresAt: event.expiresAt } : {}), willRenew: false };
    case "BILLING_ISSUE": {
      const until = event.gracePeriodEndsAt ?? event.expiresAt ?? current.expiresAt;
      return { ...current, ...base, status: "grace", ...(until ? { expiresAt: until } : {}) };
    }
    case "EXPIRATION":
      return { ...current, ...base, status: "expired", willRenew: false };
    default:
      return null;
  }
}
