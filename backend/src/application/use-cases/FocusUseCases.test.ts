import { beforeEach, describe, expect, it } from "@jest/globals";
import { InvalidError } from "../../domain/errors";
import {
  FakeExplainer,
  FixedClock,
  InMemoryCheckIns,
  InMemoryFocusScores,
  InMemoryMeals,
  InMemoryProfiles,
  InMemoryTelemetry,
  item,
  profile,
} from "../testing/fakes";
import { GetFocusScoreUseCase } from "./GetFocusScoreUseCase";
import { IngestTelemetryUseCase } from "./IngestTelemetryUseCase";

const clock = new FixedClock(new Date("2026-09-29T15:00:00Z")); // 10:00 on the 29th in Chicago
const sleepNight = { start: new Date("2026-09-29T04:00:00Z"), end: new Date("2026-09-29T10:00:00Z"), source: "manual" as const }; // 23:00–05:00, 6 h

describe("IngestTelemetryUseCase", () => {
  const ingest = new IngestTelemetryUseCase(new InMemoryTelemetry(), clock);

  it("stores valid sleep; a corrected entry replaces the overlapping one from the same source", async () => {
    const telemetry = new InMemoryTelemetry();
    const useCase = new IngestTelemetryUseCase(telemetry, clock);
    await useCase.sleep({ userId: "u1", sessions: [sleepNight] });
    const corrected = { ...sleepNight, start: new Date("2026-09-29T05:00:00Z"), end: new Date("2026-09-29T09:00:00Z") };
    await useCase.sleep({ userId: "u1", sessions: [corrected] });
    await useCase.sleep({ userId: "u1", sessions: [{ ...sleepNight, source: "wearable" }] });
    const stored = await telemetry.sleepEndingOn("u1", { date: "2026-09-29", timeZone: "America/Chicago" });
    expect(stored.map((s) => [s.source, s.start.toISOString()])).toEqual([
      ["manual", "2026-09-29T05:00:00.000Z"],
      ["wearable", "2026-09-29T04:00:00.000Z"],
    ]);
  });

  it.each([
    ["ends before it starts", { ...sleepNight, end: new Date("2026-09-29T03:00:00Z") }],
    ["is longer than a day", { ...sleepNight, start: new Date("2026-09-27T00:00:00Z") }],
    ["ends in the future", { ...sleepNight, end: new Date("2026-09-29T20:00:00Z") }],
    ["has more deep sleep than sleep", { ...sleepNight, deepMinutes: 400 }],
  ])("rejects sleep that %s", async (_, session) => {
    await expect(ingest.sleep({ userId: "u1", sessions: [session] })).rejects.toBeInstanceOf(InvalidError);
  });

  it("rejects screen time longer than its window", async () => {
    const sample = { windowStart: new Date("2026-09-29T03:00:00Z"), windowEnd: new Date("2026-09-29T04:00:00Z"), minutes: 90, source: "wearable" as const };
    await expect(ingest.screenTime({ userId: "u1", samples: [sample] })).rejects.toBeInstanceOf(InvalidError);
  });
});

describe("GetFocusScoreUseCase", () => {
  let telemetry: InMemoryTelemetry;
  let meals: InMemoryMeals;
  let checkIns: InMemoryCheckIns;
  let scores: InMemoryFocusScores;
  let profiles: InMemoryProfiles;

  beforeEach(async () => {
    telemetry = new InMemoryTelemetry();
    meals = new InMemoryMeals();
    checkIns = new InMemoryCheckIns();
    scores = new InMemoryFocusScores();
    profiles = new InMemoryProfiles();
    await profiles.save(profile());
  });

  const build = (explainer = new FakeExplainer()) =>
    new GetFocusScoreUseCase(profiles, meals, checkIns, telemetry, scores, explainer, clock);

  it("scores today from last night's sleep, yesterday's meals and check-ins", async () => {
    await telemetry.upsertSleep("u1", [sleepNight]);
    await meals.create("u1", { kind: "dinner", eatenAt: new Date("2026-09-29T02:00:00Z"), items: [{ ...item("Pasta", 800, 25, 110, 20), glycemicLoad: "high" }] }); // 21:00 on the 28th
    await checkIns.create("u1", { at: new Date("2026-09-29T14:00:00Z"), flags: ["low_focus"] });

    const result = await build().execute({ userId: "u1" });

    expect(result.date).toBe("2026-09-29");
    expect(result.components).toEqual({ sleep: 0.75, timing: 1, glycemic: 0, stress: 0.75 });
    expect(result.score).toBe(65); // 100 × (0.4·0.75 + 0.2·1 + 0.2·0 + 0.2·0.75)
    expect(result.explanation).toBe("Sleep is the main thing holding you back today.");
    expect(await scores.get("u1", "2026-09-29")).toEqual(result);
  });

  it("reuses the stored explanation until the inputs change", async () => {
    await telemetry.upsertSleep("u1", [sleepNight]);
    const explainer = new FakeExplainer();
    await build(explainer).execute({ userId: "u1" });
    await build(explainer).execute({ userId: "u1" });
    expect(explainer.calls).toHaveLength(1);

    await checkIns.create("u1", { at: new Date("2026-09-29T14:30:00Z"), flags: ["stressed"] });
    await build(explainer).execute({ userId: "u1" });
    expect(explainer.calls).toHaveLength(2);
  });

  it("falls back to a plain explanation when the explainer fails", async () => {
    await telemetry.upsertSleep("u1", [sleepNight]);
    const result = await build(new FakeExplainer(new Error("timeout"))).execute({ userId: "u1" });
    expect(result.explanation).toBe("Last night's sleep is pulling your score down the most today.");
  });

  it("has no score and asks for data on an empty day, without calling the AI", async () => {
    const explainer = new FakeExplainer();
    const result = await build(explainer).execute({ userId: "u1" });
    expect(result.score).toBeNull();
    expect(result.explanation).toMatch(/Log last night's sleep/);
    expect(explainer.calls).toHaveLength(0);
  });
});
