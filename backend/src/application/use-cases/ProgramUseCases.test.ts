import { describe, expect, it } from "@jest/globals";
import type { GuideRecord } from "../../domain/guides";
import type { ProgramDayFacts } from "../../domain/program";
import { InMemoryFocusScores, InMemoryGuides, InMemoryPrograms, InMemoryProfiles, profile } from "../testing/fakes";
import { GuideUseCases } from "./GuideUseCases";
import { ProgramUseCases } from "./ProgramUseCases";

const seed: GuideRecord = {
  id: "mitoproof-protocol",
  title: "The Mitoproof Protocol",
  subtitle: "Your 30-day cellular energy plan",
  summary: "A reset, then a build.",
  body: "## Chapter 1\n\nText.",
  brand: "ownBrand",
  status: "draft",
  program: true,
  updatedAt: new Date("2026-11-01T00:00:00Z"),
};
const user = { isAdmin: false };
const admin = { isAdmin: true };

async function build(at: string) {
  const profiles = new InMemoryProfiles();
  await profiles.save(profile());
  const store = new InMemoryGuides();
  let now = new Date(at);
  const clock = { now: () => now };
  const guides = new GuideUseCases(store, [seed], clock);
  let facts: ProgramDayFacts = { daylight: false, mealMinutes: [], exercise: [], sessions: [] };
  const scores = new InMemoryFocusScores();
  const program = new ProgramUseCases(new InMemoryPrograms(), guides, profiles, clock, async () => facts, scores);
  return {
    guides,
    program,
    scores,
    at: (iso: string) => (now = new Date(iso)),
    setFacts: (f: Partial<ProgramDayFacts>) => (facts = { ...facts, ...f }),
  };
}

describe("GuideUseCases", () => {
  it("keeps a draft from everyone but admins, until it's published", async () => {
    const t = await build("2026-11-02T15:00:00Z");
    expect(await t.guides.list(user)).toEqual([]);
    await expect(t.guides.get(seed.id, user)).rejects.toThrow("There's no such guide.");
    expect((await t.guides.list(admin)).map((g) => [g.id, g.status, g.minutes])).toEqual([[seed.id, "draft", 1]]);

    await expect(t.guides.save(user, seed.id, { ...seed, status: "published" })).rejects.toThrow("Only admins can edit guides.");
    const saved = await t.guides.save(admin, seed.id, { title: "The Mitoproof Protocol", subtitle: "", summary: "", body: "## Reviewed\n\nText.", status: "published" });
    // What comes with the guide (brand, program) is kept.
    expect(saved).toMatchObject({ brand: "ownBrand", program: true, status: "published" });
    expect((await t.guides.get(seed.id, user)).body).toBe("## Reviewed\n\nText.");
  });
});

describe("ProgramUseCases", () => {
  it("starts a draft's program only for an admin, and none means null", async () => {
    const t = await build("2026-11-02T15:00:00Z");
    expect(await t.program.get("u1")).toBeNull();
    await expect(t.program.start("u1", seed.id, user)).rejects.toThrow("There's no such guide.");
    const view = await t.program.start("u1", seed.id, admin);
    expect(view).toMatchObject({ title: "The Mitoproof Protocol", startedOn: "2026-11-02", day: 1, phase: "reset", checkDue: 1, fullDays: 0 });
    expect(view.rules.map((r) => r.id)).toEqual(["daylight", "noSeedOils", "noSugar", "noAlcohol", "screensOff", "lastMeal", "walk"]);
    expect(view.tip.title).toBe("Start with the energy check");
  });

  it("ticks habits from what's logged and by hand, and counts full days", async () => {
    // 09:00 in Chicago.
    const t = await build("2026-11-02T15:00:00Z");
    await t.program.start("u1", seed.id, admin);
    t.setFacts({ daylight: true, exercise: ["walk"] });
    let view = (await t.program.get("u1"))!;
    expect(view.rules.filter((r) => r.done).map((r) => [r.id, r.auto])).toEqual([
      ["daylight", true],
      ["walk", true],
    ]);
    for (const id of ["noSeedOils", "noSugar", "noAlcohol", "screensOff"]) view = await t.program.tick("u1", id, true);
    expect(view.fullDays).toBe(0);

    // 20:00, the last meal was at 18:30: the day is full.
    t.at("2026-11-03T02:00:00Z");
    t.setFacts({ mealMinutes: [8 * 60, 18 * 60 + 30] });
    view = (await t.program.get("u1"))!;
    expect(view.rules.find((r) => r.id === "lastMeal")).toMatchObject({ done: true, auto: true });
    expect(view.fullDays).toBe(1);

    // The next day starts empty, and the full day is remembered.
    t.at("2026-11-03T15:00:00Z");
    t.setFacts({ daylight: false, exercise: [], mealMinutes: [] });
    view = (await t.program.get("u1"))!;
    expect(view.day).toBe(2);
    expect(view.rules.every((r) => !r.done)).toBe(true);
    expect(view.fullDays).toBe(1);
    await expect(t.program.tick("u1", "cold", true)).rejects.toThrow("That isn't one of today's habits.");
  });

  it("takes the energy check when it's due, and compares the Focus Score", async () => {
    const t = await build("2026-11-02T15:00:00Z");
    await t.program.start("u1", seed.id, admin);
    let view = await t.program.check("u1", [2, 1, 3, 2, 1]);
    expect(view.checks).toEqual([{ checkpoint: 1, date: "2026-11-02", answers: [2, 1, 3, 2, 1], total: 9, band: "some" }]);
    expect(view.checkDue).toBeNull();
    await expect(t.program.check("u1", [0, 0, 0, 0, 0])).rejects.toThrow("No energy check is due today.");
    await expect(t.program.check("u1", [5, 0, 0, 0, 0])).rejects.toThrow("Answer each of the five areas with 0 to 4.");

    // Day 15: the second check, and the score over the first and the latest week.
    for (const [date, score] of [["2026-11-03", 60], ["2026-11-04", 62], ["2026-11-14", 70], ["2026-11-16", 74]] as const) {
      await t.scores.put({ userId: "u1", date, score, components: {} as never, explanation: "" } as never);
    }
    t.at("2026-11-16T15:00:00Z");
    view = (await t.program.get("u1"))!;
    expect(view).toMatchObject({ day: 15, phase: "build", checkDue: 15, focusScore: { firstWeek: 61, lastWeek: 72 } });
  });

  it("shows a finished program for a week, then lets it go", async () => {
    const t = await build("2026-11-02T15:00:00Z");
    await t.program.start("u1", seed.id, admin);
    t.at("2026-12-02T15:00:00Z");
    expect(await t.program.get("u1")).toMatchObject({ day: 31, phase: "finished", rules: [], checkDue: 30 });
    t.at("2026-12-10T15:00:00Z");
    expect(await t.program.get("u1")).toBeNull();
    await t.program.stop("u1");
    await expect(t.program.tick("u1", "daylight", true)).rejects.toThrow("No program is running.");
  });
});
