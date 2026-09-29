/**
 * Secrets for the deployed Lambdas (ARCHITECTURE §10): API keys live in one
 * Secrets Manager JSON secret, and Aurora's generated credentials in another.
 * Both are read once per cold start and turned into the same settings
 * `loadConfig` reads locally, so nothing else needs to know about AWS.
 */

/** Keys accepted from the app secret; anything else in it is ignored. */
const APP_KEYS = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_CSE_API_KEY", "GOOGLE_CSE_ID", "RECIPE_ALLOWED_DOMAINS"] as const;

/** Shape of the secret Aurora generates for its admin user. */
interface DbSecret {
  username: string;
  password: string;
  host: string;
  port: number | string;
  dbname?: string;
}

export type GetSecretString = (arn: string) => Promise<string>;

/**
 * Settings to add to the environment, from `APP_SECRET_ARN` and `DB_SECRET_ARN`.
 * Values already set in the environment win, so a function can still override one.
 */
export async function resolveAwsSecrets(env: NodeJS.ProcessEnv, getSecret: GetSecretString): Promise<Record<string, string>> {
  const out: Record<string, string> = {};

  if (env.APP_SECRET_ARN) {
    const app = parseJson(await getSecret(env.APP_SECRET_ARN), "app secret") as Record<string, unknown>;
    for (const key of APP_KEYS) {
      const value = app[key];
      if (typeof value === "string" && value && !env[key]) out[key] = value;
    }
  }

  if (env.DB_SECRET_ARN && !env.DATABASE_URL) {
    const db = parseJson(await getSecret(env.DB_SECRET_ARN), "database secret") as Partial<DbSecret>;
    if (!db.username || !db.password || !db.host || !db.port) throw new Error("Database secret is missing username, password, host or port.");
    const user = encodeURIComponent(db.username);
    const password = encodeURIComponent(db.password);
    // verify-full: the Lambda trusts the RDS CA through NODE_EXTRA_CA_CERTS (set by the stack).
    out.DATABASE_URL = `postgres://${user}:${password}@${db.host}:${db.port}/${encodeURIComponent(db.dbname ?? "neurocal")}?sslmode=verify-full`;
  }

  return out;
}

/** Reads secrets with the AWS SDK (bundled with the Lambda runtime) and applies them to `process.env`. */
export async function applyAwsSecrets(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (!env.APP_SECRET_ARN && !env.DB_SECRET_ARN) return;
  const { SecretsManagerClient, GetSecretValueCommand } = await import("@aws-sdk/client-secrets-manager");
  const client = new SecretsManagerClient({});
  const values = await resolveAwsSecrets(env, async (arn) => {
    const res = await client.send(new GetSecretValueCommand({ SecretId: arn }));
    if (!res.SecretString) throw new Error(`Secret ${arn} has no string value.`);
    return res.SecretString;
  });
  Object.assign(env, values);
}

function parseJson(text: string, what: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    if (value && typeof value === "object") return value;
  } catch {
    // fall through
  }
  throw new Error(`The ${what} is not a JSON object.`);
}
