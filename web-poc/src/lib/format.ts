import type { CognitiveFlag, MealKind } from "@neurocal/contracts";

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
