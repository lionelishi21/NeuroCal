import { DomainError, InvalidError, NotFoundError, UpstreamError } from "../../domain/errors";
import { MAX_PHOTO_BYTES, ownsPhotoKey } from "../../domain/photo";
import type { IAiVisionProvider, MealPhoto, MealPhotoAnalysis } from "../interfaces/IAiVisionProvider";
import type { IObjectStorage } from "../interfaces/IObjectStorage";

export { MAX_PHOTO_BYTES };

/** A photo the client uploaded first. Someone else's key reads as missing (ARCHITECTURE §10). */
export async function readOwnedPhoto(storage: IObjectStorage, userId: string, photoKey: string): Promise<MealPhoto> {
  const missing = new NotFoundError("That photo isn't there. Choose it again.");
  if (!ownsPhotoKey(userId, photoKey)) throw missing;
  const photo = await storage.read(photoKey, MAX_PHOTO_BYTES);
  if (!photo) throw missing;
  return photo;
}

/** Throws unless it's an image of a size the readers take. */
export function checkMealPhoto(photo: MealPhoto): void {
  if (!photo.mediaType.startsWith("image/")) throw new InvalidError("Attach a photo of the meal.");
  if (photo.bytes.byteLength === 0) throw new InvalidError("The photo is empty. Choose it again.");
  if (photo.bytes.byteLength > MAX_PHOTO_BYTES) throw new InvalidError("The photo is larger than 8 MB.");
}

/** Photo → proposed items. Nothing is saved; the user confirms first (ARCHITECTURE §6.1). */
export class AnalyzeMealPhotoUseCase {
  constructor(
    private readonly vision: IAiVisionProvider,
    private readonly storage: IObjectStorage,
  ) {}

  /** For a photo the client uploaded first. Someone else's key reads as missing (ARCHITECTURE §10). */
  async executeForKey(input: { userId: string; photoKey: string }): Promise<MealPhotoAnalysis> {
    return this.execute(await readOwnedPhoto(this.storage, input.userId, input.photoKey));
  }

  async execute(photo: MealPhoto): Promise<MealPhotoAnalysis> {
    checkMealPhoto(photo);

    try {
      return await this.vision.analyzeMealPhoto(photo);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new UpstreamError("The photo couldn't be analyzed right now. Try again in a moment.", { cause: error });
    }
  }
}
