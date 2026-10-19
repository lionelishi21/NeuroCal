import { describe, expect, it } from "@jest/globals";
import { conditionsOf, fastingLimit, glycemicWeightFor, interactionOf, mealNotes, suits, unsuitable, weightLossAllowed } from "./conditions";

const cold = { title: "Two-minute cold shower", summary: "End your shower with cold water.", tags: ["energy", "morning routine"] };
const sprints = { title: "REHIT sprints", summary: "Two 20-second all-out sprints on a bike.", tags: ["exercise"] };
const walk = { title: "Walk after meals", summary: "Ten minutes after eating flattens the blood sugar rise.", tags: ["blood sugar"] };
const fast = { title: "16:8 eating window", summary: "Fast for 16 hours.", tags: ["fasting"] };

describe("health conditions", () => {
  it("reads only known conditions from the profile", () => {
    expect(conditionsOf({ bioProfile: { conditions: ["joint_pain", "made_up"] } })).toEqual(["joint_pain"]);
    expect(conditionsOf({ bioProfile: { goal: "focus" } })).toEqual([]);
    expect(conditionsOf({})).toEqual([]);
  });

  it("caps fasting and weight loss where they aren't safe", () => {
    expect(fastingLimit(["pregnant"])).toBe("none");
    expect(fastingLimit(["eating_disorder_history", "type1_diabetes"])).toBe("none");
    expect(fastingLimit(["glucose_lowering_meds"])).toBe("12_12");
    expect(fastingLimit(["type2_diabetes"])).toBeNull();
    expect(weightLossAllowed(["pregnant"])).toBe(false);
    expect(weightLossAllowed(["joint_pain"])).toBe(true);
  });

  it("leaves out routines that don't suit a condition, and puts the ones that do first", () => {
    expect(unsuitable(cold, ["heart_condition"])).toBe(true);
    expect(unsuitable(cold, ["joint_pain"])).toBe(false);
    expect(unsuitable(sprints, ["joint_pain"])).toBe(true);
    expect(unsuitable(fast, ["pregnant"])).toBe(true);
    expect(unsuitable(walk, ["heart_condition", "pregnant", "joint_pain"])).toBe(false);
    expect(suits(walk, ["type2_diabetes"])).toBe(true);
    expect(suits(sprints, ["type2_diabetes"])).toBe(false);
  });

  it("flags supplements that interact with the medicines behind a condition", () => {
    expect(interactionOf("Fish oil", ["blood_thinners"])).toMatch(/blood thinners/);
    expect(interactionOf("Berberine", ["glucose_lowering_meds"])).toMatch(/lower blood sugar/);
    expect(interactionOf("Ashwagandha", ["pregnant"])).toMatch(/pregnancy/);
    expect(interactionOf("Magnesium", ["blood_thinners", "pregnant"])).toBeNull();
  });

  it("gives the meal AI food rules, never medicine", () => {
    const notes = mealNotes(["type2_diabetes", "pregnant"]).join(" ");
    expect(notes).toMatch(/glycemic load low/);
    expect(notes).toMatch(/high-mercury fish/);
    expect(notes).not.toMatch(/insulin|dose/i);
    expect(mealNotes([])).toEqual([]);
    expect(glycemicWeightFor(["type1_diabetes"])).toBe(0.25);
    expect(glycemicWeightFor(["joint_pain"])).toBeNull();
  });
});
