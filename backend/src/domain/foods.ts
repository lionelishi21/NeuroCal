import type { CognitiveGoal, DietaryPreference, FoodProcessing, GlycemicLoad, Macros } from "./types";

export type FoodCategory = "fish" | "meat" | "eggs_dairy" | "plant_protein" | "grains" | "vegetables" | "fruit" | "nuts_seeds" | "fats" | "drinks" | "extras";

/** What a food comes from, which decides most diets it fits. */
export type FoodKind = "fish" | "meat" | "eggs_dairy" | "plant";

/** A food in the catalog, per serving. */
export interface Food {
  id: string;
  name: string;
  category: FoodCategory;
  kind: FoodKind;
  /** How the serving reads, e.g. "1 fillet (120 g)". */
  serving: string;
  grams: number;
  calories: number;
  macros: Macros;
  fiberG: number;
  glycemicLoad: GlycemicLoad;
  processing: FoodProcessing;
  /** The goals it suits; empty for everyday foods. */
  goals: CognitiveGoal[];
  /** One plain sentence on what it brings. No medical claims. */
  why: string;
  /** Source entry in USDA FoodData Central. */
  fdcId: number;
}

/** Net carbs per serving at or under this fit keto. */
const KETO_NET_CARBS = 6;
const NOT_PALEO = new Set(["peanut-butter", "peas", "sweetcorn", "white-rice", "pasta", "whole-wheat-bread", "sourdough", "oats", "brown-rice", "quinoa", "buckwheat", "corn-tortilla"]);
/** Bulletproof's low-toxin list steers away from legumes, most grains, mould-prone nuts and most dairy. */
const NOT_LOW_TOXIN = new Set([...NOT_PALEO, "cashews", "pistachios", "tuna", "orange-juice", "honey"].filter((id) => id !== "white-rice"));
const RED_MEAT = new Set(["ground-beef", "sirloin-steak", "beef-liver", "pork-tenderloin", "lamb"]);

/** The diets a food fits, by plain rules (so they stay consistent as the catalog grows). */
export function dietsFor(food: Food): DietaryPreference[] {
  const netCarbs = food.macros.carbsG - food.fiberG;
  const dairyOnlyButter = food.kind !== "eggs_dairy" || food.id === "eggs" || food.id === "butter";
  const fits: Record<DietaryPreference, boolean> = {
    omnivore: true,
    standard: true,
    pescatarian: food.kind !== "meat",
    vegetarian: food.kind === "plant" || food.kind === "eggs_dairy",
    vegan: food.kind === "plant",
    keto: netCarbs <= KETO_NET_CARBS,
    cyclical_keto: netCarbs <= KETO_NET_CARBS,
    mediterranean: !RED_MEAT.has(food.id) && food.id !== "coconut-oil" && food.id !== "butter",
    paleo: food.category !== "plant_protein" && !NOT_PALEO.has(food.id) && dairyOnlyButter,
    low_toxin: food.category !== "plant_protein" && !NOT_LOW_TOXIN.has(food.id) && dairyOnlyButter,
    carnivore: food.kind !== "plant" && food.macros.carbsG <= 2,
  };
  return (Object.keys(fits) as DietaryPreference[]).filter((diet) => fits[diet]);
}
