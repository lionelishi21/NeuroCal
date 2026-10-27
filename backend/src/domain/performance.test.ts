import { describe, expect, it } from "@jest/globals";
import { type PerformanceSession, type SessionContext, summaryOf } from "./performance";

let n = 0;
/** A session and what came before it; by default a plain 60-minute afternoon session after an unknown night. */
function point(s: Partial<PerformanceSession>, c: Partial<SessionContext> = {}) {
  return {
    session: { id: `p${++n}`, activity: "deep_work" as const, startedAt: new Date("2026-10-20T14:00:00Z"), minutes: 60, sharpness: 3, ...s },
    context: { sleep: null, caffeineBefore: false, mealBefore: false, hour: 14, ...c },
  };
}

describe("summaryOf", () => {
  it("waits for enough sessions before looking for patterns", () => {
    const s = summaryOf("deep_work", [point({ sharpness: 4, result: 3 }), point({ sharpness: 2, result: 5 })]);
    expect(s).toMatchObject({ sessions: 2, sharpness: 3, bestResult: 5, insights: [] });
    expect(s.note).toBe("Log 4 more sessions and NeuroCal can show what goes with your best ones.");
  });

  it("finds that good sleep goes with sharper sessions, and says it as the person's own pattern", () => {
    const points = [
      ...[5, 4, 4, 5].map((sharpness) => point({ sharpness }, { sleep: 0.85 })),
      ...[2, 3, 2].map((sharpness) => point({ sharpness }, { sleep: 0.5 })),
    ];
    const s = summaryOf("deep_work", points);
    expect(s.note).toBeUndefined();
    expect(s.insights[0]).toMatchObject({ factor: "sleep", measure: "sharpness", with: 4.5, without: 2.3, countWith: 4, countWithout: 3 });
    expect(s.insights[0]!.summary).toBe("You feel sharper in deep work after a good night's sleep: 4.5 against 2.3 out of 5 (4 sessions against 3).");
  });

  it("phrases the better side when the factor goes with worse sessions", () => {
    const points = [
      ...[2, 2, 3].map((sharpness) => point({ sharpness }, { mealBefore: true })),
      ...[4, 4, 5].map((sharpness) => point({ sharpness })),
    ];
    const meal = summaryOf("study", points).insights.find((i) => i.factor === "meal")!;
    expect(meal).toMatchObject({ with: 2.3, without: 4.3 });
    expect(meal.summary).toBe("You feel sharper studying without a meal in the 2 hours before: 4.3 against 2.3 out of 5 (3 sessions against 3).");
  });

  it("keeps only the strongest time of day, and at most three patterns", () => {
    const points = [
      ...[5, 5, 5].map((sharpness) => point({ sharpness, minutes: 45 }, { hour: 9, sleep: 0.9, caffeineBefore: true })),
      ...[2, 2, 2].map((sharpness) => point({ sharpness, minutes: 120 }, { hour: 20, sleep: 0.4 })),
    ];
    const s = summaryOf("creative", points);
    expect(s.insights).toHaveLength(3);
    expect(s.insights.filter((i) => ["morning", "afternoon", "evening"].includes(i.factor))).toHaveLength(1);
  });

  it("says when nothing stands out", () => {
    const s = summaryOf("training", [3, 3, 3, 3, 3, 3].map((sharpness, i) => point({ sharpness }, { sleep: i % 2 ? 0.9 : 0.4 })));
    expect(s.insights).toEqual([]);
    expect(s.note).toMatch(/^No clear pattern yet/);
  });

  it("adds up games and rating, and compares win rates with enough games", () => {
    const fresh = [0, 1, 2].map(() => point({ activity: "gaming", sharpness: 4, minutes: 60, wins: 7, losses: 3, ratingBefore: 1500, ratingAfter: 1540 }, { hour: 19 }));
    const tired = [0, 1, 2].map(() => point({ activity: "gaming", sharpness: 4, minutes: 150, wins: 4, losses: 6, ratingBefore: 1540, ratingAfter: 1500 }, { hour: 19 }));
    const s = summaryOf("gaming", [...fresh, ...tired]);
    expect(s).toMatchObject({ wins: 33, losses: 27, ratingChange: 0 });
    expect(s.insights).toEqual([
      expect.objectContaining({
        factor: "short",
        measure: "win_rate",
        with: 0.7,
        without: 0.4,
        summary: "You win more in sessions of 90 minutes or less: 70% against 40% of games (30 games against 30).",
      }),
    ]);
  });
});
