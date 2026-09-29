import { describe, expect, it } from "@jest/globals";
import { contentHash, needText, weakPoints } from "./recommendations";

const day = (sleep: number | null, timing: number | null, glycemic: number | null, stress: number | null) => ({ sleep, timing, glycemic, stress });

describe("weakPoints", () => {
  it("returns the two weakest components below 0.75, lowest first", () => {
    const week = [day(0.6, 0.9, 0.5, 0.7), day(0.7, 1, 0.6, 0.8), day(0.65, 0.8, null, 0.72)];
    expect(weakPoints(week)).toEqual([
      { component: "glycemic", label: "high-glycemic meals", average: 0.55 },
      { component: "sleep", label: "short or light sleep", average: 0.65 },
    ]);
  });

  it("is empty when everything is fine or missing", () => {
    expect(weakPoints([day(0.9, null, 0.8, 1)])).toEqual([]);
    expect(weakPoints([])).toEqual([]);
  });
});

describe("needText", () => {
  it("describes the problems and goals", () => {
    expect(needText([{ component: "sleep", label: "short or light sleep", average: 0.6 }], ["focus"])).toBe(
      "Help with short or light sleep. Goals: focus.",
    );
    expect(needText([], [])).toBe("Maintain steady focus, energy and sleep.");
  });
});

describe("contentHash", () => {
  it("is stable and changes with the text", () => {
    expect(contentHash("abc")).toBe(contentHash("abc"));
    expect(contentHash("abc")).not.toBe(contentHash("abd"));
  });
});
