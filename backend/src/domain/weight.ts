/**
 * Weight goals and the trend. Day-to-day weight swings by a kilo or more with water and food, so
 * progress is read from a smoothed trend (an exponential moving average, as in The Hacker's Diet),
 * not from any single weigh-in.
 */

export interface WeightGoal {
  startKg: number;
  targetKg: number;
  /** YYYY-MM-DD. */
  startedOn: string;
  /** Planned loss per week as a share of body weight: 0.5–1%. */
  pacePctPerWeek: number;
  /**
   * The person said one of: diabetes medication, pregnant or breastfeeding, under 18, or a history
   * of an eating disorder. Long fasts are then never suggested.
   */
  fastingCaution: boolean;
}

export interface WeightEntry {
  /** YYYY-MM-DD in the person's time zone. */
  date: string;
  kg: number;
}

export interface WeightTrend {
  /** Smoothed weight on the latest weigh-in day. */
  trendKg: number;
  /** Change in the trend over the last 7 days (negative is a loss); null with under a week of data. */
  weeklyChangeKg: number | null;
}

export interface WeightProgress extends WeightTrend {
  /** Still to go to the target, never negative. */
  toGoKg: number;
  /** When the trend reaches the target at the current rate; null if it isn't heading there. */
  projectedOn: string | null;
}

export const MIN_KG = 25;
export const MAX_KG = 350;
/** The gentlest and fastest paces the app sets: losing more than 1% a week loses muscle too. */
export const PACES = [0.5, 0.75, 1] as const;

/** How fast the trend follows new weigh-ins: about a tenth of each day's difference. */
const SMOOTHING = 0.1;
const DAY_MS = 86_400_000;

const dayNumber = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / DAY_MS;
export const addDays = (date: string, days: number) => new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10);

/** The trend for each day from the first weigh-in to the last, filling missed days by carrying the trend. */
function dailyTrend(entries: WeightEntry[]): Map<number, number> {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const byDay = new Map(sorted.map((e) => [dayNumber(e.date), e.kg]));
  const trend = new Map<number, number>();
  if (sorted.length === 0) return trend;
  const first = dayNumber(sorted[0]!.date);
  const last = dayNumber(sorted.at(-1)!.date);
  let value = sorted[0]!.kg;
  for (let day = first; day <= last; day++) {
    const kg = byDay.get(day);
    if (kg !== undefined) value += SMOOTHING * (kg - value);
    trend.set(day, value);
  }
  return trend;
}

export function trendOf(entries: WeightEntry[]): WeightTrend | null {
  const trend = dailyTrend(entries);
  if (trend.size === 0) return null;
  const days = [...trend.keys()];
  const last = days.at(-1)!;
  const now = trend.get(last)!;
  const weekAgo = trend.get(last - 7);
  return { trendKg: round1(now), weeklyChangeKg: weekAgo === undefined ? null : round2(now - weekAgo) };
}

export function progressOf(entries: WeightEntry[], goal: WeightGoal): WeightProgress | null {
  const trend = trendOf(entries);
  if (!trend) return null;
  const latest = [...entries].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!.date;
  const toGo = Math.max(0, trend.trendKg - goal.targetKg);
  const perDay = trend.weeklyChangeKg === null ? 0 : -trend.weeklyChangeKg / 7;
  const projectedOn = toGo === 0 ? latest : perDay > 0.005 ? addDays(latest, Math.ceil(toGo / perDay)) : null;
  return { ...trend, toGoKg: round1(toGo), projectedOn };
}

/** Kilos a week the plan aims for at its pace, from the starting weight. */
export const plannedWeeklyLossKg = (goal: WeightGoal) => round2((goal.startKg * goal.pacePctPerWeek) / 100);

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
