# NeuroCal — Execution Plan

_Last updated: 2026-10-01_

## 1. Where the project is today

The product direction comes from `README.md` and `CLAUDE.md` on `main`. NeuroCal AI connects metabolic tracking (calories and macros) with cognitive performance:

- **Calorie & macro vision:** meal photo → items, calories, macros, high-glycemic flags (OpenAI `gpt-4o`)
- **Focus Score engine:** a daily score from sleep telemetry, diet and self-reported stress
- **Circadian telemetry:** late-night screen time and late eating vs. melatonin and weight plateaus
- **Dynamic recipe routing:** macro gaps → search query (Anthropic Claude) → recipes from trusted domains (Tavily search)
- **Vector recommendations:** `pgvector` matches a user's weak points (e.g. "poor deep sleep") to protocols and products

| Area | State |
|---|---|
| `packages/contracts` | Zod schemas for 9 endpoints, 3 Jest tests |
| `web-poc/` | Next.js app: Today screen, log-meal and check-in flows on a mock API, 7 Vitest tests |
| `backend/` | Hexagonal skeleton; only `IAiReasoningProvider.ts` has code |
| `mobile-app/` | Flutter app: sign-in (Cognito or mock), Today, Log a meal, Check in, Settings with Match device / Light / Dark; hand-written Dart models for now |
| `ARCHITECTURE.md` | Build spec: layers, domain model, DB schema, ports, use cases, AI prompts, API surface |

## 2. Recommendation: frontend-first, contract-driven

You asked to start with the frontend. I agree, with one guardrail: **define the API contract first (a day of work), then build the frontend against mocks.** That gives you the speed of front-first without a painful rewrite when the real API lands.

```
Week 0  ── Contracts (shared Zod schemas + OpenAPI) ──┐
Weeks 1-4 ── Frontend on mock API (MSW) ──────────────┤ both consume
Weeks 3-6 ── Backend implements the same contracts ───┘ packages/contracts
Week 6+  ── Swap mocks for real API, harden, ship
```

Why not backend first? The backend is almost empty, and the product's value is felt in the UX (camera → instant nutrition, a clear daily state, explained recipes). Designing the screens first will tell us exactly which endpoints and fields matter, so we don't build API surface nobody uses.

## 3. Target architecture

Monorepo with npm workspaces:

```
neurocal-workspace/
├── backend/                 # AWS Lambda + API Gateway, hexagonal architecture
│   └── src/
│       ├── domain/          # entities + value objects, no external deps
│       ├── application/     # use cases + ports (IAiVisionProvider, IRepositories, …)
│       ├── infrastructure/  # Drizzle schema/repos, OpenAI + Claude adapters, search, email
│       └── presentation/    # Lambda handlers, API Gateway DTOs
├── web-poc/                 # Next.js web proof of concept (mobile-first PWA)
├── mobile-app/              # Flutter (iOS + Android)
└── packages/
    └── contracts/           # Zod schemas: single source of truth for the API
```

`packages/contracts` stays the source of truth for every request and response. The backend validates with it, `web-poc` parses with it, and an OpenAPI document generated from it will give Flutter a typed Dart client.

### Web POC stack
| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router) + React 19 + TypeScript** | Chosen on `main` |
| Server state | **TanStack Query** | Caching, refetch after logging, offline retry |
| Styling | **Tailwind CSS v4** mapped to our own design tokens | Speed, but the look is ours |
| Primitives | **Radix UI** (unstyled) | Accessible sheets and dialogs without a stock look |
| Fonts | `next/font/google`: Plus Jakarta Sans | Self-hosted at build, no layout shift |
| Mocks | **MSW** (browser only, loaded with `ssr: false`) | Runs fully without the backend |
| Tests | Vitest + Testing Library (+ Playwright for screenshots) | MSW is ESM-only, which Jest handles poorly |

### Backend stack
- **AWS Serverless:** Lambda, API Gateway, S3 (meal photos), EventBridge (scheduled Focus Score and telemetry jobs)
- **Aurora PostgreSQL Serverless v2 + `pgvector`** via Drizzle
- **AI:** OpenAI `gpt-4o` (vision) and `text-embedding-3-small` (vectors); Anthropic `claude-haiku-4-5` (recipe search queries). All behind the existing ports; every LLM output is validated against a schema
- **Search / email:** Tavily search (Brave and Google Custom Search as fallbacks), Resend
- **Tests:** Jest with fake providers for use cases

## 4. Design approach — no templates

### The skill
The best-fit Claude Code skill is Anthropic's official **`frontend-design`** skill (from `anthropics/claude-plugins-official`, Apache-2.0). It is built specifically to stop generated UIs from looking templated: it forces a subject-grounded design plan (palette, type, layout, principles), a review of that plan against known "AI default" looks, then build and self-critique with screenshots.

It is **vendored into this repo** at `.claude/skills/frontend-design/`, so every Claude Code session in this project loads it automatically — no plugin install needed. (It is also installable as the `frontend-design` plugin from the Anthropic directory if you want it globally.)

Complementary, optional: the Anthropic **Design** plugin (accessibility review, design critique, design-system skills) for later audits.

### Design direction (from the NeuroCal onboarding and Today v2 designs, October 2026)

The source is the Claude Design file "NeuroCal onboarding" (intro, sign in, create account, confirm email, the 11-step bio-profile onboarding, "Profile saved") with "NC Today v2" embedded. Tokens live in `web-poc/src/styles/tokens.css`; nothing in the app hard-codes a colour or size.

- **Look.** Light page `#F3F4FA` with white cards, or dark `#0E1325` with `#161C31` cards; one violet primary (`#6A4FDB` / `#9D85FA`), teal for the logo's spark, green for "good" and amber for "watch this". Cards have a 1px border and no shadow; only chips, toasts and the main button float.
- **Type.** Plus Jakarta Sans throughout: 800 for titles and figures, 700 for buttons and section titles, 600 for labels. Sizes 12 to 56 px are the `--text-*` scale.
- **Shape.** Pills for buttons and chips, 16 px for fields and option rows, 20 px for cards, 24 px for the Focus Score card.
- **Signature.** The Focus Score ring: a blue-to-teal arc on a quiet track. It is the hero of Today, the payoff of the intro and, dashed, the "no score yet" state.
- **Motion.** The intro's illustration glides between five poses with a spring; onboarding steps slide in from the side they come from; selections scale up slightly. All of it stops under `prefers-reduced-motion`.
- **Copy.** Sentence case, plain verbs, the same action name through a flow. Onboarding step eyebrows are the one uppercase label, as designed.

The rest of the app follows the second Claude Design file (Today, This week, Sleep and evenings, Settings, Manage products, the four bottom sheets): a bottom tab bar for the four main screens, toasts at the top with a tick, "i" or "!" dot, floating actions above the tab bar, and one shared set of loading, empty and failed states (`ListStates.tsx`, `Screen.tsx`). Times on charts and tables are 24-hour.

## 5. Phased execution

### Phase 0 — Foundations
- [x] `.gitignore`; untrack `node_modules` and `.DS_Store`
- [x] Vendor `frontend-design` skill; fill `CLAUDE.md`
- [x] npm workspaces (`backend`, `web-poc`, `packages/contracts`); shared `tsconfig.base.json`
- [x] Jest for backend and contracts, Vitest for web; GitHub Actions CI (typecheck, test, build)
- [x] `packages/contracts`: Zod schemas for the endpoints in §6
- [ ] ESLint + Prettier
- [x] Generate OpenAPI from `packages/contracts` (for Flutter codegen): `npm run openapi -w @neurocal/contracts` writes `packages/contracts/openapi.json` (OpenAPI 3.1); a contracts test fails when the file is out of date
- [x] Write `ARCHITECTURE.md` (schemas, ports, system prompts)

### Phase 1 — Design system
- [x] `frontend-design` two-pass review. Revision: meals are a ruled timeline with times in the margin instead of a card stack; corner radius follows hierarchy; one elevation, for sheets only
- [x] Tokens (`web-poc/src/styles/tokens.css`) + dark theme, exposed as Tailwind utilities
- [x] Components: Button, Sheet, Toast, MealTimeline, MacroLegend, FlagSummary, SuggestedMeal, **BioStateDial**
- [x] Component lab at `/lab`
- [ ] Playwright screenshot tests of `/lab` and Today in CI

### Phase 2 — Web POC screens on the mock API
1. ✅ **Intro and onboarding** — a five-slide intro for first visits (`/intro`), then the 11-step bio-profile onboarding for new accounts (`/welcome`): chronotype, diet and fasting, coffee, environment, hydration, recovery, supplements, training, friction point and goal, ending in a starting macro ratio, eating window, caffeine curfew and amber-light time. "Edit profile" keeps the earlier four steps. The friction point, fasting schedule and training answers steer the recipe query, and the friction point is matched to protocols and products. _To do: device connections (shown as "Coming soon"); leave out supplements the person already takes; a "Forgot password?" flow_
2. ✅ **Today** — Focus Score card, the four signals with "log it" actions for missing ones, calories left, what to eat next, meals
3. ✅ **Log a meal** — photo → editable items → confirm, or add items by hand; high glycemic load is flagged in the sheet and on the meal timeline
4. ✅ **Check-in** — cognitive flags that feed recommendations
5. ✅ **Focus Score** — daily score with the inputs behind it, plus a "Log sleep" sheet (ARCHITECTURE §6.7–6.8)
6. ✅ **Sleep & circadian** — seven nights on one clock axis (sleep, last meal, screens after 10pm), late-eating and screen-time insights computed from the week, "Log screen time" sheet (`/sleep`; `/history` now also returns bedtime, wake time and late screen minutes)
7. ✅ **Protocols & products** — matched to the week's weak points with pgvector; affiliate links labelled ("What could help" on `/history`)
8. ✅ **History** — the past week as aligned Focus Score / calories / sleep charts with a day-by-day table (`/history`)
9. ✅ **Settings / profile** — profile summary with "Edit profile", appearance (match device, light, dark; saved on the device), account and sign out (`/settings`). _To do: daily summary email opt-in, once ARCHITECTURE §6.10 has a contract_
- [x] PWA install: web manifest and icons, "Install NeuroCal" in Settings (Share-menu steps on iPhone)
- [x] Offline queue for meal logs: a meal that gets no response is kept on the device and sent when the connection returns. Each meal carries a `clientKey`, so a lost response can't log it twice. _To do: a service worker so the app itself opens offline (it must share a scope with the MSW mock worker)_

### Phase 3 — Backend on AWS
- [x] Domain entities (ARCHITECTURE §3); Drizzle schema + first migration for the core tables (§4)
- [ ] Planned tables incl. `pgvector` HNSW indexes (§4)
- [x] Ports for the built use cases (§5); in-memory fakes in `backend/src/application/testing`
- [x] Drizzle repository adapters + integration tests against Postgres (PGlite)
- [x] AnalyzeMealPhoto, LogMeal, DeleteMeal, RecordCheckIn, GetBioState use cases (§6.1–6.5)
- [x] OpenAI vision adapter (§7.1)
- [x] `RecommendRecipeUseCase` (§6.6)
- [x] Claude reasoning adapter + Google Custom Search adapter (§7.2)
- [x] Tavily search adapter (and a Brave one) with recipe-page nutrition lookup; the provider is chosen by which key is set (Google refuses the Custom Search API for new projects). The query prompt now asks for dish-style queries, which is what returns recipes. _To do: add `TAVILY_API_KEY` to the dev secret and redeploy; settle the allow-list (ARCHITECTURE §11.4)_
- [x] Telemetry ingest + Focus Score use case with Claude explanation (§6.7–6.8, §7.4)
- [x] Embeddings + vector recommendation use case, catalog sync, pgvector HNSW (§6.9, §7.3)
- [x] Partner and own-brand products: TrueDark, Danger Coffee and BodyHealth as affiliates, the other product brands Dave Asprey recommends, and the MitoProof range; own-brand supplements are suggested before other brands'. Product admin at `/admin` (links, affiliate label, on/off, add and remove). _To do: enter NeuroCal's tracking links in the admin screen; embed the catalog (needs OpenAI credits); check the MitoProof descriptions against the labels_
- [x] HTTP routes for all 9 endpoints + Lambda entry point (JWT claims from API Gateway)
- [x] Infrastructure as code in `infra/` (CDK): HTTP API + Cognito JWT authorizer, Lambda bundling, Aurora Serverless v2 + pgvector, Secrets Manager, migrations on deploy, catalog-sync Lambda, photo bucket (ARCHITECTURE §12)
- [x] Web sign-in: create account, email code, sign in and out (Cognito via Amplify; local mock without it)
- [x] First deploy to a `dev` stage (`NeuroCal-dev`, us-east-1)
- [x] S3 presigned photo upload: `POST /uploads/meal-photo`, then `/meals/analyze` by key; the web app uses it, multipart still works for the mobile app. _To do: move the mobile app to uploads; attach the photo to the saved meal_
- [ ] EventBridge schedules (nightly Focus Score, daily summary)
- [x] Local dev server (`npm run dev` in `backend`); web-poc runs against it end to end
- [ ] Jest use-case tests with fake providers; integration tests against Postgres

### Phase 4 — Mobile, integration and launch
**Direction (agreed October 2026): the mobile app is the product.** Health data (Apple Health, Oura, Whoop) is only reachable natively, and the app is a daily habit that needs the camera and notifications. The web app stays as a companion and hosts the admin screen, frozen at its current feature set; new features go to Flutter first. The domain root becomes a landing page for signed-out visitors (what NeuroCal does, screens, store buttons or a waitlist, a small "Sign in" link). Order of work:
1. Bring the Flutter app up to the Claude Design screens (tab bar, Today, This week, Sleep and evenings, Settings, the four sheets).
2. Build the landing page. _Done: signed-out visitors to the home page see `Landing.tsx` (what it does, a sample Focus Score, a day in order, what the score is made of, how links are labelled); it is server-rendered, and a pre-paint hint hides it from people who are signed in. To do: store buttons once the apps are published._
3. Health data connections on mobile.
4. Leave the web app as it is unless something is cheap to add.

- [x] Flutter app on the same API and Cognito pool, same tokens, font, logo and app icon (`mobile-app/`, build steps in its README)
- [x] Mobile: the new tokens, the Focus Score ring and the 11-step bio-profile onboarding for accounts without a profile (the time zone comes from the device). Then the tab bar, top toasts, Today and Settings from the second design file. Then This week, Sleep and evenings, and the Check in, Log sleep and Log screen time sheets. The Log a meal sheet follows the design too (photo tiles, reading, tick the items, add by hand with macros). _To do: the intro slides, "Edit profile", custom tab icons_
- [ ] Generate the Dart client from `openapi.json` instead of the hand-written models; add Sleep, History and protocols screens
- [ ] Point `web-poc` at the real API (`NEXT_PUBLIC_API_URL`); E2E on the critical path
- [ ] Accessibility and performance pass
- [ ] Observability and AI cost tracking per request

## 6. First API contract (drives mocks and backend)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/me` | Profile + targets |
| `PUT` | `/me/profile` | Update goals, diet preference |
| `GET` | `/bio-state?date=` | Calories remaining, macro focus, cognitive flags |
| `POST` | `/check-ins` | Record cognitive flags |
| `POST` | `/meals/analyze` | Photo → proposed `FoodItem[]` (not yet saved) |
| `POST` | `/meals` | Save confirmed meal |
| `GET` | `/meals?date=` | Day's meals |
| `DELETE` | `/meals/:id` | Remove a meal |
| `GET` | `/recommendations/next` | Recipe suggestions + reasoning for current bio-state |

## 7. Open questions
1. **Anthropic model:** decided: `claude-haiku-4-5` for recipe queries and Focus Score explanations (ARCHITECTURE §7).
2. **Design direction:** decided — the Claude Design files, light and dark, Plus Jakarta Sans (see Design direction).
3. **Auth provider** for the API (Cognito proposed in ARCHITECTURE §10).
4. **Affiliate recommendations:** how they are disclosed in the UI.
