import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import type { Database } from "./client";
import * as schema from "./schema";

/** In-process Postgres with the real migrations applied. For tests and the local dev server only; run from backend/. */
export async function createPgliteDatabase(): Promise<{ db: Database; close: () => Promise<void> }> {
  const client = new PGlite({ extensions: { vector } });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  return { db: db as unknown as Database, close: () => client.close() };
}
