/**
 * "Why?" lines under a result: the likely reasons a weigh-in moved or where a day's calories came
 * from, worked out by rules from what's logged, so they cost nothing and show at once. A "Why?" tap
 * asks the model for a fuller explanation only when these aren't enough (WhyUseCases).
 */
import { type CoachData, LB_PER_KG, type WeightUnit, formatWeight } from "./coach";
import { addDays, trendOf } from "./weight";
import type { Meal } from "./types";

export const WHY_TOPICS = ["weight", "calories", "focus"] as const;
export type WhyTopic = (typeof WHY_TOPICS)[number];

export interface WhyReasons {
  headline: string;
  reasons: string[];
}

/** A change smaller than this (about a pound) isn't worth explaining. */
const STEADY_KG = 0.45;
/** Above this (about two pounds), add the arithmetic of how much food fat would take. */
const BIG_KG = 0.9;
const KCAL_PER_LB_FAT = 3500;

/** Foods that usually carry a lot of salt, matched in logged food names. */
const SALTY =
  /pizza|ramen|noodle soup|instant noodle|soy sauce|teriyaki|chips|crisps|fries|bacon|ham\b|salami|pepperoni|sausage|hot dog|pickle|olives|cured|jerky|burger|takeaway|takeout|fast food|nachos|pretzel|canned soup|miso|kimchi|fried chicken|chinese|curry/i;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayWord = (date: string, today: string) =>
  date === today ? "today" : date === addDays(today, -1) ? "yesterday" : `on ${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;

const kcalText = (n: number) => `${Math.round(n).toLocaleString("en-US")} kcal`;

function totals(meals: Meal[]) {
  const items = meals.flatMap((m) => m.items);
  const sum = (f: (i: (typeof items)[number]) => number) => items.reduce((a, i) => a + f(i), 0);
  return { kcal: sum((i) => i.calories), carbs: sum((i) => i.macros.carbsG), protein: sum((i) => i.macros.proteinG), items };
}

function localHour(d: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(d));
}

function localClock(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

function amount(kg: number, unit: WeightUnit): string {
  return formatWeight(Math.abs(kg), unit);
}

/**
 * Why the latest weigh-in moved from the one before (at most three days apart): the day before it
 * (carbs against their usual, salty foods, a late last meal, calories over target), the night's sleep,
 * and the trend. Null without two close weigh-ins or when the change is under a pound.
 */
export function weightWhy(d: CoachData): WhyReasons | null {
  const entries = d.weights.filter((w) => w.date <= d.today);
  const last = entries.at(-1);
  const prev = entries.at(-2);
  if (!last || !prev || last.date > d.today || addDays(prev.date, 3) < last.date) return null;
  const change = last.kg - prev.kg;
  if (Math.abs(change) < STEADY_KG) return null;
  const tz = d.profile.timeZone;
  const up = change > 0;
  const eve = addDays(last.date, -1);
  const eveWord = dayWord(eve, d.today);
  const eveMeals = d.meals.find((m) => m.date === eve)?.meals ?? [];
  const others = d.meals.filter((m) => m.date !== eve && m.date !== d.today && m.meals.length);
  const usualCarbs = others.length
    ? others.reduce((a, m) => a + totals(m.meals).carbs, 0) / others.length
    : d.profile.macroTargets.carbsG;
  const reasons: string[] = [];

  if (eveMeals.length) {
    const t = totals(eveMeals);
    if (up) {
      if (usualCarbs > 0 && t.carbs >= usualCarbs * 1.3) {
        reasons.push(
          `${Math.round(t.carbs)} g of carbs ${eveWord}, against about ${Math.round(usualCarbs)} g usually. Each gram the body stores holds about 3 g of water.`,
        );
      }
      const salty = [...new Set(t.items.filter((i) => SALTY.test(i.name)).map((i) => i.name))];
      if (salty.length) reasons.push(`Salty food ${eveWord} (${salty.slice(0, 3).join(", ")}). Salt makes the body hold water for a day or two.`);
      const lastMeal = eveMeals.reduce((a, b) => (a.eatenAt > b.eatenAt ? a : b));
      if (localHour(lastMeal.eatenAt, tz) >= 20) {
        reasons.push(`Last meal at ${localClock(lastMeal.eatenAt, tz)}, so more food was still in your gut at the weigh-in.`);
      }
      const over = t.kcal - d.profile.dailyCalorieTarget;
      if (over >= 300) reasons.push(`${kcalText(t.kcal)} ${eveWord}, ${kcalText(over)} over your target.`);
    } else {
      if (usualCarbs > 0 && t.carbs <= usualCarbs * 0.7) {
        reasons.push(`Fewer carbs ${eveWord} (${Math.round(t.carbs)} g against about ${Math.round(usualCarbs)} g), so the body let go of the water they hold.`);
      }
      const under = d.profile.dailyCalorieTarget - t.kcal;
      if (under >= 300) reasons.push(`${kcalText(t.kcal)} ${eveWord}, ${kcalText(under)} under your target.`);
    }
  } else {
    reasons.push(`Nothing logged ${eveWord}. Log meals to see what moves your weight.`);
  }

  const night = d.sleep.find((s) => s.date === last.date);
  if (up && night?.sessions.length) {
    const hours = night.sessions.reduce((a, s) => a + (s.end.getTime() - s.start.getTime()) / 3_600_000, 0);
    if (hours < 6) reasons.push(`${Math.round(hours * 10) / 10} h of sleep. Short sleep raises cortisol, which holds water.`);
  }

  if (up && change >= BIG_KG) {
    const fatKcal = Math.round((change * LB_PER_KG * KCAL_PER_LB_FAT) / 500) * 500;
    reasons.push(`Gaining ${amount(change, d.unit)} of fat would take about ${kcalText(fatKcal)} more than you burn, so this is mostly water.`);
  } else if (!up) {
    reasons.push("Some of a quick drop is water and an emptier gut too; the trend shows the real change.");
  }
  if (up && reasons.length === 0) {
    reasons.push(
      `Nothing in your log stands out. Swings of ${d.unit === "lb" ? "1 to 3 lb" : "half a kilo to a kilo and a half"} a day are normal; weigh at the same time each morning.`,
    );
  }

  const trend = trendOf(entries);
  if (trend?.weeklyChangeKg != null && Math.abs(trend.weeklyChangeKg) >= 0.05) {
    reasons.push(`Your trend is ${trend.weeklyChangeKg < 0 ? "down" : "up"} ${amount(trend.weeklyChangeKg, d.unit)} this week, and that's what counts.`);
  }

  return {
    headline: up ? `Up ${amount(change, d.unit)}: most likely water, not fat` : `Down ${amount(change, d.unit)}: part of it is water`,
    reasons,
  };
}

/** Where [date]'s calories came from: the biggest items, and protein when it's lagging. Null with nothing logged. */
export function caloriesWhy(d: CoachData, date: string): WhyReasons | null {
  const meals = d.meals.find((m) => m.date === date)?.meals ?? [];
  if (!meals.length) return null;
  const t = totals(meals);
  if (t.kcal <= 0) return null;
  const target = d.profile.dailyCalorieTarget;
  const top = [...t.items].sort((a, b) => b.calories - a.calories).slice(0, 2);
  const reasons = [`Most came from ${top.map((i) => `${i.name} (${kcalText(i.calories)})`).join(" and ")}.`];
  const proteinTarget = d.profile.macroTargets.proteinG;
  if (t.kcal >= target * 0.7 && proteinTarget > 0 && t.protein < proteinTarget * 0.6) {
    reasons.push(`Protein is at ${Math.round(t.protein)} of ${proteinTarget} g. Protein keeps you full for longer and protects muscle while you lose weight.`);
  }
  const over = t.kcal - target;
  return {
    headline: over > 0 ? `${kcalText(over)} over: here's where it came from` : `${kcalText(t.kcal)} so far ${dayWord(date, d.today)}`,
    reasons,
  };
}
