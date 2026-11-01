import { type OwnPick, weeklyReportEmail } from "../email/templates";
import { localDateOf, localTimeOf } from "../../domain/localDay";
import { addDays } from "../../domain/weight";
import type { IClock } from "../interfaces/IClock";
import type { IEmailSender } from "../interfaces/IEmailSender";
import type { INotificationSettingsRepository } from "../interfaces/INotificationSettings";
import type { GetWeeklyReportUseCase } from "./GetWeeklyReportUseCase";

/** Monday from this hour, local time: the same as the app's weekly report notification. */
const SEND_FROM_HOUR = 8;

/**
 * Emails last week's report on Monday morning in each person's own time zone. Runs every hour; a run
 * that's missed is made up later that Monday, and each week goes out once. Weeks without a single
 * Focus Score are skipped: an empty report isn't worth an email.
 */
export class SendWeeklyEmailsUseCase {
  constructor(
    private readonly settings: INotificationSettingsRepository,
    private readonly reports: Pick<GetWeeklyReportUseCase, "execute">,
    private readonly email: IEmailSender,
    private readonly clock: IClock,
    private readonly config: { webUrl: string; newToken: () => string },
    /** One of our brand's products for the week's weakest area; the email goes without it if this fails. */
    private readonly ownPick?: (userId: string) => Promise<OwnPick | null>,
  ) {}

  async execute(): Promise<{ sent: number; skipped: number; failed: number }> {
    const result = { sent: 0, skipped: 0, failed: 0 };
    if (!this.email.enabled) return result;
    const now = this.clock.now();
    for (const r of await this.settings.weeklyRecipients()) {
      const today = localDateOf(now, r.timeZone);
      const monday = new Date(`${today}T12:00:00Z`).getUTCDay() === 1;
      if (!monday || localTimeOf(now, r.timeZone).hour < SEND_FROM_HOUR) continue;
      const weekStart = addDays(today, -7);
      if (r.sentFor === weekStart) continue;
      try {
        const report = await this.reports.execute(r.userId);
        if (report.daysScored > 0) {
          const token = await this.settings.tokenFor(r.userId, this.config.newToken());
          const unsubscribeUrl = `${this.config.webUrl.replace(/\/+$/, "")}/unsubscribe?token=${encodeURIComponent(token)}&from=weekly`;
          const pick = this.ownPick ? await this.ownPick(r.userId).catch(() => null) : null;
          await this.email.send({ to: r.email, ...weeklyReportEmail({ to: r.email, unsubscribeUrl, report, pick }), unsubscribeUrl });
          result.sent++;
        } else {
          result.skipped++;
        }
        await this.settings.markWeeklySent(r.userId, weekStart);
      } catch {
        // Not marked: the next hourly run tries again while it's still Monday.
        result.failed++;
      }
    }
    return result;
  }
}
