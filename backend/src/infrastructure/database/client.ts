import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/** Any Drizzle Postgres database built on this schema (node-postgres in prod, PGlite in tests and dev). */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export function createDatabase(url: string): Database {
  return drizzle(new Pool({ connectionString: url, max: 2 }), { schema });
}
