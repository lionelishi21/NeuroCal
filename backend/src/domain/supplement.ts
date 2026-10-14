/**
 * Supplement labels: what the vision model read, and the flags NeuroCal adds. The flags are plain
 * rules, not the model's opinion, so they can be tested and explained. Everything here describes the
 * label; a photo can't show what is actually in the bottle.
 */

export type SupplementTestingMark =
  | "nsf_certified"
  | "nsf_sport"
  | "usp_verified"
  | "informed_sport"
  | "informed_choice"
  | "bscg"
  | "clean_label_project"
  | "other";

export type LabelProblem = "not_a_label" | "blurry" | "too_dark" | "cut_off";

export interface SupplementIngredient {
  name: string;
  amount?: number;
  unit?: string;
  inBlend: boolean;
}

/** What the vision model read off the label. */
export interface SupplementLabelReading {
  problem?: LabelProblem;
  brand?: string;
  productName?: string;
  servingSize?: string;
  servingsPerContainer?: number;
  ingredients: SupplementIngredient[];
  /** The label mentions a proprietary blend, matrix or complex with only a total weight. */
  proprietaryBlend: boolean;
  testing: SupplementTestingMark[];
  lotNumber?: string;
  /** "YYYY-MM" or "YYYY-MM-DD". */
  expiresOn?: string;
}

export type SupplementFlagKind = "proprietary_blend" | "above_upper_limit" | "no_third_party_testing" | "expired" | "expires_soon" | "doses_missing";

export interface SupplementFlag {
  kind: SupplementFlagKind;
  message: string;
}

/**
 * Adult tolerable upper intake levels (US NIH Office of Dietary Supplements), for nutrients where a
 * single serving can plausibly pass one. Amounts are per day; we compare one serving, so a label at
 * or under these can still go over when taken more than once a day or with other products.
 */
const UPPER_LIMITS: { label: string; match: RegExp; amount: number; unit: "mg" | "mcg"; iuPerUnit?: number }[] = [
  { label: "vitamin A", match: /\bvitamin a\b|retinol|retinyl/, amount: 3000, unit: "mcg", iuPerUnit: 3.33 },
  { label: "vitamin D", match: /\bvitamin d\d?\b|cholecalciferol|ergocalciferol/, amount: 100, unit: "mcg", iuPerUnit: 40 },
  { label: "vitamin E", match: /\bvitamin e\b|tocopherol/, amount: 1000, unit: "mg" },
  { label: "vitamin C", match: /\bvitamin c\b|ascorbic|ascorbate/, amount: 2000, unit: "mg" },
  { label: "vitamin B6", match: /\bvitamin b-?6\b|pyridox/, amount: 100, unit: "mg" },
  { label: "niacin", match: /niacin|nicotinic acid|\bvitamin b-?3\b/, amount: 35, unit: "mg" },
  { label: "folic acid", match: /folic acid/, amount: 1000, unit: "mcg" },
  { label: "zinc", match: /\bzinc\b/, amount: 40, unit: "mg" },
  { label: "iron", match: /\biron\b|ferrous|ferric/, amount: 45, unit: "mg" },
  { label: "magnesium", match: /magnesium/, amount: 350, unit: "mg" },
  { label: "calcium", match: /calcium/, amount: 2500, unit: "mg" },
  { label: "selenium", match: /selenium|selenomethionine/, amount: 400, unit: "mcg" },
  { label: "copper", match: /\bcopper\b|cupric/, amount: 10, unit: "mg" },
  { label: "iodine", match: /iodine|iodide|kelp/, amount: 1100, unit: "mcg" },
  { label: "manganese", match: /manganese/, amount: 11, unit: "mg" },
  { label: "boron", match: /\bboron\b/, amount: 20, unit: "mg" },
];

const TESTING_NAMES: Record<SupplementTestingMark, string> = {
  nsf_certified: "NSF",
  nsf_sport: "NSF Certified for Sport",
  usp_verified: "USP",
  informed_sport: "Informed Sport",
  informed_choice: "Informed Choice",
  bscg: "BSCG",
  clean_label_project: "Clean Label Project",
  other: "a third-party tester",
};

const EXPIRES_SOON_DAYS = 90;

/** The amount in mg or mcg, or null when the printed unit can't be converted (e.g. "mcg DFE", "CFU"). */
function toUnit(amount: number, printed: string | undefined, want: "mg" | "mcg", iuPerUnit?: number): number | null {
  const unit = (printed ?? "").trim().toLowerCase().replace(/^(µg|μg|ug)$/, "mcg");
  const perMcg: Record<string, number> = { g: 1_000_000, mg: 1000, mcg: 1 };
  let mcg: number;
  if (unit === "iu") {
    if (!iuPerUnit) return null;
    mcg = amount / iuPerUnit;
  } else if (unit in perMcg) {
    mcg = amount * perMcg[unit]!;
  } else {
    return null;
  }
  return want === "mcg" ? mcg : mcg / 1000;
}

const round = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10);

/** An ingredient with an adult upper limit, in that limit's unit; null when it has none or the unit can't be compared. */
export function limitedNutrient(ingredient: SupplementIngredient): { label: string; amount: number; unit: "mg" | "mcg"; limit: number } | null {
  if (ingredient.amount === undefined) return null;
  const limit = UPPER_LIMITS.find((l) => l.match.test(ingredient.name.toLowerCase()));
  if (!limit) return null;
  const amount = toUnit(ingredient.amount, ingredient.unit, limit.unit, limit.iuPerUnit);
  return amount === null ? null : { label: limit.label, amount, unit: limit.unit, limit: limit.amount };
}

export const roundAmount = round;

/** The last day the product is good for: the end of the month when only a month is printed. */
function lastGoodDay(expiresOn: string): Date {
  const [y, m, d] = expiresOn.split("-").map(Number) as [number, number, number | undefined];
  return d ? new Date(Date.UTC(y, m - 1, d)) : new Date(Date.UTC(y, m, 0));
}

function monthName(expiresOn: string): string {
  const date = lastGoodDay(expiresOn);
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC", ...(expiresOn.length > 7 ? { day: "numeric" } : {}) });
}

export function flagsFor(reading: SupplementLabelReading, today: Date): SupplementFlag[] {
  if (reading.problem) return [];
  const flags: SupplementFlag[] = [];

  if (reading.proprietaryBlend || reading.ingredients.some((i) => i.inBlend)) {
    flags.push({
      kind: "proprietary_blend",
      message: "Part of this is a proprietary blend: the label gives the blend's total weight but not how much of each ingredient is in it.",
    });
  }

  const missing = reading.ingredients.filter((i) => !i.inBlend && i.amount === undefined);
  if (missing.length > 0) {
    flags.push({
      kind: "doses_missing",
      message: `No dose could be read for ${missing.map((i) => i.name).join(", ")}. Check the label.`,
    });
  }

  for (const ingredient of reading.ingredients) {
    if (ingredient.amount === undefined) continue;
    const name = ingredient.name.toLowerCase();
    const limit = UPPER_LIMITS.find((l) => l.match.test(name));
    if (!limit) continue;
    const amount = toUnit(ingredient.amount, ingredient.unit, limit.unit, limit.iuPerUnit);
    if (amount === null || amount <= limit.amount) continue;
    flags.push({
      kind: "above_upper_limit",
      message: `One serving has ${round(amount)} ${limit.unit} of ${limit.label}, above the ${limit.amount} ${limit.unit} a day that health authorities set as the upper limit for adults. Check with your doctor before taking it.`,
    });
  }

  if (reading.testing.length === 0) {
    flags.push({
      kind: "no_third_party_testing",
      message: "No third-party testing mark (such as NSF, USP or Informed Sport) was found, so nobody outside the maker is shown to have checked what's inside.",
    });
  }

  if (reading.expiresOn) {
    const days = (lastGoodDay(reading.expiresOn).getTime() - today.getTime()) / 86_400_000;
    if (days < 0) flags.push({ kind: "expired", message: `It expired in ${monthName(reading.expiresOn)}.` });
    else if (days <= EXPIRES_SOON_DAYS) flags.push({ kind: "expires_soon", message: `It expires soon, in ${monthName(reading.expiresOn)}.` });
  }

  return flags;
}

/** One plain sentence: what it is, then what the label does and doesn't show. */
export function summaryFor(reading: SupplementLabelReading): string {
  if (reading.problem) {
    return {
      not_a_label: "That doesn't look like a supplement label. Photograph the side of the bottle with the facts panel.",
      blurry: "The label is too blurry to read. Hold the phone steady and try again.",
      too_dark: "The label is too dark to read. Try again in better light.",
      cut_off: "Part of the label is cut off. Fit the whole facts panel in the photo.",
    }[reading.problem];
  }
  const what = [reading.brand, reading.productName].filter(Boolean).join(" ") || "This supplement";
  const count = reading.ingredients.length;
  const parts = [`${count} ${count === 1 ? "ingredient" : "ingredients"}`];
  if (reading.testing.length) parts.push(`tested by ${reading.testing.map((t) => TESTING_NAMES[t]).join(" and ")}`);
  if (reading.expiresOn) parts.push(`expires ${monthName(reading.expiresOn)}`);
  return `${what}: ${parts.join(", ")}.`;
}

/** Text to search the catalog with for a close own-brand alternative. */
export const searchTextFor = (reading: SupplementLabelReading) =>
  [reading.productName, ...reading.ingredients.map((i) => i.name)].filter(Boolean).join(", ");
