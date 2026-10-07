import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { ClaudeFocusExplainer } from "../infrastructure/ai/ClaudeFocusExplainer";
import { OpenAiEmbeddingProvider } from "../infrastructure/ai/OpenAiEmbeddingProvider";
import { ClaudeReasoningProvider } from "../infrastructure/ai/ClaudeReasoningProvider";
import { OpenAiVisionProvider } from "../infrastructure/ai/OpenAiVisionProvider";
import { applyAwsSecrets } from "../infrastructure/aws/secrets";
import { loadConfig } from "../infrastructure/config";
import { createDatabase } from "../infrastructure/database/client";
import { DrizzleCatalogRepository } from "../infrastructure/database/DrizzleCatalogRepository";
import {
  DrizzleCheckInRepository,
  DrizzleFocusScoreRepository,
  DrizzleMealRepository,
  DrizzleProfileRepository,
  DrizzleRecommendationRepository,
  DrizzleTelemetryRepository,
  DrizzleUserRepository,
  DrizzleWaitlistRepository,
} from "../infrastructure/database/DrizzleRepositories";
import { S3ObjectStorage } from "../infrastructure/aws/S3ObjectStorage";
import { ResendEmailSender, noEmail } from "../infrastructure/email/ResendEmailSender";
import { createRecipeSearch } from "../infrastructure/search/createRecipeSearch";
import { buildUseCases, systemClock } from "./compose";
import { type ApiResponse, createApi } from "./routes";

/**
 * API Gateway (HTTP API) entry point. Built once per cold start. Auth is the
 * gateway's JWT authorizer (Cognito proposed, ARCHITECTURE §10); we only read
 * the verified claims. Secrets come from Secrets Manager (infra stack sets the ARNs).
 */
await applyAwsSecrets();
const config = loadConfig();
const required = <T>(name: string, value: T | undefined): T => {
  if (!value) throw new Error(`Missing required setting ${name}`);
  return value;
};
const db = createDatabase(required("DATABASE_URL", config.databaseUrl));
const users = new DrizzleUserRepository(db);
const api = createApi(
  buildUseCases({
    profiles: new DrizzleProfileRepository(db),
    meals: new DrizzleMealRepository(db),
    checkIns: new DrizzleCheckInRepository(db),
    recommendations: new DrizzleRecommendationRepository(db),
    telemetry: new DrizzleTelemetryRepository(db),
    focusScores: new DrizzleFocusScoreRepository(db),
    catalog: new DrizzleCatalogRepository(db),
    embedder: new OpenAiEmbeddingProvider({ apiKey: required("OPENAI_API_KEY", config.openAiApiKey) }),
    storage: new S3ObjectStorage({ bucket: required("PHOTO_BUCKET", config.photoBucket) }),
    vision: new OpenAiVisionProvider({ apiKey: required("OPENAI_API_KEY", config.openAiApiKey) }),
    explainer: new ClaudeFocusExplainer({ apiKey: required("ANTHROPIC_API_KEY", config.anthropicApiKey) }),
    reasoning: new ClaudeReasoningProvider({ apiKey: required("ANTHROPIC_API_KEY", config.anthropicApiKey) }),
    search: required("TAVILY_API_KEY (or BRAVE_SEARCH_API_KEY, or GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID)", createRecipeSearch(config)),
    clock: systemClock,
    waitlist: new DrizzleWaitlistRepository(db),
    // Without a Resend key the waitlist still fills; its emails go out once the key is set.
    email: config.resendApiKey ? new ResendEmailSender({ apiKey: config.resendApiKey, from: config.emailFrom }) : noEmail,
    webUrl: config.webUrl,
    recipeDomains: config.recipeDomains,
  }),
);
const userIds = new Map<string, string>();

/** Admins are the verified emails listed in ADMIN_EMAILS (set by the stack). */
function isAdminClaim(claims: Record<string, unknown>): boolean {
  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
  const verified = claims.email_verified === true || claims.email_verified === "true";
  return verified && config.adminEmails.includes(email);
}

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  // CORS preflight carries no token; API Gateway adds the CORS headers.
  if (event.requestContext.http.method === "OPTIONS") return { statusCode: 204 };
  const request = {
    method: event.requestContext.http.method,
    path: event.rawPath,
    query: new URLSearchParams(event.rawQueryString),
    headers: event.headers,
    ...(event.body ? { body: Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8") } : {}),
  };
  // The waitlist is open to anyone; the gateway lets these routes through without a token.
  if (api.isPublic(request.method, request.path)) return toResult(await api({ ...request, userId: "" }));

  const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
  const subject = typeof claims.sub === "string" ? claims.sub : undefined;
  if (!subject) return { statusCode: 401, body: JSON.stringify({ code: "unauthorized", message: "Sign in again." }) };

  let userId = userIds.get(subject);
  if (!userId) {
    userId = await users.findOrCreateByAuthSubject(subject, typeof claims.email === "string" ? claims.email : `${subject}@unknown`);
    userIds.set(subject, userId);
  }

  return toResult(await api({ ...request, userId, isAdmin: isAdminClaim(claims) }));
}

function toResult(response: ApiResponse): APIGatewayProxyResultV2 {
  return {
    statusCode: response.status,
    headers: { "content-type": "application/json" },
    ...(response.body === undefined ? {} : { body: JSON.stringify(response.body) }),
  };
}
