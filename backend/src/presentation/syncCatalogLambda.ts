import { applyAwsSecrets } from "../infrastructure/aws/secrets";
import { loadConfig } from "../infrastructure/config";
import { errorReporterFor, reportingErrors } from "../infrastructure/monitoring/SentryErrorReporter";
import { runCatalogSync } from "./catalogSync";

/** Catalog sync for a deployed stage. Invoke after deploying catalog changes (infra/README.md). */
async function run() {
  await applyAwsSecrets();
  const result = await runCatalogSync(loadConfig());
  console.log(`Catalog synced: ${result.embedded} entries embedded.`);
  return result;
}

/** A failed run is reported to Sentry (when SENTRY_DSN is set), then fails as before. */
export const handler = reportingErrors("catalog_sync", run, () => {
  const config = loadConfig();
  return errorReporterFor(config.sentryDsn, config.stage);
});
