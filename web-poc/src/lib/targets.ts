import type { DietaryPreference, Macros } from "@neurocal/contracts";
import { DIETS, macroRatio } from "./bioProfile";

const PROTOCOLS = new Set<string>(DIETS.map(([value]) => value));

/** Share of calories from protein / carbs / fat. Keto flips carbs and fat. */
const SPLITS: Record<"standard" | "keto", { protein: number; carbs: number; fat: number }> = {
  standard: { protein: 0.25, carbs: 0.45, fat: 0.3 },
  keto: { protein: 0.25, carbs: 0.05, fat: 0.7 },
};

/** Grams from a calorie target (4 kcal/g protein and carbs, 9 kcal/g fat), rounded to 5 g. */
export function suggestMacros(dailyCalories: number, diet: DietaryPreference): Macros {
  // The onboarding's diet protocols carry their own ratios.
  if (PROTOCOLS.has(diet)) {
    const [fat, protein, carbs] = macroRatio(diet, dailyCalories);
    return { fatG: fat!.grams, proteinG: protein!.grams, carbsG: carbs!.grams };
  }
  const split = SPLITS[diet === "keto" ? "keto" : "standard"];
  const round5 = (n: number) => Math.round(n / 5) * 5;
  return {
    proteinG: round5((dailyCalories * split.protein) / 4),
    carbsG: round5((dailyCalories * split.carbs) / 4),
    fatG: round5((dailyCalories * split.fat) / 9),
  };
}

export function macroCalories(m: Macros): number {
  return Math.round(m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9);
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function timeZones(current: string): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return all.includes(current) ? all : [current, ...all];
}
