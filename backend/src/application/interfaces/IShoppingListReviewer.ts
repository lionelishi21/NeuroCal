import type { ReviewedItem } from "../../domain/shopping";
import type { DietaryPreference } from "../../domain/types";
import type { MealPhoto } from "./IAiVisionProvider";

export interface ShoppingReviewContext {
  /** Typed or pasted items; empty when a photo is sent instead. */
  items: string[];
  /** A photo of a written list, a receipt or a shopping app's screen. */
  photo?: MealPhoto;
  dietaryPreference: DietaryPreference;
  cognitiveGoals: string[];
  /** The person is losing weight. */
  losingWeight: boolean;
}

/** Grades a shopping list item by item (an LLM; its output is schema-checked). */
export interface IShoppingListReviewer {
  review(context: ShoppingReviewContext): Promise<{ problem?: "not_a_list" | "unreadable"; items: ReviewedItem[] }>;
}
