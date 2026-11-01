import { describe, expect, it } from "@jest/globals";
import type { WeeklyReport } from "../../domain/weeklyReport";
import { FakeEmail, FixedClock, InMemoryNotificationSettings } from "../testing/fakes";
import { SendWeeklyEmailsUseCase } from "./SendWeeklyEmailsUseCase";

const report = (daysScored = 5): WeeklyReport => ({
  weekStart: "2026-10-26",
  weekEnd: "2026-11-01",
  daysScored,
  headline: { score: 72, previous: 66, change: 6, title: "Your sharpest week yet", summary: "Sleep carried it." },
  pillars: [{ pillar: "sleep", label: "Sleep", score: 81, previous: 70, summary: "7 h 40 min a night." }],
  mind: { brain: "Steady.", performance: null },
  body: { startKg: null, endKg: null, goalKg: null },
  working: [],
  level: { level: 2, name: "Aware", summary: "Two habits to Level 3." },
  next: { pillar: "timing", title: "Dinner by 20:00", detail: "Late meals cost you most." },
});

function build(at: string, days = 5) {
  const settings = new InMemoryNotificationSettings();
  settings.people.set("u1", { email: "maya@example.com", timeZone: "America/Chicago" });
  const email = new FakeEmail();
  let n = 0;
  const useCase = new SendWeeklyEmailsUseCase(settings, { execute: async () => report(days) }, email, new FixedClock(new Date(at)), {
    webUrl: "https://neurocal.ai/",
    newToken: () => `token-${++n}-0000000000000000`,
  });
  return { settings, email, useCase };
}

describe("SendWeeklyEmailsUseCase", () => {
  it("emails last week's report from 08:00 on Monday in the person's time zone, once a week", async () => {
    // 07:00 on Monday 2 November in Chicago: not yet.
    expect(await build("2026-11-02T13:00:00Z").useCase.execute()).toEqual({ sent: 0, skipped: 0, failed: 0 });

    const { email, useCase, settings } = build("2026-11-02T15:00:00Z"); // 09:00
    expect(await useCase.execute()).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(email.sent[0]).toMatchObject({ to: "maya@example.com", subject: "Your week: Your sharpest week yet" });
    expect(email.sent[0]!.unsubscribeUrl).toBe("https://neurocal.ai/unsubscribe?token=token-1-0000000000000000&from=weekly");
    expect(email.sent[0]!.text).toContain("One thing for this week: Dinner by 20:00");
    expect(await useCase.execute()).toEqual({ sent: 0, skipped: 0, failed: 0 });

    // The link switches it off.
    await settings.unsubscribe("token-1-0000000000000000", "weekly");
    expect(await settings.get("u1")).toMatchObject({ weeklyReport: false, comeBackEmail: true });
    expect(await settings.weeklyRecipients()).toEqual([]);
  });

  it("skips a week with no scores, leaves Tuesday alone, and does nothing with email off", async () => {
    const empty = build("2026-11-02T15:00:00Z", 0);
    expect(await empty.useCase.execute()).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(await empty.useCase.execute()).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(await build("2026-11-03T15:00:00Z").useCase.execute()).toEqual({ sent: 0, skipped: 0, failed: 0 });

    const off = build("2026-11-02T15:00:00Z");
    await off.settings.save("u1", { weeklyReport: false });
    expect(await off.useCase.execute()).toEqual({ sent: 0, skipped: 0, failed: 0 });
  });
});
