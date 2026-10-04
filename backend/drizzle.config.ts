import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infrastructure/database/schema.ts",
  out: "./drizzle",
  // Only needed for `drizzle-kit migrate` / `push`; `generate` works offline.
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost:5432/neurocal" },
});
