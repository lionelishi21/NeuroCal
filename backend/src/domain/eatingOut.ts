import { InvalidError } from "./errors";
import type { Food, FoodKind, FoodRegion } from "./foods";

/** A chain's published figures for one menu item, typed in by an admin from the chain's own page. */
export interface EatingOutEntry {
  chainName: string;
  region: FoodRegion;
  name: string;
  /** How a portion reads, e.g. "1 burger". The weight is added. */
  serving: string;
  grams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Many chains don't publish fibre. */
  fiberG?: number;
  kind: FoodKind;
  /** One plain sentence on what it brings; a neutral one is used when empty. */
  why?: string;
  /** The chain's page the figures come from. */
  sourceUrl: string;
}

export const FOOD_REGIONS: readonly FoodRegion[] = ["US", "GB", "JM"];

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The same chain, item and country always get the same id, so adding it again updates it. */
export const eatingOutId = (e: Pick<EatingOutEntry, "chainName" | "name" | "region">) => `admin-${slug(e.chainName)}-${slug(e.name)}-${e.region.toLowerCase()}`;

/**
 * Checks an entry and turns it into a catalog food. The calories must roughly add up from the
 * protein, carbs and fat (4, 4 and 9 kcal a gram), which catches most typing slips; glycemic load is
 * estimated from net carbs, as most fast-food carbs are refined (GI about 65).
 */
export function eatingOutFood(e: EatingOutEntry): Food {
  const chainName = e.chainName.trim();
  const name = e.name.trim();
  const serving = e.serving.trim();
  if (!chainName) throw new InvalidError("Add the chain's name.");
  if (!name) throw new InvalidError("Add the item's name.");
  if (!serving) throw new InvalidError("Say what a portion is, like 1 burger.");
  if (!FOOD_REGIONS.includes(e.region)) throw new InvalidError("Choose a country.");
  const numbers = [e.grams, e.calories, e.proteinG, e.carbsG, e.fatG, e.fiberG ?? 0];
  if (numbers.some((n) => !Number.isFinite(n) || n < 0) || e.grams <= 0 || e.calories <= 0) {
    throw new InvalidError("Weight and calories must be above zero, and no number can be negative.");
  }
  if ((e.fiberG ?? 0) > e.carbsG) throw new InvalidError("Fibre can't be more than the carbs.");
  const fromMacros = 4 * e.proteinG + 4 * e.carbsG + 9 * e.fatG;
  if (Math.abs(fromMacros - e.calories) > Math.max(15, 0.2 * e.calories)) {
    throw new InvalidError(`The calories don't add up: protein, carbs and fat make about ${Math.round(fromMacros)} kcal, not ${Math.round(e.calories)}. Check the numbers.`);
  }
  if (!/^https:\/\/\S+\.\S+/.test(e.sourceUrl.trim())) throw new InvalidError("Add the link to the chain's page, starting with https://");

  const r1 = (n: number) => Math.round(n * 10) / 10;
  const fiberG = r1(e.fiberG ?? 0);
  const gl = (0.65 * Math.max(0, e.carbsG - fiberG));
  return {
    id: eatingOutId({ chainName, name, region: e.region }),
    name,
    category: "eating_out",
    kind: e.kind,
    serving: serving.includes(`${Math.round(e.grams)} g`) ? serving : `${serving} (${Math.round(e.grams)} g)`,
    grams: Math.round(e.grams),
    calories: Math.round(e.calories),
    macros: { proteinG: r1(e.proteinG), carbsG: r1(e.carbsG), fatG: r1(e.fatG) },
    fiberG,
    glycemicLoad: gl <= 10 ? "low" : gl < 20 ? "medium" : "high",
    processing: "ultra_processed",
    goals: [],
    why: e.why?.trim() || `As ${chainName} publishes it.`,
    chain: { id: slug(chainName), name: chainName },
    regions: [e.region],
    source: "chain",
    sourceUrl: e.sourceUrl.trim(),
  };
}
