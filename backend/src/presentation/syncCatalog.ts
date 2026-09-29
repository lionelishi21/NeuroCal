/**
 * `npm run catalog:sync -w @neurocal/backend`: embeds new or edited catalog entries
 * (src/infrastructure/catalog/catalog.ts) into the database at DATABASE_URL.
 * Needs OPENAI_API_KEY. Run after deploying catalog changes.
 */
import { SyncCatalogUseCase } from "../application/use-cases/SyncCatalogUseCase";
import { OpenAiEmbeddingProvider } from "../infrastructure/ai/OpenAiEmbeddingProvider";
import { PRODUCTS, PROTOCOLS } from "../infrastructure/catalog/catalog";
import { loadConfig } from "../infrastructure/config";
import { createDatabase } from "../infrastructure/database/client";
import { DrizzleCatalogRepository } from "../infrastructure/database/DrizzleCatalogRepository";

async function main() {
  const config = loadConfig();
  if (!config.databaseUrl || !config.openAiApiKey) throw new Error("Set DATABASE_URL and OPENAI_API_KEY.");
  const result = await new SyncCatalogUseCase(
    new DrizzleCatalogRepository(createDatabase(config.databaseUrl)),
    new OpenAiEmbeddingProvider({ apiKey: config.openAiApiKey }),
  ).execute({ protocols: PROTOCOLS, products: PRODUCTS });
  console.log(`Catalog synced: ${result.embedded} entries embedded.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
