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
  /** Who makes or distributes it, as printed (or Open Food Facts' brand owner). */
  manufacturer?: string;
  /** Production or packed-on date, "YYYY-MM" or "YYYY-MM-DD". */
  producedOn?: string;
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
 * industrially, and additives that make food look, taste or feel like something it isn't. Each
 * says, in a sentence, what it is and why it's there.
 */
const MARKERS: { name: string; match: RegExp; why: string }[] = [
  { name: "maltodextrin", match: /maltodextrin/, why: "Starch broken down in a factory into a fast sugar. It raises blood sugar even faster than table sugar." },
  { name: "dextrose", match: /\bdextrose\b/, why: "Pure glucose refined from corn starch: sugar under another name." },
  { name: "glucose syrup", match: /glucose(-fructose)? syrup|glucose solids/, why: "A sugar syrup made from starch in a factory: cheap sweetness and bulk." },
  { name: "corn syrup", match: /corn syrup/, why: "A sugar syrup made from corn starch in a factory." },
  { name: "invert sugar", match: /invert(ed)? sugar|invert syrup/, why: "Sugar split in a factory so it stays soft and sweet: sugar under another name." },
  { name: "fructose", match: /\bfructose\b(?! corn)|crystalline fructose/, why: "Fruit sugar refined on its own, without the fruit's fibre." },
  { name: "hydrogenated oil", match: /hydrogenated|interesterified/, why: "Oil hardened in a factory so it keeps longer. Partly hydrogenated oil carries trans fat, the worst kind for your heart." },
  { name: "modified starch", match: /modified (corn |tapioca |potato |food )?starch/, why: "Starch changed in a factory to thicken and hold texture through processing." },
  {
    name: "protein isolate",
    match: /protein isolate|hydroly[sz]ed (vegetable |soy |wheat )?protein|textured (vegetable|soy) protein/,
    why: "Protein pulled out of soy, milk or wheat in a factory, not a food you could cook with.",
  },
  {
    name: "emulsifier",
    match: /lecithin|mono- ?and diglycerides|polysorbate|emulsif|sodium stearoyl lactylate|\be4[0-9]{2}\b/,
    why: "Keeps fat and water from separating, for a smooth texture that whole ingredients wouldn't hold.",
  },
  {
    name: "thickener or gum",
    match: /carrageenan|xanthan|guar gum|cellulose gum|carboxymethylcellulose|gellan/,
    why: "Thickens and stabilises, so it feels richer than what's in it.",
  },
  { name: "flavouring", match: /\bflavou?r(ing|s)?\b|natural flavou?r|artificial flavou?r/, why: "Flavour made or extracted in a lab, added so it tastes of more than its ingredients." },
  {
    name: "flavour enhancer",
    match: /monosodium glutamate|\bmsg\b|disodium (inosinate|guanylate)|yeast extract/,
    why: "Makes savoury food taste stronger, which makes it easy to keep eating.",
  },
  {
    name: "sweetener",
    match: /sucralose|aspartame|acesulfame|saccharin|steviol|stevia|erythritol|sorbitol|maltitol|xylitol/,
    why: "Sweet without sugar. It keeps your taste for sweetness up.",
  },
  { name: "colouring", match: /colou?r(ing|s)?\b|caramel colou?r|red 40|yellow [56]|titanium dioxide|annatto/, why: "Added only to change how it looks." },
];

/** Ingredients that make a simple food "processed" (NOVA 3) when added to whole foods. */
const CULINARY = /\b(salt|sugar|cane sugar|honey|maple syrup|syrup|oil|butter|vinegar|molasses)\b/;

/** One ingredient behind the verdict: as printed, the kind of additive it is, and why it counts. */
export interface ProcessingReason {
  ingredient: string;
  marker: string;
  why: string;
}

export interface ProcessingVerdict {
  level: FoodProcessing;
  /** The industrial ingredients found (ultra-processed only). */
  markers: string[];
  /** Each industrial ingredient, as printed, with why it makes the food ultra-processed. */
  reasons: ProcessingReason[];
  /** Why it's this level, in a sentence or two. */
  summary: string;
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
  const reasons = MARKERS.flatMap((m) => {
    const i = text.findIndex((t) => m.match.test(t));
    return i < 0 ? [] : [{ ingredient: ingredients[i]!.trim(), marker: m.name, why: m.why }];
  });
  const markers = reasons.map((r) => r.marker);
  const added = [...new Set(text.flatMap((t) => t.match(CULINARY)?.[1] ?? []))];
  const fromList: FoodProcessing = markers.length > 0 ? "ultra_processed" : ingredients.length > 1 && added.length > 0 ? "processed" : "whole";
  const fromDatabase = sourceNovaGroup && RANK[fromNova(sourceNovaGroup)] > RANK[fromList];
  const level = fromDatabase ? fromNova(sourceNovaGroup) : fromList;
  return { level, markers, reasons, summary: summaryOf(level, { reasons, added, fromDatabase: Boolean(fromDatabase), listed: ingredients.length > 0 }) };
}

function summaryOf(level: FoodProcessing, o: { reasons: ProcessingReason[]; added: string[]; fromDatabase: boolean; listed: boolean }): string {
  if (level === "ultra_processed") {
    const lead = o.reasons.length
      ? `Ultra-processed: it's made with ${o.reasons.length === 1 ? "an ingredient" : `${o.reasons.length} ingredients`} you wouldn't find in a kitchen.`
      : "Ultra-processed, according to Open Food Facts, from additives on the full label.";
    return `${lead} Foods like this are built to be easy to overeat: in a controlled study, people ate about 500 kcal a day more on them.`;
  }
  if (level === "processed") {
    return o.fromDatabase && !o.added.length
      ? "Processed, according to Open Food Facts: whole foods preserved or prepared, with nothing industrial in the ingredients."
      : `Processed: whole foods with ${listOf(o.added)} added, the way you might at home. Nothing industrial in it; fine in sensible amounts.`;
  }
  return o.listed ? "A whole food: nothing added that you wouldn't use in your own kitchen." : "No ingredient list to check, so it's graded as a whole food.";
}

const listOf = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

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
