/**
 * A person's recent data as a short, plain summary: what the rules in domain/why.ts read, and what the
 * model reads when someone taps "Why?". Facts only (dates, weights, meals, sleep, Focus Scores); the
 * model does the explaining, from what is here plus general knowledge.
 */
import type { FocusScore, Meal, Profile, SleepSession } from "./types";
import type { Session } from "./session";
import { SESSION_KIND } from "./session";
import { type WeightEntry, trendOf } from "./weight";

export type WeightUnit = "kg" | "lb";

export const LB_PER_KG = 2.20462;
/** Days of weigh-ins, meals and sleep the summary covers. */
export const COACH_WEIGH_IN_DAYS = 21;
export const COACH_MEAL_DAYS = 4;
export const COACH_SLEEP_NIGHTS = 4;

export interface CoachData {
  profile: Profile;
  /** Local date today. */
  today: string;
  unit: WeightUnit;
  /** Oldest first. */
  weights: WeightEntry[];
  /** Meals by local date, most recent day last. */
  meals: { date: string; meals: Meal[] }[];
  /** Night sleep by the local date it ended, most recent last, with that day's naps. */
  sleep: { date: string; sessions: SleepSession[]; naps?: SleepSession[] }[];
  /** Gadget and practice sessions lately (a sitting, or a period such as a subscription). */
  sessions: Session[];
  /** Focus Scores lately, oldest first. */
  focus?: FocusScore[];
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

  lines.push("", `Sleep (last ${COACH_SLEEP_NIGHTS} nights, by the morning it ended; daytime naps that day listed apart):`);
  for (const night of d.sleep) {
    const minutes = night.sessions.reduce((a, s) => a + (s.end.getTime() - s.start.getTime()) / 60_000, 0);
    const naps = (night.naps ?? []).map((s) => `${clock(s.start, tz)} for ${Math.round((s.end.getTime() - s.start.getTime()) / 60_000)} min`);
    lines.push(`${night.date}: ${night.sessions.length ? `${round1(minutes / 60)} h` : "not recorded"}${naps.length ? `; naps: ${naps.join(", ")}` : ""}`);
  }

  if (d.focus?.length) {
    lines.push("", "Focus Score (0–100; each input 0–1, higher is better, blank without data):");
    for (const f of d.focus) {
      const parts = Object.entries(f.components)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k} ${Math.round((v as number) * 100) / 100}`)
        .join(", ");
      lines.push(`${f.date}: ${f.score ?? "no score"}${parts ? ` (${parts})` : ""}`);
    }
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
