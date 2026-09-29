import { describe, expect, it } from "vitest";
import { sleepWindow } from "./LogSleepSheet";

describe("sleepWindow", () => {
  const now = new Date(2026, 8, 29, 9, 0);

  it("puts a late bedtime on the previous evening", () => {
    const { start, end, minutes } = sleepWindow("23:15", "05:45", now);
    expect(start).toEqual(new Date(2026, 8, 28, 23, 15));
    expect(end).toEqual(new Date(2026, 8, 29, 5, 45));
    expect(minutes).toBe(390);
  });

  it("keeps an after-midnight bedtime on the same day", () => {
    expect(sleepWindow("01:30", "08:00", now).minutes).toBe(390);
  });
});
