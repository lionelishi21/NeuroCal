import { SendTrialRemindersUseCase } from "../application/use-cases/SendTrialRemindersUseCase";
import { applyAwsSecrets } from "../infrastructure/aws/secrets";
import { loadConfig } from "../infrastructure/config";
import { errorReporterFor, reportingErrors } from "../infrastructure/monitoring/SentryErrorReporter";
import { createDatabase } from "../infrastructure/database/client";
import { DrizzleNotificationSettingsRepository, DrizzleSubscriptionRepository } from "../infrastructure/database/DrizzleRepositories";
import { FcmPushSender, parseServiceAccount } from "../infrastructure/push/FcmPushSender";
import { ResendEmailSender, noEmail } from "../infrastructure/email/ResendEmailSender";
import { systemClock } from "./compose";

/** Runs every hour (infra: TrialReminders schedule): emails trials ending in two days, and pushes to their phones. */
async function run() {
  await applyAwsSecrets();
  const config = loadConfig();
  if (!config.databaseUrl) throw new Error("Missing required setting DATABASE_URL");
  const email = config.resendApiKey ? new ResendEmailSender({ apiKey: config.resendApiKey, from: config.emailFrom }) : noEmail;
  const db = createDatabase(config.databaseUrl);
  const firebase = parseServiceAccount(config.firebaseServiceAccount);
  const push = firebase ? { settings: new DrizzleNotificationSettingsRepository(db), sender: new FcmPushSender({ account: firebase }) } : undefined;
  const result = await new SendTrialRemindersUseCase(new DrizzleSubscriptionRepository(db), email, systemClock, push).execute();
  console.info(JSON.stringify({ event: "trial_reminders", ...result }));
  return result;
}

/** A failed run is reported to Sentry (when SENTRY_DSN is set), then fails as before. */
export const handler = reportingErrors("trial_reminders", run, () => {
  const config = loadConfig();
  return errorReporterFor(config.sentryDsn, config.stage);
});
