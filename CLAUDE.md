# Claude Code Project Context: NeuroCal AI Monorepo

## Workspace Structure
This repository is organized as a monorepo (npm workspaces) containing three core applications and one shared package:
- `/backend`: Node.js Serverless API (Hexagonal / Clean Architecture)
- `/web-poc`: Next.js (React) Web Proof of Concept
- `/mobile-app`: Flutter Mobile Application (iOS & Android)
- `/packages/contracts`: Zod schemas for every API request/response, shared by backend and web. Change the contract first, then both sides.

## Core Tech Stack
- **Backend:** Node.js (v20+ LTS), TypeScript (Strict Mode), AWS Serverless (Lambda, API Gateway, S3, EventBridge)
- **Database:** PostgreSQL (AWS Aurora Serverless v2) + `pgvector` extension via Drizzle ORM
- **Inference & APIs:** OpenAI (`gpt-4o`, `text-embedding-3-small`), Anthropic (`claude-haiku-4-5`), Resend API, Google Custom Search API
- **Web & Mobile:** Next.js / React (Web POC) & Flutter (Mobile App)

## Backend Architecture & Rules (`/backend`)
- **Directory Mapping:**
  - `backend/src/domain/*`: Business entities & value objects (NO external dependencies)
  - `backend/src/application/*`: Use cases & port interfaces (`IAiVisionProvider`, `IMealRepository`)
  - `backend/src/infrastructure/*`: Database (`schema.ts`), AI adapters, search, email, config
  - `backend/src/presentation/*`: Lambda handlers, API Gateway DTOs, formatters
- **SOLID Compliance:** Always code to interfaces (`IAiVisionProvider`, `IRepositories`); never inject concrete infrastructure classes directly into use cases.
- **LLM Safety:** Enforce structured JSON schema validation for all LLM outputs.

## Web POC Rules (`/web-poc`)
- Use the `frontend-design` skill (`.claude/skills/frontend-design/`) for any new screen or visual change.
- Use the design tokens in `web-poc/src/styles/tokens.css` — never hard-code colors, font sizes or spacing.
- No stock UI themes or templates. Radix primitives are fine; their look must come from our tokens.
- Mobile-first; visible keyboard focus; respect `prefers-reduced-motion`.
- Copy: sentence case, plain verbs, same action name through a flow ("Log a meal" → "Meal logged").
- Without `NEXT_PUBLIC_API_URL`, the app runs on the MSW mock API in `web-poc/src/mocks`, built from `packages/contracts`.

## Key Reference Docs
- See `ARCHITECTURE.md` at the root for full database schemas, TypeScript interfaces, system prompts, and use cases.
- See `docs/EXECUTION_PLAN.md` for the roadmap, phases and design direction.

## Development Workflows
- **All packages (repo root):**
  - `npm install` - Install every workspace
  - `npm run typecheck` / `npm test` / `npm run build` - Run across all workspaces
- **Backend (`/backend`):**
  - `cd backend && npm run build` - Compile TypeScript to `/backend/dist`
  - `cd backend && npm run test` - Execute Jest unit test suite
  - `cd backend && npm run dev` - Run local serverless environment (not set up yet, Phase 3)
- **Web POC (`/web-poc`):**
  - `cd web-poc && npm run dev` - Run Next.js local dev server
  - `cd web-poc && npm run test` - Vitest + Testing Library (Vitest, not Jest, because MSW is ESM-only)
- **Mobile App (`/mobile-app`):**
  - `cd mobile-app && flutter run` - Run Flutter app on emulator/device

## Conventions
- Never commit `node_modules`, `.env` files or `.DS_Store`.
- Tests next to code (`*.test.ts`); use cases are tested with fake providers.
