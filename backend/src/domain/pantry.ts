import type { Macros } from "./types";

export const MAX_PANTRY_ITEMS = 150;
export const MAX_PANTRY_NAME = 60;

/** Enough to cook something real from. */
export const MIN_PANTRY_FOR_RECIPES = 3;

/** "  greek   yogurt " → "greek yogurt"; null when empty or too long. */
export function cleanPantryName(raw: string): string | null {
  // Control characters out: names go into a prompt and back onto the screen.
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return name.length === 0 || name.length > MAX_PANTRY_NAME ? null : name;
}

/** Two names are the same item when they match ignoring case and a plural "s". */
export function pantryKey(name: string): string {
  return name.toLowerCase().replace(/(?<=[a-z]{3})(es|s)$/, "");
}

export interface PantryIngredient {
  name: string;
  /** "2 eggs", "1 tbsp". */
  quantity: string;
  /** Already in the pantry; worked out here, not taken from the model. */
  inPantry: boolean;
}

export interface PantryRecipe {
  title: string;
  minutes: number;
  servings: number;
  /** Per serving. */
  calories: number;
  macros: Macros;
  ingredients: PantryIngredient[];
  steps: string[];
  whyItFits: string;
}

/**
 * Marks which ingredients are already in the pantry: an ingredient matches an item when either name
 * contains the other ("cherry tomatoes" and "tomatoes"), ignoring case and plurals.
 */
export function markPantryIngredients<T extends { name: string }>(ingredients: T[], pantry: string[]): (T & { inPantry: boolean })[] {
  const keys = pantry.map(pantryKey);
  return ingredients.map((i) => {
    const k = pantryKey(i.name);
    return { ...i, inPantry: keys.some((p) => k.includes(p) || p.includes(k)) };
  });
}
