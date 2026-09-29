# Claude Code Project Context: NeuroCal AI Monorepo

## Workspace Structure
This repository is organized as a monorepo containing three core applications:
- `/backend`: Node.js Serverless API (Hexagonal / Clean Architecture)
- `/web-poc`: Next.js (React) Web Proof of Concept
- `/mobile-app`: Flutter Mobile Application (iOS & Android)

## Core Tech Stack
- **Backend:** Node.js (v20+ LTS), TypeScript (Strict Mode), AWS Serverless (Lambda, API Gateway, S3, EventBridge)
- **Database:** PostgreSQL (AWS Aurora Serverless v2) + `pgvector` extension via Drizzle ORM
- **Inference & APIs:** OpenAI (`gpt-4o`, `text-embedding-3-small`), Anthropic (`claude-3-5-haiku`), Resend API, Google Custom Search API
- **Web & Mobile:** Next.js / React (Web POC) & Flutter (Mobile App)

## Backend Architecture & Rules (`/backend`)
- **Directory Mapping:**
  - `backend/src/domain/*`: Business entities & value objects (NO external dependencies)
  - `backend/src/application/*`: Use cases & port interfaces (`IAiVisionProvider`, `IMealRepository`)
  - `backend/src/infrastructure/*`: Database (`schema.ts`), AI adapters, search, email, config
  - `backend/src/presentation/*`: Lambda handlers, API Gateway DTOs, formatters
- **SOLID Compliance:** Always code to interfaces (`IAiVisionProvider`, `IRepositories`); never inject concrete infrastructure classes directly into use cases.
- **LLM Safety:** Enforce structured JSON schema validation for all LLM outputs.

## Key Reference Docs
- See `ARCHITECTURE.md` at the root for full database schemas, TypeScript interfaces, system prompts, and use cases.

## Development Workflows
- **Backend (`/backend`):**
  - `cd backend && npm install` - Install backend dependencies
  - `cd backend && npm run build` - Compile TypeScript to `/backend/dist`
  - `cd backend && npm run test` - Execute Jest unit test suite
  - `cd backend && npm run dev` - Run local serverless environment
- **Web POC (`/web-poc`):**
  - `cd web-poc && npm run dev` - Run Next.js local dev server
- **Mobile App (`/mobile-app`):**
  - `cd mobile-app && flutter run` - Run Flutter app on emulator/device