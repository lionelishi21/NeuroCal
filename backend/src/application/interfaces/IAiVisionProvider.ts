import type { FoodItem } from "../../domain/types";

export type PhotoProblem = "too_dark" | "no_food_found" | "blurry";

export interface MealPhoto {
  bytes: Uint8Array;
  mediaType: string;
}

export interface MealPhotoAnalysis {
  /** AI-proposed items, each with `confidence` set. */
  items: FoodItem[];
  /** Set when the photo could not be read well enough to propose items. */
  problem?: PhotoProblem;
}

export interface IAiVisionProvider {
  /** Implementations validate the model output against a schema and throw on anything unusable. */
  analyzeMealPhoto(photo: MealPhoto): Promise<MealPhotoAnalysis>;
}
