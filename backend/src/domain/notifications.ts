/**
 * Notifications the server sends (docs/NCBM.md §10): which kinds there are, when in the person's day
 * each may go, and what each says. The phone schedules its own reminders; these are the ones that
 * depend on what only the server knows.
 */

export const PUSH_KINDS = ["focusScore", "levelUp", "levelAtRisk", "airQuality", "newRoutine", "comeBack", "goalWeight", "trialEnding", "productNews"] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

export const EMAIL_KINDS = ["weekly", "comeBack"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export interface NotificationPrefs {
  weeklyReport: boolean;
  comeBackEmail: boolean;
  push: Record<PushKind, boolean>;
}

/** Promotional, so off until switched on (app store rules on marketing pushes). */
export const OFF_UNTIL_ASKED: readonly PushKind[] = ["productNews"];

/** Everything but [OFF_UNTIL_ASKED] on: someone who never changed a setting. */
export function prefsOf(stored?: { weeklyReport?: boolean; comeBackEmail?: boolean; push?: Partial<Record<string, boolean>> } | null): NotificationPrefs {
  const push = Object.fromEntries(PUSH_KINDS.map((k) => [k, stored?.push?.[k] ?? !OFF_UNTIL_ASKED.includes(k)])) as Record<PushKind, boolean>;
  return { weeklyReport: stored?.weeklyReport ?? true, comeBackEmail: stored?.comeBackEmail ?? true, push };
}

/** What a tap on the notification opens in the app (mobile reminders.dart payloads); none opens Today. */
export type PushOpen = "week" | "stack";

export interface PushMessage {
  title: string;
  body: string;
  open?: PushOpen;
}

/** Local hours [from, to) each kind may go out in: daytime only, so quiet hours never need checking. */
export const PUSH_HOURS: Record<Exclude<PushKind, "trialEnding">, readonly [number, number]> = {
  airQuality: [7, 10],
  focusScore: [8, 12],
  goalWeight: [9, 21],
  newRoutine: [10, 20],
  comeBack: [10, 20],
  productNews: [10, 20],
  levelUp: [18, 21],
  levelAtRisk: [18, 21],
};

export const inHours = (hour: number, [from, to]: readonly [number, number]) => hour >= from && hour < to;

/** Above this the air is unhealthy for everyone (US AQI). */
export const UNHEALTHY_AQI = 100;

/** Days away before the push, and before the email. */
export const AWAY_PUSH_DAYS = 3;
export const AWAY_EMAIL_DAYS = 7;

/** Days a newly approved routine stays news. */
export const NEW_ROUTINE_DAYS = 3;

/** Days a new MitoProof product stays news. */
export const NEW_PRODUCT_DAYS = 7;

/** Wednesday: early enough in the week to rescue a slipping level. */
export const AT_RISK_WEEKDAY = 3;

const firstSentence = (text: string, max = 140) => {
  const s = text.split(/(?<=[.!?])\s/)[0]!.trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
};

export const focusScoreMessage = (score: number, explanation: string): PushMessage => ({
  title: `Your Focus Score today: ${score}`,
  body: firstSentence(explanation),
});

export const airMessage = (aqi: number, place: string): PushMessage => ({
  title: `Air quality is unhealthy today (AQI ${aqi})`,
  body: `In ${place.split(",")[0]}: keep windows shut and move your workout indoors.`,
});

export const levelUpMessage = (level: number, name: string, nextName?: string): PushMessage => ({
  title: `You reached Level ${level}: ${name}`,
  body: nextName ? `Four weeks of habits earned it. See what Level ${level + 1}, ${nextName}, takes.` : "The top of the ladder. Keep the habits that got you here.",
  open: "week",
});

export const levelAtRiskMessage = (level: number, why: string): PushMessage => ({
  title: `Your Level ${level} is at risk`,
  body: `${why}. A few good days this week keep it.`,
  open: "week",
});

export const newRoutineMessage = (title: string, summary: string): PushMessage => ({
  title: `New routine: ${title}`,
  body: firstSentence(summary),
});

export const comeBackMessage = (): PushMessage => ({
  title: "Pick up where you left off",
  body: "Log one meal or do a check-in today and your streak starts again.",
});

export const goalWeightMessage = (targetKg: number): PushMessage => ({
  title: "You reached your goal weight",
  body: `Your trend is at ${targetKg} kg. Set a new goal, or switch to keeping it.`,
});

export const trialEndingMessage = (day: string): PushMessage => ({
  title: `Your free trial ends on ${day}`,
  body: "Staying? Nothing to do. To cancel, use your app store's subscriptions before then.",
});

/** Whole days between two YYYY-MM-DD dates. */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** A new MitoProof product that matches one of the person's weak points ([area], a weak point label). */
export const productNewsMessage = (name: string, area: string | null): PushMessage => ({
  title: `New from our brand: ${name}`,
  body: area ? `Picked for you: it's made for ${area}, which held your score back this week. Sold by MitoProof.` : "Picked for your goals. Sold by MitoProof, which makes NeuroCal.",
});
