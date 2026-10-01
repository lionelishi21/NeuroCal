import type { HistoryDay } from "@neurocal/contracts";
import { formatClock, hoursAndMinutes } from "./format";

/** One evening and the sleep that followed it. */
export interface Night {
  /** The evening's date. */
  evening: string;
  /** The morning's date (the day whose Focus Score this night feeds). */
  morning: string;
  lastMealAt: string | null;
  lateScreenMinutes: number | null;
  bedtime: string | null;
  wakeTime: string | null;
  sleepMinutes: number | null;
  focusScore: number | null;
}

/** The clock axis the Sleep screen draws on: 6pm to noon the next day. */
export const AXIS_START_HOUR = 18;
export const AXIS_HOURS = 18;
/** Eating after this counts as late (ARCHITECTURE §6.8). */
export const LATE_EATING_FROM = "21:00";
export const LATE_SCREEN_FROM = "22:00";

/** Pairs each day's evening with the next day's morning. N days in, N − 1 nights out, oldest first. */
export function nightsFrom(days: HistoryDay[]): Night[] {
  return days.slice(1).map((morning, i) => {
    const evening = days[i]!;
    return {
      evening: evening.date,
      morning: morning.date,
      lastMealAt: evening.lastMealAt,
      lateScreenMinutes: morning.lateScreenMinutes,
      bedtime: morning.bedtime,
      wakeTime: morning.wakeTime,
      sleepMinutes: morning.sleepMinutes,
      focusScore: morning.focusScore,
    };
  });
}

/** Hours after 6pm for a "HH:MM" time, wrapping past midnight (01:30 → 7.5). */
export function hoursIntoEvening(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return ((h ?? 0) + (m ?? 0) / 60 - AXIS_START_HOUR + 24) % 24;
}

export const ateLate = (night: Night) => night.lastMealAt !== null && night.lastMealAt >= LATE_EATING_FROM;

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

export function averageSleep(nights: Night[]): number | null {
  const slept = nights.flatMap((n) => (n.sleepMinutes === null ? [] : [n.sleepMinutes]));
  return slept.length ? Math.round(mean(slept)) : null;
}

/** The middle bedtime of the week as "HH:MM", or null without data. */
export function usualBedtime(nights: Night[]): string | null {
  const times = nights.flatMap((n) => (n.bedtime ? [n.bedtime] : [])).sort((a, b) => hoursIntoEvening(a) - hoursIntoEvening(b));
  return times[Math.floor((times.length - 1) / 2)] ?? null;
}

/** Plain sentences about late eating, late screens and bedtime drift, from the week's own numbers. */
export function eveningInsights(nights: Night[]): string[] {
  const out: string[] = [];
  const slept = nights.filter((n) => n.sleepMinutes !== null);

  const late = slept.filter(ateLate);
  const early = slept.filter((n) => n.lastMealAt !== null && !ateLate(n));
  if (late.length && early.length) {
    const lateAvg = mean(late.map((n) => n.sleepMinutes!));
    const gap = Math.round(mean(early.map((n) => n.sleepMinutes!)) - lateAvg);
    const count = late.length === 1 ? "the one night" : `the ${late.length} nights`;
    out.push(
      gap >= 15
        ? `On ${count} you ate after 9pm, you slept ${hoursAndMinutes(Math.round(lateAvg))} on average. That is ${hoursAndMinutes(gap)} less than on the nights you finished earlier.`
        : `You ate after 9pm on ${late.length === 1 ? "one night" : `${late.length} nights`}, and slept about as long as on the others.`,
    );
  } else if (early.length && !late.length) {
    out.push("You finished eating before 9pm every night you logged. That gives digestion time to settle before sleep.");
  }

  const screens = nights.filter((n) => (n.lateScreenMinutes ?? 0) > 0);
  if (screens.length) {
    const minutes = Math.round(mean(screens.map((n) => n.lateScreenMinutes!)));
    out.push(
      `You were on screens after 10pm on ${screens.length === 1 ? "one night" : `${screens.length} nights`}, for ${minutes} minutes on average. Each late hour takes points off the next morning's Focus Score.`,
    );
  } else if (nights.every((n) => n.lateScreenMinutes === null)) {
    out.push("No late screen time is logged yet. Add last night's to see how it lines up with your sleep.");
  }

  const bedtimes = nights.flatMap((n) => (n.bedtime ? [n.bedtime] : [])).sort((a, b) => hoursIntoEvening(a) - hoursIntoEvening(b));
  const first = bedtimes[0];
  const last = bedtimes.at(-1);
  if (first && last && hoursIntoEvening(last) - hoursIntoEvening(first) >= 1) {
    out.push(`Your bedtime moved between ${formatClock(first)} and ${formatClock(last)}. A steadier bedtime keeps your body clock in step.`);
  }
  return out;
}
