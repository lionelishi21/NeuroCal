import { describe, expect, it } from "@jest/globals";
import { FakeEmail, FixedClock, InMemorySubscriptions } from "../testing/fakes";
import { SendTrialRemindersUseCase } from "./SendTrialRemindersUseCase";

const now = new Date("2026-10-25T15:00:00Z");
const trial = (endsAt: string, over = {}) => ({ status: "trial" as const, expiresAt: new Date(endsAt), willRenew: true, eventAt: new Date("2026-10-13T00:00:00Z"), ...over });

describe("SendTrialRemindersUseCase", () => {
  it("emails trials ending in one to two days, once each, with the date in their time zone and how to cancel", async () => {
    const subs = new InMemorySubscriptions();
    subs.known.add("u3");
    await subs.save("u1", trial("2026-10-27T05:00:00Z")); // 38 h away: in the window
    await subs.save("u2", trial("2026-10-25T20:00:00Z")); // 5 h away: too late to be useful, already past the window
    await subs.save("u3", trial("2026-10-27T05:00:00Z", { willRenew: false })); // already cancelled
    const email = new FakeEmail();
    const useCase = new SendTrialRemindersUseCase(subs, email, new FixedClock(now));

    expect(await useCase.execute()).toEqual({ sent: 1, failed: 0 });
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]).toMatchObject({ to: "maya@example.com", subject: "Your NeuroCal trial ends on Tuesday 27 October" });
    expect(email.sent[0]!.text).toContain("cancel before then and you won't be charged");
    expect(email.sent[0]!.text).toContain("iPhone: Settings > your name > Subscriptions");

    // The next hourly run doesn't send it again.
    expect(await useCase.execute()).toEqual({ sent: 0, failed: 0 });
  });

  it("tries again next hour when sending fails, and does nothing with email switched off", async () => {
    const subs = new InMemorySubscriptions();
    await subs.save("u1", trial("2026-10-27T05:00:00Z"));
    expect(await new SendTrialRemindersUseCase(subs, new FakeEmail(true, new Error("down")), new FixedClock(now)).execute()).toEqual({ sent: 0, failed: 1 });
    expect(await new SendTrialRemindersUseCase(subs, new FakeEmail(false), new FixedClock(now)).execute()).toEqual({ sent: 0, failed: 0 });
    expect(await new SendTrialRemindersUseCase(subs, new FakeEmail(), new FixedClock(now)).execute()).toEqual({ sent: 1, failed: 0 });
  });
});
