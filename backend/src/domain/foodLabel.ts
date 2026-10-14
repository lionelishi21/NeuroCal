/**
 * Packaged food: what the label (or a barcode lookup) says, how processed it is, and what's worth
 * knowing. The processing level follows the NOVA classification, read from the ingredient list:
 * any industrial ingredient (one you wouldn't find in a kitchen) makes it ultra-processed. Plain
 * rules, not the model's opinion, so they can be tested and explained.
 */
import type { FoodItem, FoodProcessing, GlycemicLoad } from "./types";

export type FoodLabelProblem = "not_a_label" | "blurry" | "too_dark" | "cut_off";

export interface FoodNutrition {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarsG?: number;
  addedSugarsG?: number;
  sodiumMg?: number;
}

/** What a label photo or a barcode lookup gave us. */
export interface FoodLabelReading {
  problem?: FoodLabelProblem;
  brand?: string;
  productName?: string;
  barcode?: string;
  /** As printed, e.g. "1 bar (40 g)". */
  servingSize?: string;
  servingsPerContainer?: number;
  /** Per serving. Missing when the nutrition panel couldn't be read. */
  nutrition?: FoodNutrition;
  /** In label order, as printed. */
  ingredients: string[];
  /** "YYYY-MM" or "YYYY-MM-DD". */
  bestBefore?: string;
  lotNumber?: string;
  /** Where the data came from. Open Food Facts data must be credited (ODbL). */
  source: "label" | "open_food_facts";
  /** NOVA group from the source, when it has one (Open Food Facts). */
  sourceNovaGroup?: 1 | 2 | 3 | 4;
}

export type FoodFlagKind = "ultra_processed" | "high_added_sugar" | "high_sodium" | "expired" | "expires_soon";

export interface FoodFlag {
  kind: FoodFlagKind;
  message: string;
}

/**
 * Ingredients that mark a food as ultra-processed (NOVA 4): substances extracted or made
 * industrially, and additives that make food look, taste or feel like something it isn't.
 */
const MARKERS: { name: string; match: RegExp }[] = [
  { name: "maltodextrin", match: /maltodextrin/ },
  { name: "dextrose", match: /\bdextrose\b/ },
  { name: "glucose syrup", match: /glucose(-fructose)? syrup|glucose solids/ },
  { name: "corn syrup", match: /corn syrup/ },
  { name: "invert sugar", match: /invert(ed)? sugar|invert syrup/ },
  { name: "fructose", match: /\bfructose\b(?! corn)|crystalline fructose/ },
  { name: "hydrogenated oil", match: /hydrogenated|interesterified/ },
  { name: "modified starch", match: /modified (corn |tapioca |potato |food )?starch/ },
  { name: "protein isolate", match: /protein isolate|hydroly[sz]ed (vegetable |soy |wheat )?protein|textured (vegetable|soy) protein/ },
  { name: "emulsifier", match: /lecithin|mono- ?and diglycerides|polysorbate|emulsif|sodium stearoyl lactylate|\be4[0-9]{2}\b/ },
  { name: "thickener or gum", match: /carrageenan|xanthan|guar gum|cellulose gum|carboxymethylcellulose|gellan/ },
  { name: "flavouring", match: /\bflavou?r(ing|s)?\b|natural flavou?r|artificial flavou?r/ },
  { name: "flavour enhancer", match: /monosodium glutamate|\bmsg\b|disodium (inosinate|guanylate)|yeast extract/ },
  { name: "sweetener", match: /sucralose|aspartame|acesulfame|saccharin|steviol|stevia|erythritol|sorbitol|maltitol|xylitol/ },
  { name: "colouring", match: /colou?r(ing|s)?\b|caramel colou?r|red 40|yellow [56]|titanium dioxide|annatto/ },
];

/** Ingredients that make a simple food "processed" (NOVA 3) when added to whole foods. */
const CULINARY = /\b(salt|sugar|cane sugar|honey|maple syrup|syrup|oil|butter|vinegar|molasses)\b/;

export interface ProcessingVerdict {
  level: FoodProcessing;
  /** The industrial ingredients found (ultra-processed only). */
  markers: string[];
}

const RANK: Record<FoodProcessing, number> = { whole: 0, processed: 1, ultra_processed: 2 };
const fromNova = (group: 1 | 2 | 3 | 4): FoodProcessing => (group === 4 ? "ultra_processed" : group === 3 ? "processed" : "whole");
/** Lower case without accents, so "émulsifiants: lécithines" reads like "emulsifiants: lecithines". */
const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * The level from the ingredient list. With a database's NOVA group as well, the more processed of
 * the two wins: the database also checks additive codes our list rules can miss.
 */
export function processingOf(ingredients: string[], sourceNovaGroup?: 1 | 2 | 3 | 4): ProcessingVerdict {
  const text = ingredients.map(plain);
  const markers = MARKERS.filter((m) => text.some((i) => m.match.test(i))).map((m) => m.name);
  const fromList: FoodProcessing =
    markers.length > 0 ? "ultra_processed" : ingredients.length > 1 && text.some((i) => CULINARY.test(i)) ? "processed" : "whole";
  const level = sourceNovaGroup && RANK[fromNova(sourceNovaGroup)] > RANK[fromList] ? fromNova(sourceNovaGroup) : fromList;
  return { level, markers };
}

/** Glycemic load from carbs less fibre, per serving: an estimate, since labels don't print it. */
export function estimatedGlycemicLoad(n: FoodNutrition): GlycemicLoad {
  const net = Math.max(0, n.carbsG - (n.fiberG ?? 0));
  return net < 10 ? "low" : net < 25 ? "medium" : "high";
}

/** Daily limits used on US labels (added sugar 50 g, sodium 2,300 mg); flagged from a fifth and a quarter of them. */
const ADDED_SUGAR_LIMIT_G = 50;
const SODIUM_LIMIT_MG = 2300;
const HIGH_ADDED_SUGAR_G = 10;
const HIGH_SODIUM_MG = 600;

/** "a fifth of", "over half of", "more than"… a day's limit, in words. */
function shareOfLimit(amount: number, limit: number): string {
  const pct = Math.round((amount / limit) * 100);
  return pct >= 100 ? `more than a whole day's limit (${limit.toLocaleString("en-US")})` : `${pct}% of a day's limit`;
}
const EXPIRES_SOON_DAYS = 3;

function lastGoodDay(date: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number | undefined];
  return d ? new Date(Date.UTC(y, m - 1, d)) : new Date(Date.UTC(y, m, 0));
}

export function foodFlags(reading: FoodLabelReading, verdict: ProcessingVerdict, today: Date): FoodFlag[] {
  if (reading.problem) return [];
  const flags: FoodFlag[] = [];
  if (verdict.level === "ultra_processed") {
    flags.push({
      kind: "ultra_processed",
      message: verdict.markers.length
        ? `Ultra-processed: it contains ${verdict.markers.join(", ")}. Foods like this are easy to overeat.`
        : "Ultra-processed, according to Open Food Facts. Foods like this are easy to overeat.",
    });
  }
  const n = reading.nutrition;
  const per = reading.servingSize === "100 g" ? "per 100 g" : "per serving";
  if (n?.addedSugarsG !== undefined && n.addedSugarsG >= HIGH_ADDED_SUGAR_G) {
    flags.push({
      kind: "high_added_sugar",
      message: `${Math.round(n.addedSugarsG)} g of added sugar ${per}: ${shareOfLimit(n.addedSugarsG, ADDED_SUGAR_LIMIT_G).replace(")", " g)")}.`,
    });
  }
  if (n?.sodiumMg !== undefined && n.sodiumMg >= HIGH_SODIUM_MG) {
    flags.push({
      kind: "high_sodium",
      message: `${Math.round(n.sodiumMg).toLocaleString("en-US")} mg of sodium ${per}: ${shareOfLimit(n.sodiumMg, SODIUM_LIMIT_MG).replace(")", " mg)")}.`,
    });
  }
  if (reading.bestBefore) {
    const days = (lastGoodDay(reading.bestBefore).getTime() - today.getTime()) / 86_400_000;
    if (days < 0) flags.push({ kind: "expired", message: `Its best-before date was ${reading.bestBefore}.` });
    else if (days <= EXPIRES_SOON_DAYS) flags.push({ kind: "expires_soon", message: `Best before ${reading.bestBefore}: eat it soon.` });
  }
  return flags;
}

/** The food as one serving to log, or null when there's no nutrition to log. */
export function foodItemOf(reading: FoodLabelReading, verdict: ProcessingVerdict): FoodItem | null {
  const n = reading.nutrition;
  if (!n) return null;
  const name = displayName(reading);
  return {
    name,
    portion: reading.servingSize ?? "1 serving",
    calories: Math.round(n.calories),
    macros: { proteinG: round1(n.proteinG), carbsG: round1(n.carbsG), fatG: round1(n.fatG) },
    glycemicLoad: estimatedGlycemicLoad(n),
    processing: verdict.level,
  };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Brand and product, without saying the brand twice ("Nutella", not "Nutella Nutella"). */
export function displayName(reading: Pick<FoodLabelReading, "brand" | "productName">): string {
  const { brand, productName } = reading;
  if (brand && productName && plain(productName).includes(plain(brand))) return productName;
  return [brand, productName].filter(Boolean).join(" ") || "Packaged food";
}
