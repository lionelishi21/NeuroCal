import { timingSafeEqual } from "node:crypto";
import { ForbiddenError, PaymentRequiredError } from "../../domain/errors";
import { NO_SUBSCRIPTION, type StoreEvent, type Subscription, applyEvent, hasAccess } from "../../domain/subscription";
import type { IClock } from "../interfaces/IClock";
import type { ISubscriptionLookup, ISubscriptionRepository } from "../interfaces/ISubscriptions";

export interface SubscriptionView extends Subscription {
  active: boolean;
}

/** The caller's subscription. Without access, it asks the store once more in case a purchase just happened. */
export class GetSubscriptionUseCase {
  constructor(
    private readonly subscriptions: ISubscriptionRepository,
    private readonly lookup: ISubscriptionLookup | null,
    private readonly clock: IClock,
  ) {}

  async execute(input: { userId: string }): Promise<SubscriptionView> {
    const now = this.clock.now();
    let current = (await this.subscriptions.get(input.userId)) ?? NO_SUBSCRIPTION;
    if (!hasAccess(current, now) && this.lookup) {
      const fresh = await this.lookup.lookup(input.userId).catch(() => null);
      if (fresh && fresh.eventAt >= current.eventAt) {
        await this.subscriptions.save(input.userId, fresh);
        current = fresh;
      }
    }
    return { ...current, active: hasAccess(current, now) };
  }
}

/** Applies one RevenueCat webhook event. Unknown users and event types are ignored, not errors: the store retries errors. */
export class HandleStoreEventUseCase {
  constructor(
    private readonly subscriptions: ISubscriptionRepository,
    /** The Authorization header RevenueCat is set up to send. Without one, every call is refused. */
    private readonly expectedAuth: string | undefined,
  ) {}

  async execute(authorization: string | undefined, event: StoreEvent | null): Promise<"applied" | "ignored"> {
    if (!this.expectedAuth || !authorization || !sameText(authorization, this.expectedAuth)) {
      throw new ForbiddenError("That webhook call isn't signed.");
    }
    if (!event) return "ignored";
    const current = (await this.subscriptions.get(event.appUserId)) ?? NO_SUBSCRIPTION;
    const next = applyEvent(current, event);
    if (!next) return "ignored";
    return (await this.subscriptions.save(event.appUserId, next)) ? "applied" : "ignored";
  }
}

/**
 * The paywall on features that cost money to run (photo and label reading, recipe search). Off
 * until launch (`PAYWALL=on`), so the app keeps working before the store products exist. Admins
 * always pass.
 */
export class SubscriptionGate {
  constructor(
    private readonly getSubscription: GetSubscriptionUseCase,
    private readonly enabled: boolean,
  ) {}

  async require(caller: { userId: string; isAdmin?: boolean }): Promise<void> {
    if (!this.enabled || caller.isAdmin) return;
    const { active } = await this.getSubscription.execute(caller);
    if (!active) throw new PaymentRequiredError("Start your free trial to use this.");
  }
}

/** Compares secrets in constant time, so the time taken doesn't leak how much matched. */
function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
