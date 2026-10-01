# NeuroCal — Execution Plan

_Last updated: 2026-10-01_

## 1. Where the project is today

The product direction comes from `README.md` and `CLAUDE.md` on `main`. NeuroCal AI connects metabolic tracking (calories and macros) with cognitive performance:

- **Calorie & macro vision:** meal photo → items, calories, macros, high-glycemic flags (OpenAI `gpt-4o`)
- **Focus Score engine:** a daily score from sleep telemetry, diet and self-reported stress
- **Circadian telemetry:** late-night screen time and late eating vs. melatonin and weight plateaus
- **Dynamic recipe routing:** macro gaps → search query (Anthropic Claude) → recipes from trusted domains (Google Custom Search)
- **Vector recommendations:** `pgvector` matches a user's weak points (e.g. "poor deep sleep") to protocols and products

| Area | State |
|---|---|
| `packages/contracts` | Zod schemas for 9 endpoints, 3 Jest tests |
| `web-poc/` | Next.js app: Today screen, log-meal and check-in flows on a mock API, 7 Vitest tests |
| `backend/` | Hexagonal skeleton; only `IAiReasoningProvider.ts` has code |
| `mobile-app/` | Not started (Flutter) |
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
- **Search / email:** Google Custom Search, Resend
- **Tests:** Jest with fake providers for use cases

## 4. Design approach — no templates

### The skill
The best-fit Claude Code skill is Anthropic's official **`frontend-design`** skill (from `anthropics/claude-plugins-official`, Apache-2.0). It is built specifically to stop generated UIs from looking templated: it forces a subject-grounded design plan (palette, type, layout, principles), a review of that plan against known "AI default" looks, then build and self-critique with screenshots.

It is **vendored into this repo** at `.claude/skills/frontend-design/`, so every Claude Code session in this project loads it automatically — no plugin install needed. (It is also installable as the `frontend-design` plugin from the Anthropic directory if you want it globally.)

Complementary, optional: the Anthropic **Design** plugin (accessibility review, design critique, design-system skills) for later audits.

### Proposed design direction (draft — to be validated in Phase 1)

**Subject, audience, job.** NeuroCal is a nutrition companion for people who eat to think clearly — knowledge workers, students, athletes managing focus and energy. Its primary job: *tell me, right now, what my body has and what my mind needs, and what to eat next.*

**Concept: "instrument panel."** A premium biohacker look (chosen from mockups): dark by default, light when the phone is set to light, unless the viewer picks Light or Dark (Settings → Appearance, or the switch on the sign-in screens; saved per device and applied before first paint). One glowing element per screen carries the boldness; everything around it is quiet instrumentation. Mockups: `NeuroCal Night Lab` artifact.

**Colour means a body system**, in both modes (tokens in `web-poc/src/styles/tokens.css`):
| Token | Dark | Light | Meaning |
|---|---|---|---|
| `synapse` | `#9D86FF` | `#6A4FE0` | Focus, AI reasoning, primary buttons (solid) |
| `ion` | `#43D9C8` | `#0C9D8F` | Focus ring end, the logo's spark |
| `sleep` | `#5B8DFF` | `#2B5FDC` | Sleep |
| `glucose` | `#F4B24C` | `#D8962C` | Energy: calories, carbs |
| `chlorophyll` | `#4FD49F` | `#13875A` | Protein, good |
| `beet` | `#FF6F8A` | `#D0385A` | Over budget, errors |

Surfaces: `mist` page (`#0C1324` / `#F3F5FA`), `paper` panels, `rule` hairlines, `glow` for the ambient light behind heroes.

**Type.** **Plus Jakarta Sans** for everything (headings, numbers, UI), bold weights for figures, tabular numerals for data. Sentence case, no all-caps labels except the NEUROCAL mark.

**Signature element — the Focus ring.** Today opens with the Focus Score in a violet-to-teal ring with a soft glow, its four inputs (sleep, evening timing, glycemic load, stress) as colour-coded bars underneath, and the AI explanation in a panel. Energy (the bio-state dial), what to eat next and meals sit in panels beside it.

**Layout.** Mobile-first single column, left-aligned, bottom-sheet interactions (log meal, adjust item) rather than modal pages. Desktop becomes two panes: the dial on the left, the day's log and recommendations on the right.

```
Mobile — Today                  Desktop — Today
┌──────────────────────┐        ┌──────────────┬───────────────────────┐
│ Tue 29 Sep     (you) │        │              │ Today's meals         │
│                      │        │   BIO-STATE  │  Breakfast  420 kcal  │
│      ╭──────╮        │        │     DIAL     │  Lunch      610 kcal  │
│     (  840   )       │        │              │───────────────────────│
│      ╰──────╯ left   │        │  flags:      │ Suggested next meal   │
│  focus · low energy  │        │  low focus   │  recipe + "why"       │
├──────────────────────┤        │              │                       │
│ Meals today          │        └──────────────┴───────────────────────┘
│ Suggested next meal  │
│      [ Log a meal ]  │  ← thumb-reach primary action
└──────────────────────┘
```

**Motion.** One orchestrated moment: the dial filling on load and re-settling after a meal is logged. Everything else is action feedback only (sheet opens, item confirmed).

**Copy.** Plain, second person, sentence case. "Log a meal", toast "Meal logged". Errors say what happened and how to fix it ("We couldn't read that photo — try better light or add items by hand").

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
1. ✅ **Onboarding** — name, time zone, dietary preference, cognitive goals, calorie and macro targets (`/welcome`, also used to edit the profile)
2. ✅ **Today** — dial, meals, check-in, what to eat next
3. ✅ **Log a meal** — photo → editable items → confirm, or add items by hand; high glycemic load is flagged in the sheet and on the meal timeline
4. ✅ **Check-in** — cognitive flags that feed recommendations
5. ✅ **Focus Score** — daily score with the inputs behind it, plus a "Log sleep" sheet (ARCHITECTURE §6.7–6.8)
6. ✅ **Sleep & circadian** — seven nights on one clock axis (sleep, last meal, screens after 10pm), late-eating and screen-time insights computed from the week, "Log screen time" sheet (`/sleep`; `/history` now also returns bedtime, wake time and late screen minutes)
7. ✅ **Protocols & products** — matched to the week's weak points with pgvector; affiliate links labelled ("What could help" on `/history`)
8. ✅ **History** — the past week as aligned Focus Score / calories / sleep charts with a day-by-day table (`/history`)
9. ✅ **Settings / profile** — profile summary with "Edit profile", appearance (match device, light, dark; saved on the device), account and sign out (`/settings`). _To do: daily summary email opt-in, once ARCHITECTURE §6.10 has a contract_
- [x] PWA install: web manifest and icons, "Install NeuroCal" in Settings (Share-menu steps on iPhone)
- [x] Offline queue for meal logs: a meal that gets no response is kept on the device and sent when the connection returns. _To do: an idempotency key on `POST /meals`, so a lost response can't log a meal twice; a service worker so the app itself opens offline (it must share a scope with the MSW mock worker)_

### Phase 3 — Backend on AWS
- [x] Domain entities (ARCHITECTURE §3); Drizzle schema + first migration for the core tables (§4)
- [ ] Planned tables incl. `pgvector` HNSW indexes (§4)
- [x] Ports for the built use cases (§5); in-memory fakes in `backend/src/application/testing`
- [x] Drizzle repository adapters + integration tests against Postgres (PGlite)
- [x] AnalyzeMealPhoto, LogMeal, DeleteMeal, RecordCheckIn, GetBioState use cases (§6.1–6.5)
- [x] OpenAI vision adapter (§7.1)
- [x] `RecommendRecipeUseCase` (§6.6)
- [x] Claude reasoning adapter + Google Custom Search adapter (§7.2)
- [x] Telemetry ingest + Focus Score use case with Claude explanation (§6.7–6.8, §7.4)
- [x] Embeddings + vector recommendation use case, catalog sync, pgvector HNSW (§6.9, §7.3)
- [ ] Real protocol/product content and partner links (catalog.ts)
- [x] HTTP routes for all 9 endpoints + Lambda entry point (JWT claims from API Gateway)
- [x] Infrastructure as code in `infra/` (CDK): HTTP API + Cognito JWT authorizer, Lambda bundling, Aurora Serverless v2 + pgvector, Secrets Manager, migrations on deploy, catalog-sync Lambda, photo bucket (ARCHITECTURE §12)
- [x] Web sign-in: create account, email code, sign in and out (Cognito via Amplify; local mock without it)
- [ ] First deploy to a `dev` stage
- [ ] EventBridge schedules (nightly Focus Score, daily summary) and S3 presigned photo upload
- [x] Local dev server (`npm run dev` in `backend`); web-poc runs against it end to end
- [ ] Jest use-case tests with fake providers; integration tests against Postgres

### Phase 4 — Mobile, integration and launch
- [ ] Flutter app on the same API (Dart client generated from OpenAPI)
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
2. **Design direction:** decided — "instrument panel", dark and light, Plus Jakarta Sans (see Design direction).
3. **Auth provider** for the API (Cognito proposed in ARCHITECTURE §10).
4. **Affiliate recommendations:** how they are disclosed in the UI.
