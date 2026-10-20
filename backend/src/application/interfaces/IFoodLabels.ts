import type { FoodLabelReading } from "../../domain/foodLabel";
import type { DietaryPreference } from "../../domain/types";
import type { MealPhoto } from "./IAiVisionProvider";
import type { SuggestedRecipe } from "./IPantry";

/** Reads a packaged food's label from 1–4 photos (nutrition panel, ingredients, dates). */
export interface IFoodLabelReader {
  /** Implementations validate the model output against a schema and throw on anything unusable. */
  readLabel(photos: MealPhoto[]): Promise<FoodLabelReading>;
}

/** A product database looked up by barcode (Open Food Facts). */
export interface IProductDatabase {
  /** Null when the barcode isn't in the database. */
  lookup(barcode: string): Promise<FoodLabelReading | null>;
}

export interface BetterChoiceContext {
  /** Brand and product, as the scan showed it. */
  food: string;
  ingredients: string[];
  level: "processed" | "ultra_processed";
  /** The industrial ingredients NeuroCal found (domain/foodLabel.ts). */
  markers: string[];
  pantry: string[];
  dietaryPreference: DietaryPreference;
  cognitiveGoals: string[];
  /** Food rules from health conditions (domain/conditions.ts mealNotes); left out when there are none. */
  healthNotes?: string[];
}

/** A cleaner version and a homemade one for a processed food (an LLM; its output is schema-checked). */
export interface IBetterChoiceAdvisor {
  suggest(context: BetterChoiceContext): Promise<{ lookFor: string; homemade: SuggestedRecipe | null }>;
}
