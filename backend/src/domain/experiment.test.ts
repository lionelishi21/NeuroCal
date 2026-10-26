import { describe, expect, it } from "@jest/globals";
import { addDays } from "./weight";
import { afterStopOf, experimentOf, profileOf } from "./experiment";

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

describe("afterStopOf", () => {
  const focus = profileOf({ name: "Focus blend", ingredients: [{ name: "L-theanine" }, { name: "Caffeine" }] });
  const added = "2026-09-01";
  const stopped = "2026-10-01";
  /** Brain speed: [before] the 4 weeks before starting, [during] while taking it, [after] since stopping. */
  const series = (before: number, during: number, after: number, today = "2026-10-26") => {
    const out = new Map<string, number>();
    for (let i = 1; i <= 20; i++) out.set(addDays(added, -i), before);
    for (let i = 1; i < 30; i++) out.set(addDays(added, i), during);
    for (let d = addDays(stopped, 3); d <= today; d = addDays(d, 1)) out.set(d, after);
    return out;
  };
  const run = (before: number, during: number, after: number, today = "2026-10-26") =>
    afterStopOf({ name: "Focus blend", profile: focus, added, stopped, today, series: series(before, during, after, today) });

  it("says the gain lasted when the level stayed up after stopping", () => {
    const e = run(68, 76, 75);
    expect(e).toMatchObject({ verdict: "lasted", measure: "brain_speed", before: { mean: 68 }, during: { mean: 76 }, since: { mean: 75 } });
    expect(e.summary).toBe("Your Brain speed stayed up after you stopped Focus blend: 68 before, 76 while you took it, 75 since you stopped. You may not need to keep taking it.");
  });

  it("says it faded when the level went back down", () => {
    expect(run(68, 76, 69).verdict).toBe("faded");
  });

  it("watches the first week after stopping, and spots a rise that came later", () => {
    expect(run(68, 76, 75, "2026-10-04")).toMatchObject({ verdict: "watching", summary: expect.stringContaining("3 days ago") });
    expect(run(68, 68, 76)).toMatchObject({ verdict: "no_change", summary: expect.stringContaining("something else") });
  });
});
