/**
 * Ask NeuroCal: a person asks about their own numbers ("why did my weight jump 6 lb overnight?") and the
 * answer is grounded in what they've logged. This file turns their recent data into the short, plain
 * summary the model reads. It holds facts only (dates, weights, meals, sleep); the model does the
 * explaining, and works only from what is here plus general knowledge.
 */
import type { Meal, Profile, SleepSession } from "./types";
import type { Session } from "./session";
import { SESSION_KIND } from "./session";
import { type WeightEntry, trendOf } from "./weight";

export type WeightUnit = "kg" | "lb";

export const LB_PER_KG = 2.20462;
/** Days of weigh-ins, meals and sleep the summary covers. */
export const COACH_WEIGH_IN_DAYS = 21;
export const COACH_MEAL_DAYS = 4;
export const COACH_SLEEP_NIGHTS = 4;

/** The longest question, the most earlier turns kept, and the longest earlier turn. */
export const MAX_QUESTION_CHARS = 1000;
export const MAX_TURNS = 20;
export const MAX_TURN_CHARS = 4000;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CoachData {
  profile: Profile;
  /** Local date today. */
  today: string;
  unit: WeightUnit;
  /** Oldest first. */
  weights: WeightEntry[];
  /** Meals by local date, most recent day last. */
  meals: { date: string; meals: Meal[] }[];
  /** Sleep by the local date it ended, most recent last. */
  sleep: { date: string; sessions: SleepSession[] }[];
  /** Gadget and practice sessions lately (a sitting, or a period such as a subscription). */
  sessions: Session[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function formatWeight(kg: number, unit: WeightUnit): string {
  return unit === "lb" ? `${round1(kg * LB_PER_KG)} lb` : `${round1(kg)} kg`;
}

function signed(kg: number, unit: WeightUnit): string {
  const v = round1(unit === "lb" ? kg * LB_PER_KG : kg);
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v)} ${unit}`;
}

function clock(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

/** The person's recent data as plain lines, for the model to read. */
export function coachContext(d: CoachData): string {
  const { profile, unit } = d;
  const tz = profile.timeZone;
  const lines: string[] = [];
  lines.push(`Today is ${d.today} (${tz}). They use ${unit === "lb" ? "pounds" : "kilograms"}; answer in ${unit}.`);
  lines.push(`Name: ${profile.displayName || "not given"}.`);
  const m = profile.macroTargets;
  lines.push(`Daily calorie target: ${profile.dailyCalorieTarget} kcal (protein ${m.proteinG} g, carbs ${m.carbsG} g, fat ${m.fatG} g).`);
  if (profile.weightGoal) {
    const g = profile.weightGoal;
    lines.push(`Weight goal: from ${formatWeight(g.startKg, unit)} to ${formatWeight(g.targetKg, unit)}, started ${g.startedOn}, aiming to lose ${g.pacePctPerWeek}% of body weight a week.`);
  }
  if (profile.healthConditions?.length) lines.push(`Health conditions they told the app: ${profile.healthConditions.join(", ")}.`);

  lines.push("", `Weigh-ins (last ${COACH_WEIGH_IN_DAYS} days, change from the previous weigh-in in brackets):`);
  if (!d.weights.length) lines.push("None logged.");
  d.weights.forEach((w, i) => {
    const prev = d.weights[i - 1];
    lines.push(`${w.date}: ${formatWeight(w.kg, unit)}${prev ? ` (${signed(w.kg - prev.kg, unit)} since ${prev.date})` : ""}`);
  });
  const trend = trendOf(d.weights);
  if (trend) {
    lines.push(
      `Smoothed trend: ${formatWeight(trend.trendKg, unit)}${trend.weeklyChangeKg === null ? "" : `, ${signed(trend.weeklyChangeKg, unit)} over the last 7 days`}.`,
    );
  }

  lines.push("", `Food (last ${COACH_MEAL_DAYS} days; nutrition is estimated from photos or typed in):`);
  for (const day of d.meals) {
    if (!day.meals.length) {
      lines.push(`${day.date}: nothing logged.`);
      continue;
    }
    const items = day.meals.flatMap((meal) => meal.items);
    const sum = (f: (i: (typeof items)[number]) => number) => Math.round(items.reduce((a, i) => a + f(i), 0));
    const last = day.meals.reduce((a, b) => (a.eatenAt > b.eatenAt ? a : b));
    const foods = day.meals
      .map((meal) => `${clock(meal.eatenAt, tz)} ${meal.items.map((i) => `${i.name} (${i.portion})`).join(", ")}`)
      .join("; ");
    lines.push(
      `${day.date}: ${sum((i) => i.calories)} kcal, carbs ${sum((i) => i.macros.carbsG)} g, protein ${sum((i) => i.macros.proteinG)} g, fat ${sum((i) => i.macros.fatG)} g; last meal at ${clock(last.eatenAt, tz)}. ${foods}.`,
    );
  }

  lines.push("", `Sleep (last ${COACH_SLEEP_NIGHTS} nights, by the morning it ended):`);
  for (const night of d.sleep) {
    const minutes = night.sessions.reduce((a, s) => a + (s.end.getTime() - s.start.getTime()) / 60_000, 0);
    lines.push(`${night.date}: ${night.sessions.length ? `${round1(minutes / 60)} h` : "not recorded"}`);
  }

  if (d.sessions.length) {
    lines.push("", "Practices and gadgets lately:");
    for (const s of d.sessions) {
      const label = SESSION_KIND[s.kind].label;
      lines.push(
        s.endsAt !== undefined
          ? `${label}: running from ${s.takenAt.toISOString().slice(0, 10)}${s.endsAt ? ` to ${s.endsAt.toISOString().slice(0, 10)}` : ", ongoing"}`
          : `${label}: ${s.takenAt.toISOString().slice(0, 10)}${s.minutes ? `, ${s.minutes} min` : ""}`,
      );
    }
  }
  return lines.join("\n");
}
