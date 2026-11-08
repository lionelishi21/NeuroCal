/**
 * The sign-up funnel, for admins: the people who signed up in a week, and how many of them went on
 * to finish onboarding, start a trial (or buy without one) and pay. Each week follows its own sign-ups,
 * so a recent week's later steps still grow while its trials run.
 */
export interface FunnelWeek {
  /** The Monday the week starts on (UTC), YYYY-MM-DD. */
  weekStart: string;
  signedUp: number;
  onboarded: number;
  /** Started a free trial, or bought without one. */
  subscribed: number;
  paid: number;
}

export type FunnelCounts = Omit<FunnelWeek, "weekStart">;

const DAY_MS = 86_400_000;

/** The Monday (UTC) of the week `at` falls in. */
export function mondayOf(at: Date): Date {
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY_MS);
}

/** The last `count` weeks, newest first, with a zero row for any week no one signed up in. */
export function fillWeeks(rows: FunnelWeek[], now: Date, count: number): FunnelWeek[] {
  const byWeek = new Map(rows.map((r) => [r.weekStart, r]));
  const thisWeek = mondayOf(now).getTime();
  return Array.from({ length: count }, (_, i) => {
    const weekStart = new Date(thisWeek - i * 7 * DAY_MS).toISOString().slice(0, 10);
    return byWeek.get(weekStart) ?? { weekStart, signedUp: 0, onboarded: 0, subscribed: 0, paid: 0 };
  });
}

export function totalOf(weeks: FunnelWeek[]): FunnelCounts {
  return weeks.reduce(
    (t, w) => ({ signedUp: t.signedUp + w.signedUp, onboarded: t.onboarded + w.onboarded, subscribed: t.subscribed + w.subscribed, paid: t.paid + w.paid }),
    { signedUp: 0, onboarded: 0, subscribed: 0, paid: 0 },
  );
}
