import type { EmailKind, NotificationPrefs, PushKind } from "../../domain/notifications";

/** Someone the weekly report email may go to: weekly report on, with a profile, account not deleted. */
export interface WeeklyRecipient {
  userId: string;
  email: string;
  timeZone: string;
  /** The Monday of the last week emailed; null before the first. */
  sentFor: string | null;
}

/** Someone the notification job looks at: a profile, an account not deleted, and at least one phone. */
export interface NotificationRecipient {
  userId: string;
  email: string;
  /** What they asked to be called. */
  name: string;
  timeZone: string;
  prefs: NotificationPrefs;
  /** Their phones' push tokens. */
  tokens: string[];
  /** When the app last started on any of their phones. */
  lastSeenAt: Date;
  /** The level last seen by the job; null before the first look. */
  lastLevel: number | null;
  /** Notifications sent in the last [RECENT_DAYS] days. */
  recent: { key: string; sentAt: Date }[];
}

/** How far back [NotificationRecipient.recent] goes: enough for a week's once-only keys. */
export const RECENT_DAYS = 10;

export interface NotificationPrefsChange {
  weeklyReport?: boolean;
  comeBackEmail?: boolean;
  push?: Partial<Record<PushKind, boolean>>;
}

/** Scoped to one user (ARCHITECTURE §10), except the unsubscribe link and the jobs' lists. */
export interface INotificationSettingsRepository {
  /** Everything on for someone without a row. */
  get(userId: string): Promise<NotificationPrefs>;
  /** Changes only what's given; push kinds left out keep their setting. */
  save(userId: string, change: NotificationPrefsChange): Promise<void>;
  /** The user's unsubscribe token, saving [fresh] as it when there's none yet. */
  tokenFor(userId: string, fresh: string): Promise<string>;
  /** Switches that email off for the token's owner; an unknown token does nothing. */
  unsubscribe(token: string, from: EmailKind): Promise<void>;
  weeklyRecipients(): Promise<WeeklyRecipient[]>;
  markWeeklySent(userId: string, weekStart: string): Promise<void>;

  /** Saves a phone for [userId] as seen [at]; a token another account had moves to this one. */
  saveDevice(userId: string, device: { token: string; platform: "android" | "ios" }, at: Date): Promise<void>;
  /** Drops a token Firebase no longer accepts (the app was removed, or signed out). */
  removeDevice(token: string): Promise<void>;
  devicesOf(userId: string): Promise<string[]>;
  /** The phones of the account signed in with [email] (the ops test push). */
  devicesOfEmail(email: string): Promise<string[]>;
  notificationRecipients(): Promise<NotificationRecipient[]>;
  /** Records [key] as sent; false when it already was, so each notification goes once. */
  claim(userId: string, key: string, at: Date): Promise<boolean>;
  setLastLevel(userId: string, level: number): Promise<void>;
}
