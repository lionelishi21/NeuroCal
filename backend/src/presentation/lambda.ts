import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { DrizzleGuideRepository, DrizzleProgramRepository } from "../infrastructure/database/DrizzleGuideRepositories";
import { GUIDE_SEEDS } from "../infrastructure/catalog/guides";
import { ClaudeFocusExplainer } from "../infrastructure/ai/ClaudeFocusExplainer";
import { ClaudeWhyExplainer } from "../infrastructure/ai/ClaudeWhyExplainer";
import { OpenAiEmbeddingProvider } from "../infrastructure/ai/OpenAiEmbeddingProvider";
import { ClaudeReasoningProvider } from "../infrastructure/ai/ClaudeReasoningProvider";
import { ClaudePantryRecipeAssistant } from "../infrastructure/ai/ClaudePantryRecipeAssistant";
import { ClaudeBetterChoiceAdvisor } from "../infrastructure/ai/ClaudeBetterChoiceAdvisor";
import { ClaudeShoppingListReviewer } from "../infrastructure/ai/ClaudeShoppingListReviewer";
import { ClaudeRecipeParser } from "../infrastructure/ai/ClaudeRecipeParser";
import { ClaudeMealPlanner } from "../infrastructure/ai/ClaudeMealPlanner";
import { ClaudeTechniqueExtractor } from "../infrastructure/ai/ClaudeTechniqueExtractor";
import { ClaudeDeviceExtractor } from "../infrastructure/ai/ClaudeDeviceExtractor";
import { TavilyWebSearch } from "../infrastructure/search/TavilyWebSearch";
import { YouTubeVideoFeed } from "../infrastructure/knowledge/YouTubeVideoFeed";
import { OpenMeteoAirQuality, OpenMeteoGeocoder } from "../infrastructure/environment/OpenMeteo";
import { OpenAiFoodLabelReader } from "../infrastructure/ai/OpenAiFoodLabelReader";
import { OpenAiSupplementLabelReader } from "../infrastructure/ai/OpenAiSupplementLabelReader";
import { OpenFoodFactsDatabase } from "../infrastructure/food/OpenFoodFacts";
import { OpenAiVisionProvider } from "../infrastructure/ai/OpenAiVisionProvider";
import { OpenAiDishRecipeWriter } from "../infrastructure/ai/OpenAiDishRecipeWriter";
import { applyAwsSecrets } from "../infrastructure/aws/secrets";
import { UpstreamError } from "../domain/errors";
import type { ISearchEngineAdapter } from "../application/interfaces/ISearchEngineAdapter";
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
  DrizzleBrainCheckRepository,
  DrizzleExerciseRepository,
  DrizzlePantryRepository,
  DrizzleKnowledgeRepository,
  DrizzleDeviceCandidateRepository,
  DrizzleAiUsageRepository,
  DrizzleMarkerRepository,
  DrizzleGlucoseRepository,
  DrizzleEatingOutRepository,
  DrizzleEnvironmentRepository,
  DrizzleNotificationSettingsRepository,
  DrizzleFastPlanRepository,
  DrizzleCoffeeRepository,
  DrizzleSessionRepository,
  DrizzleWhyCache,
  DrizzlePerformanceRepository,
  DrizzleShoppingListRepository,
  DrizzleMealPlanRepository,
  DrizzleStackRepository,
  DrizzleSubscriptionRepository,
  DrizzleWaitlistRepository,
  DrizzleWeightRepository,
} from "../infrastructure/database/DrizzleRepositories";
import { CognitoIdentityProvider } from "../infrastructure/aws/CognitoIdentityProvider";
import { S3ObjectStorage } from "../infrastructure/aws/S3ObjectStorage";
import { RevenueCatLookup } from "../infrastructure/billing/RevenueCat";
import { FOODS } from "../infrastructure/catalog/foods";
import { EATING_OUT } from "../infrastructure/catalog/eatingOut";
import { ResendEmailSender, noEmail } from "../infrastructure/email/ResendEmailSender";
import { FcmPushSender, parseServiceAccount } from "../infrastructure/push/FcmPushSender";
import { createRecipeSearch } from "../infrastructure/search/createRecipeSearch";
import { errorReporterFor, routeOf } from "../infrastructure/monitoring/SentryErrorReporter";
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
/**
 * An AI or search key that isn't in the app secret yet. The API still starts: the features that need it
 * fail on their own, politely (their providers' errors become "not available right now"), and the
 * cold-start log names what's missing.
 */
const missing: string[] = [];
const aiKey = (name: string, value: string | undefined): string => {
  if (value) return value;
  if (!missing.includes(name)) missing.push(name);
  return "not-set";
};
const unavailableSearch: ISearchEngineAdapter = {
  searchRecipes: async () => {
    throw new UpstreamError("Recipe search isn't set up yet.");
  },
};
const errors = errorReporterFor(config.sentryDsn, config.stage);
const db = createDatabase(required("DATABASE_URL", config.databaseUrl));
const users = new DrizzleUserRepository(db);
const firebase = parseServiceAccount(config.firebaseServiceAccount);
const useCases = buildUseCases({
    users,
    identity: new CognitoIdentityProvider({ userPoolId: required("USER_POOL_ID", config.userPoolId) }),
    profiles: new DrizzleProfileRepository(db),
    meals: new DrizzleMealRepository(db),
    checkIns: new DrizzleCheckInRepository(db),
    recommendations: new DrizzleRecommendationRepository(db),
    telemetry: new DrizzleTelemetryRepository(db),
    focusScores: new DrizzleFocusScoreRepository(db),
    catalog: new DrizzleCatalogRepository(db),
    embedder: new OpenAiEmbeddingProvider({ apiKey: aiKey("OPENAI_API_KEY", config.openAiApiKey) }),
    storage: new S3ObjectStorage({ bucket: required("PHOTO_BUCKET", config.photoBucket) }),
    vision: new OpenAiVisionProvider({ apiKey: aiKey("OPENAI_API_KEY", config.openAiApiKey) }),
    dishRecipes: new OpenAiDishRecipeWriter({ apiKey: aiKey("OPENAI_API_KEY", config.openAiApiKey), ...(config.cookThisModel ? { model: config.cookThisModel } : {}) }),
    foods: FOODS,
    eatingOut: EATING_OUT,
    eatingOutItems: new DrizzleEatingOutRepository(db),
    weights: new DrizzleWeightRepository(db),
    subscriptions: new DrizzleSubscriptionRepository(db),
    stack: new DrizzleStackRepository(db),
    brainChecks: new DrizzleBrainCheckRepository(db),
    exercises: new DrizzleExerciseRepository(db),
    pantry: new DrizzlePantryRepository(db),
    pantryRecipes: new ClaudePantryRecipeAssistant({ apiKey: aiKey("ANTHROPIC_API_KEY", config.anthropicApiKey) }),
    betterChoice: new ClaudeBetterChoiceAdvisor({ apiKey: aiKey("ANTHROPIC_API_KEY", config.anthropicApiKey) }),
    shoppingReviewer: new ClaudeShoppingListReviewer({ apiKey: aiKey("ANTHROPIC_API_KEY", config.anthropicApiKey) }),
    recipeParser: new ClaudeRecipeParser({ apiKey: aiKey("ANTHROPIC_API_KEY", config.anthropicApiKey) }),
    mealPlanner: new ClaudeMealPlanner({ apiKey: aiKey("ANTHROPIC_API_KEY", config.anthropicApiKey) }),
    mealPlans: new DrizzleMealPlanRepository(db),
    environment: new DrizzleEnvironmentRepository(db),
    notificationSettings: new DrizzleNotificationSettingsRepository(db),
    guides: new DrizzleGuideRepository(db),
    programs: new DrizzleProgramRepository(db),
    guideSeeds: GUIDE_SEEDS,
    fastPlans: new DrizzleFastPlanRepository(db),
    coffee: new DrizzleCoffeeRepository(db),
    sessions: new DrizzleSessionRepository(db),
    performance: new DrizzlePerformanceRepository(db),
    shoppingList: new DrizzleShoppingListRepository(db),
    airQuality: new OpenMeteoAirQuality(config.openMeteoApiKey ? { apiKey: config.openMeteoApiKey } : {}),
    geocoder: new OpenMeteoGeocoder(config.openMeteoApiKey ? { apiKey: config.openMeteoApiKey } : {}),
    knowledge: new DrizzleKnowledgeRepository(db),
    techniqueExtractor: new ClaudeTechniqueExtractor({ apiKey: aiKey("ANTHROPIC_API_KEY", config.anthropicApiKey) }),
    videoFeed: config.youTubeApiKey ? new YouTubeVideoFeed({ apiKey: config.youTubeApiKey }) : null,
    knowledgeChannels: config.knowledgeChannels,
    glucose: new DrizzleGlucoseRepository(db),
    markers: new DrizzleMarkerRepository(db),
    aiUsage: new DrizzleAiUsageRepository(db),
    deviceCandidates: new DrizzleDeviceCandidateRepository(db),
    deviceExtractor: new ClaudeDeviceExtractor({ apiKey: aiKey("ANTHROPIC_API_KEY", config.anthropicApiKey) }),
    webSearch: config.tavilyApiKey ? new TavilyWebSearch({ apiKey: config.tavilyApiKey }) : null,
    subscriptionLookup: config.revenueCatSecretKey ? new RevenueCatLookup({ secretKey: config.revenueCatSecretKey }) : null,
    ...(config.revenueCatWebhookAuth ? { storeWebhookAuth: config.revenueCatWebhookAuth } : {}),
    paywall: config.paywall,
    labels: new OpenAiSupplementLabelReader({ apiKey: aiKey("OPENAI_API_KEY", config.openAiApiKey) }),
    foodLabels: new OpenAiFoodLabelReader({ apiKey: aiKey("OPENAI_API_KEY", config.openAiApiKey) }),
    products: new OpenFoodFactsDatabase(),
    explainer: new ClaudeFocusExplainer({ apiKey: aiKey("ANTHROPIC_API_KEY", config.anthropicApiKey) }),
    whyExplainer:
      aiKey("ANTHROPIC_API_KEY", config.anthropicApiKey) === "not-set"
        ? {
            explain: async () => {
              throw new UpstreamError("Explanations aren't switched on yet. The reasons under each result still show.");
            },
          }
        : new ClaudeWhyExplainer({ apiKey: aiKey("ANTHROPIC_API_KEY", config.anthropicApiKey) }),
    whyCache: new DrizzleWhyCache(db),
    reasoning: new ClaudeReasoningProvider({ apiKey: aiKey("ANTHROPIC_API_KEY", config.anthropicApiKey) }),
    search: createRecipeSearch(config) ?? (missing.push("TAVILY_API_KEY"), unavailableSearch),
    clock: systemClock,
    waitlist: new DrizzleWaitlistRepository(db),
    // Without a Resend key the waitlist still fills; its emails go out once the key is set.
    email: config.resendApiKey ? new ResendEmailSender({ apiKey: config.resendApiKey, from: config.emailFrom }) : noEmail,
    // Without a Firebase key nothing is pushed; the phone's own reminders still work.
    ...(firebase ? { push: new FcmPushSender({ account: firebase }) } : {}),
    webUrl: config.webUrl,
    amazonTag: config.amazonTag,
    recipeDomains: config.recipeDomains,
  });
const api = createApi(useCases, errors);
if (missing.length) console.warn(JSON.stringify({ event: "settings_missing", keys: missing }));

const userIds = new Map<string, string>();

/** Admins are the verified emails listed in ADMIN_EMAILS (set by the stack). */
function isAdminClaim(claims: Record<string, unknown>): boolean {
  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
  const verified = claims.email_verified === true || claims.email_verified === "true";
  return verified && config.adminEmails.includes(email);
}

/** The hourly schedule (infra: Notifications rule) sends this instead of an HTTP request. */
const NOTIFICATIONS = "notifications";
/** What the rule sent before push notifications; still accepted while an old rule is about. */
const WEEKLY_EMAILS = "weekly-emails";

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer | { job: string; email?: string }): Promise<APIGatewayProxyResultV2> {
  // Run by hand (aws lambda invoke) to check push reaches someone's phone.
  if ("job" in event && event.job === "test-push" && event.email) {
    const result = await useCases.sendNotifications.test(event.email);
    console.info(JSON.stringify({ event: "test_push", ...result }));
    return { statusCode: 200, body: JSON.stringify(result) };
  }
  if ("job" in event) {
    if (event.job !== NOTIFICATIONS && event.job !== WEEKLY_EMAILS) throw new Error(`Unknown job ${event.job}`);
    try {
      const weekly = await useCases.sendWeeklyEmails.execute();
      console.info(JSON.stringify({ event: "weekly_emails", ...weekly }));
      const sent = await useCases.sendNotifications.execute();
      console.info(JSON.stringify({ event: "notifications", ...sent }));
      return { statusCode: 200 };
    } catch (e) {
      await errors.report(e, { source: "notifications" });
      throw e;
    }
  }
  try {
    return await handle(event);
  } catch (e) {
    // Outside the routes (signing a user in, reading the request): report, then fail as before.
    await errors.report(e, { source: "api", method: event.requestContext.http.method, route: routeOf(event.rawPath) });
    throw e;
  }
}

async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
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

  const response = await api({ ...request, userId, isAdmin: isAdminClaim(claims) });
  // A deleted account's id must not be reused if the same sign-in comes back to this container.
  if (request.method === "DELETE" && request.path === "/me" && response.status === 204) userIds.delete(subject);
  return toResult(response);
}

function toResult(response: ApiResponse): APIGatewayProxyResultV2 {
  return {
    statusCode: response.status,
    headers: { "content-type": "application/json" },
    ...(response.body === undefined ? {} : { body: JSON.stringify(response.body) }),
  };
}
