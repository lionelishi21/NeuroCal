/**
 * Coffee and mould: some coffee carries mould toxins (mycotoxins, such as ochratoxin A) from how the
 * beans were grown, dried and stored. Testing for them is a claim a maker prints on the bag, so the
 * check reads the label: a stated mycotoxin or mould test, or a brand whose maker says it tests.
 * It never says a coffee is unsafe; it says whether testing is stated.
 */
import type { FoodLabelReading } from "./foodLabel";

export interface CoffeeCheck {
  /** The label or its maker says the coffee is tested for mould toxins. */
  moldTested: boolean;
  /** One plain sentence on why, or what to look for. */
  detail: string;
}

/** Makers that say they test their coffee for mould toxins. */
const TESTING_BRANDS: { name: string; match: RegExp }[] = [
  { name: "Danger Coffee", match: /danger\s*coffee/ },
  { name: "Bulletproof", match: /bulletproof/ },
  { name: "Purity Coffee", match: /purity\s*coffee/ },
  { name: "Lifeboost", match: /lifeboost/ },
  { name: "Natural Force", match: /natural\s*force/ },
];

/** What a label prints when the coffee is tested. */
const TESTED_CLAIM = /mycotoxin|ochratoxin|aflatoxin|mou?ld[- ](free|tested)|tested for mou?ld|lab[- ]tested for (toxins|mou?ld)/;

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** True for a coffee: its name or ingredients say so (not coffee-flavoured sweets or cake). */
export function isCoffee(reading: Pick<FoodLabelReading, "productName" | "brand" | "ingredients">): boolean {
  const name = plain(`${reading.brand ?? ""} ${reading.productName ?? ""}`);
  const first = plain(reading.ingredients[0] ?? "");
  return /\bcoffee\b|\bespresso\b|\bcafe\b/.test(name) && (reading.ingredients.length === 0 || /coffee|arabica|robusta/.test(first));
}

/** The mould check for a coffee, or null when the food isn't coffee. */
export function coffeeCheck(reading: Pick<FoodLabelReading, "productName" | "brand" | "ingredients" | "manufacturer">): CoffeeCheck | null {
  if (!isCoffee(reading)) return null;
  const text = plain([reading.brand, reading.productName, reading.manufacturer, ...reading.ingredients].filter(Boolean).join(" "));
  if (TESTED_CLAIM.test(text)) return { moldTested: true, detail: "The label says it's tested for mould toxins (mycotoxins)." };
  const brand = TESTING_BRANDS.find((b) => b.match.test(text));
  if (brand) return { moldTested: true, detail: `${brand.name} says it tests its coffee for mould toxins.` };
  return {
    moldTested: false,
    detail:
      "The label doesn't say it's tested for mould toxins. Look for 'mycotoxin-tested' or a named lab test; washed, single-origin beans roasted recently are a safer bet than old, cheap blends.",
  };
}
