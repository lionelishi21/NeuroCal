import { describe, expect, it } from "@jest/globals";
import { activePlan, fastingState, fastingStreak, fastingProtocolOf, plannedFastLimit } from "./fasting";

const at = (iso: string) => new Date(`${iso}Z`);
const day = (d: Date) => d.toISOString().slice(0, 10);

describe("fasting timer", () => {
  it("has nothing to time without meals", () => {
    expect(fastingState([], at("2026-10-13T10:00"), 16)).toEqual({ kind: "unknown" });
  });

  it("runs the eating window from the first meal after a full fast", () => {
    const meals = [at("2026-10-12T19:00"), at("2026-10-13T12:00"), at("2026-10-13T15:30")];
    expect(fastingState(meals, at("2026-10-13T16:00"), 16)).toEqual({
      kind: "eating",
      openedAt: at("2026-10-13T12:00"),
      closesAt: at("2026-10-13T20:00"),
    });
  });

  it("fasts from the last meal once the window has closed, until the goal", () => {
    const meals = [at("2026-10-12T12:00"), at("2026-10-12T19:30")];
    expect(fastingState(meals, at("2026-10-13T09:00"), 16)).toEqual({
      kind: "fasting",
      since: at("2026-10-12T19:30"),
      goalAt: at("2026-10-13T11:30"),
    });
    expect(fastingState(meals, at("2026-10-13T12:00"), 16)).toMatchObject({ kind: "fasted" });
  });

  it("counts days in a row with a completed fast", () => {
    const meals = [
      at("2026-10-09T19:00"),
      at("2026-10-10T12:00"), // 17 h: done on the 10th
      at("2026-10-10T19:00"),
      at("2026-10-11T08:00"), // 13 h: not done on the 11th
      at("2026-10-11T19:00"),
      at("2026-10-12T12:00"), // 17 h: done on the 12th
      at("2026-10-12T19:00"),
    ];
    // On the 13th at 09:00 today's fast is still running: the streak counts the 12th only.
    expect(fastingStreak(meals, at("2026-10-13T09:00"), 16, day)).toBe(1);
    // At 12:00 the running fast has passed 16 h, so today counts too.
    expect(fastingStreak(meals, at("2026-10-13T12:00"), 16, day)).toBe(2);
    expect(fastingStreak([], at("2026-10-13T12:00"), 16, day)).toBe(0);
  });
});

describe("fastingProtocolOf with health conditions", () => {
  const profile = (fasting: string, conditions: string[], fastingCaution = false) =>
    ({ bioProfile: { fasting }, healthConditions: conditions, ...(fastingCaution ? { weightGoal: { startKg: 90, targetKg: 80, startedOn: "2026-10-01", pacePctPerWeek: 0.5, fastingCaution } } : {}) }) as Parameters<typeof fastingProtocolOf>[0];

  it("drops fasting when pregnant or with an eating-disorder history, and caps it at 12:12 on diabetes medicines", () => {
    expect(fastingProtocolOf(profile("omad", ["pregnant"]))).toBe("none");
    expect(fastingProtocolOf(profile("16_8", ["eating_disorder_history"]))).toBe("none");
    expect(fastingProtocolOf(profile("omad", ["glucose_lowering_meds"]))).toBe("12_12");
    expect(fastingProtocolOf(profile("16_8", ["type2_diabetes"]))).toBe("16_8");
    expect(fastingProtocolOf(profile("omad", [], true))).toBe("12_12");
    expect(fastingProtocolOf(profile("none", ["joint_pain"]))).toBe("none");
  });
});

describe("planned fasts", () => {
  it("allow up to 36 hours, 12 at the cautious protocol, and none when a condition rules fasting out", () => {
    expect(plannedFastLimit({})).toBe(36);
    expect(plannedFastLimit({ healthConditions: ["glucose_lowering_meds"] })).toBe(12);
    expect(plannedFastLimit({ weightGoal: { startKg: 90, targetKg: 80, startedOn: "2026-10-01", pacePctPerWeek: 0.5, fastingCaution: true } })).toBe(12);
    expect(plannedFastLimit({ healthConditions: ["eating_disorder_history"] })).toBe(0);
  });

  it("run until their end, or until a meal is eaten after they were made", () => {
    const plan = { startedAt: at("2026-10-20T20:00"), until: at("2026-10-21T12:00") };
    expect(activePlan(plan, [at("2026-10-20T18:00")], at("2026-10-21T08:00"))).toBe(plan);
    expect(activePlan(plan, [at("2026-10-21T07:00")], at("2026-10-21T08:00"))).toBeNull();
    expect(activePlan(plan, [], at("2026-10-21T12:00"))).toBeNull();
    expect(activePlan(null, [], at("2026-10-21T08:00"))).toBeNull();
  });
});
