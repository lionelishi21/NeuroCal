/**
 * Performance sessions: what someone wants to be sharp for. A block of deep work, a study session,
 * training, creative work or a run of ranked games, each rated for how sharp it felt (1 to 5), with
 * a result where one fits (tasks finished, a practice score, wins and losses). Over a few weeks the
 * sessions are split by what came before them: last night's sleep, caffeine, a meal, the time of day
 * and how long the session ran, and the splits that differ enough say what goes with someone's best
 * sessions. It's their own pattern, not proof of the cause, and the wording keeps it that way.
 */
export const ACTIVITIES = ["deep_work", "study", "training", "creative", "gaming"] as const;
export type Activity = (typeof ACTIVITIES)[number];

export interface ActivityProfile {
  label: string;
  /** How a sentence says it: "You feel sharper {doing} after...". */
  doing: string;
  /** The optional result, for the activities that have one that adds up (gaming has wins and losses instead). */
  result?: { label: string; unit?: string; max: number };
  /** Minutes offered first when logging. */
  usualMinutes: number;
}

export const ACTIVITY: Record<Activity, ActivityProfile> = {
  deep_work: { label: "Deep work", doing: "in deep work", result: { label: "Tasks finished", max: 50 }, usualMinutes: 90 },
  study: { label: "Study", doing: "studying", result: { label: "Practice score", unit: "%", max: 100 }, usualMinutes: 60 },
  training: { label: "Training", doing: "training", usualMinutes: 60 },
  creative: { label: "Creative work", doing: "in creative work", usualMinutes: 60 },
  gaming: { label: "Gaming", doing: "gaming", usualMinutes: 90 },
};

export interface PerformanceSession {
  id: string;
  activity: Activity;
  startedAt: Date;
  minutes: number;
  /** How sharp it felt, 1 (foggy) to 5 (locked in). */
  sharpness: number;
  /** The activity's result (ACTIVITY[activity].result). */
  result?: number;
  /** Gaming: which game, and the ranked results. */
  game?: string;
  wins?: number;
  losses?: number;
  ratingBefore?: number;
  ratingAfter?: number;
}

export const MAX_PERFORMANCE_MINUTES = 720;
export const MAX_GAMES = 200;
export const MAX_RATING = 100_000;
export const MAX_GAME_NAME = 60;
/** How far back the patterns look. */
export const PATTERN_DAYS = 56;
/** Sessions of one activity before patterns are looked for. */
export const MIN_SESSIONS = 6;
/** Sessions on each side of a split. */
export const MIN_GROUP = 3;
/** The smallest difference in average sharpness worth mentioning (on the 1–5 scale). */
export const MIN_SHARPNESS_GAP = 0.5;
/** Games on each side of a split, and the smallest win-rate difference worth mentioning. */
export const MIN_GAMES = 15;
export const MIN_WIN_GAP = 0.08;
/** A last-night sleep score at or above this is a good night. */
export const GOOD_SLEEP = 0.7;
export const LONG_SESSION_MINUTES = 90;

/** What came before a session. */
export interface SessionContext {
  /** Last night's sleep score (0–1), when known. */
  sleep: number | null;
  /** Caffeine 15 minutes to 2 hours before it started. */
  caffeineBefore: boolean;
  /** A proper meal in the 2 hours before it started. */
  mealBefore: boolean;
  /** Local hour it started (0–23). */
  hour: number;
}

export const FACTORS = ["sleep", "caffeine", "meal", "morning", "afternoon", "evening", "short"] as const;
export type Factor = (typeof FACTORS)[number];

const TIME_OF_DAY: readonly Factor[] = ["morning", "afternoon", "evening"];

/** Each factor: whether a session has it (null when unknown), and how a sentence says either side. */
const FACTOR: Record<Factor, { has: (s: PerformanceSession, c: SessionContext) => boolean | null; with: string; without: string }> = {
  sleep: { has: (_, c) => (c.sleep === null ? null : c.sleep >= GOOD_SLEEP), with: "after a good night's sleep", without: "after a poorer night" },
  caffeine: { has: (_, c) => c.caffeineBefore, with: "with caffeine 15 minutes to 2 hours before", without: "without caffeine before" },
  meal: { has: (_, c) => c.mealBefore, with: "with a meal in the 2 hours before", without: "without a meal in the 2 hours before" },
  morning: { has: (_, c) => c.hour < 12, with: "in the morning", without: "later in the day" },
  afternoon: { has: (_, c) => c.hour >= 12 && c.hour < 17, with: "in the afternoon", without: "at other times" },
  evening: { has: (_, c) => c.hour >= 17, with: "in the evening", without: "earlier in the day" },
  short: { has: (s) => s.minutes <= LONG_SESSION_MINUTES, with: `in sessions of ${LONG_SESSION_MINUTES} minutes or less`, without: "in longer sessions" },
};

export interface PerformanceInsight {
  factor: Factor;
  measure: "sharpness" | "win_rate";
  /** Average sharpness (1–5) or win rate (0–1) with the factor and without it. */
  with: number;
  without: number;
  /** Sessions (sharpness) or games (win rate) on each side. */
  countWith: number;
  countWithout: number;
  summary: string;
}

export interface ActivitySummary {
  activity: Activity;
  sessions: number;
  /** Average sharpness, one decimal. */
  sharpness: number;
  /** Gaming: games won and lost, and the rating gained over the sessions that logged both ratings. */
  wins?: number;
  losses?: number;
  ratingChange?: number;
  /** The best result logged, for activities with one. */
  bestResult?: number;
  /** What goes with the best sessions, strongest first; at most three. */
  insights: PerformanceInsight[];
  /** Why there are no patterns to show: too few sessions, or none clear. */
  note?: string;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const one = (n: number) => Math.round(n * 10) / 10;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Sessions of one activity in the pattern window, with what came before each. */
export function summaryOf(activity: Activity, points: { session: PerformanceSession; context: SessionContext }[]): ActivitySummary {
  const p = ACTIVITY[activity];
  const sessions = points.map((x) => x.session);
  const summary: ActivitySummary = {
    activity,
    sessions: sessions.length,
    sharpness: sessions.length ? one(mean(sessions.map((s) => s.sharpness))) : 0,
    insights: [],
  };
  if (activity === "gaming") {
    const played = sessions.filter((s) => s.wins !== undefined || s.losses !== undefined);
    if (played.length) {
      summary.wins = played.reduce((a, s) => a + (s.wins ?? 0), 0);
      summary.losses = played.reduce((a, s) => a + (s.losses ?? 0), 0);
    }
    const rated = sessions.filter((s) => s.ratingBefore !== undefined && s.ratingAfter !== undefined);
    if (rated.length) summary.ratingChange = rated.reduce((a, s) => a + s.ratingAfter! - s.ratingBefore!, 0);
  }
  const results = sessions.flatMap((s) => (s.result === undefined ? [] : [s.result]));
  if (p.result && results.length) summary.bestResult = Math.max(...results);

  if (sessions.length < MIN_SESSIONS) {
    const need = MIN_SESSIONS - sessions.length;
    summary.note = `Log ${plural(need, "more session")} and NeuroCal can show what goes with your best ones.`;
    return summary;
  }

  const found: (PerformanceInsight & { weight: number })[] = [];
  for (const factor of FACTORS) {
    const f = FACTOR[factor];
    const yes = points.filter((x) => f.has(x.session, x.context) === true).map((x) => x.session);
    const no = points.filter((x) => f.has(x.session, x.context) === false).map((x) => x.session);

    if (yes.length >= MIN_GROUP && no.length >= MIN_GROUP) {
      const a = mean(yes.map((s) => s.sharpness));
      const b = mean(no.map((s) => s.sharpness));
      if (Math.abs(a - b) >= MIN_SHARPNESS_GAP) {
        const [hi, lo, phrase, nHi, nLo] = a > b ? [a, b, f.with, yes.length, no.length] : [b, a, f.without, no.length, yes.length];
        found.push({
          factor,
          measure: "sharpness",
          with: one(a),
          without: one(b),
          countWith: yes.length,
          countWithout: no.length,
          summary: `You feel sharper ${p.doing} ${phrase}: ${one(hi)} against ${one(lo)} out of 5 (${plural(nHi, "session")} against ${nLo}).`,
          weight: Math.abs(a - b) / 4,
        });
      }
    }

    if (activity === "gaming") {
      const games = (xs: PerformanceSession[]) => {
        const w = xs.reduce((n, s) => n + (s.wins ?? 0), 0);
        const l = xs.reduce((n, s) => n + (s.losses ?? 0), 0);
        return { rate: w + l ? w / (w + l) : 0, games: w + l };
      };
      const a = games(yes);
      const b = games(no);
      if (a.games >= MIN_GAMES && b.games >= MIN_GAMES && Math.abs(a.rate - b.rate) >= MIN_WIN_GAP) {
        const [hi, lo, phrase] = a.rate > b.rate ? [a, b, f.with] : [b, a, f.without];
        found.push({
          factor,
          measure: "win_rate",
          with: Math.round(a.rate * 100) / 100,
          without: Math.round(b.rate * 100) / 100,
          countWith: a.games,
          countWithout: b.games,
          summary: `You win more ${phrase}: ${pct(hi.rate)} against ${pct(lo.rate)} of games (${hi.games} games against ${lo.games}).`,
          weight: Math.abs(a.rate - b.rate),
        });
      }
    }
  }

  // One time of day per measure: the best one. "Morning" and "later in the day" say the same thing as
  // "evening" and "earlier", so only the strongest time split is kept.
  const kept = found
    .sort((a, b) => b.weight - a.weight)
    .filter((x, i, all) => !TIME_OF_DAY.includes(x.factor) || all.findIndex((y) => y.measure === x.measure && TIME_OF_DAY.includes(y.factor)) === i);
  summary.insights = kept.slice(0, 3).map(({ weight: _, ...x }) => x);
  if (!summary.insights.length) {
    summary.note = "No clear pattern yet: your sessions go about as well whatever came before them. Keep logging and it may show.";
  }
  return summary;
}
