/**
 * A recipe's nutrition per serving. Ingredients that match the food catalog use its USDA FoodData
 * Central values scaled by weight; the rest use the reader's estimate, and say so.
 */
import type { Food } from "./foods";
import type { FoodProcessing, Macros } from "./types";

export const MAX_RECIPE_CHARS = 8000;
export const MAX_SERVINGS = 24;

/** One ingredient as read from the recipe. */
export interface ParsedIngredient {
  name: string;
  /** As written, e.g. "2 cups". */
  quantity: string;
  grams: number;
  /** A food catalog id when the ingredient is one of them. */
  catalogId: string | null;
  /** The reader's figures for this amount, used when there's no catalog match. */
  estimate: { calories: number } & Macros;
  processing: FoodProcessing;
}

export interface RecipeIngredient {
  name: string;
  quantity: string;
  grams: number;
  calories: number;
  macros: Macros;
  processing: FoodProcessing;
  source: "catalog" | "estimate";
}

export interface RecipeNutrition {
  title: string;
  servings: number;
  ingredients: RecipeIngredient[];
  /** Per serving. */
  calories: number;
  macros: Macros;
  /** The most processed ingredient sets the dish's grade, as with packaged food. */
  processing: FoodProcessing;
  /** Share of the calories that came from catalog values, 0–1. */
  catalogShare: number;
}

const RANK: Record<FoodProcessing, number> = { whole: 0, processed: 1, ultra_processed: 2 };
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Totals per serving from parsed ingredients, preferring catalog values over estimates. */
export function recipeNutrition(input: { title: string; servings: number; ingredients: ParsedIngredient[] }, catalog: readonly Food[]): RecipeNutrition {
  const byId = new Map(catalog.map((f) => [f.id, f]));
  const ingredients: RecipeIngredient[] = input.ingredients.map((i) => {
    const food = i.catalogId ? byId.get(i.catalogId) : undefined;
    if (food && food.grams > 0 && i.grams > 0) {
      const k = i.grams / food.grams;
      return {
        name: i.name,
        quantity: i.quantity,
        grams: i.grams,
        calories: Math.round(food.calories * k),
        macros: { proteinG: round1(food.macros.proteinG * k), carbsG: round1(food.macros.carbsG * k), fatG: round1(food.macros.fatG * k) },
        processing: food.processing,
        source: "catalog",
      };
    }
    const { calories, ...macros } = i.estimate;
    return { name: i.name, quantity: i.quantity, grams: i.grams, calories: Math.round(calories), macros, processing: i.processing, source: "estimate" };
  });
  const servings = Math.min(MAX_SERVINGS, Math.max(1, Math.round(input.servings)));
  const sum = (f: (i: RecipeIngredient) => number) => ingredients.reduce((s, i) => s + f(i), 0);
  const total = sum((i) => i.calories);
  return {
    title: input.title,
    servings,
    ingredients,
    calories: Math.round(total / servings),
    macros: {
      proteinG: round1(sum((i) => i.macros.proteinG) / servings),
      carbsG: round1(sum((i) => i.macros.carbsG) / servings),
      fatG: round1(sum((i) => i.macros.fatG) / servings),
    },
    processing: ingredients.reduce<FoodProcessing>((worst, i) => (RANK[i.processing] > RANK[worst] ? i.processing : worst), "whole"),
    catalogShare: total > 0 ? Math.round((sum((i) => (i.source === "catalog" ? i.calories : 0)) / total) * 100) / 100 : 0,
  };
}
