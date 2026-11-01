import { describe, expect, it } from "@jest/globals";
import { PROGRAM_DAYS, PROGRAM_TIPS, autoDone, checkDue, dayOf, energyBand, isFullDay, phaseOf, rulesFor, tipFor } from "./program";

const facts = { daylight: false, mealMinutes: [] as number[], exercise: [] as never[], sessions: [] as never[] };

describe("program", () => {
  it("runs a 7-day reset, then the build adds training on day 8 and cold on day 10", () => {
    expect(dayOf("2026-11-01", "2026-11-01")).toBe(1);
    expect(dayOf("2026-11-01", "2026-12-01")).toBe(31);
    expect([1, 7, 8, 30, 31].map(phaseOf)).toEqual(["reset", "reset", "build", "build", "finished"]);
    expect(rulesFor(7).map((r) => r.id)).toEqual(["daylight", "noSeedOils", "noSugar", "noAlcohol", "screensOff", "lastMeal", "walk"]);
    expect(rulesFor(8).map((r) => r.id)).toContain("train");
    expect(rulesFor(9).map((r) => r.id)).not.toContain("cold");
    expect(rulesFor(10).map((r) => r.id)).toContain("cold");
    expect(rulesFor(31)).toEqual([]);
  });

  it("ticks the last meal only after 7pm, with meals logged and none later", () => {
    const meals = { ...facts, mealMinutes: [8 * 60, 18 * 60 + 30] };
    expect(autoDone("lastMeal", meals, 18 * 60)).toBe(false);
    expect(autoDone("lastMeal", meals, 20 * 60)).toBe(true);
    expect(autoDone("lastMeal", { ...meals, mealMinutes: [8 * 60, 19 * 60 + 15] }, 21 * 60)).toBe(false);
    expect(autoDone("lastMeal", facts, 21 * 60)).toBe(false);
    expect(autoDone("walk", { ...facts, exercise: ["walk"] }, 0)).toBe(true);
    expect(autoDone("training", { ...facts, exercise: ["calf"] }, 0)).toBe(false);
    expect(autoDone("cold", { ...facts, sessions: ["cold_plunge"] }, 0)).toBe(true);
  });

  it("counts a full day without the weekly training habit", () => {
    const daily = rulesFor(8).filter((r) => !r.weekly).map((r) => r.id);
    expect(isFullDay(8, daily)).toBe(true);
    expect(isFullDay(8, daily.slice(1))).toBe(false);
  });

  it("opens each energy check for a few days, and reads the total like the guide", () => {
    expect(checkDue(1, [])).toBe(1);
    expect(checkDue(4, [])).toBeNull();
    expect(checkDue(15, [1])).toBe(15);
    expect(checkDue(16, [1, 15])).toBeNull();
    expect(checkDue(32, [1, 15])).toBe(30);
    expect([0, 4, 5, 9, 10, 14, 15, 20].map(energyBand)).toEqual(["well", "well", "some", "some", "lots", "lots", "doctor", "doctor"]);
  });

  it("has a tip for every day and one for when it's done", () => {
    expect(PROGRAM_TIPS).toHaveLength(PROGRAM_DAYS);
    expect(tipFor(15).title).toBe("Halfway");
    expect(tipFor(30).title).toBe("The final energy check");
    expect(tipFor(31).title).toBe("You finished the 30 days");
  });
});
