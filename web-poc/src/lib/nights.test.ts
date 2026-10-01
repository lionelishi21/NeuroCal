import type { HistoryDay } from "@neurocal/contracts";
import { describe, expect, it } from "vitest";
import { averageSleep, eveningInsights, hoursIntoEvening, nightsFrom, usualBedtime } from "./nights";

const day = (date: string, patch: Partial<HistoryDay> = {}): HistoryDay => ({
  date,
  calorieTarget: 2200,
  caloriesEaten: 1800,
  proteinG: 100,
  focusScore: 70,
  sleepMinutes: null,
  lastMealAt: null,
  bedtime: null,
  wakeTime: null,
  lateScreenMinutes: null,
  flags: [],
  ...patch,
});

describe("nights", () => {
  const days = [
    day("2026-09-26", { lastMealAt: "19:00" }),
    day("2026-09-27", { lastMealAt: "22:10", sleepMinutes: 480, bedtime: "22:30", wakeTime: "06:30", lateScreenMinutes: 0 }),
    day("2026-09-28", { lastMealAt: "21:30", sleepMinutes: 330, bedtime: "01:00", wakeTime: "06:30", lateScreenMinutes: 60 }),
    day("2026-09-29", { sleepMinutes: 390, bedtime: "00:00", wakeTime: "06:30" }),
  ];
  const nights = nightsFrom(days);

  it("pairs each evening's last meal with the next morning's sleep", () => {
    expect(nights).toHaveLength(3);
    expect(nights[1]).toMatchObject({ evening: "2026-09-27", morning: "2026-09-28", lastMealAt: "22:10", sleepMinutes: 330, lateScreenMinutes: 60 });
  });

  it("places times on the 6pm axis, wrapping past midnight", () => {
    expect(hoursIntoEvening("18:00")).toBe(0);
    expect(hoursIntoEvening("01:30")).toBe(7.5);
    expect(usualBedtime(nights)).toBe("00:00");
    expect(averageSleep(nights)).toBe(400);
  });

  it("compares sleep after late and early dinners", () => {
    const [eating, screens, bedtime] = eveningInsights(nights);
    // Late: 330 and 390 → 6 h 00; early: 480 → 2 h 00 more.
    expect(eating).toMatch(/the 2 nights you ate after 9pm, you slept 6 h 00 min on average.*2 h 00 min less/);
    expect(screens).toMatch(/after 10pm on one night, for 60 minutes/);
    expect(bedtime).toMatch(/Your bedtime moved between/);
  });

  it("asks for screen time when none is logged", () => {
    expect(eveningInsights(nightsFrom([day("2026-09-28"), day("2026-09-29", { sleepMinutes: 420, bedtime: "23:00", wakeTime: "06:00" })]))).toEqual([
      expect.stringMatching(/No late screen time is logged yet/),
    ]);
  });
});
