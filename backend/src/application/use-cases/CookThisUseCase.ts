import { withHealthNotes } from "../../domain/conditions";
import { DomainError, NotFoundError, UpstreamError } from "../../domain/errors";
import type { Food } from "../../domain/foods";
import { markPantryIngredients } from "../../domain/pantry";
import { recipeNutrition } from "../../domain/recipe";
import type { FoodProcessing, Macros } from "../../domain/types";
import type { MealPhoto, PhotoProblem } from "../interfaces/IAiVisionProvider";
import type { IDishRecipeWriter } from "../interfaces/IDishRecipeWriter";
import type { IObjectStorage } from "../interfaces/IObjectStorage";
import type { IPantryRepository } from "../interfaces/IPantry";
import type { IProfileRepository } from "../interfaces/IRepositories";
import { checkMealPhoto, readOwnedPhoto } from "./AnalyzeMealPhotoUseCase";
import type { GetBioStateUseCase } from "./GetBioStateUseCase";

export interface CookThisRecipe {
  dish: string;
  title: string;
  minutes: number;
  servings: number;
  /** inPantry is worked out here from the pantry, not by the model. */
  ingredients: { name: string; quantity: string; inPantry: boolean }[];
  steps: string[];
  swaps: string[];
  /** Per serving, from catalog values where the ingredients match them. */
  calories: number;
  macros: Macros;
  processing: FoodProcessing;
  glycemicLoad: "low" | "medium" | "high";
  /** Share of the calories that came from catalog values, 0–1. */
  catalogShare: number;
}

/** The fewest grams of protein a serving aims for, whatever the day's target. */
const MIN_PROTEIN_PER_SERVING = 20;

/**
 * "Cook this": a photo of a dish (a restaurant plate, a friend's dinner, a screenshot) → a recipe for it
 * that suits the person, its nutrition per serving and which ingredients are already in the pantry.
 * Nothing is saved: the app adds the missing ones to the shopping list, or logs the dish, when asked.
 */
export class CookThisUseCase {
  constructor(
    private readonly writer: IDishRecipeWriter,
    private readonly storage: IObjectStorage,
    private readonly profiles: IProfileRepository,
    private readonly pantry: IPantryRepository,
    private readonly bioState: GetBioStateUseCase,
    private readonly foods: readonly Food[],
  ) {}

  /** For a photo the client uploaded first. */
  async executeForKey(input: { userId: string; photoKey: string }): Promise<{ problem: PhotoProblem } | CookThisRecipe> {
    return this.execute({ userId: input.userId, photo: await readOwnedPhoto(this.storage, input.userId, input.photoKey) });
  }

  async execute(input: { userId: string; photo: MealPhoto }): Promise<{ problem: PhotoProblem } | CookThisRecipe> {
    checkMealPhoto(input.photo);
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const [bio, pantry] = await Promise.all([this.bioState.execute({ userId: input.userId }), this.pantry.list(input.userId)]);

    let written;
    try {
      written = await this.writer.write({
        photo: input.photo,
        context: {
          dietaryPreference: profile.dietaryPreference,
          cognitiveGoals: profile.cognitiveGoals,
          // About a third of the day's protein, as one of three meals.
          proteinPerServingG: Math.max(MIN_PROTEIN_PER_SERVING, Math.round(bio.macroTargets.proteinG / 3)),
          ...withHealthNotes(profile),
        },
        catalog: this.foods.map((f) => ({ id: f.id, name: f.name, serving: f.serving })),
      });
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new UpstreamError("The photo couldn't be read right now. Try again in a moment.", { cause: error });
    }
    if ("problem" in written) return { problem: written.problem };
    if (written.ingredients.length === 0) return { problem: "no_food_found" };

    const nutrition = recipeNutrition({ title: written.title, servings: written.servings, ingredients: written.ingredients }, this.foods);
    return {
      dish: written.dish,
      title: written.title,
      minutes: written.minutes,
      servings: nutrition.servings,
      ingredients: markPantryIngredients(
        written.ingredients.map((i) => ({ name: i.name, quantity: i.quantity })),
        pantry.map((p) => p.name),
      ),
      steps: written.steps,
      swaps: written.swaps,
      calories: nutrition.calories,
      macros: nutrition.macros,
      processing: nutrition.processing,
      glycemicLoad: written.glycemicLoad,
      catalogShare: nutrition.catalogShare,
    };
  }
}
