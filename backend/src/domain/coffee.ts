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

/**
 * The coffee log: each cup with its time and add-ins, separate from meals. Coffee and pure fat keep a
 * fast going (Bulletproof coffee as a "fat fast"); milk, sugar or collagen end it. The add-ins'
 * calories still count toward the day. Cups after the caffeine curfew (eight hours after waking) are
 * flagged and cost the next day's evening timing, since late caffeine cuts deep sleep.
 */
export const COFFEE_KINDS = ["brewed", "espresso", "double_espresso", "decaf"] as const;
export type CoffeeKind = (typeof COFFEE_KINDS)[number];

export const COFFEE_ADD_INS = ["mct_c8", "mct_c8_c10", "butter_grass_fed", "butter", "ghee_grass_fed", "ghee", "creatine", "collagen", "milk", "sugar"] as const;
export type CoffeeAddIn = (typeof COFFEE_ADD_INS)[number];

/** Caffeine and calories in the coffee itself (USDA for brewed and espresso). */
export const KIND: Record<CoffeeKind, { label: string; caffeineMg: number; kcal: number }> = {
  brewed: { label: "Coffee", caffeineMg: 95, kcal: 2 },
  espresso: { label: "Espresso", caffeineMg: 63, kcal: 1 },
  double_espresso: { label: "Double espresso", caffeineMg: 126, kcal: 2 },
  decaf: { label: "Decaf", caffeineMg: 3, kcal: 2 },
};

/** Per usual serving. Milk, sugar and collagen (protein or sugar) end a fast; fat and creatine don't. */
export const ADD_IN: Record<CoffeeAddIn, { label: string; portion: string; kcal: number; proteinG: number; carbsG: number; fatG: number; breaksFast: boolean }> = {
  mct_c8: { label: "C8 MCT oil", portion: "1 tbsp", kcal: 130, proteinG: 0, carbsG: 0, fatG: 14, breaksFast: false },
  mct_c8_c10: { label: "MCT oil (C8/C10)", portion: "1 tbsp", kcal: 130, proteinG: 0, carbsG: 0, fatG: 14, breaksFast: false },
  butter_grass_fed: { label: "Grass-fed butter", portion: "1 tbsp", kcal: 102, proteinG: 0.1, carbsG: 0, fatG: 11.5, breaksFast: false },
  butter: { label: "Butter", portion: "1 tbsp", kcal: 102, proteinG: 0.1, carbsG: 0, fatG: 11.5, breaksFast: false },
  ghee_grass_fed: { label: "Grass-fed ghee", portion: "1 tbsp", kcal: 120, proteinG: 0, carbsG: 0, fatG: 13.6, breaksFast: false },
  ghee: { label: "Ghee", portion: "1 tbsp", kcal: 120, proteinG: 0, carbsG: 0, fatG: 13.6, breaksFast: false },
  creatine: { label: "Creatine", portion: "5 g", kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, breaksFast: false },
  collagen: { label: "Collagen", portion: "10 g", kcal: 36, proteinG: 9, carbsG: 0, fatG: 0, breaksFast: true },
  milk: { label: "Milk", portion: "a splash (60 ml)", kcal: 37, proteinG: 1.9, carbsG: 2.9, fatG: 2, breaksFast: true },
  sugar: { label: "Sugar", portion: "1 tsp", kcal: 16, proteinG: 0, carbsG: 4.2, fatG: 0, breaksFast: true },
};

export interface CoffeeCup {
  id: string;
  takenAt: Date;
  kind: CoffeeKind;
  addIns: CoffeeAddIn[];
}

export const MAX_CUPS_A_DAY = 20;

/** A cup's name as a meal item would read: "Coffee with C8 MCT oil and grass-fed butter". */
export function cupName(cup: Pick<CoffeeCup, "kind" | "addIns">): string {
  // Lower case in a sentence, except names that start with an abbreviation (C8, MCT).
  const parts = cup.addIns.map((a) => ADD_IN[a].label).map((l) => (/^[A-Z0-9]{2}/.test(l) ? l : l[0]!.toLowerCase() + l.slice(1)));
  if (parts.length === 0) return KIND[cup.kind].label;
  const list = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  return `${KIND[cup.kind].label} with ${list}`;
}

export function cupNutrition(cup: Pick<CoffeeCup, "kind" | "addIns">) {
  const base = KIND[cup.kind];
  return cup.addIns.reduce(
    (n, a) => ({
      kcal: n.kcal + ADD_IN[a].kcal,
      proteinG: n.proteinG + ADD_IN[a].proteinG,
      carbsG: n.carbsG + ADD_IN[a].carbsG,
      fatG: n.fatG + ADD_IN[a].fatG,
      caffeineMg: n.caffeineMg,
    }),
    { kcal: base.kcal, proteinG: 0, carbsG: 0, fatG: 0, caffeineMg: base.caffeineMg },
  );
}

/** Milk, sugar or collagen end a fast; black coffee, pure fat and creatine keep it going. */
export const breaksFast = (cup: Pick<CoffeeCup, "addIns">) => cup.addIns.some((a) => ADD_IN[a].breaksFast);

/** Caffeine's half-life is five or six hours, so the last cup is eight hours after waking. */
export const CURFEW_AFTER_WAKE_HOURS = 8;

/** The wake-time answer in onboarding, as an hour of the day. */
const WAKE_HOURS: Record<string, number> = { before_6: 5.5, "6_to_8": 7, after_8: 8.5 };
export const wakeHourOf = (bioProfile: Record<string, unknown> | undefined) => WAKE_HOURS[String(bioProfile?.wake)] ?? 7;

/** The caffeine curfew as local "HH:MM". */
export function curfewClock(wakeHour: number): string {
  const minutes = Math.round((wakeHour + CURFEW_AFTER_WAKE_HOURS) * 60);
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** True when a cup at local "HH:MM" `time` comes after the curfew. */
export const afterCurfew = (time: { hour: number; minute: number }, wakeHour: number) =>
  time.hour * 60 + time.minute > Math.round((wakeHour + CURFEW_AFTER_WAKE_HOURS) * 60);

/**
 * What a scanned MCT oil, butter or ghee is, as an add-in for the coffee log: pure C8 or a C8/C10
 * blend, grass-fed or not. Read from the label and the maker; null for anything else.
 */
export interface CoffeeFatCheck {
  /** The add-in it is, to log in a cup. */
  addIn: CoffeeAddIn;
  /** Pure C8, or grass-fed butter or ghee. */
  good: boolean;
  detail: string;
}

const NOT_DAIRY_BUTTER = /peanut|almond|cashew|nut butter|seed butter|cocoa butter|cacao butter|shea|apple butter|buttermilk|margarine|spread|butter beans?|butternut|butterscotch/;
const GRASS_FED = /grass[- ]?fed|pasture[- ]?raised|pasture[- ]?fed/;
/** Makers whose butter or ghee comes from (mostly) grass-fed cows. */
const GRASS_FED_BRANDS: { name: string; match: RegExp }[] = [
  { name: "Kerrygold", match: /kerrygold/ },
  { name: "Anchor", match: /\banchor\b/ },
  { name: "Vital Farms", match: /vital farms/ },
  { name: "Organic Valley", match: /organic valley/ },
  { name: "4th & Heart", match: /4th (&|and) heart|fourth (&|and) heart/ },
  { name: "Ancient Organics", match: /ancient organics/ },
  { name: "Bulletproof", match: /bulletproof/ },
];

export function coffeeFatCheck(reading: Pick<FoodLabelReading, "productName" | "brand" | "ingredients" | "manufacturer">): CoffeeFatCheck | null {
  const name = plain(`${reading.brand ?? ""} ${reading.productName ?? ""}`);
  const text = plain([reading.brand, reading.productName, reading.manufacturer, ...reading.ingredients].filter(Boolean).join(" "));

  if (/\bmct\b|medium[- ]chain|caprylic|brain octane|\bc8\b/.test(name)) {
    const c8 = /caprylic|\bc8\b|brain octane|octanoic/.test(text);
    const c10 = /capric|\bc10\b|decanoic|c8\s*\/\s*c10|lauric|\bc12\b/.test(text);
    if (c8 && !c10) return { addIn: "mct_c8", good: true, detail: "Pure C8 (caprylic acid): the MCT that raises ketones most and is easiest on the stomach." };
    if (c8 && c10) return { addIn: "mct_c8_c10", good: false, detail: "A C8/C10 blend. Pure C8 raises ketones more and is easier on the stomach; look for C8 or caprylic acid alone." };
    return {
      addIn: "mct_c8_c10",
      good: false,
      detail: "The label doesn't say which MCTs it holds. Most plain MCT oil is a C8/C10 blend; for the most ketones, look for C8 or caprylic acid alone.",
    };
  }

  const ghee = /\bghee\b|clarified butter/.test(name);
  if (ghee || (/\bbutter\b/.test(name) && !NOT_DAIRY_BUTTER.test(name))) {
    const brand = GRASS_FED_BRANDS.find((b) => b.match.test(text));
    const grassFed = GRASS_FED.test(text) || brand !== undefined;
    const what = ghee ? "ghee" : "butter";
    if (grassFed) {
      return {
        addIn: ghee ? "ghee_grass_fed" : "butter_grass_fed",
        good: true,
        detail: GRASS_FED.test(text)
          ? `Grass-fed ${what}: more omega-3, CLA and vitamin K2 than regular.`
          : `${brand!.name} ${what} comes from (mostly) grass-fed cows: more omega-3, CLA and vitamin K2 than regular.`,
      };
    }
    return {
      addIn: ghee ? "ghee" : "butter",
      good: false,
      detail: `The label doesn't say the ${what} is grass-fed. Grass-fed has more omega-3, CLA and vitamin K2; look for "grass-fed" or "pasture-raised".`,
    };
  }
  return null;
}

/** The products the coffee page suggests, by catalog id (partnerProducts.ts): what goes in a good cup. */
export const COFFEE_PRODUCT_IDS = ["danger-coffee", "bulletproof-brain-octane", "sports-research-c8-mct", "kerrygold-butter", "fourth-and-heart-ghee", "thorne-creatine"] as const;
