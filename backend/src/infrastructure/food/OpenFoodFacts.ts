import type { IProductDatabase } from "../../application/interfaces/IFoodLabels";
import type { FoodLabelReading, FoodNutrition } from "../../domain/foodLabel";

const FIELDS = ["code", "product_name", "brands", "serving_size", "nutriments", "ingredients_text_en", "ingredients_text", "nova_group"].join(",");

/** Splits an ingredient list on commas that aren't inside brackets: "oats, chocolate (sugar, cocoa)". */
export function splitIngredients(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";") && depth === 0) {
      out.push(current);
      current = "";
    } else current += ch;
  }
  out.push(current);
  return out.map((s) => s.replace(/[_*]/g, "").replace(/\.$/, "").trim()).filter(Boolean);
}

/**
 * Open Food Facts (https://world.openfoodfacts.org): a free, open database of packaged foods.
 * Its data is under the Open Database License, so the apps credit it wherever it shows.
 */
export class OpenFoodFactsDatabase implements IProductDatabase {
  constructor(private readonly options: { fetch?: typeof fetch; contact?: string } = {}) {}

  async lookup(barcode: string): Promise<FoodLabelReading | null> {
    const res = await (this.options.fetch ?? fetch)(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${FIELDS}`, {
      // Open Food Facts asks every app to identify itself.
      headers: { "user-agent": `NeuroCal/1.0 (${this.options.contact ?? "hello@neurocal.ai"})` },
      signal: AbortSignal.timeout(6_000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Open Food Facts lookup failed: ${res.status}`);
    const body = (await res.json()) as {
      status?: number;
      product?: {
        code?: string;
        product_name?: string;
        brands?: string;
        serving_size?: string;
        nutriments?: Record<string, number | string | undefined>;
        ingredients_text_en?: string;
        ingredients_text?: string;
        nova_group?: number;
      };
    };
    const p = body.product;
    if (body.status !== 1 || !p) return null;

    const n = p.nutriments ?? {};
    const num = (key: string) => (typeof n[key] === "number" ? (n[key] as number) : undefined);
    // Per serving when the database has it, else per 100 g.
    const perServing = num("energy-kcal_serving") !== undefined;
    const suffix = perServing ? "_serving" : "_100g";
    const kcal = num(`energy-kcal${suffix}`);
    const optional = (key: string, name: keyof FoodNutrition, scale = 1) => {
      const v = num(`${key}${suffix}`);
      return v === undefined ? {} : { [name]: scale === 1 ? v : Math.round(v * scale) };
    };
    const nutrition: FoodNutrition | undefined =
      kcal === undefined
        ? undefined
        : {
            calories: kcal,
            proteinG: num(`proteins${suffix}`) ?? 0,
            carbsG: num(`carbohydrates${suffix}`) ?? 0,
            fatG: num(`fat${suffix}`) ?? 0,
            ...optional("fiber", "fiberG"),
            ...optional("sugars", "sugarsG"),
            ...optional("added-sugars", "addedSugarsG"),
            // Stored in grams.
            ...optional("sodium", "sodiumMg", 1000),
          };
    const servingSize = perServing ? p.serving_size?.trim() || undefined : "100 g";
    const nova = p.nova_group;
    return {
      ...(p.brands ? { brand: p.brands.split(",")[0]!.trim() } : {}),
      ...(p.product_name?.trim() ? { productName: p.product_name.trim() } : {}),
      barcode: p.code ?? barcode,
      ...(servingSize ? { servingSize } : {}),
      ...(nutrition ? { nutrition } : {}),
      // English when the database has it; the grading rules also cope with other languages.
      ingredients: splitIngredients(p.ingredients_text_en || p.ingredients_text || ""),
      source: "open_food_facts",
      ...(nova === 1 || nova === 2 || nova === 3 || nova === 4 ? { sourceNovaGroup: nova } : {}),
    };
  }
}
