import { describe, expect, it } from "@jest/globals";
import { NO_SUBSCRIPTION, applyEvent, hasAccess, type StoreEvent } from "./subscription";

const t = (iso: string) => new Date(`${iso}T12:00:00Z`);
const event = (over: Partial<StoreEvent>): StoreEvent => ({ type: "INITIAL_PURCHASE", appUserId: "u1", productId: "neurocal_pro_yearly", at: t("2026-10-01"), ...over });

describe("subscriptions", () => {
  it("starts a trial, renews into a paid year, and keeps access after a cancel until it expires", () => {
    const trial = applyEvent(NO_SUBSCRIPTION, event({ periodType: "TRIAL", expiresAt: t("2026-10-15") }))!;
    expect(trial).toMatchObject({ status: "trial", willRenew: true });
    expect(hasAccess(trial, t("2026-10-10"))).toBe(true);

    const paid = applyEvent(trial, event({ type: "RENEWAL", periodType: "NORMAL", expiresAt: t("2027-10-15"), at: t("2026-10-15") }))!;
    expect(paid).toMatchObject({ status: "active", willRenew: true });

    const cancelled = applyEvent(paid, event({ type: "CANCELLATION", expiresAt: t("2027-10-15"), at: t("2026-11-01") }))!;
    expect(cancelled).toMatchObject({ status: "active", willRenew: false });
    expect(hasAccess(cancelled, t("2027-01-01"))).toBe(true);
    expect(hasAccess(cancelled, t("2027-10-16"))).toBe(false);

    const expired = applyEvent(cancelled, event({ type: "EXPIRATION", at: t("2027-10-15") }))!;
    expect(hasAccess(expired, t("2027-10-15"))).toBe(false);
  });

  it("keeps access through a billing problem's grace period", () => {
    const grace = applyEvent(NO_SUBSCRIPTION, event({ type: "BILLING_ISSUE", gracePeriodEndsAt: t("2026-10-20") }))!;
    expect(grace.status).toBe("grace");
    expect(hasAccess(grace, t("2026-10-19"))).toBe(true);
    expect(hasAccess(grace, t("2026-10-21"))).toBe(false);
  });

  it("ignores older events and ones that don't change access", () => {
    const paid = applyEvent(NO_SUBSCRIPTION, event({ periodType: "NORMAL", expiresAt: t("2027-10-01"), at: t("2026-10-05") }))!;
    expect(applyEvent(paid, event({ type: "EXPIRATION", at: t("2026-10-01") }))).toBeNull();
    expect(applyEvent(paid, event({ type: "TEST", at: t("2026-10-06") }))).toBeNull();
    expect(hasAccess(NO_SUBSCRIPTION, t("2026-10-06"))).toBe(false);
  });
});
