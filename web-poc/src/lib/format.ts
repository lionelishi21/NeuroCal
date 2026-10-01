import type { CognitiveFlag, CognitiveGoal, DietaryPreference, MealKind } from "@neurocal/contracts";

export function todayIso(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** ISO 8601 timestamp in local time with offset, as the contracts expect. */
export function nowWithOffset(now = new Date()): string {
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const local = new Date(now.getTime() + offset * 60_000).toISOString().slice(0, 19);
  return `${local}${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
}

export const flagLabel: Record<CognitiveFlag, string> = {
  sharp: "Sharp",
  low_focus: "Low focus",
  brain_fog: "Brain fog",
  low_energy: "Low energy",
  wired: "Wired",
  stressed: "Stressed",
  calm: "Calm",
};

export const dietLabel: Record<DietaryPreference, { name: string; detail: string }> = {
  omnivore: { name: "Everything", detail: "Meat, fish, dairy and plants" },
  pescatarian: { name: "Pescatarian", detail: "Fish and seafood, no meat" },
  vegetarian: { name: "Vegetarian", detail: "No meat or fish" },
  vegan: { name: "Vegan", detail: "Plants only" },
  keto: { name: "Keto", detail: "Very low carb, high fat" },
  mediterranean: { name: "Mediterranean", detail: "Olive oil, fish, grains, vegetables" },
};

export const goalLabel: Record<CognitiveGoal, string> = {
  focus: "Sharper focus",
  calm: "Feel calmer",
  energy: "Steadier energy",
  sleep: "Better sleep",
};

export const mealKindLabel: Record<MealKind, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function mealKindForHour(hour: number): MealKind {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 17 && hour < 22) return "dinner";
  return "snack";
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDay(date = new Date()): string {
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export const kcal = (n: number) => Math.round(n).toLocaleString();

/** "7 h 05 min". */
export const hoursAndMinutes = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, "0")} min`;

/** A contract "HH:MM" local time in the reader's clock format ("9:40 PM" or "21:40"). */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
