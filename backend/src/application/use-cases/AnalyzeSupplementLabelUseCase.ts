import { DomainError, InvalidError, NotFoundError, UpstreamError } from "../../domain/errors";
import { MAX_PHOTO_BYTES, ownsPhotoKey } from "../../domain/photo";
import { type SupplementFlag, type SupplementLabelReading, flagsFor, searchTextFor, summaryFor } from "../../domain/supplement";
import type { Product } from "../../domain/types";
import type { ICatalogRepository } from "../interfaces/ICatalogRepository";
import type { IClock } from "../interfaces/IClock";
import type { IEmbeddingProvider } from "../interfaces/IEmbeddingProvider";
import type { MealPhoto } from "../interfaces/IAiVisionProvider";
import type { IObjectStorage } from "../interfaces/IObjectStorage";
import type { ISupplementLabelReader } from "../interfaces/ISupplementLabelReader";

/** Sides of one bottle a scan may send (`MAX_LABEL_PHOTOS` in the contracts). */
export const MAX_LABEL_PHOTOS = 4;

export interface SupplementLabelAnalysis {
  reading: SupplementLabelReading;
  summary: string;
  flags: SupplementFlag[];
  alternative?: { item: Product; similarity: number };
}

/**
 * Supplement label photos (sides of one bottle) → what the label says, NeuroCal's flags, and a close own-brand alternative.
 * Nothing is saved. The flags come from rules in the domain, not from the model.
 */
export class AnalyzeSupplementLabelUseCase {
  constructor(
    private readonly reader: ISupplementLabelReader,
    private readonly storage: IObjectStorage,
    private readonly catalog: ICatalogRepository,
    private readonly embedder: IEmbeddingProvider,
    private readonly clock: IClock,
    /** How close an own-brand supplement must be to be offered; below this it isn't really an alternative. */
    private readonly options: { minAlternativeMatch: number } = { minAlternativeMatch: 0.45 },
  ) {}

  /** For photos the client uploaded first. Someone else's key reads as missing (ARCHITECTURE §10). */
  async executeForKeys(input: { userId: string; photoKeys: string[] }): Promise<SupplementLabelAnalysis> {
    const photos: MealPhoto[] = [];
    for (const key of input.photoKeys) {
      const missing = new NotFoundError("A photo isn't there. Scan the label again.");
      if (!ownsPhotoKey(input.userId, key)) throw missing;
      const photo = await this.storage.read(key, MAX_PHOTO_BYTES);
      if (!photo) throw missing;
      photos.push(photo);
    }
    return this.execute(photos);
  }

  async execute(photos: MealPhoto[]): Promise<SupplementLabelAnalysis> {
    if (photos.length === 0) throw new InvalidError("Attach a photo of the label.");
    if (photos.length > MAX_LABEL_PHOTOS) throw new InvalidError(`Send at most ${MAX_LABEL_PHOTOS} photos of the label.`);
    for (const photo of photos) {
      if (!photo.mediaType.startsWith("image/")) throw new InvalidError("Attach a photo of the label.");
      if (photo.bytes.byteLength === 0) throw new InvalidError("A photo is empty. Scan the label again.");
      if (photo.bytes.byteLength > MAX_PHOTO_BYTES) throw new InvalidError("A photo is larger than 8 MB.");
    }

    let reading: SupplementLabelReading;
    try {
      reading = await this.reader.readLabel(photos);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new UpstreamError("The label couldn't be read right now. Try again in a moment.");
    }

    const analysis: SupplementLabelAnalysis = { reading, summary: summaryFor(reading), flags: flagsFor(reading, this.clock.now()) };
    const alternative = await this.alternativeFor(reading);
    return alternative ? { ...analysis, alternative } : analysis;
  }

  private async alternativeFor(reading: SupplementLabelReading) {
    // Nothing to compare, or it already is one of ours.
    if (reading.problem || reading.ingredients.length === 0 || /mitoproof/i.test(reading.brand ?? "")) return undefined;
    try {
      const [vector] = await this.embedder.embed([searchTextFor(reading)]);
      const [best] = vector ? await this.catalog.nearestProducts(vector, 1, "ownSupplements") : [];
      return best && best.similarity >= this.options.minAlternativeMatch ? best : undefined;
    } catch {
      // The label is the point; an alternative is a nice-to-have.
      return undefined;
    }
  }
}
