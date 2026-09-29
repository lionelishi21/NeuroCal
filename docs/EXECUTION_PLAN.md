# NeuroCal — Execution Plan

_Last updated: 2026-09-29_

## 1. Where the project is today

| Area | State |
|---|---|
| `README.md`, `CLAUDE.md`, `ARCHITECTURE.md` | Empty / title only |
| `backend/` | Clean-architecture skeleton (`application/`, `infrastructure/`). Only `IAiReasoningProvider.ts` has code; every other file is 0 bytes |
| Dependencies | `drizzle-orm`, `pg`, `drizzle-kit`, `tsx` — no HTTP framework, no TypeScript config, no tests |
| Frontend | Does not exist |
| Repo hygiene | `backend/node_modules` (macOS binaries) and `.DS_Store` were committed — now untracked via `.gitignore` |

What the skeleton tells us about the product:

- **Log a meal** (`LogMealUseCase`, `IAiVisionProvider`) — the user snaps a photo, AI vision identifies foods and estimates calories/macros.
- **Recommend a recipe** (`RecommendRecipeUseCase`, `IAiReasoningProvider`, `ISearchEngineAdapter`) — AI reasons over the user's *bio-state* (calories remaining, macro focus, **cognitive flags** such as "brain fog" or "low focus", dietary preference), builds a search query, and a search engine returns real recipes with an explanation of why.
- The differentiator is the **"neuro"** part: nutrition framed around how you want to *think and feel*, not only weight.

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

Monorepo with pnpm workspaces:

```
neurocal/
├── apps/
│   └── web/                 # React PWA (mobile-first, installable, camera access)
├── backend/                 # existing clean-architecture API (kept, filled in)
│   └── src/
│       ├── domain/          # entities + value objects (Meal, FoodItem, BioState, Recipe)
│       ├── application/     # use-cases + interfaces (already scaffolded)
│       ├── infrastructure/  # drizzle schema/repos, Claude vision+reasoning, search adapter
│       └── interface/http/  # routes, validation, auth middleware
└── packages/
    └── contracts/           # Zod schemas → TS types + OpenAPI; single source of truth
```

### Frontend stack
| Concern | Choice | Why |
|---|---|---|
| Build | **Vite + React 19 + TypeScript** | Separate backend already exists; a SPA/PWA is leaner than Next.js here |
| Routing | **TanStack Router** | Type-safe routes and search params |
| Server state | **TanStack Query** | Caching, optimistic meal logging, offline retry |
| Styling | **Tailwind CSS v4** with our own design tokens (CSS variables) | Speed, but tokens are ours — no stock theme |
| Primitives | **Radix UI** (unstyled) | Accessible dialogs/sheets/menus without inheriting someone else's look |
| Motion | **Motion** (framer) | One signature moment + action feedback only |
| Charts | **visx** or hand-rolled SVG | The bio-state dial is custom; no dashboard-kit charts |
| Mocks | **MSW** | Frontend runs fully without the backend |
| PWA | `vite-plugin-pwa` | Install to home screen, camera, offline queue |
| Tests | Vitest + Testing Library + Playwright | Unit + E2E; Playwright doubles as screenshot review |

### Backend stack (when we get there)
- **Hono** (or Fastify) on Node 22, Zod validation from `packages/contracts`
- **Drizzle + Postgres** (already chosen) — tables: `users`, `profiles`, `meals`, `meal_items`, `daily_bio_state`, `recipe_recommendations`
- **AI**: Claude for both vision (meal photo → items/macros, structured JSON output) and reasoning (bio-state → search query + explanation); implement behind the existing `IAiVisionProvider` / `IAiReasoningProvider` interfaces so providers stay swappable
- **Search**: `ISearchEngineAdapter` → a recipe API (Spoonacular / Edamam) or web search
- **Auth**: Better Auth or Clerk
- Object storage for meal photos (S3/R2)

## 4. Design approach — no templates

### The skill
The best-fit Claude Code skill is Anthropic's official **`frontend-design`** skill (from `anthropics/claude-plugins-official`, Apache-2.0). It is built specifically to stop generated UIs from looking templated: it forces a subject-grounded design plan (palette, type, layout, principles), a review of that plan against known "AI default" looks, then build and self-critique with screenshots.

It is **vendored into this repo** at `.claude/skills/frontend-design/`, so every Claude Code session in this project loads it automatically — no plugin install needed. (It is also installable as the `frontend-design` plugin from the Anthropic directory if you want it globally.)

Complementary, optional: the Anthropic **Design** plugin (accessibility review, design critique, design-system skills) for later audits.

### Proposed design direction (draft — to be validated in Phase 1)

**Subject, audience, job.** NeuroCal is a nutrition companion for people who eat to think clearly — knowledge workers, students, athletes managing focus and energy. Its primary job: *tell me, right now, what my body has and what my mind needs, and what to eat next.*

**Concept: "field notes from the body."** Less fitness-app gamification, more a calm instrument — the feel of a well-made lab notebook crossed with a produce market. Data is precise; food is warm and real.

**Palette (5 named values)**
| Token | Hex | Role |
|---|---|---|
| `mist` | `#E9EEF0` | Cool, slightly blue paper background (deliberately not cream) |
| `ink` | `#1C2438` | Deep indigo text and structure |
| `chlorophyll` | `#2E7A57` | Primary action, protein/whole-food cues |
| `glucose` | `#E9A93A` | Energy — calorie budget and carbs |
| `synapse` | `#6B5BD6` | Cognitive flags and AI reasoning — the "neuro" colour, used sparingly |

Warning/over-budget uses a beetroot `#B23A5B`, only where something needs attention.

**Type.** One family carries the UI: **Schibsted Grotesk** (sentence case, tabular numerals for all nutrition data). One accent: **Fraunces** with its soft optical axis, used only for the big numbers on the Today dial. No monospace, no all-caps labels.

**Signature element — the Bio-State Dial.** The Today screen opens with a single living figure: an organic ring showing calories left (glucose arc), macro balance (inner segments) and today's cognitive flags as small synapse-coloured nodes. This is where the design spends its boldness; every other screen stays quiet and disciplined.

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

### Phase 0 — Foundations (1–2 days)
- [x] `.gitignore`; untrack `node_modules` and `.DS_Store`
- [x] Vendor `frontend-design` skill; fill `CLAUDE.md`
- [ ] Convert to pnpm workspace (`apps/web`, `backend`, `packages/contracts`)
- [ ] Shared `tsconfig`, ESLint, Prettier, Vitest; GitHub Actions CI (lint, typecheck, test)
- [ ] `packages/contracts`: Zod schemas for `Profile`, `FoodItem`, `Meal`, `BioState`, `CognitiveFlag`, `RecipeRecommendation` and request/response shapes for the endpoints in §6

### Phase 1 — Design system (3–4 days)
- [ ] Run the `frontend-design` two-pass process on the direction above; revise anything that reads as a default
- [ ] Tokens as CSS variables (color, type scale, spacing, radius, elevation, motion) + dark theme
- [ ] Core components on Radix: Button, Sheet, Field, Segmented control, Toast, Meal row, Macro bar, **BioStateDial**
- [ ] Component playground route (`/_lab`) with Playwright screenshots for visual review

### Phase 2 — Frontend screens on mock API (2–3 weeks)
1. **Onboarding** — goals, dietary preference, typical cognitive goals (focus, calm, energy)
2. **Today** — dial, meals list, suggested next meal
3. **Log a meal** — camera/upload → AI result with editable items → confirm (optimistic update). Manual search entry as fallback
4. **Check-in** — quick cognitive flags ("How's your head?") that feed the bio-state
5. **Recommendations** — recipe detail with the AI's reasoning shown plainly
6. **History** — week view, trends of energy/focus vs intake
7. **Settings / profile**
- MSW handlers return realistic fixture data from `packages/contracts`
- PWA install, offline queue for meal logs

### Phase 3 — Backend API (2–3 weeks, can start mid-Phase 2)
- [ ] Domain entities + Drizzle schema + migrations
- [ ] Repositories (`IRepositories.ts`)
- [ ] `LogMealUseCase` + Claude vision adapter (structured JSON output, confidence per item)
- [ ] `RecommendRecipeUseCase` + Claude reasoning adapter + recipe search adapter
- [ ] HTTP layer (Hono), auth, photo upload, rate limiting
- [ ] Use-case unit tests with fake providers; integration tests against Postgres (Testcontainers)

### Phase 4 — Integration & launch
- [ ] Swap MSW for the real API behind an env flag; E2E on the critical path (onboard → log meal → get recommendation)
- [ ] Accessibility pass (keyboard, contrast, reduced motion), performance budget (LCP < 2s on mid-range phone)
- [ ] Deploy: web to Vercel/Cloudflare Pages, API + Postgres to Fly/Railway/Neon
- [ ] Observability (Sentry), AI cost tracking per request

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

## 7. Decisions needed from you
1. **Platform:** web PWA first (recommended) vs native mobile (React Native/Expo). The plan assumes PWA; the contracts and backend are identical either way.
2. **Design direction:** approve, tweak, or reject the "field notes from the body" direction before Phase 1 starts.
3. **Recipe source:** paid recipe API (structured nutrition data) vs web search (broader, messier).
4. **Auth provider:** Better Auth (self-hosted, free) vs Clerk (hosted, faster).
