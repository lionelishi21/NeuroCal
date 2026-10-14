import type { FoodLabelReading } from "../../domain/foodLabel";
import type { MealPhoto } from "./IAiVisionProvider";

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
