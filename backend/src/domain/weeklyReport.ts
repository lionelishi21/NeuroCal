/**
 * The weekly report: last week, Monday to Sunday, in one place. The Focus Score against the week
 * before and the biggest reason it moved, each pillar with what was logged, Brain speed and
 * performance, weight, what's working (supplements and practices with a verdict), the level, and
 * one thing to do next week. Built from the person's own numbers with fixed rules, like the score;
 * no model writes it, so it reads the same every week and never makes things up.
 */
import type { FocusComponents } from "./types";

export const REPORT_PILLARS = ["sleep", "timing", "glycemic", "stress", "movement", "environment"] as const;
export type ReportPillar = (typeof REPORT_PILLARS)[number];

/** As the rings on Today call them, and how a sentence says them. */
export const PILLAR: Record<ReportPillar, { label: string; noun: string }> = {
  sleep: { label: "Sleep", noun: "sleep" },
  timing: { label: "Evening", noun: "your evenings" },
  glycemic: { label: "Food", noun: "food" },
  stress: { label: "Stress", noun: "stress" },
  movement: { label: "Move", noun: "movement" },
  environment: { label: "Air", noun: "air and environment" },
};

/** One day, as the history has it. */
export interface ReportDay {
  date: string;
  focusScore: number | null;
  components: FocusComponents;
  sleepMinutes: number | null;
  caloriesEaten: number;
  calorieTarget: number;
  proteinG: number;
  /** "HH:MM" local. */
  lastMealAt: string | null;
  lateScreenMinutes: number | null;
}

export interface ReportInput {
  weekStart: string;
  weekEnd: string;
  /** Monday to Sunday of the report week, and of the week before. */
  thisWeek: ReportDay[];
  lastWeek: ReportDay[];
  /** Brain speed checks in the week, the usual before it, and a lasting level change. */
  brain: { scores: number[]; usual: number | null; newLevel: { up: boolean; from: number; to: number } | null };
  /** Performance sessions in the week by activity, and the strongest pattern over eight weeks. */
  performance: { activities: { label: string; sessions: number; sharpness: number }[]; pattern: string | null };
  /** First and last weigh-in of the week, and the goal. */
  weight: { startKg: number | null; endKg: number | null; goalKg: number | null };
  /** Supplements and practices with a verdict. */
  working: WorkingItem[];
  level: { level: number; name: string; nextName: string | null; nextMet: number; nextOf: number; missing: string[] };
}

export interface WorkingItem {
  name: string;
  kind: "supplement" | "practice";
  verdict: "helping" | "worse" | "no_change" | "lasted" | "faded";
  summary: string;
}

export interface PillarLine {
  pillar: ReportPillar;
  label: string;
  /** Average 0–100 over the days with data, or null. */
  score: number | null;
  previous: number | null;
  summary: string;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  /** Days with a Focus Score. */
  daysScored: number;
  headline: { score: number | null; previous: number | null; change: number | null; title: string; summary: string };
  pillars: PillarLine[];
  mind: { brain: string; performance: string | null };
  body: { startKg: number | null; endKg: number | null; goalKg: number | null };
  working: WorkingItem[];
  level: { level: number; name: string; summary: string };
  next: { pillar: ReportPillar; title: string; detail: string };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const known = <T>(xs: (T | null | undefined)[]) => xs.filter((x): x is T => x !== null && x !== undefined);
const r = (n: number) => Math.round(n);
const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const hours = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ` ${String(Math.round(min % 60)).padStart(2, "0")} min` : ""}`;
const thousands = (n: number) => r(n).toLocaleString("en-GB");

/** Minutes after midnight; times before 4 am count as late the day before. */
const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return (h < 4 ? h + 24 : h) * 60 + m;
};
const clockOf = (min: number) => {
  const m = r(min) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

function pillarScore(days: ReportDay[], p: ReportPillar): number | null {
  const a = avg(known(days.map((d) => d.components[p])));
  return a === null ? null : r(a * 100);
}

function pillarSummary(p: ReportPillar, week: ReportDay[], before: ReportDay[], score: number | null, previous: number | null): string {
  const was = previous === null ? "" : ` (${previous} the week before)`;
  switch (p) {
    case "sleep": {
      const nights = known(week.map((d) => d.sleepMinutes));
      if (!nights.length) return "No sleep logged. Connect your health app or log your nights, and this fills in.";
      const prev = avg(known(before.map((d) => d.sleepMinutes)));
      return `${hours(avg(nights)!)} a night on average over ${plural(nights.length, "night")}${prev === null ? "" : ` (${hours(prev)} the week before)`}.`;
    }
    case "timing": {
      const meals = known(week.map((d) => d.lastMealAt)).map(minutesOf);
      const screens = known(week.map((d) => d.lateScreenMinutes));
      const parts = [
        meals.length ? `last meal at about ${clockOf(avg(meals)!)} on average` : null,
        screens.length ? `${r(avg(screens)!)} min of screens late in the evening` : null,
      ].filter(Boolean);
      if (!parts.length) return "No evening meals or screen time logged.";
      const text = parts.join("; ");
      return `${text[0]!.toUpperCase()}${text.slice(1)}.`;
    }
    case "glycemic": {
      const eaten = week.filter((d) => d.caloriesEaten > 0);
      if (!eaten.length) return "No meals logged. Snap your plates and this fills in.";
      const kcal = avg(eaten.map((d) => d.caloriesEaten))!;
      const protein = avg(eaten.map((d) => d.proteinG))!;
      return `${thousands(kcal)} kcal a day against your ${thousands(eaten.at(-1)!.calorieTarget)} target, with ${r(protein)} g of protein, over ${plural(eaten.length, "day")} logged.`;
    }
    case "stress":
      return score === null ? "No check-ins. A quick check-in tells NeuroCal how you're coping." : `Stress score ${score}${was}, from your check-ins.`;
    case "movement":
      return score === null ? "No exercise logged." : `Movement score ${score}${was}.`;
    case "environment":
      return score === null ? "No air or environment check." : `Air and environment score ${score}${was}.`;
  }
}

/** One step for next week, from the weakest pillar. */
const NEXT: Record<ReportPillar, { title: string; detail: string }> = {
  sleep: {
    title: "Protect your sleep",
    detail: "Go to bed within the same half hour each night, and keep the last hour dim and screen-free.",
  },
  timing: {
    title: "Finish the day earlier",
    detail: "Eat your last meal at least 3 hours before bed, and put screens away an hour before.",
  },
  glycemic: {
    title: "Steadier food",
    detail: "Build each meal around protein and vegetables, and swap one ultra-processed food a day.",
  },
  stress: {
    title: "Bring stress down",
    detail: "Ten minutes of slow breathing or meditation a day. Log it as a session and NeuroCal will show whether it helps you.",
  },
  movement: {
    title: "Move a little more",
    detail: "Add a 20-minute walk on three days, ideally after a meal.",
  },
  environment: {
    title: "Better air",
    detail: "Air your rooms each morning, and check the air before you exercise outside.",
  },
};

export function weeklyReportOf(i: ReportInput): WeeklyReport {
  const scores = known(i.thisWeek.map((d) => d.focusScore));
  const before = known(i.lastWeek.map((d) => d.focusScore));
  const score = avg(scores) === null ? null : r(avg(scores)!);
  const previous = avg(before) === null ? null : r(avg(before)!);
  const change = score !== null && previous !== null ? score - previous : null;

  const pillars: PillarLine[] = REPORT_PILLARS.map((pillar) => {
    const s = pillarScore(i.thisWeek, pillar);
    const p = pillarScore(i.lastWeek, pillar);
    return { pillar, label: PILLAR[pillar].label, score: s, previous: p, summary: pillarSummary(pillar, i.thisWeek, i.lastWeek, s, p) };
  }).filter((p) => p.pillar !== "environment" || p.score !== null || p.previous !== null);

  // The pillar that moved most, in the direction the score moved.
  const moved = pillars
    .filter((p) => p.score !== null && p.previous !== null && change !== null && Math.sign(p.score - p.previous) === Math.sign(change))
    .sort((a, b) => Math.abs(b.score! - b.previous!) - Math.abs(a.score! - a.previous!))[0];

  let headline: WeeklyReport["headline"];
  if (score === null) {
    headline = {
      score,
      previous,
      change,
      title: "Not enough logged for a Focus Score",
      summary: "Log your sleep and meals this week and next Monday's report will fill in.",
    };
  } else if (change === null) {
    headline = { score, previous, change, title: `Focus Score ${score}`, summary: `Your average over ${plural(scores.length, "day")}. Next week's report compares with this one.` };
  } else if (Math.abs(change) < 2) {
    headline = { score, previous, change, title: `Focus Score ${score}, steady`, summary: `About the same as the week before (${previous}).` };
  } else {
    const way = change > 0 ? "Up" : "Down";
    headline = {
      score,
      previous,
      change,
      title: `Focus Score ${score}, ${way.toLowerCase()} ${Math.abs(change)}`,
      summary: `${way} from ${previous} the week before${moved ? `, mostly from ${PILLAR[moved.pillar].noun} (${moved.previous} to ${moved.score})` : ""}.`,
    };
  }

  const b = i.brain;
  const brainAvg = avg(b.scores);
  const brain = [
    brainAvg === null
      ? "No Brain speed checks. A two-minute check a few times a week shows how sharp you are."
      : `${plural(b.scores.length, "Brain speed check")}, averaging ${r(brainAvg)}${b.usual === null ? "" : ` against your usual ${b.usual}`}.`,
    b.newLevel ? `New level: your usual ${b.newLevel.up ? "rose" : "fell"} from ${b.newLevel.from} to ${b.newLevel.to} and has held.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const acts = i.performance.activities.filter((a) => a.sessions > 0);
  const total = acts.reduce((n, a) => n + a.sessions, 0);
  const performance = total
    ? [
        `${plural(total, "performance session")}: ${acts.map((a) => `${a.sessions} ${a.label.toLowerCase()}`).join(", ")}, sharpness ${(acts.reduce((n, a) => n + a.sharpness * a.sessions, 0) / total).toFixed(1)}/5 on average.`,
        i.performance.pattern,
      ]
        .filter(Boolean)
        .join(" ")
    : i.performance.pattern;

  const l = i.level;
  const levelSummary =
    l.nextName === null
      ? "You hold every level. Keep the habits and it stays."
      : `${l.nextMet} of ${l.nextOf} habits for ${l.nextName}${l.missing.length ? `. Still to do: ${l.missing.slice(0, 2).join("; ")}.` : "."}`;

  // Next week: a missing core input first, as nothing else can be read without it; else the weakest pillar.
  const sleepLogged = i.thisWeek.some((d) => d.sleepMinutes !== null);
  const foodLogged = i.thisWeek.some((d) => d.caloriesEaten > 0);
  const weakest = pillars.filter((p) => p.score !== null).sort((a, b) => a.score! - b.score!)[0];
  const next = !sleepLogged
    ? { pillar: "sleep" as const, title: "Log your sleep", detail: "Sleep is the biggest input to your score. Connect your health app so it fills in by itself." }
    : !foodLogged
      ? { pillar: "glycemic" as const, title: "Log your meals", detail: "A photo of each plate is enough. Food drives both your weight and your focus." }
      : { pillar: weakest?.pillar ?? "sleep", ...NEXT[weakest?.pillar ?? "sleep"] };

  return {
    weekStart: i.weekStart,
    weekEnd: i.weekEnd,
    daysScored: scores.length,
    headline,
    pillars,
    mind: { brain, performance },
    body: i.weight,
    working: i.working,
    level: { level: l.level, name: l.name, summary: levelSummary },
    next,
  };
}
