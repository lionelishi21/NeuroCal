import { describe, expect, it } from "@jest/globals";
import { periodDays, sessionExperimentOf } from "./session";
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

describe("periods", () => {
  const dayOf = (d: Date) => d.toISOString().slice(0, 10);

  it("covers each day from the start through the end, or through today while it runs", () => {
    expect(periodDays({ takenAt: new Date("2026-10-23T09:00:00Z"), endsAt: null }, today, dayOf)).toEqual(["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"]);
    expect(periodDays({ takenAt: new Date("2026-10-20T09:00:00Z"), endsAt: new Date("2026-10-22T09:00:00Z") }, today, dayOf)).toEqual(["2026-10-20", "2026-10-21", "2026-10-22"]);
    // Days ahead of today don't count yet.
    expect(periodDays({ takenAt: new Date("2026-10-25T09:00:00Z"), endsAt: new Date("2026-11-25T09:00:00Z") }, today, dayOf)).toEqual(["2026-10-25", "2026-10-26"]);
  });

  it("compares the days a subscription runs with the days before it", () => {
    const on = Array.from({ length: 30 }, (_, i) => addDays(today, -29 + i));
    const brain = new Map(Array.from({ length: 60 }, (_, i) => addDays(today, -59 + i)).map((d) => [d, on.includes(d) ? 72 : 70] as [string, number]));
    const e = sessionExperimentOf({ kind: "quantum_upgrade", sessionDays: on, series: brain, today });
    expect(e).toMatchObject({ measure: "brain_speed", verdict: "no_change", since: { days: 30 }, before: { days: 30 } });
    expect(e.summary).toBe("No clear difference in your Brain speed: 72 on days with Quantum Upgrade running, against 70 on other days (30 vs 30).");
    const allOn = new Map(on.map((d) => [d, 72] as [string, number]));
    expect(sessionExperimentOf({ kind: "quantum_upgrade", sessionDays: on, series: allOn, today }).summary).toBe(
      "NeuroCal needs a few more days without Quantum Upgrade to compare with: your days before it started count.",
    );
  });
});
