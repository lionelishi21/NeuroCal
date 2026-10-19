import { KnowledgeUseCases } from "../application/use-cases/KnowledgeUseCases";
import { applyAwsSecrets } from "../infrastructure/aws/secrets";
import { loadConfig } from "../infrastructure/config";
import { errorReporterFor, reportingErrors } from "../infrastructure/monitoring/SentryErrorReporter";
import { createDatabase } from "../infrastructure/database/client";
import { DrizzleCatalogRepository } from "../infrastructure/database/DrizzleCatalogRepository";
import { DrizzleKnowledgeRepository } from "../infrastructure/database/DrizzleRepositories";
import { YouTubeVideoFeed } from "../infrastructure/knowledge/YouTubeVideoFeed";

/**
 * Runs monthly (infra: KnowledgeSync schedule): new uploads on the watched channels go into the admin
 * Knowledge list as "queued". It never reads transcripts and never adds anything to the catalog.
 */
async function run() {
  await applyAwsSecrets();
  const config = loadConfig();
  if (!config.databaseUrl) throw new Error("Missing required setting DATABASE_URL");
  if (!config.youTubeApiKey) {
    console.info(JSON.stringify({ event: "knowledge_sync", skipped: "no YOUTUBE_API_KEY" }));
    return { added: 0 };
  }
  const db = createDatabase(config.databaseUrl);
  const notUsed = { async extract() { return []; } };
  const noEmbeddings = { async embed() { return []; } };
  const useCase = new KnowledgeUseCases(
    new DrizzleKnowledgeRepository(db),
    notUsed,
    new DrizzleCatalogRepository(db),
    noEmbeddings,
    new YouTubeVideoFeed({ apiKey: config.youTubeApiKey }),
    config.knowledgeChannels,
  );
  const result = await useCase.sync();
  console.info(JSON.stringify({ event: "knowledge_sync", ...result }));
  return result;
}

/** A failed run is reported to Sentry (when SENTRY_DSN is set), then fails as before. */
export const handler = reportingErrors("knowledge_sync", run, () => {
  const config = loadConfig();
  return errorReporterFor(config.sentryDsn, config.stage);
});
