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

export interface SupplementLabelAnalysis {
  reading: SupplementLabelReading;
  summary: string;
  flags: SupplementFlag[];
  alternative?: { item: Product; similarity: number };
}

/**
 * Supplement label photo → what the label says, NeuroCal's flags, and a close own-brand alternative.
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

  /** For a photo the client uploaded first. Someone else's key reads as missing (ARCHITECTURE §10). */
  async executeForKey(input: { userId: string; photoKey: string }): Promise<SupplementLabelAnalysis> {
    const missing = new NotFoundError("That photo isn't there. Choose it again.");
    if (!ownsPhotoKey(input.userId, input.photoKey)) throw missing;
    const photo = await this.storage.read(input.photoKey, MAX_PHOTO_BYTES);
    if (!photo) throw missing;
    return this.execute(photo);
  }

  async execute(photo: MealPhoto): Promise<SupplementLabelAnalysis> {
    if (!photo.mediaType.startsWith("image/")) throw new InvalidError("Attach a photo of the label.");
    if (photo.bytes.byteLength === 0) throw new InvalidError("The photo is empty. Choose it again.");
    if (photo.bytes.byteLength > MAX_PHOTO_BYTES) throw new InvalidError("The photo is larger than 8 MB.");

    let reading: SupplementLabelReading;
    try {
      reading = await this.reader.readLabel(photo);
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
