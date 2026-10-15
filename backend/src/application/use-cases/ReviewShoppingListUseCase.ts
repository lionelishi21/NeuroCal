import { DomainError, InvalidError, NotFoundError, UpstreamError } from "../../domain/errors";
import { MAX_SHOPPING_ITEMS, type ReviewedItem, devicesFor, itemsFromText } from "../../domain/shopping";
import type { AdminProduct } from "../../domain/types";
import type { MealPhoto } from "../interfaces/IAiVisionProvider";
import type { ICatalogRepository } from "../interfaces/ICatalogRepository";
import type { IProfileRepository } from "../interfaces/IRepositories";
import type { IShoppingListReviewer } from "../interfaces/IShoppingListReviewer";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export interface ShoppingReview {
  problem?: "not_a_list" | "unreadable";
  items: ReviewedItem[];
  /** Kitchen devices the list calls for (domain/shopping.ts rules), with the items that called for them. */
  devices: { product: AdminProduct; because: string[] }[];
}

/** A shopping list, typed or photographed, graded item by item, with kitchen devices that would help. Nothing is saved. */
export class ReviewShoppingListUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly reviewer: IShoppingListReviewer,
    private readonly catalog: ICatalogRepository,
  ) {}

  async execute(input: { userId: string; text?: string; photo?: MealPhoto }): Promise<ShoppingReview> {
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const items = input.text ? itemsFromText(input.text) : [];
    if (!input.photo && items.length === 0) throw new InvalidError("Add your list, or a photo of it.");
    if (items.length > MAX_SHOPPING_ITEMS) throw new InvalidError(`A list can have up to ${MAX_SHOPPING_ITEMS} items.`);
    if (input.photo) {
      if (!input.photo.mediaType.startsWith("image/")) throw new InvalidError("Attach a photo of the list.");
      if (input.photo.bytes.byteLength === 0 || input.photo.bytes.byteLength > MAX_PHOTO_BYTES) throw new InvalidError("Attach a photo under 8 MB.");
    }

    let reviewed: Awaited<ReturnType<IShoppingListReviewer["review"]>>;
    try {
      reviewed = await this.reviewer.review({
        items,
        ...(input.photo ? { photo: input.photo } : {}),
        dietaryPreference: profile.dietaryPreference,
        cognitiveGoals: profile.cognitiveGoals,
        losingWeight: profile.weightGoal !== undefined,
      });
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error(JSON.stringify({ event: "shopping_review_failed", error: String(error).slice(0, 300) }));
      throw new UpstreamError("The list couldn't be reviewed right now. Try again in a moment.");
    }
    if (reviewed.problem) return { problem: reviewed.problem, items: [], devices: [] };

    const wanted = devicesFor(reviewed.items.map((i) => i.name));
    const products = wanted.length ? (await this.catalog.listProducts()).filter((p) => p.enabled) : [];
    const devices = wanted.flatMap(({ tag, because }) => {
      const product = products.find((p) => p.tags.includes(tag));
      return product ? [{ product, because }] : [];
    });
    return { items: reviewed.items, devices };
  }
}
