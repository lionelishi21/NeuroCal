import { type CoffeeCheck, type CoffeeFatCheck, coffeeCheck, coffeeFatCheck } from "../../domain/coffee";
import { DomainError, InvalidError, NotFoundError, UpstreamError } from "../../domain/errors";
import { type FoodFlag, type FoodLabelReading, type ProcessingVerdict, foodFlags, foodItemOf, processingOf } from "../../domain/foodLabel";
import { MAX_PHOTO_BYTES, ownsPhotoKey } from "../../domain/photo";
import type { FoodItem } from "../../domain/types";
import type { MealPhoto } from "../interfaces/IAiVisionProvider";
import type { IClock } from "../interfaces/IClock";
import type { IFoodLabelReader, IProductDatabase } from "../interfaces/IFoodLabels";
import type { IObjectStorage } from "../interfaces/IObjectStorage";
import { MAX_LABEL_PHOTOS } from "./AnalyzeSupplementLabelUseCase";

export interface FoodScan {
  reading: FoodLabelReading;
  processing: ProcessingVerdict;
  flags: FoodFlag[];
  /** One serving, ready to log; missing when there was no nutrition to read. */
  item?: FoodItem;
  /** For coffee: whether it's stated to be tested for mould toxins. */
  coffee?: CoffeeCheck;
  /** For MCT oil, butter or ghee: which coffee add-in it is, and whether it's the better kind. */
  coffeeFat?: CoffeeFatCheck;
}

/**
 * A packaged food, by barcode (Open Food Facts) or from label photos (the AI reads them). Either
 * way NeuroCal grades the ingredient list itself and adds its flags. Nothing is saved.
 */
export class ScanFoodUseCase {
  constructor(
    private readonly reader: IFoodLabelReader,
    private readonly products: IProductDatabase,
    private readonly storage: IObjectStorage,
    private readonly clock: IClock,
  ) {}

  async byBarcode(barcode: string): Promise<FoodScan> {
    if (!/^\d{8,14}$/.test(barcode)) throw new InvalidError("A barcode is 8 to 14 digits.");
    let reading: FoodLabelReading | null;
    try {
      reading = await this.products.lookup(barcode);
    } catch {
      throw new UpstreamError("The product database didn't answer. Try again, or photograph the label.");
    }
    if (!reading) throw new NotFoundError("We don't know that barcode yet. Photograph the label instead.");
    return this.grade(reading);
  }

  /** For photos the client uploaded first. Someone else's key reads as missing (ARCHITECTURE §10). */
  async byPhotoKeys(input: { userId: string; photoKeys: string[] }): Promise<FoodScan> {
    const photos: MealPhoto[] = [];
    for (const key of input.photoKeys) {
      const missing = new NotFoundError("A photo isn't there. Scan the label again.");
      if (!ownsPhotoKey(input.userId, key)) throw missing;
      const photo = await this.storage.read(key, MAX_PHOTO_BYTES);
      if (!photo) throw missing;
      photos.push(photo);
    }
    return this.byPhotos(photos);
  }

  async byPhotos(photos: MealPhoto[]): Promise<FoodScan> {
    if (photos.length === 0) throw new InvalidError("Attach a photo of the label.");
    if (photos.length > MAX_LABEL_PHOTOS) throw new InvalidError(`Send at most ${MAX_LABEL_PHOTOS} photos of the label.`);
    for (const p of photos) {
      if (!p.mediaType.startsWith("image/")) throw new InvalidError("Attach a photo of the label.");
      if (p.bytes.byteLength === 0 || p.bytes.byteLength > MAX_PHOTO_BYTES) throw new InvalidError("Each photo must be under 8 MB.");
    }
    let reading: FoodLabelReading;
    try {
      reading = await this.reader.readLabel(photos);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new UpstreamError("The label couldn't be read right now. Try again in a moment.");
    }
    return this.grade(reading);
  }

  private grade(reading: FoodLabelReading): FoodScan {
    const processing = processingOf(reading.ingredients, reading.sourceNovaGroup);
    const item = reading.problem ? null : foodItemOf(reading, processing);
    const coffee = reading.problem ? null : coffeeCheck(reading);
    const coffeeFat = reading.problem ? null : coffeeFatCheck(reading);
    return {
      reading,
      processing,
      flags: foodFlags(reading, processing, this.clock.now()),
      ...(item ? { item } : {}),
      ...(coffee ? { coffee } : {}),
      ...(coffeeFat ? { coffeeFat } : {}),
    };
  }
}
