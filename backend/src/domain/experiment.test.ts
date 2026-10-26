import { describe, expect, it } from "@jest/globals";
import { addDays } from "./weight";
import { experimentOf, profileOf } from "./experiment";

const ing = (name: string) => ({ name });

describe("profileOf", () => {
  it("knows what an ingredient is for, when it shows and how sure we are", () => {
    const mg = profileOf({ name: "Magnesium glycinate", ingredients: [ing("Magnesium (as magnesium glycinate)")] });
    expect(mg).toMatchObject({ purpose: "sleep", onsetDays: 14, ingredients: [{ name: "Magnesium", evidence: "some" }] });
    expect(mg.ingredients[0]!.expectation).not.toMatch(/%/);
  });

  it("gives a blend the purpose most of its known ingredients share, and that purpose's slowest onset", () => {
    const blend = profileOf({ name: "Brain 101", ingredients: [ing("Citicoline"), ing("L-theanine"), ing("Caffeine"), ing("Bacopa monnieri extract"), ing("Vitamin D3")] });
    expect(blend.purpose).toBe("focus");
    expect(blend.onsetDays).toBe(56); // bacopa
    expect(blend.ingredients.map((i) => i.name)).toEqual(["Caffeine", "L-theanine", "Citicoline", "Bacopa", "Vitamin D"]);
  });

  it("knows nothing about an unknown product, and a long-term one has no daily measure", () => {
    expect(profileOf({ name: "Mystery Mix", ingredients: [ing("Proprietary blend")] })).toEqual({ purpose: null, onsetDays: 14, ingredients: [] });
    expect(profileOf({ name: "Fish oil", ingredients: [ing("EPA"), ing("DHA")] }).purpose).toBe("long_term");
  });
});

describe("experimentOf", () => {
  const added = "2026-10-01";
  const days = (from: string, n: number, value: (i: number) => number) => new Map(Array.from({ length: n }, (_, i) => [addDays(from, i), value(i)] as [string, number]));
  const sleepy = profileOf({ name: "Magnesium", ingredients: [ing("Magnesium")] });
  const run = (o: { today: string; series: Map<string, number>; doses?: string[]; feelings?: { date: string; feeling: "better" | "same" | "worse" }[]; profile?: ReturnType<typeof profileOf>; name?: string }) =>
    experimentOf({ name: o.name ?? "Magnesium", profile: o.profile ?? sleepy, added, today: o.today, series: o.series, doses: o.doses ?? [], feelings: o.feelings ?? [] });

  it("waits while it's building", () => {
    const e = run({ today: "2026-10-05", series: new Map() });
    expect(e).toMatchObject({ measure: "sleep", day: 5, verdict: "building", change: null });
    expect(e.summary).toBe("Day 5 of about 14 before Magnesium can show. Keep taking it.");
  });

  it("says when there's nothing from before to compare with", () => {
    expect(run({ today: "2026-10-20", series: days("2026-10-14", 7, () => 80) }).verdict).toBe("need_baseline");
  });

  it("calls it helping when the measure rose past the noise, and notes spotty doses", () => {
    const series = new Map([...days("2026-09-10", 20, (i) => 70 + (i % 3)), ...days("2026-10-14", 8, (i) => 82 + (i % 2))]);
    const doses = ["2026-10-14", "2026-10-15", "2026-10-16"];
    const e = run({ today: "2026-10-21", series, doses });
    expect(e).toMatchObject({ verdict: "helping", before: { days: 20 }, since: { days: 8 }, taken: { days: 3, of: 8 } });
    expect(e.change).toBeGreaterThan(10);
    expect(e.summary).toMatch(/^Since starting Magnesium, your sleep score is up 1\d \(from 71 to 8\d\)\. You ticked it on 3 of 8 days/);
  });

  it("calls a small change no change, and a drop worse", () => {
    const flat = new Map([...days("2026-09-10", 20, (i) => 70 + (i % 5)), ...days("2026-10-14", 8, (i) => 72 + (i % 3))]);
    expect(run({ today: "2026-10-21", series: flat }).verdict).toBe("no_change");
    const down = new Map([...days("2026-09-10", 20, () => 80), ...days("2026-10-14", 8, () => 60)]);
    expect(run({ today: "2026-10-21", series: down })).toMatchObject({ verdict: "worse", change: -20 });
  });

  it("asks for checks when there are too few since, and judges unknown products by Brain speed", () => {
    const mystery = profileOf({ name: "Mystery Mix", ingredients: [] });
    const series = new Map([...days("2026-09-10", 10, () => 70), ...days("2026-10-15", 2, () => 75)]);
    const e = run({ today: "2026-10-21", series, profile: mystery, name: "Mystery Mix" });
    expect(e).toMatchObject({ measure: "brain_speed", verdict: "too_early" });
    expect(e.summary).toBe("2 more Brain speed checks and NeuroCal can tell whether Mystery Mix is working for you.");
  });

  it("explains long-term supplements instead of judging them", () => {
    const fish = profileOf({ name: "Fish oil", ingredients: [ing("EPA")] });
    expect(run({ today: "2026-10-21", series: new Map(), profile: fish, name: "Fish oil" })).toMatchObject({ measure: null, verdict: "long_term", summary: expect.stringContaining("works over months") });
  });

  it("asks how it feels at two weeks and at four, unless answered since", () => {
    expect(run({ today: "2026-10-13", series: new Map() }).askFeeling).toBe(false); // day 13
    expect(run({ today: "2026-10-14", series: new Map() }).askFeeling).toBe(true); // day 14
    expect(run({ today: "2026-10-20", series: new Map(), feelings: [{ date: "2026-10-15", feeling: "better" }] })).toMatchObject({ askFeeling: false, feeling: "better" });
    expect(run({ today: "2026-10-28", series: new Map(), feelings: [{ date: "2026-10-15", feeling: "better" }] }).askFeeling).toBe(true); // day 28
  });
});
