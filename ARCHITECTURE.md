# NeuroCal AI — Architecture

_Last updated: 2026-09-29. Implemented so far: §3 domain types, §4 core tables, §5 ports for the built use cases, §6.1–6.8, §7.1, §7.2, §7.4 adapters, §8 existing endpoints (HTTP routes, Lambda entry point, local dev server), §12 deployment stack (`infra/`, not yet deployed). This is the build spec for `backend/`, `web-poc/` and `mobile-app/`. Anything marked **planned** does not exist in code yet; for API shapes, add it to `packages/contracts` first, then build both sides._

**Sources of truth**
- API shapes: `packages/contracts/src/index.ts` (Zod). This document refers to those types by name and does not redefine them.
- Existing port: `backend/src/application/interfaces/IAiReasoningProvider.ts`.
- Roadmap: `docs/EXECUTION_PLAN.md`.

---

## 1. System overview

```
 ┌────────────┐  ┌──────────────┐
 │  web-poc   │  │  mobile-app  │   clients parse every response with packages/contracts
 │  Next.js   │  │   Flutter    │   (Flutter: Dart client generated from OpenAPI, planned)
 └─────┬──────┘  └──────┬───────┘
       │  HTTPS + JWT   │
       ▼                ▼
 ┌─────────────────────────────────┐        ┌───────────────────────────┐
 │          API Gateway            │        │       EventBridge         │
 │  auth (Cognito JWT, proposed)   │        │  schedules + domain events│
 └───────────────┬─────────────────┘        └─────────────┬─────────────┘
                 ▼                                        ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │ presentation/   Lambda handlers: parse request (contracts) → call use  │
 │                 case → map result to contract → HTTP response          │
 ├───────────────────────────────────────────────────────────────────────┤
 │ application/    Use cases + ports (interfaces). No SDKs, no SQL.       │
 ├───────────────────────────────────────────────────────────────────────┤
 │ domain/         Entities, value objects, pure rules (BioState, score)  │
 ├───────────────────────────────────────────────────────────────────────┤
 │ infrastructure/ Adapters that implement the ports                      │
 └──┬─────────────┬──────────────┬──────────────┬──────────────┬─────────┘
    ▼             ▼              ▼              ▼              ▼
 Aurora PG     S3 (meal      OpenAI          Anthropic      Tavily search
 Serverless v2 photos)       gpt-4o vision   claude-haiku-  · Resend      
 + pgvector                  embeddings      4-5            (email)
```

### Request lifecycle

1. The client calls API Gateway with a Cognito JWT. The gateway rejects unauthenticated calls before any Lambda runs.
2. The handler parses path, query and body with the matching contract schema (e.g. `CreateMealRequest`). An invalid request gets `400` with an `ApiError` body (`{ code, message }`).
3. The handler builds its use case from the Lambda's composition root and calls it with the authenticated `userId`.
4. The use case talks only to ports. Every LLM output is validated against a Zod schema inside its adapter, before it reaches the use case (§7).
5. The handler maps the domain result to the contract response schema and **parses it again** before returning. A response that doesn't match the contract is a `500`, logged, never sent.

Validation happens at three edges: request in, LLM output in, response out.

---

## 2. Layering rules

| Layer | May import | Must not import |
|---|---|---|
| `domain/` | nothing outside `domain/` | SDKs, Drizzle, Zod, contracts, `process.env` |
| `application/` | `domain/`, its own port interfaces | infrastructure classes, SDKs, contracts |
| `infrastructure/` | `domain/`, `application/` ports, SDKs (Drizzle, `openai`, `@anthropic-ai/sdk`, AWS SDK, Resend) | `presentation/` |
| `presentation/` | everything above, plus `@neurocal/contracts` | direct SDK or DB calls |

- **Contracts stay at the edge.** Only `presentation/` imports `@neurocal/contracts`. Use cases take and return domain types; handlers translate. This keeps the domain free to evolve without breaking the wire format, and vice versa.
- **Dependency injection.** Each Lambda has one composition root (`presentation/<handler>/compose.ts`) that builds adapters once per cold start and injects them into use cases. Use cases receive ports through their constructor; they never `new` an adapter (CLAUDE.md: SOLID compliance).
- **Configuration.** Only infrastructure reads config, through a typed `config.ts`. Secrets come from SSM Parameter Store / Secrets Manager (§10).
- **Tests.** Use cases are tested with in-memory fakes of every port (Jest). Adapters get their own integration tests against real Postgres or recorded HTTP.

---

## 3. Domain model

Names below are domain types in `backend/src/domain/`. Where a contract type has the same shape, the handler maps one-to-one.

| Entity / value object | Fields (summary) | Invariants |
|---|---|---|
| **Profile** | userId, displayName, timeZone, dietaryPreference, cognitiveGoals[], dailyCalorieTarget, macroTargets | Calorie target > 0; macro targets ≥ 0; `timeZone` is an IANA name and defines the user's "day" |
| **Meal** | id, userId, kind, eatenAt, items[] (≥ 1), photoKey? | At least one item; `eatenAt` not more than 5 minutes in the future |
| **FoodItem** (value) | name, portion, calories, macros, confidence?, glycemicLoad? | Non-negative numbers; `confidence` in 0–1 and only on AI-proposed items |
| **CheckIn** | id, userId, at, flags[] (≥ 1), note? (≤ 280) | Flags from the `CognitiveFlag` enum |
| **BioState** (derived) | date, calorieTarget, caloriesEaten, macrosEaten, macroTargets, macroFocus, cognitiveFlags, dietaryPreference | **Computed on read, never stored as truth** (§6.5) |
| **SleepSession** (planned) | id, userId, start, end, source, stages? (deep/rem/light minutes), quality? | `end > start`; overlapping sessions from the same source are merged |
| **ScreenTimeSample** (planned) | id, userId, windowStart, windowEnd, minutes, source | Minutes ≤ window length |
| **FocusScore** (planned) | userId, date, score (0–100), components{sleep, timing, glycemic, stress}, explanation, modelVersion | One per user per day; recomputing replaces it |
| **RecipeRecommendation** | id, title, sourceName, sourceUrl, imageUrl?, minutes, calories, macros, reasoning, searchQuery | `sourceUrl` host must be on the recipe allow-list (§11) |
| **Protocol** (planned) | id, title, body, tags[], embedding | Content is authored by NeuroCal, not generated |
| **Product** (planned) | id, name, url, affiliate (bool), ownBrand (bool), supplement (bool), tags[], embedding | Affiliate and own-brand (MitoProof) products must be labelled as such wherever shown (§10) |

`glycemicLoad` (`"low" \| "medium" \| "high"`) is **planned** for `FoodItem` in contracts, so the vision step's high-glycemic flag (README) can reach the UI.

---

## 4. Database schema (Drizzle + Aurora PostgreSQL)

Conventions: `uuid` primary keys (`gen_random_uuid()`), `timestamptz` everywhere (stored UTC; the user's day comes from `profiles.time_zone`), `created_at` / `updated_at` on every table, `deleted_at` for soft delete where users can remove data. Extensions: `pgcrypto`, `vector`.

```text
users
  id uuid pk
  cognito_sub text unique not null
  email text unique not null
  created_at, updated_at, deleted_at

profiles                                   1:1 with users
  user_id uuid pk fk → users.id on delete cascade
  display_name text not null
  time_zone text not null default 'UTC'
  dietary_preference text not null         -- DietaryPreference enum
  cognitive_goals text[] not null default '{}'
  daily_calorie_target integer not null check (> 0)
  protein_target_g, carbs_target_g, fat_target_g numeric(6,1) not null
  created_at, updated_at

meals
  id uuid pk
  user_id uuid not null fk → users.id
  kind text not null                       -- MealKind enum
  eaten_at timestamptz not null
  photo_key text                           -- S3 key, never a public URL
  created_at, updated_at, deleted_at
  index (user_id, eaten_at desc) where deleted_at is null

meal_items
  id uuid pk
  meal_id uuid not null fk → meals.id on delete cascade
  position smallint not null
  name text not null, portion text not null
  calories numeric(7,1) not null check (>= 0)
  protein_g, carbs_g, fat_g numeric(6,1) not null check (>= 0)
  confidence real                          -- null for manual items
  glycemic_load text                       -- planned: low | medium | high
  unique (meal_id, position)

check_ins
  id uuid pk
  user_id uuid not null fk → users.id
  at timestamptz not null
  flags text[] not null check (cardinality(flags) > 0)
  note varchar(280)
  created_at, deleted_at
  index (user_id, at desc)

sleep_sessions                              planned
  id uuid pk, user_id fk, source text, start_at timestamptz, end_at timestamptz,
  deep_min, rem_min, light_min integer, quality real
  unique (user_id, source, start_at); index (user_id, end_at desc)

screen_time_samples                         planned
  id uuid pk, user_id fk, source text, window_start timestamptz, window_end timestamptz, minutes integer
  unique (user_id, source, window_start)

focus_scores                                planned
  user_id fk, date date, score smallint check (0..100),
  sleep_component, timing_component, glycemic_component, stress_component real,
  explanation text, model_version text, computed_at timestamptz
  primary key (user_id, date)

recipe_recommendations
  id uuid pk, user_id fk, search_query text not null, title, source_name, source_url text not null,
  image_url text, minutes integer, calories numeric, protein_g, carbs_g, fat_g numeric,
  reasoning text not null, created_at
  index (user_id, created_at desc)

protocols                                   catalog, synced from backend/src/infrastructure/catalog/catalog.ts
  id text pk, title, summary text, steps text[], tags text[],
  embedding vector(1536) not null, content_hash text, updated_at

products                                    catalog, same source
  id text pk, name, description text, url text, affiliate boolean not null default false, own_brand boolean not null default false, supplement boolean not null default false,
  tags text[], embedding vector(1536) not null, content_hash text, updated_at

user_embeddings                             planned (cache; not needed at current volume)
  user_id fk, kind text, embedding vector(1536), source_text text, computed_at
```

Migration 0002 runs `CREATE EXTENSION IF NOT EXISTS vector` before the catalog tables. Vector indexes:

```sql
create index on protocols using hnsw (embedding vector_cosine_ops);
create index on products  using hnsw (embedding vector_cosine_ops);
```

**Retention.** Photos in S3 expire after 30 days (lifecycle rule) unless attached to a saved meal; account deletion hard-deletes all rows and objects within 30 days. Exact periods are an open decision (§11).

---

## 5. Ports (TypeScript interfaces)

All in `backend/src/application/interfaces/`. Domain types come from `backend/src/domain/`. `userId` is always an explicit argument: every repository method is scoped to one user (§10).

### AI and external services

```ts
// IAiVisionProvider.ts
export type PhotoProblem = "too_dark" | "no_food_found" | "blurry";
export interface MealPhotoAnalysis {
  items: FoodItem[];            // domain FoodItem, with confidence set
  problem?: PhotoProblem;       // set when items could not be proposed
}
export interface IAiVisionProvider {
  analyzeMealPhoto(photo: { bytes: Uint8Array; mediaType: string }): Promise<MealPhotoAnalysis>;
}

// IAiReasoningProvider.ts — EXISTS; unchanged
export interface BioStateContext {
  caloriesRemaining: number;
  macroFocus: string;
  cognitiveFlags: string[];
  dietaryPreference: string;
}
export interface RecipeQueryOutput {
  searchQuery: string;
  contextualReasoning: string;
}
export interface IAiReasoningProvider {
  generateRecipeSearchQuery(context: BioStateContext): Promise<RecipeQueryOutput>;
}

// IEmbeddingProvider.ts (planned)
export interface IEmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;   // 1536 dimensions each
}

// ISearchEngineAdapter.ts
export interface RecipeSearchHit {
  title: string; url: string; sourceName: string; snippet: string; imageUrl?: string;
  // From the page's schema.org Recipe data when the result carries it
  minutes?: number; calories?: number; macros?: Macros;
}
export interface ISearchEngineAdapter {
  searchRecipes(query: string, opts: { allowedDomains: string[]; limit: number }): Promise<RecipeSearchHit[]>;
}

// IEmailProvider.ts (planned)
export interface IEmailProvider {
  send(message: { to: string; subject: string; html: string; text: string }): Promise<void>;
}

// IObjectStorage.ts (planned)
export interface IObjectStorage {
  createUploadUrl(key: string, mediaType: string, maxBytes: number): Promise<{ url: string; expiresAt: Date }>;
  read(key: string): Promise<{ bytes: Uint8Array; mediaType: string }>;
  delete(key: string): Promise<void>;
}

// IClock.ts
export interface IClock { now(): Date }
```

### Repositories (`IRepositories.ts`)

```ts
export interface IUserRepository {                               // Cognito sub → our user id, created on first sign-in
  findOrCreateByAuthSubject(subject: string, email: string): Promise<string>;
}
export interface IProfileRepository {
  get(userId: string): Promise<Profile | null>;
  save(profile: Profile): Promise<void>;
}
export interface IMealRepository {
  listForDay(userId: string, day: LocalDay): Promise<Meal[]>;   // LocalDay = date + time zone
  get(userId: string, mealId: string): Promise<Meal | null>;
  create(userId: string, meal: NewMeal): Promise<Meal>;
  softDelete(userId: string, mealId: string): Promise<boolean>;
}
export interface ICheckInRepository {
  create(userId: string, checkIn: NewCheckIn): Promise<CheckIn>;
  latestForDay(userId: string, day: LocalDay): Promise<CheckIn | null>;
  listBetween(userId: string, from: Date, to: Date): Promise<CheckIn[]>;   // planned, for Focus Score
}
export interface ITelemetryRepository {                          // planned
  upsertSleep(userId: string, sessions: SleepSession[]): Promise<number>;
  upsertScreenTime(userId: string, samples: ScreenTimeSample[]): Promise<number>;
  sleepEndingOn(userId: string, day: LocalDay): Promise<SleepSession[]>;
  screenTimeBetween(userId: string, from: Date, to: Date): Promise<ScreenTimeSample[]>;
}
export interface IFocusScoreRepository {                         // planned
  get(userId: string, date: string): Promise<FocusScore | null>;
  put(score: FocusScore): Promise<void>;
}
export interface IRecommendationRepository {
  saveRecipes(userId: string, recs: NewRecipeRecommendation[]): Promise<RecipeRecommendation[]>;   // assigns ids
  nearestProtocols(embedding: number[], limit: number): Promise<Protocol[]>;   // planned, HNSW
  nearestProducts(embedding: number[], limit: number): Promise<Product[]>;     // planned, HNSW
}
```

---

## 6. Use cases

Each use case is a class in `backend/src/application/use-cases/` with a single `execute(input)` method, constructed with the ports it needs. Errors are typed domain errors (`NotFound`, `Invalid`, `Upstream`); handlers map them to `404`, `400` and `502`.

### 6.1 AnalyzeMealPhoto — `POST /meals/analyze`
Ports: `IObjectStorage`, `IAiVisionProvider`.
1. Read the uploaded photo (by S3 key once presigned upload lands; multipart body until then).
2. `analyzeMealPhoto(photo)` → `MealPhotoAnalysis`.
3. Return it. **Nothing is saved**: the user confirms items first.

Output → `AnalyzeMealResponse`. A `problem` is a normal response (200), not an error.

### 6.2 LogMeal — `POST /meals`
Ports: `IMealRepository`, `IClock`. Input: `CreateMealRequest` mapped to `NewMeal`. Enforce the Meal invariants (§3), create, return `Meal`. `LogMealUseCase.ts` is this use case.

### 6.3 DeleteMeal — `DELETE /meals/:id`
Soft-delete scoped to the user; `NotFound` if the meal isn't the user's (so another user's ID is indistinguishable from a missing one).

### 6.4 RecordCheckIn — `POST /check-ins`
Validate flags, then create. Emits `checkin.recorded` on EventBridge (planned) so the Focus Score can refresh.

### 6.5 ComputeBioState — `GET /bio-state?date=`
Pure domain function over the day's meals, latest check-in and profile. It must match the web mock (`web-poc/src/mocks/db.ts`) exactly:

```
caloriesEaten = Σ item.calories over the day's meals
macrosEaten   = Σ item.macros
gap(m)        = 1 − eaten(m) / target(m)          for protein, carbs, fat
macroFocus    = the macro with the largest gap, if it beats the second-largest by more than 0.10;
                otherwise "balanced"          (protein → "protein", carbs → "complex_carbs", fat → "healthy_fats")
cognitiveFlags = flags of the latest check-in on that local day, or []
```

"Day" is the calendar day in `profiles.time_zone`.

### 6.6 RecommendRecipe — `GET /recommendations/next`
Ports: `IProfileRepository`, `IMealRepository`, `ICheckInRepository`, `IAiReasoningProvider`, `ISearchEngineAdapter`, `IRecommendationRepository`. `RecommendRecipeUseCase.ts` is this use case.
1. `ComputeBioState` for today → `BioStateContext { caloriesRemaining, macroFocus, cognitiveFlags, dietaryPreference }`.
2. `generateRecipeSearchQuery(context)` → `{ searchQuery, contextualReasoning }` (Claude, §7.2).
3. `searchRecipes(searchQuery, { allowedDomains, limit: 10 })`: Tavily search with the allow-list as `include_domains`. Tavily returns links only, so the adapter fetches each allow-listed hit's page and reads its schema.org Recipe data (time, calories, macros); guides, collection pages and pages that can't be read stay without nutrition and are dropped in the next step. `createRecipeSearch` picks the provider by which key is set: `TAVILY_API_KEY`, then `BRAVE_SEARCH_API_KEY`, then the Google Custom Search pair (Google closed that API to new projects).
4. Rank the hits: keep only allowed domains (checked again, not just trusted to search) and hits with full nutrition (the contract requires minutes, calories and macros); drop anything over `caloriesRemaining` when calories are left; sort by protein per calorie; keep the top 3. The dietary preference is enforced by the query itself.
5. Attach `contextualReasoning` as each recipe's `reasoning`, save, and return `NextRecommendationsResponse { searchQuery, recipes }`.

If the reasoning call fails after one retry: `502`. If search returns nothing: `200` with `recipes: []`, and the UI says so.

### 6.7 IngestTelemetry — `POST /telemetry/sleep`, `POST /telemetry/screen-time`
A sleep session replaces any stored session **from the same source that overlaps it**, so re-syncs and manual corrections don't pile up. Screen-time samples upsert on `(user, source, windowStart)`. Rejects sleep that ends before it starts, lasts over 24 h, ends in the future, or has more deep sleep than sleep. Emitting `telemetry.ingested` is planned with the EventBridge work.

### 6.8 ComputeFocusScore — `GET /focus-score?date=`
Computed on read and stored in `focus_scores`; the AI explanation is only requested when the score or a component changed, and a plain fallback sentence is used if the explainer fails. Nightly precomputation via EventBridge is planned with the deploy work.

The score for day D is a **morning baseline**:
- sleep ← sessions that ended on D (overlapping sessions from different sources count once)
- timing ← the last meal of D−1 after 21:00, and screen time starting 22:00–04:00 on the evening of D−1 (screen samples outside that window don't count as timing data)
- glycemic ← D−1's meals
- stress ← check-ins on D−1 and D

v0 is a **deterministic** formula; the AI only writes the explanation. Weights are a **proposal** to validate with real data:

```
sleep     = clamp(totalSleepMin / 480) × 0.7 + clamp(deepMin / 90) × 0.3   (duration only when a session lacks deep-sleep data)
timing    = 1 − clamp(minutes eaten after 21:00 local / 120) − clamp(screen minutes after 22:00 / 120) × 0.5
glycemic  = 1 − share of the day's calories from items with glycemicLoad = "high"
stress    = 1 − 0.25 × count of {stressed, brain_fog, low_focus, wired} in the day's check-ins (floor 0)
score     = round(100 × (0.40·sleep + 0.20·timing + 0.20·glycemic + 0.20·stress))
```

Missing inputs drop out and the remaining weights are renormalised; the stored `components` show what was used. The explanation is generated from the components, not from raw data, and is validated like every LLM output.

### 6.9 RecommendProtocols — `GET /recommendations/protocols`
1. Weak points: Focus Score components averaged over the last 7 days; below 0.75 counts; the two lowest are used.
2. One text per weak point (e.g. "Help with stress and low focus. Goals: focus."), embedded in one batched call.
3. `nearestProtocols` / `nearestProducts` per text (HNSW cosine), taken **round-robin** so every weak point gets its own best match; 2 protocols and 2 products in total. With no weak points, one "maintain steady focus…" query.
4. Return them with the `affiliate` and `ownBrand` flags intact; clients label those links ("Affiliate link", "Our brand") next to the link and use `rel="sponsored"`.

**Catalog.** Protocols and products are authored in the repo (`catalog.ts`), never generated. `SyncCatalogUseCase` embeds only entries whose record hash changed (any field, so URL and affiliate edits are always stored) and removes deleted ones. The dev server syncs on start; `npm run catalog:sync -w @neurocal/backend` syncs a real database. Products are generic categories until partner agreements exist, plus MitoProof's own items (`ownBrand: true`; MitoProof is run by NeuroCal's makers).

### 6.10 SendDailySummary — planned; EventBridge, morning per user time zone
Yesterday's intake, Focus Score and one suggestion, sent via `IEmailProvider` (Resend). Opt-in only.

---

## 7. AI integration

Rules for every model call:
- **Structured output only.** Ask the provider for schema-constrained JSON, then parse it again with Zod in the adapter. A parse failure counts as a failed call.
- **One retry, then a typed failure.** Timeout 20 s for vision, 10 s for text; retry once on timeout, 429 or 5xx; never retry a 4xx.
- **No sensitive data in logs.** Log model, latency, token counts and estimated cost per call; never log photos, prompts containing user notes, or model output text.
- **Prompts live in code** (`infrastructure/ai/prompts/*.ts`) as constants, versioned with the adapter. Keep the system prompt byte-stable so provider-side prompt caching can apply.

### 7.1 Meal vision — OpenAI `gpt-4o`
Adapter: `infrastructure/ai/OpenAiVisionProvider.ts` implements `IAiVisionProvider`. JSON-schema structured output from the schema below.

System prompt:
```
You identify foods in a single meal photo and estimate nutrition.
Return every distinct food or drink you can see as an item with a short name,
a portion in everyday units (g, cup, slice, piece) and your best estimate of
calories, protein, carbs and fat for that portion.
Set confidence between 0 and 1 for each item; below 0.85 means the user should check it.
Set glycemicLoad to low, medium or high for each item.
If the photo is too dark, too blurry, or shows no food, return no items and set problem.
Never guess brands. Never add items you cannot see.
```

Output schema (Zod, in the adapter):
```ts
z.object({
  items: z.array(z.object({
    name: z.string().min(1),
    portion: z.string().min(1),
    calories: z.number().nonnegative(),
    proteinG: z.number().nonnegative(),
    carbsG: z.number().nonnegative(),
    fatG: z.number().nonnegative(),
    confidence: z.number().min(0).max(1),
    glycemicLoad: z.enum(["low", "medium", "high"]),
  })),
  problem: z.enum(["too_dark", "no_food_found", "blurry"]).nullable(),
})
```
Mapped to `MealPhotoAnalysis`, and then by the handler to `AnalyzeMealResponse` (`glycemicLoad` is dropped until the contract gains it).

### 7.2 Recipe search query — Anthropic `claude-haiku-4-5`
Adapter: `infrastructure/ai/ClaudeReasoningProvider.ts` implements the existing `IAiReasoningProvider`. It uses the official `@anthropic-ai/sdk` with structured outputs: `client.messages.parse({ model: "claude-haiku-4-5", max_tokens: 1024, system, messages, output_config: { format: zodOutputFormat(RecipeQuerySchema) } })`, and treats a null `parsed_output` or a `stop_reason` of `refusal` / `max_tokens` as a failed call.

System prompt:
```
You write one web search query that finds a recipe for the user's next meal.
You get: calories remaining today, the macro they are most short of, how they
feel right now (cognitive flags) and their dietary preference.
Choose a dish or main ingredient that respects the dietary preference, is rich in
the macro they are short of, and supports the way they want to feel (for example
oats or lentils for low_energy, salmon or walnuts for low_focus).
Write the query the way a person looks up a dish: four to eight plain words that
name the ingredient or dish and the meal, ending with the word "recipe", for
example "high protein salmon dinner recipe". Never put calorie numbers or nutrient
names such as omega-3 in the query: they return articles instead of recipes, and
the calories remaining are checked against each recipe afterwards.
Also write contextualReasoning: two sentences, second person, plain words,
explaining why this kind of meal fits right now. No medical claims.
```

User message: the `BioStateContext` as JSON. Output schema:
```ts
const RecipeQuerySchema = z.object({
  searchQuery: z.string().min(3).max(200),
  contextualReasoning: z.string().min(1).max(400),
});   // matches RecipeQueryOutput
```

### 7.3 Embeddings — OpenAI `text-embedding-3-small`
Adapter: `infrastructure/ai/OpenAiEmbeddingProvider.ts` implements `IEmbeddingProvider`. 1536 dimensions; batch up to 100 texts per call. Protocol and product embeddings are recomputed only when their text changes.

### 7.4 Focus Score explanation — `claude-haiku-4-5`
Input: the score and its components only. Output: `{ explanation: string (≤ 300 chars) }`, same rules as §7.2.

---

## 8. API surface

Existing — defined in `endpoints` in `packages/contracts/src/index.ts`, served by the backend and the web mock:

| Method | Path | Request | Response | Use case |
|---|---|---|---|---|
| GET | `/me` | — | `Profile` | profile read |
| PUT | `/me/profile` | `UpdateProfileRequest` | `Profile` | creates the profile on first save (all required fields), then partial updates; `timeZone` defaults to UTC |
| GET | `/bio-state?date=` | — | `BioState` | 6.5 |
| POST | `/check-ins` | `CreateCheckInRequest` | `CheckIn` | 6.4 |
| POST | `/meals/analyze` | multipart `photo` | `AnalyzeMealResponse` | 6.1 |
| POST | `/meals` | `CreateMealRequest` | `Meal` | 6.2 |
| GET | `/meals?date=` | — | `Meal[]` | meal list |
| DELETE | `/meals/:id` | — | 204 | 6.3 |
| GET | `/recommendations/next` | — | `NextRecommendationsResponse` | 6.6 |
| GET | `/focus-score?date=` | — | `FocusScore` | 6.8 |
| GET | `/recommendations/protocols` | — | `ProtocolsResponse` | 6.9 |
| GET | `/history?days=` | — | `HistoryResponse` | the last 1–31 days, oldest first; Focus Scores recomputed without the AI explanation; each day carries the bedtime and wake time of the sleep that ended that morning and the screen minutes after 22:00 the night before (the web Sleep screen) |
| POST | `/telemetry/sleep` | `IngestSleepRequest` | `IngestResponse` | 6.7 |
| POST | `/telemetry/screen-time` | `IngestScreenTimeRequest` | `IngestResponse` | 6.7 |

The same surface is published as OpenAPI 3.1 in `packages/contracts/openapi.json`, generated from the Zod schemas by `packages/contracts/src/openapi.ts` (`npm run openapi -w @neurocal/contracts`). The Flutter client is generated from that file. Rules written with `.refine()` (sleep ends after it starts, screen minutes fit the window) can't be expressed in JSON Schema and are stated in the operation descriptions.

Planned — add to contracts first:

| Method | Path | Purpose |
|---|---|---|
| POST | `/uploads/meal-photo` | Presigned S3 URL; `/meals/analyze` then takes `{ photoKey }` instead of multipart |

Errors always use the `ApiError` shape `{ code, message }`, with messages written for the user ("A meal needs at least one item.").

---

## 9. Async flows

```
Photo upload (planned presigned flow)
  client → POST /uploads/meal-photo → { url, photoKey }
  client → PUT url (S3, ≤ 8 MB, image/*)
  client → POST /meals/analyze { photoKey } → items → user confirms → POST /meals

EventBridge
  rate: hourly  → FocusScoreScheduler → for users whose local time just passed 04:00 → ComputeFocusScore
  rate: hourly  → DailySummaryScheduler → users whose local time just passed 07:30 and opted in → SendDailySummary
  checkin.recorded, telemetry.ingested → ComputeFocusScore for that user and day
```

Scheduled handlers fan out through SQS so one user's failure doesn't block the rest; failed messages go to a dead-letter queue.

---

## 10. Security & privacy

- **Auth:** Amazon Cognito user pool with a JWT authorizer on API Gateway (in `infra/`). The web app signs in with Amplify Auth (SRP) and sends the ID token; without Cognito settings it uses a local mock (`web-poc/src/auth`). Mobile sign-in **planned**. Handlers take `userId` only from the verified token, never from the request.
- **Per-user scoping:** every repository method takes `userId` and puts it in the `WHERE` clause. Integration tests assert that user A cannot read or delete user B's rows.
- **Health data is sensitive:** encryption at rest (Aurora + S3 with KMS), TLS everywhere, S3 buckets private with presigned URLs only, least-privilege IAM per Lambda.
- **Secrets:** API keys (OpenAI, Anthropic, Tavily, Resend) in one Secrets Manager JSON secret and Aurora's credentials in its generated secret. Lambdas get only the ARNs and read them once per cold start (`infrastructure/aws/secrets.ts`); never in env files or the repo.
- **LLM safety:** schema-validated outputs (§7); user notes are passed as data, never as instructions; no medical claims in generated text.
- **Affiliate and own-brand disclosure:** products with `affiliate = true` or `own_brand = true` carry a visible label and a one-line disclosure in every client. When any suggested product has `supplement = true`, clients add a one-line note to check with a doctor or pharmacist first.
- **Deletion:** account deletion removes rows, S3 objects and embeddings (§4 retention).

---

## 11. Open decisions

1. **Focus Score weights** (§6.8): validate the v0 weights against real user data before showing scores widely.
2. **Auth provider:** Cognito is wired in `infra/` because it fits the AWS stack; confirm before building sign-in screens.
3. **Retention periods** for photos, telemetry and deleted accounts.
4. **Recipe domain allow-list** ("trusted biohacking domains" in README). Checked on 2026-10-01 with the page reader: bbcgoodfood.com, cooking.nytimes.com and budgetbytes.com publish full nutrition; bonappetit.com publishes none; seriouseats.com and eatingwell.com answer automated requests with 402. Set `RECIPE_ALLOWED_DOMAINS` to override the default list.
5. **Telemetry sources** for sleep and screen time (Apple Health, Google Health Connect, wearables) and how the Flutter app collects them.

---

## 12. Deployment (`infra/`, AWS CDK)

One CDK stack per stage (`NeuroCal-dev`, `NeuroCal-prod`), in TypeScript. Steps and costs: `infra/README.md`.

```
Cognito user pool ──JWT──▶ API Gateway (HTTP API, $default route, CORS for the web origins)
                                  │
                                  ▼
             API Lambda (Node 22, arm64, ESM bundle of presentation/lambda.ts)
               │ private subnets, one NAT → OpenAI, Anthropic, Google
               ▼
     Aurora PostgreSQL 17 Serverless v2 (isolated subnets, encrypted, pgvector)

Secrets Manager: app secret (API keys) + Aurora-generated secret → read by ARN at cold start
Migration Lambda: applies backend/drizzle on every deploy that changes it (CDK Trigger)
Catalog-sync Lambda: invoked after catalog changes (needs OPENAI_API_KEY in the app secret)
S3 meal-photo bucket: private, TLS-only, KMS, 30-day expiry (for the planned presigned upload)
```

- **Stages.** `dev` pauses the database when idle (0 ACU minimum) and deletes everything with the stack. `prod` keeps 0.5 ACU warm, turns on deletion protection, snapshots the database and retains the secret, user pool and bucket.
- **TLS to the database.** Lambdas connect with `sslmode=verify-full` and trust the RDS CA through `NODE_EXTRA_CA_CERTS=/var/runtime/ca-cert.pem`.
- **Not in the stack yet (planned):** EventBridge schedules and SQS fan-out (§9), the presigned-upload route and the Lambda's bucket grant, Resend, alarms and dashboards, a custom domain.

