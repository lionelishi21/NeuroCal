import { describe, expect, it } from "@jest/globals";
import { type SupplementLabelReading, flagsFor, summaryFor } from "./supplement";

const today = new Date("2026-10-13T12:00:00Z");
const label = (over: Partial<SupplementLabelReading> = {}): SupplementLabelReading => ({
  brand: "Calm Labs",
  productName: "Magnesium Glycinate",
  ingredients: [{ name: "Magnesium (as magnesium glycinate)", amount: 200, unit: "mg", inBlend: false }],
  proprietaryBlend: false,
  testing: ["nsf_certified"],
  expiresOn: "2027-03",
  ...over,
});
const kinds = (r: SupplementLabelReading) => flagsFor(r, today).map((f) => f.kind);

describe("supplement label flags", () => {
  it("has nothing to say about a tested label with doses under the limits", () => {
    expect(flagsFor(label(), today)).toEqual([]);
    expect(summaryFor(label())).toBe("Calm Labs Magnesium Glycinate: 1 ingredient, tested by NSF, expires March 2027.");
  });

  it("flags blends, missing doses and missing testing", () => {
    const r = label({
      ingredients: [
        { name: "Focus blend", amount: 500, unit: "mg", inBlend: false },
        { name: "Lion's mane", inBlend: true },
        { name: "Bacopa", inBlend: false },
      ],
      proprietaryBlend: true,
      testing: [],
    });
    expect(kinds(r)).toEqual(["proprietary_blend", "doses_missing", "no_third_party_testing"]);
    expect(flagsFor(r, today)[1]!.message).toBe("No dose could be read for Bacopa. Check the label.");
  });

  it("compares one serving with the adult upper limit, converting units", () => {
    const over = flagsFor(
      label({
        ingredients: [
          { name: "Vitamin D3 (as cholecalciferol)", amount: 10000, unit: "IU", inBlend: false }, // 250 mcg
          { name: "Zinc", amount: 50, unit: "mg", inBlend: false },
          { name: "Selenium", amount: 0.2, unit: "mg", inBlend: false }, // 200 mcg: under
          { name: "Vitamin C", amount: 1, unit: "g", inBlend: false }, // 1000 mg: under
          { name: "Folate (as folic acid)", amount: 1360, unit: "mcg DFE", inBlend: false }, // can't compare
        ],
      }),
      today,
    );
    expect(over.map((f) => f.message)).toEqual([
      "One serving has 250 mcg of vitamin D, above the 100 mcg a day that health authorities set as the upper limit for adults. Check with your doctor before taking it.",
      "One serving has 50 mg of zinc, above the 40 mg a day that health authorities set as the upper limit for adults. Check with your doctor before taking it.",
    ]);
  });

  it("flags an expired or nearly expired product, counting a month to its last day", () => {
    expect(kinds(label({ expiresOn: "2026-09" }))).toEqual(["expired"]);
    expect(flagsFor(label({ expiresOn: "2026-09" }), today)[0]!.message).toBe("It expired in September 2026.");
    expect(kinds(label({ expiresOn: "2026-10" }))).toEqual(["expires_soon"]);
    expect(kinds(label({ expiresOn: "2026-12-20" }))).toEqual(["expires_soon"]);
    expect(kinds(label({ expiresOn: "2027-02" }))).toEqual([]);
  });

  it("explains an unreadable photo instead of flagging it", () => {
    const r: SupplementLabelReading = { problem: "blurry", ingredients: [], proprietaryBlend: false, testing: [] };
    expect(flagsFor(r, today)).toEqual([]);
    expect(summaryFor(r)).toBe("The label is too blurry to read. Hold the phone steady and try again.");
  });
});
