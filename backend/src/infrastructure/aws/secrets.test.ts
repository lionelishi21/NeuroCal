import { describe, expect, it } from "@jest/globals";
import { resolveAwsSecrets } from "./secrets";

const secrets: Record<string, string> = {
  app: JSON.stringify({ OPENAI_API_KEY: "sk-openai", ANTHROPIC_API_KEY: "sk-ant", EXTRA: "ignored", GOOGLE_CSE_ID: "" }),
  db: JSON.stringify({ username: "neurocal", password: "p@ss/word", host: "db.cluster.local", port: 5432, dbname: "neurocal" }),
};
const get = async (arn: string) => secrets[arn] ?? "";

describe("resolveAwsSecrets", () => {
  it("returns nothing when no secret ARNs are set", async () => {
    expect(await resolveAwsSecrets({}, get)).toEqual({});
  });

  it("maps known API keys from the app secret and skips empty or unknown ones", async () => {
    expect(await resolveAwsSecrets({ APP_SECRET_ARN: "app" }, get)).toEqual({ OPENAI_API_KEY: "sk-openai", ANTHROPIC_API_KEY: "sk-ant" });
  });

  it("builds an encoded, TLS-verified DATABASE_URL from the Aurora secret", async () => {
    const out = await resolveAwsSecrets({ DB_SECRET_ARN: "db" }, get);
    expect(out.DATABASE_URL).toBe("postgres://neurocal:p%40ss%2Fword@db.cluster.local:5432/neurocal?sslmode=verify-full");
  });

  it("lets values already in the environment win", async () => {
    const out = await resolveAwsSecrets(
      { APP_SECRET_ARN: "app", DB_SECRET_ARN: "db", OPENAI_API_KEY: "from-env", DATABASE_URL: "postgres://local" },
      get,
    );
    expect(out).toEqual({ ANTHROPIC_API_KEY: "sk-ant" });
  });

  it("rejects secrets that are not usable", async () => {
    await expect(resolveAwsSecrets({ APP_SECRET_ARN: "missing" }, get)).rejects.toThrow("not a JSON object");
    const partial = async () => JSON.stringify({ username: "u", host: "h" });
    await expect(resolveAwsSecrets({ DB_SECRET_ARN: "db" }, partial)).rejects.toThrow("missing username, password, host or port");
  });
});
