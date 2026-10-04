import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { applyAwsSecrets } from "../infrastructure/aws/secrets";
import { loadConfig } from "../infrastructure/config";

/**
 * Applies the SQL migrations in `backend/drizzle` (copied next to the bundle by the
 * infra stack). Runs on every deploy that changes it; already-applied migrations are skipped.
 */
export async function handler() {
  await applyAwsSecrets();
  const { databaseUrl } = loadConfig();
  if (!databaseUrl) throw new Error("Set DATABASE_URL or DB_SECRET_ARN.");
  const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.join(process.env.LAMBDA_TASK_ROOT ?? process.cwd(), "drizzle");
  // Own pool, closed afterwards, so a warm container doesn't leave connections open.
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
    console.log(`Migrations applied from ${migrationsFolder}.`);
  } finally {
    await pool.end();
  }
}
