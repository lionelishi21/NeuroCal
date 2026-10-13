import type { SupplementLabelReading } from "../../domain/supplement";
import type { MealPhoto } from "./IAiVisionProvider";

export interface ISupplementLabelReader {
  /**
   * Reads one label from 1–4 photos of the same bottle, merged into a single reading.
   * Implementations validate the model output against a schema and throw on anything unusable.
   */
  readLabel(photos: MealPhoto[]): Promise<SupplementLabelReading>;
}
