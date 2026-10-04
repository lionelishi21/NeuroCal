/** Typed configuration. Only infrastructure and the composition root read the environment (ARCHITECTURE §2). */

/** Starting allow-list for recipe search (ARCHITECTURE §11: final list still to be decided). */
export const DEFAULT_RECIPE_DOMAINS = [
  "seriouseats.com",
  "bbcgoodfood.com",
  "eatingwell.com",
  "bonappetit.com",
  "cooking.nytimes.com",
  "budgetbytes.com",
];

export interface AppConfig {
  databaseUrl?: string;
  openAiApiKey?: string;
  anthropicApiKey?: string;
  tavilyApiKey?: string;
  braveSearchApiKey?: string;
  googleSearchApiKey?: string;
  googleSearchEngineId?: string;
  /** S3 bucket for meal photos; set by the stack. */
  photoBucket?: string;
  recipeDomains: string[];
  /** Lower-cased emails allowed to use the admin routes. */
  adminEmails: string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const opt = (name: string) => (env[name] ? env[name] : undefined);
  const domains = opt("RECIPE_ALLOWED_DOMAINS");
  return {
    databaseUrl: opt("DATABASE_URL"),
    openAiApiKey: opt("OPENAI_API_KEY"),
    anthropicApiKey: opt("ANTHROPIC_API_KEY"),
    tavilyApiKey: opt("TAVILY_API_KEY"),
    braveSearchApiKey: opt("BRAVE_SEARCH_API_KEY"),
    googleSearchApiKey: opt("GOOGLE_CSE_API_KEY"),
    googleSearchEngineId: opt("GOOGLE_CSE_ID"),
    photoBucket: opt("PHOTO_BUCKET"),
    adminEmails: (opt("ADMIN_EMAILS") ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
    recipeDomains: domains ? domains.split(",").map((d) => d.trim()).filter(Boolean) : DEFAULT_RECIPE_DOMAINS,
  };
}
