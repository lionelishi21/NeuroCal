import type { PushMessage } from "../../domain/notifications";

/** Push notifications to phones (Firebase Cloud Messaging, which also delivers to iPhones). */
export interface IPushSender {
  /** False when push isn't set up: nothing is sent and nothing fails. */
  readonly enabled: boolean;
  /** "gone" when the token is no longer valid and should be forgotten. */
  send(token: string, message: PushMessage): Promise<"sent" | "gone">;
}
