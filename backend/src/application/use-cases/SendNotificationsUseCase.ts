import { comeBackEmail, goalWeightEmail } from "../email/templates";
import { LEVEL_NAMES, type LevelDay, slippingOf } from "../../domain/levels";
import { localDateOf, localTimeOf } from "../../domain/localDay";
import {
  AT_RISK_WEEKDAY,
  AWAY_EMAIL_DAYS,
  AWAY_PUSH_DAYS,
  NEW_PRODUCT_DAYS,
  NEW_ROUTINE_DAYS,
  PUSH_HOURS,
  type PushKind,
  type PushMessage,
  UNHEALTHY_AQI,
  airMessage,
  comeBackMessage,
  daysBetween,
  focusScoreMessage,
  goalWeightMessage,
  inHours,
  levelAtRiskMessage,
  levelUpMessage,
  newRoutineMessage,
  productNewsMessage,
} from "../../domain/notifications";
import type { IClock } from "../interfaces/IClock";
import type { IEmailSender } from "../interfaces/IEmailSender";
import type { INotificationSettingsRepository, NotificationRecipient } from "../interfaces/INotificationSettings";
import type { IPushSender } from "../interfaces/IPushSender";

/** At most this many server pushes a day, on top of the phone's own reminders. */
export const SERVER_DAILY_LIMIT = 2;

const DAY_MS = 86_400_000;

/** What the job reads, each from the use case the app itself reads it from (presentation/compose.ts). */
export interface NotificationSources {
  /** Today's score, and whether last night's sleep is in it yet. */
  focusScore(userId: string): Promise<{ score: number | null; sleepIn: boolean; explanation: string }>;
  level(userId: string): Promise<{ level: number; name: string; days: LevelDay[] }>;
  /** Today's air where the person set their town; null without a town or a reading. */
  air(userId: string): Promise<{ aqi: number; place: string } | null>;
  /** Routines approved in the knowledge pipeline since [since]. */
  newRoutines(since: Date): Promise<{ id: string; title: string; summary: string }[]>;
  /** The goal, once the weight trend has reached it; null otherwise or without a goal. */
  goalReached(userId: string): Promise<{ targetKg: number } | null>;
  /** Our brand's products added since [since]. */
  newOwnProducts(since: Date): Promise<{ id: string; name: string }[]>;
  /** The products the app recommends this person now, and the weak point they're for (GetProtocolsUseCase). */
  recommendedProducts(userId: string): Promise<{ ids: string[]; area: string | null }>;
}

/** Log keys that mark a check or an email, not a push, so the daily limit doesn't count them. */
const MARKER = "_";
const EMAIL = "mail:";

export interface NotificationsResult {
  pushed: number;
  emailed: number;
  failed: number;
}

/**
 * The server's notifications (docs/NCBM.md §10): each one at the person's own time, in daytime
 * only, once (the notification log), and at most [SERVER_DAILY_LIMIT] pushes a day. Runs every hour.
 * A notification is logged before it's sent, so a failed send is lost rather than repeated.
 */
export class SendNotificationsUseCase {
  constructor(
    private readonly settings: INotificationSettingsRepository,
    private readonly sources: NotificationSources,
    private readonly push: IPushSender,
    private readonly email: IEmailSender,
    private readonly clock: IClock,
    private readonly config: { webUrl: string; newToken: () => string },
  ) {}

  async execute(): Promise<NotificationsResult> {
    const result = { pushed: 0, emailed: 0, failed: 0 };
    if (!this.push.enabled && !this.email.enabled) return result;
    const now = this.clock.now();
    const recipients = await this.settings.notificationRecipients();
    if (recipients.length === 0) return result;
    const [routines, products] = await Promise.all([
      this.sources.newRoutines(new Date(now.getTime() - NEW_ROUTINE_DAYS * DAY_MS)),
      this.sources.newOwnProducts(new Date(now.getTime() - NEW_PRODUCT_DAYS * DAY_MS)),
    ]);
    for (const r of recipients) {
      try {
        await this.notify(r, now, { routines, products }, result);
      } catch {
        result.failed++;
      }
    }
    return result;
  }

  private async notify(
    r: NotificationRecipient,
    now: Date,
    { routines, products }: { routines: { id: string; title: string; summary: string }[]; products: { id: string; name: string }[] },
    result: NotificationsResult,
  ) {
    const today = localDateOf(now, r.timeZone);
    const hour = localTimeOf(now, r.timeZone).hour;
    const sent = new Set(r.recent.map((s) => s.key));
    let pushedToday = r.recent.filter((s) => !s.key.startsWith(MARKER) && !s.key.startsWith(EMAIL) && localDateOf(s.sentAt, r.timeZone) === today).length;

    const can = (kind: Exclude<PushKind, "trialEnding">) =>
      this.push.enabled && r.prefs.push[kind] && r.tokens.length > 0 && inHours(hour, PUSH_HOURS[kind]) && pushedToday < SERVER_DAILY_LIMIT;
    const pushOnce = async (key: string, message: PushMessage) => {
      if (sent.has(key) || !(await this.settings.claim(r.userId, key, now))) return;
      sent.add(key);
      pushedToday++;
      await this.sendPush(r.tokens, message);
      result.pushed++;
    };
    const emailOnce = async (key: string, send: () => Promise<void>) => {
      if (sent.has(key) || !(await this.settings.claim(r.userId, key, now))) return;
      sent.add(key);
      await send();
      result.emailed++;
    };

    // Milestones first: they're rarest and most welcome.
    if (inHours(hour, PUSH_HOURS.goalWeight) && (can("goalWeight") || this.email.enabled) && r.prefs.push.goalWeight) {
      const goal = await this.sources.goalReached(r.userId);
      if (goal) {
        if (can("goalWeight")) await pushOnce(`goal:${goal.targetKg}`, goalWeightMessage(goal.targetKg));
        if (this.email.enabled) await emailOnce(`${EMAIL}goal:${goal.targetKg}`, () => this.email.send({ to: r.email, ...goalWeightEmail({ to: r.email, targetKg: goal.targetKg }) }));
      }
    }

    // The level once a day, in the evening: a level-up is told, and on Wednesdays a slipping habit.
    const levelKey = `${MARKER}level:${today}`;
    if (this.push.enabled && r.tokens.length > 0 && inHours(hour, PUSH_HOURS.levelUp) && !sent.has(levelKey) && (await this.settings.claim(r.userId, levelKey, now))) {
      sent.add(levelKey);
      const { level, name, days } = await this.sources.level(r.userId);
      if (level !== r.lastLevel) await this.settings.setLastLevel(r.userId, level);
      // The first look only notes the level: it was earned before notifications began.
      if (r.lastLevel !== null && level > r.lastLevel) {
        if (can("levelUp")) await pushOnce(`level:${level}:${today}`, levelUpMessage(level, name, LEVEL_NAMES[level + 1]));
      } else if (weekdayOf(today) === AT_RISK_WEEKDAY && can("levelAtRisk")) {
        const why = slippingOf(days, level);
        if (why) await pushOnce(`risk:${today}`, levelAtRiskMessage(level, why));
      }
    }

    if (can("focusScore") && !sent.has(`score:${today}`)) {
      const focus = await this.sources.focusScore(r.userId);
      if (focus.score !== null && focus.sleepIn) await pushOnce(`score:${today}`, focusScoreMessage(focus.score, focus.explanation));
    }

    if (can("airQuality") && !sent.has(`air:${today}`)) {
      const air = await this.sources.air(r.userId);
      if (air && air.aqi > UNHEALTHY_AQI) await pushOnce(`air:${today}`, airMessage(air.aqi, air.place));
    }

    // Away: one push after 3 days, one email after 7, keyed by the day last seen so they never repeat.
    const seen = localDateOf(r.lastSeenAt, r.timeZone);
    const away = daysBetween(seen, today);
    if (away >= AWAY_PUSH_DAYS && can("comeBack")) await pushOnce(`away:${seen}`, comeBackMessage());
    if (away >= AWAY_EMAIL_DAYS && r.prefs.comeBackEmail && this.email.enabled && inHours(hour, PUSH_HOURS.comeBack)) {
      await emailOnce(`${EMAIL}away:${seen}`, async () => {
        const token = await this.settings.tokenFor(r.userId, this.config.newToken());
        const unsubscribeUrl = `${this.config.webUrl.replace(/\/+$/, "")}/unsubscribe?token=${encodeURIComponent(token)}&from=comeBack`;
        await this.email.send({ to: r.email, ...comeBackEmail({ to: r.email, name: r.name, unsubscribeUrl }), unsubscribeUrl });
      });
    }

    // Someone away hears only that they're missed.
    if (away < AWAY_PUSH_DAYS && can("newRoutine")) {
      const routine = routines.find((x) => !sent.has(`routine:${x.id}`));
      if (routine) await pushOnce(`routine:${routine.id}`, newRoutineMessage(routine.title, routine.summary));
    }

    // Product news (opt-in): a new MitoProof product, only when it's among this person's own recommendations.
    // Looked at once a day: the recommendation costs an embedding call.
    const fresh = products.filter((x) => !sent.has(`product:${x.id}`));
    const productKey = `${MARKER}products:${today}`;
    if (away < AWAY_PUSH_DAYS && fresh.length > 0 && can("productNews") && !sent.has(productKey) && (await this.settings.claim(r.userId, productKey, now))) {
      sent.add(productKey);
      const picked = await this.sources.recommendedProducts(r.userId);
      const match = fresh.find((x) => picked.ids.includes(x.id));
      if (match) await pushOnce(`product:${match.id}`, productNewsMessage(match.name, picked.area));
    }
  }

  /** Ops check (lambda.ts `test-push` job): one push to the phones of the account with [email]. */
  async test(email: string): Promise<{ phones: number }> {
    const tokens = await this.settings.devicesOfEmail(email);
    await this.sendPush(tokens, { title: "Notifications are on", body: "This is a test from NeuroCal. Your morning score and level news will arrive like this." });
    return { phones: tokens.length };
  }

  /** To each of the person's phones; a token Firebase refuses is forgotten. */
  private async sendPush(tokens: string[], message: PushMessage) {
    for (const token of tokens) {
      if ((await this.push.send(token, message)) === "gone") await this.settings.removeDevice(token);
    }
  }
}

const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
