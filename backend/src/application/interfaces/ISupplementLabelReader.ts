import type { SupplementLabelReading } from "../../domain/supplement";
import type { MealPhoto } from "./IAiVisionProvider";

export interface ISupplementLabelReader {
  /** Implementations validate the model output against a schema and throw on anything unusable. */
  readLabel(photo: MealPhoto): Promise<SupplementLabelReading>;
}
