/**
 * Local API for web-poc: `npm run dev -w @neurocal/backend`, then run web-poc with
 * NEXT_PUBLIC_API_URL=http://localhost:4000. Uses real services when keys are set,
 * stubs otherwise; an in-memory Postgres (seeded) unless DATABASE_URL is set.
 */
import { createServer } from "node:http";
import type { Database } from "../infrastructure/database/client";
import { ClaudeFocusExplainer } from "../infrastructure/ai/ClaudeFocusExplainer";
import { OpenAiEmbeddingProvider } from "../infrastructure/ai/OpenAiEmbeddingProvider";
import { ClaudeReasoningProvider } from "../infrastructure/ai/ClaudeReasoningProvider";
import { OpenAiVisionProvider } from "../infrastructure/ai/OpenAiVisionProvider";
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
} from "../infrastructure/database/DrizzleRepositories";
import { createPgliteDatabase } from "../infrastructure/database/pglite";
import { SyncCatalogUseCase } from "../application/use-cases/SyncCatalogUseCase";
import { PRODUCTS, PROTOCOLS } from "../infrastructure/catalog/catalog";
import { keywordEmbedder } from "../infrastructure/dev/KeywordEmbedder";
import { stubExplainer, stubReasoning, stubSearch, stubVision } from "../infrastructure/dev/StubProviders";
import { GoogleRecipeSearch } from "../infrastructure/search/GoogleRecipeSearch";
import { buildUseCases, systemClock } from "./compose";
import { createApi } from "./routes";

const PORT = Number(process.env.PORT ?? 4000);
/** DEV_FRESH_USER=1 starts as a brand-new user with no profile, to try onboarding. */
const FRESH_USER = process.env.DEV_FRESH_USER === "1";
const DEV_SUBJECT = FRESH_USER ? "dev-fresh-user" : "dev-user";

async function seed(db: Database, userId: string) {
  const profiles = new DrizzleProfileRepository(db);
  if (await profiles.get(userId)) return;
  await profiles.save({
    userId,
    displayName: "Dev",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dietaryPreference: "pescatarian",
    cognitiveGoals: ["focus", "energy"],
    dailyCalorieTarget: 2200,
    macroTargets: { proteinG: 130, carbsG: 240, fatG: 75 },
  });
  const today = (h: number, m: number) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };
  const meals = new DrizzleMealRepository(db);
  await meals.create(userId, {
    kind: "breakfast",
    eatenAt: today(8, 10),
    items: [
      { name: "Steel-cut oats", portion: "1 cup cooked", calories: 300, macros: { proteinG: 10, carbsG: 54, fatG: 5 } },
      { name: "Blueberries", portion: "½ cup", calories: 42, macros: { proteinG: 0.5, carbsG: 11, fatG: 0.2 } },
      { name: "Walnuts", portion: "15 g", calories: 98, macros: { proteinG: 2.3, carbsG: 2, fatG: 9.8 } },
    ],
  });
  await new DrizzleCheckInRepository(db).create(userId, { at: today(14, 5), flags: ["low_focus", "low_energy"] });
  const bedtime = today(23, 15);
  bedtime.setDate(bedtime.getDate() - 1);
  await new DrizzleTelemetryRepository(db).upsertSleep(userId, [{ start: bedtime, end: today(5, 45), source: "manual" }]);
  await seedPastWeek(db, userId, today);
}

/** Six earlier days with varied sleep, dinner times and feelings, so History has a story to show. */
async function seedPastWeek(db: Database, userId: string, today: (h: number, m: number) => Date) {
  const meals = new DrizzleMealRepository(db);
  const checkIns = new DrizzleCheckInRepository(db);
  const telemetry = new DrizzleTelemetryRepository(db);
  const plan = [
    { sleep: 7.5, dinner: [19, 0], high: false, flags: ["sharp"] },
    { sleep: 6, dinner: [21, 45], high: true, flags: ["low_focus", "wired"] },
    { sleep: 5.5, dinner: [22, 10], high: true, flags: ["brain_fog", "stressed"] },
    { sleep: 8, dinner: [18, 45], high: false, flags: ["calm"] },
    { sleep: 7, dinner: [20, 15], high: false, flags: ["sharp"] },
    { sleep: 6.5, dinner: [21, 30], high: true, flags: ["low_energy"] },
  ] as const;
  for (const [i, day] of plan.entries()) {
    const back = plan.length - i; // 6 … 1 days ago
    const at = (h: number, m: number) => {
      const d = today(h, m);
      d.setDate(d.getDate() - back);
      return d;
    };
    const wake = at(6, 30);
    await telemetry.upsertSleep(userId, [{ start: new Date(wake.getTime() - day.sleep * 3_600_000), end: wake, source: "manual" }]);
    await meals.create(userId, {
      kind: "breakfast",
      eatenAt: at(8, 0),
      items: [{ name: "Greek yogurt and berries", portion: "1 bowl", calories: 320, macros: { proteinG: 22, carbsG: 35, fatG: 9 } }],
    });
    await meals.create(userId, {
      kind: "lunch",
      eatenAt: at(12, 45),
      items: [{ name: "Grain bowl", portion: "1 bowl", calories: 640, macros: { proteinG: 32, carbsG: 70, fatG: 22 } }],
    });
    await meals.create(userId, {
      kind: "dinner",
      eatenAt: at(day.dinner[0], day.dinner[1]),
      items: [
        day.high
          ? { name: "Pasta and garlic bread", portion: "1 plate", calories: 980, macros: { proteinG: 28, carbsG: 140, fatG: 30 }, glycemicLoad: "high" }
          : { name: "Salmon, greens and quinoa", portion: "1 plate", calories: 720, macros: { proteinG: 45, carbsG: 50, fatG: 30 }, glycemicLoad: "low" },
      ],
    });
    await checkIns.create(userId, { at: at(15, 0), flags: [...day.flags] });
  }
}

async function main() {
  const config = loadConfig();
  const db = config.databaseUrl ? createDatabase(config.databaseUrl) : (await createPgliteDatabase()).db;
  const users = new DrizzleUserRepository(db);
  const devUserId = await users.findOrCreateByAuthSubject(DEV_SUBJECT, "dev@localhost");
  if (!config.databaseUrl && !FRESH_USER) await seed(db, devUserId);

  const vision = config.openAiApiKey ? new OpenAiVisionProvider({ apiKey: config.openAiApiKey }) : stubVision;
  const reasoning = config.anthropicApiKey ? new ClaudeReasoningProvider({ apiKey: config.anthropicApiKey }) : stubReasoning;
  const explainer = config.anthropicApiKey ? new ClaudeFocusExplainer({ apiKey: config.anthropicApiKey }) : stubExplainer;
  const embedder = config.openAiApiKey ? new OpenAiEmbeddingProvider({ apiKey: config.openAiApiKey }) : keywordEmbedder;
  const synced = await new SyncCatalogUseCase(new DrizzleCatalogRepository(db), embedder).execute({ protocols: PROTOCOLS, products: PRODUCTS });
  const search =
    config.googleSearchApiKey && config.googleSearchEngineId
      ? new GoogleRecipeSearch({ apiKey: config.googleSearchApiKey, engineId: config.googleSearchEngineId })
      : stubSearch;

  const api = createApi(
    buildUseCases({
      profiles: new DrizzleProfileRepository(db),
      meals: new DrizzleMealRepository(db),
      checkIns: new DrizzleCheckInRepository(db),
      recommendations: new DrizzleRecommendationRepository(db),
      telemetry: new DrizzleTelemetryRepository(db),
      focusScores: new DrizzleFocusScoreRepository(db),
      catalog: new DrizzleCatalogRepository(db),
      embedder,
      vision,
      explainer,
      reasoning,
      search,
      clock: systemClock,
      recipeDomains: config.recipeDomains,
    }),
  );

  createServer(async (req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "content-type");
    res.setHeader("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return void res.writeHead(204).end();

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const url = new URL(req.url ?? "/", "http://localhost");
    const response = await api({
      method: req.method ?? "GET",
      path: url.pathname,
      query: url.searchParams,
      headers: req.headers as Record<string, string | undefined>,
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
      userId: devUserId,
    });
    res.writeHead(response.status, { "content-type": "application/json" });
    res.end(response.body === undefined ? undefined : JSON.stringify(response.body));
  }).listen(PORT, () => {
    const mode = (real: boolean) => (real ? "real" : "stub");
    console.log(`NeuroCal API on http://localhost:${PORT}`);
    console.log(`  database: ${config.databaseUrl ? "DATABASE_URL" : FRESH_USER ? "in-memory (new user, no profile)" : "in-memory (seeded)"}`);
    console.log(`  vision: ${mode(vision !== stubVision)}, reasoning: ${mode(reasoning !== stubReasoning)}, search: ${mode(search !== stubSearch)}, embeddings: ${mode(embedder !== keywordEmbedder)}`);
    console.log(`  catalog: ${synced.embedded} entries embedded`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
