import { createSign } from "node:crypto";
import type { IPushSender } from "../../application/interfaces/IPushSender";
import type { PushMessage } from "../../domain/notifications";

type Fetch = typeof fetch;

/** The fields used from a Firebase service account key (Project settings → Service accounts). */
export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

/** The Android channel server pushes arrive on (mobile-app AndroidManifest.xml and push.dart). */
export const ANDROID_CHANNEL = "neurocal_news";

const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const base64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

/** Reads FIREBASE_SERVICE_ACCOUNT: the key file's JSON. Null when it isn't a usable key. */
export function parseServiceAccount(json: string | undefined): ServiceAccount | null {
  if (!json) return null;
  try {
    const key = JSON.parse(json) as Partial<ServiceAccount>;
    return key.project_id && key.client_email && key.private_key ? { project_id: key.project_id, client_email: key.client_email, private_key: key.private_key } : null;
  } catch {
    return null;
  }
}

/**
 * Sends through Firebase Cloud Messaging's HTTP v1 API (https://firebase.google.com/docs/cloud-messaging/send-message),
 * which reaches iPhones through Apple's push service too. Signs its own OAuth token from the service
 * account with Node's crypto, so there's no Google SDK to bundle; the token is kept for most of its hour.
 */
export class FcmPushSender implements IPushSender {
  readonly enabled = true;
  private token: { value: string; until: number } | null = null;

  constructor(private readonly options: { account: ServiceAccount; fetch?: Fetch; now?: () => number }) {}

  private get fetch() {
    return this.options.fetch ?? fetch;
  }

  private async accessToken(): Promise<string> {
    const now = this.options.now?.() ?? Date.now();
    if (this.token && this.token.until > now) return this.token.value;
    const { account } = this.options;
    const issued = Math.floor(now / 1000);
    const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(
      JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: issued, exp: issued + 3600 }),
    )}`;
    const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key);
    const response = await this.fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${base64url(signature)}` }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Google sign-in for push answered ${response.status}`);
    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new Error("Google sign-in for push gave no token");
    // Renewed five minutes early, so a token never expires mid-run.
    this.token = { value: body.access_token, until: now + ((body.expires_in ?? 3600) - 300) * 1000 };
    return body.access_token;
  }

  async send(token: string, message: PushMessage): Promise<"sent" | "gone"> {
    const response = await this.fetch(`https://fcm.googleapis.com/v1/projects/${this.options.account.project_id}/messages:send`, {
      method: "POST",
      headers: { authorization: `Bearer ${await this.accessToken()}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: message.title, body: message.body },
          ...(message.open ? { data: { open: message.open } } : {}),
          android: { priority: "high", notification: { channel_id: ANDROID_CHANNEL } },
          apns: { payload: { aps: { sound: "default" } } },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) return "sent";
    // The app was removed or signed out (its token deleted): forget the token.
    if (response.status === 404) return "gone";
    const text = await response.text().catch(() => "");
    if (response.status === 400 && /UNREGISTERED|registration token/i.test(text)) return "gone";
    // The body may echo the token, so only the status goes into the error.
    throw new Error(`Firebase Cloud Messaging answered ${response.status}`);
  }
}

/** Push switched off: used until a Firebase key is configured. Nothing is sent and nothing fails. */
export const noPush: IPushSender = {
  enabled: false,
  async send() {
    return "sent";
  },
};
