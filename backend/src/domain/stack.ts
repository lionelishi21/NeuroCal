/**
 * The supplements someone takes (their "stack"): what each contains, how much a day, and when.
 * The checks look across the whole stack, which a single label can't: daily totals against the
 * adult upper limits, the same nutrient in several products, caffeine late in the day, and
 * bottles running low.
 */
import { type HealthCondition, interactionOf } from "./conditions";
import { type SupplementIngredient, limitedNutrient, roundAmount } from "./supplement";

export type StackTiming = "morning" | "with_food" | "evening" | "any";

export interface StackItem {
  id: string;
  /** Brand and product, as scanned or typed. */
  name: string;
  servingSize?: string;
  ingredients: SupplementIngredient[];
  servingsPerDay: number;
  timing: StackTiming;
  /** From the label, for the running-low estimate. */
  servingsPerContainer?: number;
  /** YYYY-MM-DD: when this bottle was started. */
  startedOn: string;
}

export interface StackFlag {
  kind: "above_upper_limit" | "duplicate" | "late_caffeine" | "interaction";
  message: string;
  /** The stack items involved. */
  itemIds: string[];
}

const CAFFEINE = /caffeine|coffee|guarana|green tea extract|yerba mate|kola nut|matcha/;
const DAY_MS = 86_400_000;
/** "Running low" from this many days left. */
export const RUNNING_LOW_DAYS = 7;

/** [conditions]: the person's health conditions, for ingredients that interact with their medicines. */
export function stackFlags(items: StackItem[], conditions: readonly HealthCondition[] = []): StackFlag[] {
  const flags: StackFlag[] = [];
  const byNutrient = new Map<string, { unit: "mg" | "mcg"; limit: number; total: number; itemIds: Set<string>; names: Set<string> }>();
  for (const item of items) {
    for (const ingredient of item.ingredients) {
      const n = limitedNutrient(ingredient);
      if (!n) continue;
      const entry = byNutrient.get(n.label) ?? { unit: n.unit, limit: n.limit, total: 0, itemIds: new Set<string>(), names: new Set<string>() };
      entry.total += n.amount * item.servingsPerDay;
      entry.itemIds.add(item.id);
      entry.names.add(item.name);
      byNutrient.set(n.label, entry);
    }
  }
  for (const [label, n] of byNutrient) {
    const several = n.itemIds.size > 1;
    if (n.total > n.limit) {
      flags.push({
        kind: "above_upper_limit",
        message: `${several ? "Together your supplements give" : "You take"} ${roundAmount(n.total)} ${n.unit} of ${label} a day, above the ${n.limit} ${n.unit} upper limit for adults${several ? ` (from ${[...n.names].join(" and ")})` : ""}. Check with your doctor.`,
        itemIds: [...n.itemIds],
      });
    } else if (several) {
      flags.push({
        kind: "duplicate",
        message: `${[...n.names].join(" and ")} both contain ${label}: ${roundAmount(n.total)} ${n.unit} a day together, within the adult upper limit.`,
        itemIds: [...n.itemIds],
      });
    }
  }
  for (const item of items) {
    for (const ingredient of item.ingredients) {
      const why = interactionOf(ingredient.name, conditions);
      if (why) flags.push({ kind: "interaction", message: `${item.name}: ${why}`, itemIds: [item.id] });
    }
  }
  for (const item of items) {
    if (item.timing === "evening" && item.ingredients.some((i) => CAFFEINE.test(i.name.toLowerCase()))) {
      flags.push({
        kind: "late_caffeine",
        message: `${item.name} contains caffeine and you take it in the evening, which can cut into your sleep. Try it before noon.`,
        itemIds: [item.id],
      });
    }
  }
  return flags;
}

/** Days of this bottle left, from when it was started; null without a servings count. */
export function daysLeft(item: StackItem, today: string): number | null {
  if (!item.servingsPerContainer) return null;
  const used = Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${item.startedOn}T00:00:00Z`)) / DAY_MS));
  const servingsLeft = item.servingsPerContainer - used * item.servingsPerDay;
  return Math.max(0, Math.floor(servingsLeft / item.servingsPerDay));
}
