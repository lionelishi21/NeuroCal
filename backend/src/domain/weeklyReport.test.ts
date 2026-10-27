import { describe, expect, it } from "@jest/globals";
import { type ReportDay, type ReportInput, weeklyReportOf } from "./weeklyReport";

const day = (date: string, d: Partial<ReportDay> = {}, c: Partial<ReportDay["components"]> = {}): ReportDay => ({
  date,
  focusScore: null,
  components: { sleep: null, timing: null, glycemic: null, stress: null, movement: null, ...c },
  sleepMinutes: null,
  caloriesEaten: 0,
  calorieTarget: 2200,
  proteinG: 0,
  lastMealAt: null,
  lateScreenMinutes: null,
  ...d,
});

const week = (start: number, d: Partial<ReportDay>, c: Partial<ReportDay["components"]>) =>
  Array.from({ length: 7 }, (_, i) => day(`2026-10-${String(start + i).padStart(2, "0")}`, d, c));

const input = (o: Partial<ReportInput> = {}): ReportInput => ({
  weekStart: "2026-10-19",
  weekEnd: "2026-10-25",
  thisWeek: week(19, { focusScore: 70, sleepMinutes: 450, caloriesEaten: 2050, proteinG: 110, lastMealAt: "20:10", lateScreenMinutes: 35 }, { sleep: 0.85, timing: 0.6, glycemic: 0.7, stress: 0.72, movement: 0.4 }),
  lastWeek: week(12, { focusScore: 64, sleepMinutes: 400, caloriesEaten: 2300, proteinG: 90 }, { sleep: 0.65, timing: 0.6, glycemic: 0.68, stress: 0.7, movement: 0.4 }),
  brain: { scores: [72, 76, 74], usual: 70, newLevel: { up: true, from: 68, to: 76 } },
  performance: { activities: [{ label: "Gaming", sessions: 3, sharpness: 4 }, { label: "Deep work", sessions: 2, sharpness: 3.5 }], pattern: "You win more in sessions of 90 minutes or less." },
  weight: { startKg: 82.4, endKg: 81.8, goalKg: 78 },
  working: [{ name: "Creatine", kind: "supplement", verdict: "helping", summary: "Your Brain speed is higher." }],
  level: { level: 2, name: "Fuelled", nextName: "Steady", nextMet: 2, nextOf: 3, missing: ["Sleep 7 hours on 5 nights a week"] },
  ...o,
});

describe("weeklyReportOf", () => {
  it("leads with the score against the week before and the pillar that moved it most", () => {
    const r = weeklyReportOf(input());
    expect(r.headline).toEqual({
      score: 70,
      previous: 64,
      change: 6,
      title: "Focus Score 70, up 6",
      summary: "Up from 64 the week before, mostly from sleep (65 to 85).",
    });
    expect(r.daysScored).toBe(7);
  });

  it("says what was logged in each pillar, and leaves air out without data", () => {
    const r = weeklyReportOf(input());
    expect(r.pillars.map((p) => p.label)).toEqual(["Sleep", "Evening", "Food", "Stress", "Move"]);
    const [sleep, evening, food, stress] = r.pillars;
    expect(sleep!.summary).toBe("7 h 30 min a night on average over 7 nights (6 h 40 min the week before).");
    expect(evening!.summary).toBe("Last meal at about 20:10 on average; 35 min of screens late in the evening.");
    expect(food!.summary).toBe("2,050 kcal a day against your 2,200 target, with 110 g of protein, over 7 days logged.");
    expect(stress!.summary).toBe("Stress score 72 (70 the week before), from your check-ins.");
  });

  it("puts Brain speed, performance, weight, what's working and the level in one place", () => {
    const r = weeklyReportOf(input());
    expect(r.mind.brain).toBe("3 Brain speed checks, averaging 74 against your usual 70. New level: your usual rose from 68 to 76 and has held.");
    expect(r.mind.performance).toBe(
      "5 performance sessions: 3 gaming, 2 deep work, sharpness 3.8/5 on average. You win more in sessions of 90 minutes or less.",
    );
    expect(r.body).toEqual({ startKg: 82.4, endKg: 81.8, goalKg: 78 });
    expect(r.working).toHaveLength(1);
    expect(r.level.summary).toBe("2 of 3 habits for Steady. Still to do: Sleep 7 hours on 5 nights a week.");
  });

  it("picks one step for next week from the weakest pillar, or asks for the missing input first", () => {
    expect(weeklyReportOf(input()).next).toMatchObject({ pillar: "movement", title: "Move a little more" });
    const noSleep = input({ thisWeek: week(19, { focusScore: 60, caloriesEaten: 2000 }, { glycemic: 0.7 }) });
    expect(weeklyReportOf(noSleep).next).toMatchObject({ pillar: "sleep", title: "Log your sleep" });
  });

  it("says plainly when there's too little for a score, and when it's the first week", () => {
    const empty = weeklyReportOf(input({ thisWeek: week(19, {}, {}), lastWeek: [] }));
    expect(empty.headline).toMatchObject({ score: null, title: "Not enough logged for a Focus Score" });
    expect(empty.pillars[0]!.summary).toBe("No sleep logged. Connect your health app or log your nights, and this fills in.");
    const first = weeklyReportOf(input({ lastWeek: [] }));
    expect(first.headline).toMatchObject({ title: "Focus Score 70", summary: "Your average over 7 days. Next week's report compares with this one." });
    const steady = weeklyReportOf(input({ lastWeek: week(12, { focusScore: 69 }, {}) }));
    expect(steady.headline.title).toBe("Focus Score 70, steady");
  });
});
