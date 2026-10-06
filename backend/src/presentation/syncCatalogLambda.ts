import { applyAwsSecrets } from "../infrastructure/aws/secrets";
import { loadConfig } from "../infrastructure/config";
import { runCatalogSync } from "./catalogSync";

/** Catalog sync for a deployed stage. Invoke after deploying catalog changes (infra/README.md). */
export async function handler() {
  await applyAwsSecrets();
  const result = await runCatalogSync(loadConfig());
  console.log(`Catalog synced: ${result.embedded} entries embedded.`);
  return result;
}
