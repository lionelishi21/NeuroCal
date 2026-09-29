import { SyncCatalogUseCase } from "../application/use-cases/SyncCatalogUseCase";
import { OpenAiEmbeddingProvider } from "../infrastructure/ai/OpenAiEmbeddingProvider";
import { PRODUCTS, PROTOCOLS } from "../infrastructure/catalog/catalog";
import type { AppConfig } from "../infrastructure/config";
import { createDatabase } from "../infrastructure/database/client";
import { DrizzleCatalogRepository } from "../infrastructure/database/DrizzleCatalogRepository";

/** Embeds new or edited catalog entries into the configured database. Shared by the CLI and the Lambda. */
export async function runCatalogSync(config: AppConfig) {
  if (!config.databaseUrl || !config.openAiApiKey) throw new Error("Set DATABASE_URL and OPENAI_API_KEY.");
  return new SyncCatalogUseCase(
    new DrizzleCatalogRepository(createDatabase(config.databaseUrl)),
    new OpenAiEmbeddingProvider({ apiKey: config.openAiApiKey }),
  ).execute({ protocols: PROTOCOLS, products: PRODUCTS });
}
