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
  /** RevenueCat: the webhook's Authorization header, and the REST key for looking up a subscriber. */
  revenueCatWebhookAuth?: string;
  revenueCatSecretKey?: string;
  /** PAYWALL=on: the AI features need a subscription or trial. Off until the store products exist. */
  paywall: boolean;
  /** The Cognito user pool, for deleting sign-ins with the account. */
  userPoolId?: string;
  recipeDomains: string[];
  /** Lower-cased emails allowed to use the admin routes. */
  adminEmails: string[];
  /** Resend API key; without it no email is sent (waitlist addresses are still kept). */
  resendApiKey?: string;
  /** The sender, on a domain verified with Resend. */
  emailFrom: string;
  /** The website; unsubscribe links point at it. */
  webUrl: string;
  /** Open-Meteo API key (paid plan); without it the free, non-commercial API is used. */
  openMeteoApiKey?: string;
  /** YouTube Data API key, to check channels for new videos (titles and links only). */
  youTubeApiKey?: string;
  /** YouTube channel ids the knowledge pipeline watches; Dave Asprey's by default. */
  knowledgeChannels: string[];
}

/** Dave Asprey's YouTube channel (youtube.com/@DaveAspreyBPR). */
export const DEFAULT_KNOWLEDGE_CHANNELS = ["UC1KoulyXR8gBGyxv7r6pWQg"];

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
    userPoolId: opt("USER_POOL_ID"),
    revenueCatWebhookAuth: opt("REVENUECAT_WEBHOOK_AUTH"),
    revenueCatSecretKey: opt("REVENUECAT_SECRET_KEY"),
    paywall: opt("PAYWALL") === "on",
    resendApiKey: opt("RESEND_API_KEY"),
    emailFrom: opt("EMAIL_FROM") ?? "NeuroCal <hello@neurocal.ai>",
    webUrl: opt("WEB_URL") ?? "https://neurocal.ai",
    adminEmails: (opt("ADMIN_EMAILS") ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
    recipeDomains: domains ? domains.split(",").map((d) => d.trim()).filter(Boolean) : DEFAULT_RECIPE_DOMAINS,
    youTubeApiKey: opt("YOUTUBE_API_KEY"),
    openMeteoApiKey: opt("OPEN_METEO_API_KEY"),
    knowledgeChannels: opt("KNOWLEDGE_CHANNELS") ? opt("KNOWLEDGE_CHANNELS")!.split(",").map((c) => c.trim()).filter(Boolean) : DEFAULT_KNOWLEDGE_CHANNELS,
  };
}
