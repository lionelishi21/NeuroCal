import type { ISubscriptionLookup } from "../../application/interfaces/ISubscriptions";
import type { StoreEvent, Subscription } from "../../domain/subscription";

/** The entitlement the apps unlock with a subscription, as set up in RevenueCat. */
export const ENTITLEMENT = "pro";

/** A webhook body (https://www.revenuecat.com/docs/integrations/webhooks) as our StoreEvent, or null if it isn't one. */
export function storeEventFrom(body: unknown): StoreEvent | null {
  const e = (body as { event?: Record<string, unknown> } | null)?.event;
  if (!e || typeof e.type !== "string" || typeof e.app_user_id !== "string") return null;
  const ms = (key: string) => (typeof e[key] === "number" ? new Date(e[key] as number) : undefined);
  const at = ms("event_timestamp_ms") ?? new Date();
  const expiresAt = ms("expiration_at_ms");
  const grace = ms("grace_period_expiration_at_ms");
  return {
    type: e.type,
    appUserId: e.app_user_id,
    ...(typeof e.product_id === "string" ? { productId: e.product_id } : {}),
    ...(typeof e.period_type === "string" ? { periodType: e.period_type } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(grace ? { gracePeriodEndsAt: grace } : {}),
    at,
  };
}

/** Asks RevenueCat's REST API for a subscriber's entitlement (GET /v1/subscribers/{id}). */
export class RevenueCatLookup implements ISubscriptionLookup {
  constructor(private readonly options: { secretKey: string; fetch?: typeof fetch }) {}

  async lookup(userId: string): Promise<Subscription | null> {
    const res = await (this.options.fetch ?? fetch)(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      headers: { authorization: `Bearer ${this.options.secretKey}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`RevenueCat lookup failed: ${res.status}`);
    const body = (await res.json()) as {
      subscriber?: {
        entitlements?: Record<string, { expires_date?: string | null; product_identifier?: string; grace_period_expires_date?: string | null }>;
        subscriptions?: Record<string, { period_type?: string; unsubscribe_detected_at?: string | null; billing_issues_detected_at?: string | null }>;
      };
    };
    const entitlement = body.subscriber?.entitlements?.[ENTITLEMENT];
    if (!entitlement?.product_identifier) return null;
    const product = body.subscriber?.subscriptions?.[entitlement.product_identifier];
    const expires = entitlement.expires_date ? new Date(entitlement.expires_date) : undefined;
    const now = new Date();
    const grace = entitlement.grace_period_expires_date ? new Date(entitlement.grace_period_expires_date) : undefined;
    const status = expires && expires <= now && !(grace && grace > now)
      ? "expired"
      : product?.billing_issues_detected_at
        ? "grace"
        : product?.period_type === "trial"
          ? "trial"
          : "active";
    const until = status === "grace" ? (grace ?? expires) : expires;
    return {
      status,
      productId: entitlement.product_identifier,
      ...(until ? { expiresAt: until } : {}),
      willRenew: status !== "expired" && !product?.unsubscribe_detected_at,
      eventAt: now,
    };
  }
}
