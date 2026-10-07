import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { InvalidError } from "../../domain/errors";
import { FakeEmail, FixedClock, InMemoryWaitlist } from "../testing/fakes";
import { JoinWaitlistUseCase, LeaveWaitlistUseCase } from "./WaitlistUseCases";

const now = new Date("2026-10-07T09:00:00Z");

describe("the waitlist", () => {
  let list: InMemoryWaitlist;
  let tokens: number;
  const join = (email: FakeEmail) => new JoinWaitlistUseCase(list, email, new FixedClock(now), { webUrl: "https://neurocal.ai/", newToken: () => `token-${++tokens}-0123456789` });

  beforeEach(() => {
    list = new InMemoryWaitlist();
    tokens = 0;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("adds a new address, lower-cased, and sends one confirmation with an unsubscribe link", async () => {
    const email = new FakeEmail();
    await join(email).execute({ email: "  Sam@Example.com ", platform: "iphone" });

    expect(list.rows).toMatchObject([{ email: "sam@example.com", platform: "iphone", confirmationSentAt: now }]);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]).toMatchObject({ to: "sam@example.com", subject: "You're on the NeuroCal list", unsubscribeUrl: "https://neurocal.ai/unsubscribe?token=token-1-0123456789" });
    expect(email.sent[0]!.text).toContain("https://neurocal.ai/unsubscribe?token=token-1-0123456789");
  });

  it("joining again changes nothing and sends nothing, but a later platform is kept", async () => {
    const email = new FakeEmail();
    await join(email).execute({ email: "sam@example.com" });
    await join(email).execute({ email: "SAM@example.com", platform: "android" });

    expect(list.rows).toHaveLength(1);
    expect(list.rows[0]).toMatchObject({ platform: "android", unsubscribeToken: "token-1-0123456789" });
    expect(email.sent).toHaveLength(1);
  });

  it("keeps the address when email is switched off or fails, and sends the confirmation on the next join", async () => {
    await join(new FakeEmail(false)).execute({ email: "sam@example.com" });
    await join(new FakeEmail(true, new Error("Resend answered 500"))).execute({ email: "sam@example.com" });
    expect(list.rows).toHaveLength(1);
    expect(list.rows[0]!.confirmationSentAt).toBeUndefined();

    const working = new FakeEmail();
    await join(working).execute({ email: "sam@example.com" });
    expect(working.sent).toHaveLength(1);
    expect(list.rows[0]!.confirmationSentAt).toEqual(now);
  });

  it("refuses something that isn't an email address", async () => {
    await expect(join(new FakeEmail()).execute({ email: "not an email" })).rejects.toBeInstanceOf(InvalidError);
    expect(list.rows).toHaveLength(0);
  });

  it("unsubscribes by token, and joining afterwards starts over", async () => {
    const email = new FakeEmail();
    await join(email).execute({ email: "sam@example.com" });
    await new LeaveWaitlistUseCase(list).execute({ token: "token-1-0123456789" });
    expect(list.rows[0]!.unsubscribed).toBe(true);
    // An unknown token is not an error.
    await new LeaveWaitlistUseCase(list).execute({ token: "no-such-token-000000" });

    await join(email).execute({ email: "sam@example.com" });
    expect(list.rows[0]!.unsubscribed).toBe(false);
    expect(email.sent).toHaveLength(2);
  });
});
