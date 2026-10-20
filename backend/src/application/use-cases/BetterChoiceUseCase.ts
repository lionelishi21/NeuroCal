import { type BetterChoice, deviceUsedIn } from "../../domain/betterChoice";
import { withHealthNotes } from "../../domain/conditions";
import { DomainError, NotFoundError, UpstreamError } from "../../domain/errors";
import { displayName, processingOf } from "../../domain/foodLabel";
import { markPantryIngredients } from "../../domain/pantry";
import type { AdminProduct } from "../../domain/types";
import type { ICatalogRepository } from "../interfaces/ICatalogRepository";
import type { IBetterChoiceAdvisor } from "../interfaces/IFoodLabels";
import type { IPantryRepository } from "../interfaces/IPantry";
import type { IProfileRepository } from "../interfaces/IRepositories";

export interface BetterChoiceResult extends BetterChoice {
  /** A kitchen device the homemade recipe uses (domain/betterChoice.ts rules), from enabled catalog products. */
  device?: AdminProduct;
}

/** Control characters out: ingredient text goes into a prompt and back onto the screen. */
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").trim();

/**
 * A processed food from a scan → what a cleaner shop-bought version lists, and the same food made at
 * home, mostly from the pantry. The industrial ingredients are found here, not taken from the client.
 * Nothing is saved.
 */
export class BetterChoiceUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly pantry: IPantryRepository,
    private readonly advisor: IBetterChoiceAdvisor,
    private readonly catalog: ICatalogRepository,
  ) {}

  async execute(input: {
    userId: string;
    brand?: string;
    productName?: string;
    ingredients: string[];
    processing: "processed" | "ultra_processed";
  }): Promise<BetterChoiceResult> {
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const ingredients = input.ingredients.map(clean).filter((i) => i.length > 0);
    const pantry = (await this.pantry.list(input.userId)).map((i) => i.name);

    let advice: Awaited<ReturnType<IBetterChoiceAdvisor["suggest"]>>;
    try {
      advice = await this.advisor.suggest({
        food: clean(displayName({ brand: input.brand, productName: input.productName })),
        ingredients,
        level: input.processing,
        markers: processingOf(ingredients).markers,
        pantry,
        dietaryPreference: profile.dietaryPreference,
        cognitiveGoals: profile.cognitiveGoals,
        ...withHealthNotes(profile),
      });
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error(JSON.stringify({ event: "better_choice_failed", error: String(error).slice(0, 300) }));
      throw new UpstreamError("A better choice couldn't be worked out right now. Try again in a moment.");
    }
    if (!advice.homemade) return { lookFor: advice.lookFor };

    const homemade = { ...advice.homemade, ingredients: markPantryIngredients(advice.homemade.ingredients, pantry) };
    const tag = deviceUsedIn(homemade.steps);
    const device = tag ? (await this.catalog.listProducts()).find((p) => p.enabled && p.tags.includes(tag)) : undefined;
    return { lookFor: advice.lookFor, homemade, ...(device ? { device } : {}) };
  }
}
