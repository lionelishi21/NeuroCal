/**
 * `npm run catalog:sync -w @neurocal/backend`: embeds new or edited catalog entries
 * (src/infrastructure/catalog/catalog.ts) into the database at DATABASE_URL.
 * Needs OPENAI_API_KEY. Deployed stages use the catalog-sync Lambda instead (infra/README.md).
 */
import { loadConfig } from "../infrastructure/config";
import { runCatalogSync } from "./catalogSync";

runCatalogSync(loadConfig())
  .then((result) => {
    console.log(`Catalog synced: ${result.embedded} entries embedded.`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
