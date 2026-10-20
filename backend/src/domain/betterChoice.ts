/**
 * A better choice for a processed food someone scanned: what a cleaner shop-bought version lists, and
 * the same food made at home, mostly from their pantry. The model writes both; these rules pick the
 * kitchen device to show, only one the recipe's steps actually use (as in the shopping review).
 */
import type { DeviceTag } from "./devices";
import type { PantryRecipe } from "./pantry";

export interface BetterChoice {
  /** What a cleaner shop-bought version lists on its label, in a sentence or two. */
  lookFor: string;
  /** The same food made at home; missing when it isn't something you'd make. */
  homemade?: PantryRecipe;
}

/** Device tag → how a recipe step names it. The water filter isn't cooked with, so it's not here. */
const DEVICE_IN_STEPS: { tag: DeviceTag; matches: RegExp }[] = [
  { tag: "kitchen:air-fryer", matches: /\bair[- ]?fr(y|yer|ied|ying)\b/i },
  { tag: "kitchen:blender", matches: /\bblender\b/i },
  { tag: "kitchen:ice-cream-maker", matches: /\bice[- ]cream maker\b|\bcreami\b/i },
];

/** The first device a recipe's steps use, or null. */
export function deviceUsedIn(steps: string[]): DeviceTag | null {
  return DEVICE_IN_STEPS.find(({ matches }) => steps.some((s) => matches.test(s)))?.tag ?? null;
}
