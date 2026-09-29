import { DomainError, InvalidError, UpstreamError } from "../../domain/errors";
import type { IAiVisionProvider, MealPhoto, MealPhotoAnalysis } from "../interfaces/IAiVisionProvider";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Photo → proposed items. Nothing is saved; the user confirms first (ARCHITECTURE §6.1). */
export class AnalyzeMealPhotoUseCase {
  constructor(private readonly vision: IAiVisionProvider) {}

  async execute(photo: MealPhoto): Promise<MealPhotoAnalysis> {
    if (!photo.mediaType.startsWith("image/")) throw new InvalidError("Attach a photo of the meal.");
    if (photo.bytes.byteLength === 0) throw new InvalidError("The photo is empty. Choose it again.");
    if (photo.bytes.byteLength > MAX_PHOTO_BYTES) throw new InvalidError("The photo is larger than 8 MB.");

    try {
      return await this.vision.analyzeMealPhoto(photo);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new UpstreamError("The photo couldn't be analyzed right now. Try again in a moment.");
    }
  }
}
