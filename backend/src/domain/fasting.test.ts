import { describe, expect, it } from "@jest/globals";
import { fastingState, fastingStreak } from "./fasting";

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
