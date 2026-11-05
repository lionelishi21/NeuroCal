import type { ParsedIngredient } from "../../domain/recipe";
import type { DietaryPreference } from "../../domain/types";
import type { MealPhoto, PhotoProblem } from "./IAiVisionProvider";

/** Who the recipe is for: it's written to suit them, not the plate as it was. */
export interface DishContext {
  dietaryPreference: DietaryPreference;
  cognitiveGoals: string[];
  /** Protein to aim for in one serving. */
  proteinPerServingG: number;
  /** Food rules from health conditions (domain/conditions.ts); left out when there are none. */
  healthNotes?: string[];
}

/** A dish recognised from a photo, written as a recipe that suits the person. */
export interface DishRecipe {
  /** What the photo shows: "Chicken pad thai". */
  dish: string;
  /** The recipe's own name, after any swaps: "Chicken pad thai with courgette noodles". */
  title: string;
  minutes: number;
  servings: number;
  /** Matched to the food catalog where it can be, as for a typed recipe. */
  ingredients: ParsedIngredient[];
  steps: string[];
  /** What was changed from the usual dish and why, one plain sentence each. */
  swaps: string[];
  glycemicLoad: "low" | "medium" | "high";
}

/** Photo → recipe (an LLM with vision; its output is schema-checked). */
export interface IDishRecipeWriter {
  write(input: {
    photo: MealPhoto;
    context: DishContext;
    /** The food catalog's ids and names, so ingredients can be matched to it. */
    catalog: { id: string; name: string; serving: string }[];
  }): Promise<{ problem: PhotoProblem } | DishRecipe>;
}
