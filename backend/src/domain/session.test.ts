import { describe, expect, it } from "@jest/globals";
import { sessionExperimentOf } from "./session";
import { addDays } from "./weight";

const today = "2026-10-26";
/** Sleep scores for the 30 days to today: 85 on the nights after a sauna day, 75 otherwise. */
function nights(saunaDays: string[], after = 85, other = 75) {
  const lagged = new Set(saunaDays.map((d) => addDays(d, 1)));
  return new Map(Array.from({ length: 30 }, (_, i) => addDays(today, -29 + i)).map((d) => [d, lagged.has(d) ? after : other] as [string, number]));
}

describe("sessionExperimentOf", () => {
  it("compares the nights after a sauna with the other nights", () => {
    const saunas = ["2026-10-02", "2026-10-06", "2026-10-10", "2026-10-15", "2026-10-20"];
    const e = sessionExperimentOf({ kind: "sauna", sessionDays: saunas, series: nights(saunas), today });
    expect(e).toMatchObject({ measure: "sleep", verdict: "helping", change: 10, since: { mean: 85, days: 5 }, before: { days: 25 } });
    expect(e.summary).toBe("Your sleep score is higher: 85 on nights after a sauna session, against 75 on other nights (5 vs 25).");
  });

  it("calls no clear difference, and waits for enough days with and without", () => {
    const saunas = ["2026-10-02", "2026-10-06", "2026-10-10", "2026-10-15"];
    expect(sessionExperimentOf({ kind: "sauna", sessionDays: saunas, series: nights(saunas, 77), today }).verdict).toBe("no_change");
    const few = sessionExperimentOf({ kind: "sauna", sessionDays: ["2026-10-20"], series: nights(["2026-10-20"]), today });
    expect(few).toMatchObject({ verdict: "too_early", summary: "3 more days after a sauna session, with your sleep score logged, and NeuroCal can compare them with days without." });
  });

  it("measures same-day practices on the day itself", () => {
    const days = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"];
    const brain = new Map(Array.from({ length: 20 }, (_, i) => addDays(today, -19 + i)).map((d) => [d, days.includes(d) ? 80 : 70] as [string, number]));
    expect(sessionExperimentOf({ kind: "cold_plunge", sessionDays: days, series: brain, today })).toMatchObject({ measure: "brain_speed", verdict: "helping", change: 10 });
  });
});
