/**
 * The shopping list someone keeps: items added by hand or from a meal plan, grouped by aisle in the
 * order you'd walk a store, ticked off while shopping, and moved into the pantry once bought. The same
 * item added twice is one line (matched like the pantry, ignoring case and plurals).
 */
import { pantryKey } from "./pantry";

export const AISLES = ["produce", "meat_fish", "dairy_eggs", "bakery", "pantry", "frozen", "drinks", "other"] as const;
export type Aisle = (typeof AISLES)[number];

export const AISLE_LABEL: Record<Aisle, string> = {
  produce: "Fruit and veg",
  meat_fish: "Meat and fish",
  dairy_eggs: "Dairy and eggs",
  bakery: "Bakery",
  pantry: "Cupboard",
  frozen: "Frozen",
  drinks: "Drinks",
  other: "Other",
};

/** Words that place an item in an aisle, checked in this order (so "frozen peas" is frozen, "almond milk" dairy). */
const RULES: [Aisle, RegExp][] = [
  ["frozen", /\bfrozen\b|ice cream/],
  // Cupboard things named after something fresh: nut butters, ground pepper, stock, tins.
  [
    "pantry",
    /\b(peanut|almond|cashew|hazelnut|nut|seed) butter|black pepper|peppercorns?|\bstock\b|\bbroth\b|\btinned\b|\bcanned\b|\bdried\b|chopped tomatoes|passata|tomato (puree|paste)|coconut milk/,
  ],
  ["drinks", /\b(coffee|tea|juice|kombucha|sparkling|soda|water|wine|beer)\b/],
  ["dairy_eggs", /\b(milk|cheese|yog(h)?urt|butter|ghee|cream|kefir|eggs?|feta|mozzarella|parmesan|cottage|ricotta|skyr)\b/],
  [
    "meat_fish",
    /\b(chicken|beef|steak|mince|pork|lamb|turkey|bacon|ham|sausages?|salmon|tuna|cod|haddock|mackerel|sardines?|prawns?|shrimp|fish|anchov(y|ies)|duck|venison|liver)\b/,
  ],
  ["bakery", /\b(bread|sourdough|bagels?|wraps?|tortillas?|pitta|pita|rolls?|buns?|croissants?)\b/],
  [
    "produce",
    /\b(apples?|bananas?|berries|blueberries|strawberries|raspberries|lemons?|limes?|oranges?|avocados?|tomato(es)?|spinach|kale|lettuce|rocket|arugula|broccoli|cauliflower|carrots?|onions?|garlic|ginger|peppers?|courgettes?|zucchini|cucumbers?|mushrooms?|potato(es)?|sweet potato(es)?|squash|celery|asparagus|bean ?sprouts?|green beans|cabbage|leeks?|herbs?|parsley|coriander|cilantro|basil|mint|chilli|chili|fruit|veg(etables?)?|greens|salad|pears?|grapes?|kiwis?|mango(es)?|pineapple|beetroot|beets?)\b/,
  ],
  [
    "pantry",
    /\b(rice|oats?|pasta|quinoa|lentils?|chickpeas?|beans?|flour|sugar|honey|syrup|oil|vinegar|salt|pepper|spices?|cumin|paprika|turmeric|cinnamon|nuts?|almonds?|walnuts?|cashews?|seeds?|chia|flax|peanut butter|tahini|stock|broth|sauce|tins?|tinned|canned|cereal|granola|crackers?|chocolate|cocoa|coconut|protein powder|mct|collagen)\b/,
  ],
];

export function aisleOf(name: string): Aisle {
  const n = name.toLowerCase();
  return RULES.find(([, re]) => re.test(n))?.[0] ?? "other";
}

export interface ShoppingListItem {
  id: string;
  name: string;
  /** As the person wrote it, or from the plan ("about 340 g"); absent when not given. */
  quantity?: string;
  aisle: Aisle;
  checked: boolean;
  /** "plan" when it came from a meal plan. */
  source: "manual" | "plan";
  addedAt: Date;
}

export const MAX_LIST_ITEMS = 200;

/** Same item, by the pantry's matching (case and plurals ignored). */
export const sameItem = (a: string, b: string) => pantryKey(a) === pantryKey(b);

/** Aisle order, then the order they were added. */
export function sortList(items: ShoppingListItem[]): ShoppingListItem[] {
  return [...items].sort((a, b) => AISLES.indexOf(a.aisle) - AISLES.indexOf(b.aisle) || a.addedAt.getTime() - b.addedAt.getTime());
}

/** "340 g", "1.2 kg": how much of an ingredient a plan needs, rounded so it reads like a shopping list. */
export function planQuantity(grams: number): string {
  if (grams >= 1000) return `about ${Math.round(grams / 100) / 10} kg`;
  if (grams >= 100) return `about ${Math.round(grams / 10) * 10} g`;
  return `about ${Math.max(5, Math.round(grams / 5) * 5)} g`;
}

/** The list as plain text, to share: one line per item, grouped under aisle names, ticked ones left out. */
export function listText(items: ShoppingListItem[]): string {
  const open = sortList(items).filter((i) => !i.checked);
  const lines: string[] = [];
  let aisle: Aisle | null = null;
  for (const i of open) {
    if (i.aisle !== aisle) {
      if (aisle !== null) lines.push("");
      aisle = i.aisle;
      lines.push(`${AISLE_LABEL[aisle]}:`);
    }
    lines.push(`- ${i.name}${i.quantity ? ` (${i.quantity})` : ""}`);
  }
  return lines.join("\n");
}
