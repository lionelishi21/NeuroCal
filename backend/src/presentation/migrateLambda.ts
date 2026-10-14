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
  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 20_000 });
  try {
    await waitForDatabase(pool);
    await migrate(drizzle(pool), { migrationsFolder });
    console.log(`Migrations applied from ${migrationsFolder}.`);
  } finally {
    await pool.end();
  }
}

/**
 * The dev database pauses itself when idle (Aurora Serverless v2 at 0 capacity) and takes several
 * seconds to wake on the first connection, longer than one connection attempt waits. Without this a
 * deploy that found it asleep failed with "connect ETIMEDOUT". Retries for about 2.5 minutes.
 */
export async function waitForDatabase(
  pool: { query(sql: string): Promise<unknown> },
  { attempts = 6, pauseMs = 5_000, log = console.log }: { attempts?: number; pauseMs?: number; log?: (m: string) => void } = {},
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      log(`Database not reachable yet (attempt ${attempt} of ${attempts}): ${(error as Error).message}. Waiting for it to wake.`);
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
  }
}
