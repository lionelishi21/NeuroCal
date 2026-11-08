import { SyncCatalogUseCase } from "../application/use-cases/SyncCatalogUseCase";
import { OpenAiEmbeddingProvider } from "../infrastructure/ai/OpenAiEmbeddingProvider";
import { keywordEmbedder } from "../infrastructure/dev/KeywordEmbedder";
import { PRODUCTS, PROTOCOLS } from "../infrastructure/catalog/catalog";
import type { AppConfig } from "../infrastructure/config";
import { createDatabase } from "../infrastructure/database/client";
import { DrizzleCatalogRepository } from "../infrastructure/database/DrizzleCatalogRepository";

/**
 * Embeds new or edited catalog entries into the configured database. Shared by the CLI and the Lambda.
 * Without OPENAI_API_KEY it stores keyword vectors, matching what the API searches with until the key is
 * added; the first sync after that embeds everything properly.
 */
export async function runCatalogSync(config: AppConfig) {
  if (!config.databaseUrl) throw new Error("Set DATABASE_URL.");
  const catalog = new DrizzleCatalogRepository(createDatabase(config.databaseUrl));
  const sync = config.openAiApiKey
    ? new SyncCatalogUseCase(catalog, new OpenAiEmbeddingProvider({ apiKey: config.openAiApiKey }))
    : new SyncCatalogUseCase(catalog, keywordEmbedder, "keyword");
  return sync.execute({ protocols: PROTOCOLS, products: PRODUCTS });
}
