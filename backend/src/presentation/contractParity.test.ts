import { describe, expect, it } from "@jest/globals";
import { CognitiveFlag, CognitiveGoal, DietaryPreference, MacroFocus, MealKind } from "@neurocal/contracts";
import { COGNITIVE_FLAGS, COGNITIVE_GOALS, DIETARY_PREFERENCES, MACRO_FOCUSES, MEAL_KINDS } from "../domain/types";

/** The domain keeps its own enums (no contracts import); this keeps them in step with the wire format. */
describe("domain enums match packages/contracts", () => {
  it.each([
    ["DietaryPreference", DIETARY_PREFERENCES, DietaryPreference.options],
    ["CognitiveFlag", COGNITIVE_FLAGS, CognitiveFlag.options],
    ["CognitiveGoal", COGNITIVE_GOALS, CognitiveGoal.options],
    ["MacroFocus", MACRO_FOCUSES, MacroFocus.options],
    ["MealKind", MEAL_KINDS, MealKind.options],
  ])("%s", (_, domain, contract) => {
    expect([...domain].sort()).toEqual([...contract].sort());
  });
});
