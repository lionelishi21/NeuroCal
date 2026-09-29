/**
 * Local API for web-poc: `npm run dev -w @neurocal/backend`, then run web-poc with
 * NEXT_PUBLIC_API_URL=http://localhost:4000. Uses real services when keys are set,
 * stubs otherwise; an in-memory Postgres (seeded) unless DATABASE_URL is set.
 */
import { createServer } from "node:http";
import type { Database } from "../infrastructure/database/client";
import { ClaudeReasoningProvider } from "../infrastructure/ai/ClaudeReasoningProvider";
import { OpenAiVisionProvider } from "../infrastructure/ai/OpenAiVisionProvider";
import { loadConfig } from "../infrastructure/config";
import { createDatabase } from "../infrastructure/database/client";
import {
  DrizzleCheckInRepository,
  DrizzleMealRepository,
  DrizzleProfileRepository,
  DrizzleRecommendationRepository,
  DrizzleUserRepository,
} from "../infrastructure/database/DrizzleRepositories";
import { createPgliteDatabase } from "../infrastructure/database/pglite";
import { stubReasoning, stubSearch, stubVision } from "../infrastructure/dev/StubProviders";
import { GoogleRecipeSearch } from "../infrastructure/search/GoogleRecipeSearch";
import { buildUseCases, systemClock } from "./compose";
import { createApi } from "./routes";

const PORT = Number(process.env.PORT ?? 4000);
const DEV_SUBJECT = "dev-user";

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
}

async function main() {
  const config = loadConfig();
  const db = config.databaseUrl ? createDatabase(config.databaseUrl) : (await createPgliteDatabase()).db;
  const users = new DrizzleUserRepository(db);
  const devUserId = await users.findOrCreateByAuthSubject(DEV_SUBJECT, "dev@localhost");
  if (!config.databaseUrl) await seed(db, devUserId);

  const vision = config.openAiApiKey ? new OpenAiVisionProvider({ apiKey: config.openAiApiKey }) : stubVision;
  const reasoning = config.anthropicApiKey ? new ClaudeReasoningProvider({ apiKey: config.anthropicApiKey }) : stubReasoning;
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
      vision,
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
    console.log(`  database: ${config.databaseUrl ? "DATABASE_URL" : "in-memory (seeded)"}`);
    console.log(`  vision: ${mode(vision !== stubVision)}, reasoning: ${mode(reasoning !== stubReasoning)}, search: ${mode(search !== stubSearch)}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
