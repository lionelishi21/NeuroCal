import { DomainError, InvalidError, UpstreamError } from "../../domain/errors";
import type { Food } from "../../domain/foods";
import { MAX_RECIPE_CHARS, MAX_SERVINGS, type RecipeNutrition, recipeNutrition } from "../../domain/recipe";
import type { IRecipeParser } from "../interfaces/IRecipeParser";

/** A typed or pasted recipe → nutrition per serving, from catalog values where possible. Nothing is saved. */
export class AnalyzeRecipeUseCase {
  constructor(
    private readonly parser: IRecipeParser,
    private readonly foods: readonly Food[],
  ) {}

  async execute(input: { text: string; servings?: number }): Promise<{ problem: "not_a_recipe" } | RecipeNutrition> {
    const text = input.text.trim();
    if (text.length < 10) throw new InvalidError("Add the ingredients with their amounts.");
    if (text.length > MAX_RECIPE_CHARS) throw new InvalidError("That recipe is too long. Keep to the ingredients.");
    if (input.servings !== undefined && (!Number.isInteger(input.servings) || input.servings < 1 || input.servings > MAX_SERVINGS)) {
      throw new InvalidError(`Servings must be a whole number from 1 to ${MAX_SERVINGS}.`);
    }
    let parsed;
    try {
      parsed = await this.parser.parse({ text, catalog: this.foods.map((f) => ({ id: f.id, name: f.name, serving: f.serving })) });
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error(JSON.stringify({ event: "recipe_parse_failed", error: String(error).slice(0, 300) }));
      throw new UpstreamError("The recipe couldn't be read right now. Try again in a moment.");
    }
    if (parsed.problem || parsed.ingredients.length === 0) return { problem: "not_a_recipe" };
    return recipeNutrition({ title: parsed.title, servings: input.servings ?? parsed.servings ?? 1, ingredients: parsed.ingredients }, this.foods);
  }
}
