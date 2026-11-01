import { describe, expect, it } from "@jest/globals";
import type { LevelDay } from "../../domain/levels";
import { FakeEmail, FakePushSender, InMemoryNotificationSettings } from "../testing/fakes";
import { type NotificationSources, SendNotificationsUseCase } from "./SendNotificationsUseCase";

const goodDay: LevelDay = {
  foodLogged: true,
  sleepLogged: true,
  ultraKcal: 100,
  gradedKcal: 2000,
  proteinRatio: 0.9,
  timing: 0.9,
  sleep: 0.85,
  stress: 0.8,
  movement: 0.8,
  environment: 0.8,
  keptFast: null,
};

/** Maya in Austin (UTC−5 in early November), with one phone last seen [seen]. */
function build(at: string, o: { seen?: string; sources?: Partial<NotificationSources>; pushOn?: boolean; emailOn?: boolean } = {}) {
  const settings = new InMemoryNotificationSettings();
  settings.people.set("u1", { email: "maya@example.com", timeZone: "America/Chicago", name: "Maya" });
  void settings.saveDevice("u1", { token: "phone-1", platform: "android" }, new Date(o.seen ?? at));
  const push = new FakePushSender(new Set(), o.pushOn ?? true);
  const email = new FakeEmail(o.emailOn ?? true);
  let now = new Date(at);
  const sources: NotificationSources = {
    focusScore: async () => ({ score: 72, sleepIn: true, explanation: "Short sleep is holding you back. Get to bed by 22:30 tonight." }),
    level: async () => ({ level: 2, name: "Fuelled", days: Array.from({ length: 28 }, () => goodDay) }),
    air: async () => ({ aqi: 40, place: "Austin, Texas, United States" }),
    newRoutines: async () => [],
    goalReached: async () => null,
    newOwnProducts: async () => [],
    recommendedProducts: async () => ({ ids: [], area: null }),
    ...o.sources,
  };
  const useCase = new SendNotificationsUseCase(settings, sources, push, email, { now: () => now }, { webUrl: "https://neurocal.ai/", newToken: () => "token-0000000000000000" });
  return { settings, push, email, useCase, at: (iso: string) => (now = new Date(iso)) };
}

describe("SendNotificationsUseCase", () => {
  it("sends the morning score once sleep is in, once a day", async () => {
    // 09:00 in Austin.
    const t = build("2026-11-02T15:00:00Z");
    expect(await t.useCase.execute()).toEqual({ pushed: 1, emailed: 0, failed: 0 });
    expect(t.push.sent).toEqual([{ token: "phone-1", message: { title: "Your Focus Score today: 72", body: "Short sleep is holding you back." } }]);
    expect(await t.useCase.execute()).toEqual({ pushed: 0, emailed: 0, failed: 0 });

    // Before sleep is in, nothing; and nothing at 13:00, out of its hours.
    const early = build("2026-11-02T15:00:00Z", { sources: { focusScore: async () => ({ score: 50, sleepIn: false, explanation: "" }) } });
    expect((await early.useCase.execute()).pushed).toBe(0);
    expect((await build("2026-11-02T19:00:00Z").useCase.execute()).pushed).toBe(0);
  });

  it("warns about unhealthy air in the morning, and respects a kind switched off", async () => {
    const t = build("2026-11-02T14:00:00Z", { sources: { air: async () => ({ aqi: 142, place: "Austin, Texas, United States" }), focusScore: async () => ({ score: null, sleepIn: false, explanation: "" }) } });
    await t.useCase.execute();
    expect(t.push.sent.map((s) => s.message)).toEqual([{ title: "Air quality is unhealthy today (AQI 142)", body: "In Austin: keep windows shut and move your workout indoors." }]);

    const off = build("2026-11-02T14:00:00Z", { sources: { air: async () => ({ aqi: 142, place: "Austin" }), focusScore: async () => ({ score: null, sleepIn: false, explanation: "" }) } });
    await off.settings.save("u1", { push: { airQuality: false } });
    expect((await off.useCase.execute()).pushed).toBe(0);
  });

  it("notes the level quietly the first time, then tells a level-up", async () => {
    let level = 2;
    // 18:00 in Austin, a Monday.
    const t = build("2026-11-03T00:00:00Z", { sources: { level: async () => ({ level, name: ["", "Aware", "Fuelled", "In rhythm"][level]!, days: [] }) } });
    await t.useCase.execute();
    expect(t.push.sent).toEqual([]);
    expect(t.settings.rows.get("u1")!.lastLevel).toBe(2);

    level = 3;
    t.at("2026-11-04T00:00:00Z");
    await t.useCase.execute();
    expect(t.push.sent.map((s) => s.message)).toEqual([
      { title: "You reached Level 3: In rhythm", body: "Four weeks of habits earned it. See what Level 4, Recovered, takes.", open: "week" },
    ]);
    // Once a day: another evening run looks no further.
    t.at("2026-11-04T01:00:00Z");
    expect((await t.useCase.execute()).pushed).toBe(0);
  });

  it("on Wednesday evening, says which habit is slipping", async () => {
    const slipping = [...Array.from({ length: 21 }, () => goodDay), ...Array.from({ length: 7 }, () => ({ ...goodDay, sleepLogged: false }))];
    // 18:00 in Austin, Wednesday 4 November.
    const t = build("2026-11-05T00:00:00Z", { sources: { level: async () => ({ level: 2, name: "Fuelled", days: slipping }) } });
    await t.settings.setLastLevel("u1", 2);
    await t.useCase.execute();
    expect(t.push.sent.map((s) => s.message)).toEqual([
      { title: "Your Level 2 is at risk", body: "You've logged sleep on 0 of the last 7 nights. A few good days this week keep it.", open: "week" },
    ]);
  });

  it("after 3 days away pushes once, after 7 emails once with its own unsubscribe link", async () => {
    // 11:00 in Austin, last seen four days before.
    const t = build("2026-11-06T17:00:00Z", { seen: "2026-11-02T17:00:00Z", sources: { focusScore: async () => ({ score: null, sleepIn: false, explanation: "" }) } });
    await t.useCase.execute();
    expect(t.push.sent.map((s) => s.message.title)).toEqual(["Pick up where you left off"]);
    t.at("2026-11-07T17:00:00Z");
    await t.useCase.execute();
    expect(t.push.sent).toHaveLength(1);

    t.at("2026-11-09T17:00:00Z");
    expect(await t.useCase.execute()).toEqual({ pushed: 0, emailed: 1, failed: 0 });
    expect(t.email.sent[0]).toMatchObject({ to: "maya@example.com", subject: "Your Focus Score misses you", unsubscribeUrl: "https://neurocal.ai/unsubscribe?token=token-0000000000000000&from=comeBack" });
    expect(t.email.sent[0]!.text).toContain("Hi Maya,");
    t.at("2026-11-10T17:00:00Z");
    expect((await t.useCase.execute()).emailed).toBe(0);
  });

  it("tells a new routine once, a goal weight by push and email, and stops at two pushes a day", async () => {
    // 11:00 in Austin: score, routine and goal all want to go.
    const t = build("2026-11-02T17:00:00Z", {
      sources: {
        focusScore: async () => ({ score: 80, sleepIn: true, explanation: "A strong day." }),
        newRoutines: async () => [{ id: "calf-raises", title: "Calf raises at your desk", summary: "Ten slow raises push blood back up to your brain. Do them every hour." }],
        goalReached: async () => ({ targetKg: 68 }),
      },
    });
    expect(await t.useCase.execute()).toEqual({ pushed: 2, emailed: 1, failed: 0 });
    expect(t.push.sent.map((s) => s.message.title)).toEqual(["You reached your goal weight", "Your Focus Score today: 80"]);
    expect(t.email.sent[0]!.subject).toBe("You reached your goal weight");

    // The next day the routine gets its turn, once.
    t.at("2026-11-03T17:00:00Z");
    await t.useCase.execute();
    expect(t.push.sent.map((s) => s.message.title)).toContain("New routine: Calf raises at your desk");
    expect(t.push.sent.filter((s) => s.message.title.startsWith("New routine"))).toHaveLength(1);
    expect(t.email.sent).toHaveLength(1);
  });

  it("forgets a phone Firebase refuses, and does nothing with push and email off", async () => {
    const t = build("2026-11-02T15:00:00Z");
    t.push.gone.add("phone-1");
    await t.useCase.execute();
    expect(await t.settings.devicesOf("u1")).toEqual([]);

    const off = build("2026-11-02T15:00:00Z", { pushOn: false, emailOn: false });
    expect(await off.useCase.execute()).toEqual({ pushed: 0, emailed: 0, failed: 0 });
  });

  it("tells product news only to those who switched it on, and only a product picked for them", async () => {
    let looked = 0;
    const sources = {
      focusScore: async () => ({ score: null, sleepIn: false, explanation: "" }),
      newOwnProducts: async () => [
        { id: "mitoproof-ignite", name: "MitoProof Ignite" },
        { id: "mitoproof-sleep-formula", name: "MitoProof Sleep Formula" },
      ],
      recommendedProducts: async () => {
        looked++;
        return { ids: ["mitoproof-sleep-formula", "blackout-mask"], area: "short or light sleep" };
      },
    };
    // 11:00 in Austin. Off until asked: nothing, and no recommendation looked up.
    const off = build("2026-11-02T17:00:00Z", { sources });
    expect((await off.useCase.execute()).pushed).toBe(0);
    expect(looked).toBe(0);

    const t = build("2026-11-02T17:00:00Z", { sources });
    await t.settings.save("u1", { push: { productNews: true } });
    await t.useCase.execute();
    expect(t.push.sent.map((s) => s.message)).toEqual([
      {
        title: "New from our brand: MitoProof Sleep Formula",
        body: "Picked for you: it's made for short or light sleep, which held your score back this week. Sold by MitoProof.",
      },
    ]);
    // Looked at once a day, and each product told once.
    t.at("2026-11-02T18:00:00Z");
    await t.useCase.execute();
    t.at("2026-11-03T17:00:00Z");
    await t.useCase.execute();
    expect(t.push.sent).toHaveLength(1);
    expect(looked).toBe(2);
  });

  it("sends a test push to the phones of one account, by email", async () => {
    const t = build("2026-11-02T15:00:00Z");
    expect(await t.useCase.test("Maya@example.com")).toEqual({ phones: 1 });
    expect(t.push.sent[0]!.message.title).toBe("Notifications are on");
    expect(await t.useCase.test("nobody@example.com")).toEqual({ phones: 0 });
  });
});
