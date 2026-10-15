import type { ParsedIngredient } from "../../domain/recipe";

/** Recipe text → title, servings and ingredients in grams (an LLM; its output is schema-checked). */
export interface IRecipeParser {
  parse(input: {
    text: string;
    /** The food catalog's ids and names, so ingredients can be matched to it. */
    catalog: { id: string; name: string; serving: string }[];
  }): Promise<{ problem?: "not_a_recipe"; title: string; servings: number | null; ingredients: ParsedIngredient[] }>;
}
