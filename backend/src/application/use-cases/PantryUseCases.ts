import { withHealthNotes } from "../../domain/conditions";
import { InvalidError, NotFoundError } from "../../domain/errors";
import {
  MAX_PANTRY_ITEMS,
  MIN_PANTRY_FOR_RECIPES,
  cleanPantryName,
  markPantryIngredients,
  pantryKey,
  type PantryRecipe,
} from "../../domain/pantry";
import type { IPantryRecipeAssistant, IPantryRepository, PantryItem } from "../interfaces/IPantry";
import type { IProfileRepository } from "../interfaces/IRepositories";
import type { GetBioStateUseCase } from "./GetBioStateUseCase";

/** The pantry, and recipes cooked from it that fit what's left of the day. */
export class PantryUseCases {
  constructor(
    private readonly pantry: IPantryRepository,
    private readonly profiles: IProfileRepository,
    private readonly bioState: GetBioStateUseCase,
    private readonly assistant: IPantryRecipeAssistant,
  ) {}

  list(userId: string): Promise<PantryItem[]> {
    return this.pantry.list(userId);
  }

  async add(userId: string, raw: string[]): Promise<PantryItem[]> {
    const names = raw.map(cleanPantryName);
    if (names.length === 0 || names.some((n) => n === null)) throw new InvalidError("Each item needs a name of 1 to 60 characters.");
    const current = await this.pantry.list(userId);
    const known = new Set(current.map((i) => pantryKey(i.name)));
    // New names only, each once, keeping the first spelling given.
    const fresh: string[] = [];
    for (const name of names as string[]) {
      if (known.has(pantryKey(name))) continue;
      known.add(pantryKey(name));
      fresh.push(name);
    }
    if (current.length + fresh.length > MAX_PANTRY_ITEMS) throw new InvalidError(`A pantry holds up to ${MAX_PANTRY_ITEMS} items.`);
    return fresh.length === 0 ? current : this.pantry.add(userId, fresh);
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.pantry.delete(userId, id))) throw new NotFoundError("No such item in your pantry.");
  }

  /** Up to three recipes, mostly from the pantry, sized to the calories and macros left today. */
  async recipes(userId: string): Promise<PantryRecipe[]> {
    const profile = await this.profiles.get(userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const items = (await this.pantry.list(userId)).map((i) => i.name);
    if (items.length < MIN_PANTRY_FOR_RECIPES) throw new InvalidError(`Add at least ${MIN_PANTRY_FOR_RECIPES} items to your pantry first.`);
    const bio = await this.bioState.execute({ userId });
    const left = (target: number, eaten: number) => Math.max(0, Math.round(target - eaten));
    const suggested = await this.assistant.suggest({
      pantry: items,
      // A meal's worth even late in the day, so there's always something to suggest.
      caloriesLeft: Math.max(300, left(bio.calorieTarget, bio.caloriesEaten)),
      macrosLeft: {
        proteinG: left(bio.macroTargets.proteinG, bio.macrosEaten.proteinG),
        carbsG: left(bio.macroTargets.carbsG, bio.macrosEaten.carbsG),
        fatG: left(bio.macroTargets.fatG, bio.macrosEaten.fatG),
      },
      dietaryPreference: profile.dietaryPreference,
      cognitiveGoals: profile.cognitiveGoals,
      ...withHealthNotes(profile),
    });
    return suggested.map((r) => ({ ...r, ingredients: markPantryIngredients(r.ingredients, items) }));
  }
}
