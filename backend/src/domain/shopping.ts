/**
 * The shopping list review: each item graded and marked keep, swap or limit (by the reviewer, an LLM
 * with a checked schema), and kitchen devices suggested by these rules when the list shows a swap they
 * make easy. The rules, not the model, pick devices, so a product only appears for a stated reason.
 */
import type { FoodProcessing } from "./types";

export const MAX_SHOPPING_ITEMS = 80;
export const MAX_SHOPPING_ITEM_LENGTH = 80;

export type ShoppingVerdict = "keep" | "swap" | "limit";

export interface ReviewedItem {
  name: string;
  processing: FoodProcessing;
  verdict: ShoppingVerdict;
  /** One plain sentence. */
  reason: string;
  /** A cleaner choice, when the verdict is swap. */
  swapFor?: string;
}

/** Catalog tag → what on a list shows it would help. */
export const DEVICE_RULES: { tag: string; matches: RegExp }[] = [
  { tag: "kitchen:air-fryer", matches: /\b(fries|chips|nuggets|tenders|breaded|hash ?browns?|tater tots?|onion rings|frozen (pizza|wings|fish sticks))\b/i },
  { tag: "kitchen:water-filter", matches: /\b(bottled water|water bottles?|spring water|sparkling water|mineral water)\b/i },
  { tag: "kitchen:ice-cream-maker", matches: /\b(ice cream|gelato|frozen (yogurt|dessert)|popsicles?|ice lollies)\b/i },
  { tag: "kitchen:blender", matches: /\b(smoothies?|juices?|protein shakes?|meal replacement shakes?|frappes?)\b/i },
];

/** The device tags a list calls for, each with the items that called for it. */
export function devicesFor(itemNames: string[]): { tag: string; because: string[] }[] {
  return DEVICE_RULES.map(({ tag, matches }) => ({ tag, because: itemNames.filter((n) => matches.test(n)) })).filter((d) => d.because.length > 0);
}

/** Splits a pasted list into items: one per line or comma, without bullets, numbers or empty lines. */
export function itemsFromText(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/[\u0000-\u001f\u007f]/g, " ").trim())
    .filter((s) => s.length > 0)
    .map((s) => s.slice(0, MAX_SHOPPING_ITEM_LENGTH));
}
