import { describe, expect, it } from "@jest/globals";
import { type MarkerReading, summarize } from "./markers";

const r = (marker: MarkerReading["marker"], value: number, date: string, id = `${marker}-${date}`): MarkerReading => ({ id, marker, value, measuredAt: new Date(`${date}T08:00:00Z`), source: "manual" });

describe("summarize", () => {
  it("gives the latest, the change over about three months, and whether it went the healthy way", () => {
    const [hr, grip] = summarize([
      r("resting_hr", 68, "2026-07-10"),
      r("resting_hr", 64, "2026-08-20"),
      r("resting_hr", 61, "2026-10-12"),
      r("grip_kg", 40, "2026-07-15"),
      r("grip_kg", 38, "2026-10-15"),
    ]);
    expect(hr).toMatchObject({ marker: "resting_hr", latest: { value: 61 }, change: -7, improving: true });
    expect(hr!.points.map((p) => p.value)).toEqual([68, 64, 61]);
    expect(grip).toMatchObject({ marker: "grip_kg", change: -2, improving: false });
  });

  it("has no change without a reading a month or more older, and leaves out markers with no readings", () => {
    const out = summarize([r("hba1c", 5.6, "2026-10-01"), r("hba1c", 5.5, "2026-10-15")]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ change: null, improving: null });
  });
});
