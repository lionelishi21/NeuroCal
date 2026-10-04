import { BioProfile } from "@neurocal/contracts";
import { describe, expect, it } from "vitest";
import { STEPS, STEP_COUNT, dayPlan, macroRatio, macroTargets, stepComplete, toProfileFields, visibleQuestions } from "./bioProfile";

describe("bio-profile onboarding", () => {
  it("has eleven steps, and every question's options are ids the contract accepts", () => {
    expect(STEP_COUNT).toBe(11);
    const shape = BioProfile.shape as Record<string, { safeParse(v: unknown): { success: boolean } }>;
    for (const step of STEPS) {
      for (const question of step.questions) {
        if (question.key === "diet") continue; // stored as the profile's dietaryPreference
        for (const [value] of question.options) {
          const stored = question.options.length === 2 && value === "yes" ? true : question.options.length === 2 && value === "no" ? false : value;
          const sample = question.key === "supplements" ? [stored] : stored;
          expect([question.key, value, shape[question.key]!.safeParse(sample).success]).toEqual([question.key, value, true]);
        }
      }
    }
  });

  it("hides the coffee and supplement follow-ups until they apply", () => {
    const coffee = STEPS.find((s) => s.eyebrow === "Coffee")!;
    expect(visibleQuestions(coffee, { coffeeType: "none" }).map((q) => q.key)).toEqual(["coffeeType"]);
    expect(stepComplete(coffee, { coffeeType: "none" })).toBe(true);
    expect(stepComplete(coffee, { coffeeType: "black" })).toBe(false);

    const stack = STEPS.find((s) => s.eyebrow === "The stack")!;
    expect(stepComplete(stack, { takesSupplements: "no" })).toBe(true);
    expect(stepComplete(stack, { takesSupplements: "yes" })).toBe(true); // "Which ones?" is optional
  });

  it("turns a diet into a macro split of a 2,200 kcal day", () => {
    expect(macroRatio("cyclical_keto").map((s) => [s.name, s.percent, s.grams])).toEqual([
      ["Fat", 70, 171],
      ["Protein", 20, 110],
      ["Carbs", 10, 55],
    ]);
    expect(macroTargets("carnivore")).toEqual({ fatG: 159, proteinG: 193, carbsG: 0 });
    expect(macroRatio(undefined).map((s) => s.percent)).toEqual([30, 25, 45]);
  });

  it("derives the day's rhythm from wake time and fasting", () => {
    expect(dayPlan({ wake: "before_6", fasting: "omad" })).toEqual([
      { label: "Eating window", value: "14:30–15:30 (OMAD)" },
      { label: "Caffeine curfew", value: "13:30" },
      { label: "Amber light from", value: "19:00" },
    ]);
    expect(dayPlan({ wake: "after_8", fasting: "none" })[0]!.value).toBe("Open, last meal by 20:30");
  });

  it("leaves coffee details and supplements out when they don't apply", () => {
    const fields = toProfileFields({
      wake: "after_8", diet: "paleo", fasting: "none", coffeeType: "none", moldSensitive: "yes", eveningScreens: "3_plus", phoneAtNight: "next_to_head",
      water: "filtered", addsMinerals: "yes", coldTherapy: "daily", redLight: "daily", pemf: "weekly", takesSupplements: "no", supplements: ["nootropics"],
      movement: "none", friction: "night_waking", goal: "longevity",
    });
    expect(fields.dietaryPreference).toBe("paleo");
    expect(fields.cognitiveGoals).toEqual([]);
    expect(fields.bioProfile).not.toHaveProperty("coffeeTime");
    expect(fields.bioProfile.supplements).toEqual([]);
    expect(BioProfile.safeParse(fields.bioProfile).success).toBe(true);
  });
});
