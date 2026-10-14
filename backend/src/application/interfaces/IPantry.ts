import type { DietaryPreference, Macros } from "../../domain/types";
import type { PantryIngredient, PantryRecipe } from "../../domain/pantry";

export interface PantryItem {
  id: string;
  name: string;
}

/** Scoped to one user (ARCHITECTURE §10). */
export interface IPantryRepository {
  /** Alphabetical. */
  list(userId: string): Promise<PantryItem[]>;
  /** Adds names not already there (by pantryKey); returns the whole pantry. */
  add(userId: string, names: string[]): Promise<PantryItem[]>;
  /** False when there was no such item for this user. */
  delete(userId: string, id: string): Promise<boolean>;
}

export interface PantryRecipeContext {
  pantry: string[];
  caloriesLeft: number;
  macrosLeft: Macros;
  dietaryPreference: DietaryPreference;
  cognitiveGoals: string[];
}

export type SuggestedRecipe = Omit<PantryRecipe, "ingredients"> & { ingredients: Omit<PantryIngredient, "inPantry">[] };

/** Recipes from what's in the kitchen (an LLM; its output is schema-checked). */
export interface IPantryRecipeAssistant {
  suggest(context: PantryRecipeContext): Promise<SuggestedRecipe[]>;
}
