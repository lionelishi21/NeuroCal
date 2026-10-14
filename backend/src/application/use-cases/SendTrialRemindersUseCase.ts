import type { IClock } from "../interfaces/IClock";
import type { IEmailSender } from "../interfaces/IEmailSender";
import type { EndingTrial, ISubscriptionRepository } from "../interfaces/ISubscriptions";

const HOUR_MS = 3_600_000;

/**
 * Emails people two days before their free trial turns into a paid subscription, with how to
 * cancel. Runs every hour; each trial end gets one email. Fewer surprise charges means fewer refunds
 * and angry reviews.
 */
export class SendTrialRemindersUseCase {
  constructor(
    private readonly subscriptions: ISubscriptionRepository,
    private readonly email: IEmailSender,
    private readonly clock: IClock,
  ) {}

  async execute(): Promise<{ sent: number; failed: number }> {
    if (!this.email.enabled) return { sent: 0, failed: 0 };
    const now = this.clock.now().getTime();
    const ending = await this.subscriptions.trialsEndingBetween(new Date(now + 24 * HOUR_MS), new Date(now + 48 * HOUR_MS));
    let sent = 0;
    let failed = 0;
    for (const trial of ending) {
      try {
        await this.email.send(reminderFor(trial));
        await this.subscriptions.markTrialReminded(trial.userId, trial.endsAt);
        sent++;
      } catch {
        // Not marked: the next hourly run tries again while the trial is still in the window.
        failed++;
      }
    }
    return { sent, failed };
  }
}

export function reminderFor(trial: EndingTrial) {
  const day = trial.endsAt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: trial.timeZone });
  return {
    to: trial.email,
    subject: `Your NeuroCal trial ends on ${day}`,
    text: [
      "Hi,",
      "",
      `A reminder that your free trial of NeuroCal ends on ${day}.`,
      "",
      "To keep going, there's nothing to do: your subscription starts then, at the price you saw when you started the trial.",
      "",
      "If you'd rather not continue, cancel before then and you won't be charged:",
      "- iPhone: Settings > your name > Subscriptions > NeuroCal",
      "- Android: Google Play > your profile > Payments & subscriptions > Subscriptions > NeuroCal",
      "",
      "Deleting the app doesn't cancel the subscription.",
      "",
      "NeuroCal",
    ].join("\n"),
  };
}
