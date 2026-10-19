import { AdminProductUseCases } from "../application/use-cases/AdminProductUseCases";
import { DeviceScoutUseCases } from "../application/use-cases/DeviceScoutUseCases";
import { ClaudeDeviceExtractor } from "../infrastructure/ai/ClaudeDeviceExtractor";
import { applyAwsSecrets } from "../infrastructure/aws/secrets";
import { loadConfig } from "../infrastructure/config";
import { errorReporterFor, reportingErrors } from "../infrastructure/monitoring/SentryErrorReporter";
import { createDatabase } from "../infrastructure/database/client";
import { DrizzleCatalogRepository } from "../infrastructure/database/DrizzleCatalogRepository";
import { DrizzleDeviceCandidateRepository } from "../infrastructure/database/DrizzleRepositories";
import { TavilyWebSearch } from "../infrastructure/search/TavilyWebSearch";

/**
 * Runs monthly (infra: DeviceScout schedule): each kitchen category is searched and new devices go
 * into the admin Devices list as "pending". It never adds a product; an admin approves those.
 */
async function run() {
  await applyAwsSecrets();
  const config = loadConfig();
  if (!config.databaseUrl) throw new Error("Missing required setting DATABASE_URL");
  if (!config.tavilyApiKey || !config.anthropicApiKey) {
    console.info(JSON.stringify({ event: "device_scan", skipped: "needs TAVILY_API_KEY and ANTHROPIC_API_KEY" }));
    return { added: 0 };
  }
  const db = createDatabase(config.databaseUrl);
  // Scanning only reads the products, so nothing is embedded here.
  const noEmbeddings = { async embed() { return []; } };
  const useCase = new DeviceScoutUseCases(
    new DrizzleDeviceCandidateRepository(db),
    new TavilyWebSearch({ apiKey: config.tavilyApiKey }),
    new ClaudeDeviceExtractor({ apiKey: config.anthropicApiKey }),
    new AdminProductUseCases(new DrizzleCatalogRepository(db), noEmbeddings),
  );
  const result = await useCase.scan();
  console.info(JSON.stringify({ event: "device_scan", ...result }));
  return result;
}

/** A failed run is reported to Sentry (when SENTRY_DSN is set), then fails as before. */
export const handler = reportingErrors("device_scout", run, () => {
  const config = loadConfig();
  return errorReporterFor(config.sentryDsn, config.stage);
});
