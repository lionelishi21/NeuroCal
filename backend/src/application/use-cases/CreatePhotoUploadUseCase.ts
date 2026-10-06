import { randomUUID } from "node:crypto";
import { InvalidError } from "../../domain/errors";
import type { IObjectStorage } from "../interfaces/IObjectStorage";
import { MAX_PHOTO_BYTES, photoKeyFor } from "../../domain/photo";

export interface PhotoUpload {
  photoKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

/** Step 1 of logging a photo: where to upload it (ARCHITECTURE §9). Nothing is stored until the client PUTs. */
export class CreatePhotoUploadUseCase {
  constructor(private readonly storage: IObjectStorage) {}

  async execute(input: { userId: string; mediaType: string; sizeBytes: number }): Promise<PhotoUpload> {
    if (!input.mediaType.startsWith("image/")) throw new InvalidError("Attach a photo of the meal.");
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) throw new InvalidError("The photo is empty. Choose it again.");
    if (input.sizeBytes > MAX_PHOTO_BYTES) throw new InvalidError("The photo is larger than 8 MB.");

    const photoKey = photoKeyFor(input.userId, randomUUID());
    const { url, headers, expiresAt } = await this.storage.createUploadUrl(photoKey, input.mediaType, input.sizeBytes);
    return { photoKey, uploadUrl: url, headers, expiresAt };
  }
}
