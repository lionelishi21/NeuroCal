/**
 * Gadgets and practices: a sauna, a cold plunge, ten minutes of meditation, blue-blocking glasses in
 * the evening. Each is logged as a session, and each is tested the way its use suits: they happen on
 * some days and not others, so the days after a session are compared with the days without one, on
 * the measure that fits (domain/experiment.ts). Logging one adds no points, with one exception that
 * is an input rather than a reward: blue-blocking glasses worn in the evening take the light out of
 * late screens, so they halve that cost in the Focus Score's evening timing.
 */
import { type Evidence, type Experiment, type Measure, MIN_DAYS, type Purpose, measureFor } from "./experiment";

export const SESSION_KINDS = ["sauna", "cold_plunge", "meditation", "breathwork", "braintap", "blue_blocking", "red_light"] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

export interface SessionKindProfile {
  label: string;
  purpose: Purpose;
  evidence: Evidence;
  /** What to expect, honestly sized. */
  expectation: string;
  /** Minutes offered first when logging. */
  usualMinutes: number;
  /** Days from a session to the day its effect shows: 1 for sleep (the night after), else the same day. */
  lagDays: number;
}

export const SESSION_KIND: Record<SessionKind, SessionKindProfile> = {
  sauna: {
    label: "Sauna",
    purpose: "sleep",
    evidence: "some",
    expectation: "Many people sleep more deeply the night after; regular use is linked to a healthier heart. Drink water and skip it after alcohol.",
    usualMinutes: 20,
    lagDays: 1,
  },
  cold_plunge: {
    label: "Cold plunge",
    purpose: "energy",
    evidence: "early",
    expectation: "A sharp lift in alertness and mood for a few hours; longer-term effects are less clear. Start with 1 to 2 minutes, and not if you have a heart condition.",
    usualMinutes: 3,
    lagDays: 0,
  },
  meditation: {
    label: "Meditation",
    purpose: "stress",
    evidence: "strong",
    expectation: "Lower stress and steadier attention with regular practice; ten minutes a day is enough to start.",
    usualMinutes: 10,
    lagDays: 0,
  },
  breathwork: {
    label: "Breathwork",
    purpose: "stress",
    evidence: "some",
    expectation: "Slow breathing (about six breaths a minute) calms you within minutes and can lower stress over weeks.",
    usualMinutes: 5,
    lagDays: 0,
  },
  braintap: {
    label: "BrainTap",
    purpose: "stress",
    evidence: "early",
    expectation: "Guided light-and-sound sessions for relaxing; small studies so far, so your own numbers matter most.",
    usualMinutes: 20,
    lagDays: 0,
  },
  blue_blocking: {
    label: "Blue-blocking glasses",
    purpose: "sleep",
    evidence: "some",
    expectation: "Worn for the last hour or two before bed, they keep screens and bright rooms from delaying your sleep. They halve the cost of late screens in your score.",
    usualMinutes: 120,
    lagDays: 1,
  },
  red_light: {
    label: "Red light",
    purpose: "sleep",
    evidence: "early",
    expectation: "Dim red light in the evening doesn't hold back sleep the way white light does; claims beyond that are early.",
    usualMinutes: 15,
    lagDays: 1,
  },
};

export interface Session {
  id: string;
  kind: SessionKind;
  takenAt: Date;
  minutes?: number;
}

export const MAX_SESSION_MINUTES = 600;

const LABEL: Record<Measure, string> = { brain_speed: "Brain speed", sleep: "sleep score", stress: "stress score" };
/** The smallest difference worth calling, as for supplements. */
const MIN_CHANGE: Record<Measure, number> = { brain_speed: 3, sleep: 5, stress: 10 };
/** How far back "days without" reaches. */
export const COMPARE_DAYS = 56;

const DAY_MS = 86_400_000;
const dayIndex = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
const dateOf = (i: number) => new Date(i * DAY_MS).toISOString().slice(0, 10);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};

/**
 * Days after a session against days without one. [sessionDays]: local dates with a session;
 * [series]: the measure by local date (0–100); [today]: local date. The shape is a supplement's
 * Experiment: "before" is the days without, "since" the days with.
 */
export function sessionExperimentOf(o: { kind: SessionKind; sessionDays: string[]; series: Map<string, number>; today: string }): Experiment {
  const k = SESSION_KIND[o.kind];
  const measure = measureFor(k.purpose)!;
  const label = LABEL[measure];
  const days = [...new Set(o.sessionDays)].sort();
  const first = days[0] ?? o.today;
  const day = dayIndex(o.today) - dayIndex(first) + 1;
  // Each session's effect day: the day itself, or the next for sleep.
  const withDays = new Set(days.map((d) => dateOf(dayIndex(d) + k.lagDays)));
  const from = dayIndex(o.today) - COMPARE_DAYS;
  const inRange = [...o.series.entries()].filter(([d]) => dayIndex(d) > from && dayIndex(d) <= dayIndex(o.today));
  const withValues = inRange.filter(([d]) => withDays.has(d)).map(([, v]) => v);
  const withoutValues = inRange.filter(([d]) => !withDays.has(d)).map(([, v]) => v);
  const stat = (xs: number[]) => (xs.length ? { mean: Math.round(mean(xs) * 10) / 10, days: xs.length } : null);
  const base = { measure, day, onsetDays: 0, before: stat(withoutValues), since: stat(withValues), taken: null, askFeeling: false, feeling: null };
  const after = k.lagDays ? `after a ${k.label.toLowerCase()} session` : `with a ${k.label.toLowerCase()} session`;
  const name = k.label.toLowerCase();
  if (withValues.length < MIN_DAYS || withoutValues.length < MIN_DAYS) {
    const need = Math.max(0, MIN_DAYS - withValues.length);
    return {
      ...base,
      change: null,
      verdict: "too_early",
      summary:
        withValues.length < MIN_DAYS
          ? `${need} more ${need === 1 ? "day" : "days"} ${after}, with your ${label} logged, and NeuroCal can compare them with days without.`
          : `NeuroCal needs a few more days without ${name} to compare with.`,
    };
  }
  const change = Math.round((mean(withValues) - mean(withoutValues)) * 10) / 10;
  const real = Math.abs(change) >= Math.max(MIN_CHANGE[measure], 0.5 * sd(withoutValues));
  const verdict = !real ? "no_change" : change > 0 ? "helping" : "worse";
  const days_ = k.lagDays ? "nights" : "days";
  const r = (n: number) => Math.round(n);
  const compare = `${r(mean(withValues))} on ${days_} ${after}, against ${r(mean(withoutValues))} on other ${days_} (${withValues.length} vs ${withoutValues.length})`;
  return {
    ...base,
    change,
    verdict,
    summary:
      verdict === "helping"
        ? `Your ${label} is higher: ${compare}.`
        : verdict === "worse"
          ? `Your ${label} is lower: ${compare}. Try a different time of day or a shorter session.`
          : `No clear difference in your ${label}: ${compare}.`,
  };
}
