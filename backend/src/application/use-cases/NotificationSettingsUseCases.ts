import type { EmailKind } from "../../domain/notifications";
import type { IClock } from "../interfaces/IClock";
import type { INotificationSettingsRepository, NotificationPrefsChange } from "../interfaces/INotificationSettings";

/** Which optional notifications and emails someone gets (Me → Notifications), their phones, and the link that stops an email. */
export class NotificationSettingsUseCases {
  constructor(
    private readonly settings: INotificationSettingsRepository,
    private readonly clock: IClock,
  ) {}

  get(userId: string) {
    return this.settings.get(userId);
  }

  async save(userId: string, change: NotificationPrefsChange) {
    await this.settings.save(userId, change);
    return this.settings.get(userId);
  }

  /** Called at every app start, so it also says when the person was last seen. */
  async registerDevice(userId: string, device: { token: string; platform: "android" | "ios" }): Promise<void> {
    await this.settings.saveDevice(userId, device, this.clock.now());
  }

  /** An email's link. An unknown token is answered like a known one. */
  async unsubscribe(token: string, from: EmailKind = "weekly"): Promise<void> {
    await this.settings.unsubscribe(token, from);
  }
}
