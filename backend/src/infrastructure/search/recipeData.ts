import type { Macros } from "../../domain/types";

/** What a recipe page says about itself in schema.org Recipe data. */
export interface RecipeData {
  title?: string;
  imageUrl?: string;
  minutes?: number;
  calories?: number;
  macros?: Macros;
}

export const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

/** "450 calories", "30 g" → 450, 30. */
export function firstNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : undefined;
  const match = str(value)?.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

/** ISO 8601 duration ("PT1H30M") → 90. */
export function isoMinutes(value: unknown): number | undefined {
  const match = str(value)?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match || !(match[1] || match[2] || match[3])) return undefined;
  const [, d = "0", h = "0", m = "0"] = match;
  const total = Number(d) * 1440 + Number(h) * 60 + Number(m);
  return total > 0 ? total : undefined;
}

export function sum(a: number | undefined, b: number | undefined): number | undefined {
  return a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0);
}

const JSON_LD = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;

/**
 * Reads the schema.org Recipe from a page's JSON-LD blocks: the same data
 * recipe sites publish for search engines. Returns {} when the page has none.
 * The page is untrusted text: it is only ever parsed as JSON and read field by field.
 */
export function readRecipeData(html: string): RecipeData {
  for (const [, block] of html.matchAll(JSON_LD)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block ?? "");
    } catch {
      continue;
    }
    const recipe = findRecipe(parsed);
    if (recipe) return toRecipeData(recipe);
  }
  return {};
}

type Node = Record<string, unknown>;
const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null && !Array.isArray(value);

/** The first node typed Recipe, looking through arrays and @graph. */
function findRecipe(value: unknown, depth = 0): Node | undefined {
  if (depth > 4) return undefined;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findRecipe(entry, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (!isNode(value)) return undefined;
  const type = value["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) return value;
  return findRecipe(value["@graph"], depth + 1);
}

function toRecipeData(recipe: Node): RecipeData {
  const nutrition = isNode(recipe.nutrition) ? recipe.nutrition : {};
  const title = str(recipe.name);
  const imageUrl = imageOf(recipe.image);
  const minutes = isoMinutes(recipe.totalTime) ?? sum(isoMinutes(recipe.prepTime), isoMinutes(recipe.cookTime));
  // Sites compute per-serving values and publish them unrounded ("404.8333333333333").
  const tenth = (n: number | undefined) => (n === undefined ? undefined : Math.round(n * 10) / 10);
  const calories = firstNumber(nutrition.calories) === undefined ? undefined : Math.round(firstNumber(nutrition.calories)!);
  const proteinG = tenth(firstNumber(nutrition.proteinContent));
  const carbsG = tenth(firstNumber(nutrition.carbohydrateContent));
  const fatG = tenth(firstNumber(nutrition.fatContent));
  return {
    ...(title ? { title } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(minutes !== undefined ? { minutes } : {}),
    ...(calories !== undefined ? { calories } : {}),
    ...(proteinG !== undefined && carbsG !== undefined && fatG !== undefined ? { macros: { proteinG, carbsG, fatG } } : {}),
  };
}

/** `image` may be a URL, an ImageObject, or a list of either. Only https URLs are kept. */
function imageOf(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const url = str(isNode(first) ? first.url : first);
  return url?.startsWith("https://") ? url : undefined;
}
