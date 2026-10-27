import { beforeEach, describe, expect, it } from "@jest/globals";
import type { FocusScore } from "../../domain/types";
import { FixedClock, InMemoryCoffee, InMemoryFocusScores, InMemoryMeals, InMemoryPerformance, InMemoryProfiles, profile } from "../testing/fakes";
import { PerformanceUseCases } from "./PerformanceUseCases";

// 18:00 in Chicago (UTC-5 in October).
const now = new Date("2026-10-26T23:00:00Z");

describe("PerformanceUseCases", () => {
  let profiles: InMemoryProfiles;
  let sessions: InMemoryPerformance;
  let scores: InMemoryFocusScores;
  let coffee: InMemoryCoffee;
  let meals: InMemoryMeals;
  let uc: PerformanceUseCases;

  beforeEach(async () => {
    profiles = new InMemoryProfiles();
    await profiles.save(profile());
    sessions = new InMemoryPerformance();
    scores = new InMemoryFocusScores();
    coffee = new InMemoryCoffee();
    meals = new InMemoryMeals();
    uc = new PerformanceUseCases(profiles, sessions, new FixedClock(now), { scores, coffee, meals });
  });

  it("logs a session as just finished, and lists it", async () => {
    const view = await uc.log("u1", { activity: "deep_work", minutes: 90, sharpness: 4, result: 3 });
    expect(view.recent).toEqual([expect.objectContaining({ activity: "deep_work", startedAt: new Date("2026-10-26T21:30:00Z"), result: 3 })]);
    expect(view.summaries).toEqual([expect.objectContaining({ activity: "deep_work", sessions: 1, sharpness: 4, bestResult: 3 })]);
    expect(view.summaries[0]!.note).toMatch(/^Log 5 more sessions/);
  });

  it("keeps game details to gaming, and checks the numbers", async () => {
    await expect(uc.log("u1", { activity: "study", minutes: 60, sharpness: 3, wins: 2 })).rejects.toThrow("Games and ratings are for gaming sessions.");
    await expect(uc.log("u1", { activity: "training", minutes: 60, sharpness: 3, result: 5 })).rejects.toThrow("Training doesn't take a result.");
    await expect(uc.log("u1", { activity: "study", minutes: 60, sharpness: 3, result: 120 })).rejects.toThrow("Practice score is between 0 and 100.");
    await expect(uc.log("u1", { activity: "gaming", minutes: 60, sharpness: 6 })).rejects.toThrow("Sharpness is between 1 and 5.");
    await expect(uc.log("u1", { activity: "gaming", minutes: 60, sharpness: 3, startedAt: new Date("2026-10-23T12:00:00Z") })).rejects.toThrow(
      "Log a session from the last two days.",
    );
    const view = await uc.log("u1", { activity: "gaming", minutes: 60, sharpness: 3, game: "  Street Fighter 6 ", wins: 6, losses: 4, ratingBefore: 1500, ratingAfter: 1530 });
    expect(view.recent[0]).toMatchObject({ game: "Street Fighter 6", wins: 6, losses: 4 });
    expect(view.summaries[0]).toMatchObject({ wins: 6, losses: 4, ratingChange: 30 });
  });

  it("reads what came before each session: last night's sleep, caffeine and a meal", async () => {
    // Six mornings of deep work: on three, a good night, coffee an hour before and no meal; sharp. On three, the opposite.
    for (let d = 0; d < 6; d++) {
      const date = `2026-10-${String(15 + d).padStart(2, "0")}`;
      const start = new Date(`${date}T14:00:00Z`); // 09:00 in Chicago
      const good = d % 2 === 0;
      await scores.put({ userId: "u1", date, components: { sleep: good ? 0.9 : 0.5 } } as unknown as FocusScore);
      if (good) await coffee.add("u1", { takenAt: new Date(start.getTime() - 3_600_000), kind: "brewed", addIns: [] });
      else meals.rows.push({ id: `m${d}`, userId: "u1", kind: "breakfast", eatenAt: new Date(start.getTime() - 1_800_000), items: [{ name: "Pancakes", calories: 700 } as never] });
      await sessions.add("u1", { activity: "deep_work", startedAt: start, minutes: 60, sharpness: good ? 5 : 2 });
    }
    const [deep] = (await uc.view("u1")).summaries;
    expect(deep!.insights.map((i) => i.factor).sort()).toEqual(["caffeine", "meal", "sleep"]);
    expect(deep!.insights.find((i) => i.factor === "sleep")!.summary).toBe(
      "You feel sharper in deep work after a good night's sleep: 5 against 2 out of 5 (3 sessions against 3).",
    );
  });

  it("removes only the person's own sessions", async () => {
    const view = await uc.log("u1", { activity: "creative", minutes: 30, sharpness: 3 });
    await expect(uc.remove("u2", view.recent[0]!.id)).rejects.toThrow("No such session.");
    await uc.remove("u1", view.recent[0]!.id);
    expect((await uc.view("u1")).recent).toEqual([]);
  });
});
