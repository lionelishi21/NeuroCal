# NeuroCal

Nutrition companion that tracks meals (AI photo analysis) and recommends recipes based on the user's "bio-state": calories remaining, macro focus, cognitive flags (focus, energy, calm) and dietary preference.

The roadmap, architecture and design direction live in `docs/EXECUTION_PLAN.md`. Read it before starting a new phase.

## Layout
- `backend/` — TypeScript clean architecture: `application/` (use-cases, interfaces), `infrastructure/` (Drizzle/Postgres, AI and search adapters). Use-cases depend only on interfaces.
- `apps/web/` (planned) — React + Vite PWA.
- `packages/contracts/` (planned) — Zod schemas shared by web and backend. Change the contract first, then both sides.

## Frontend design rules
- Use the `frontend-design` skill (`.claude/skills/frontend-design/`) for any new screen or visual change.
- Use the design tokens (CSS variables) — never hard-code colors, font sizes or spacing.
- No stock UI themes or templates. Radix primitives are fine; their look must come from our tokens.
- Mobile-first; visible keyboard focus; respect `prefers-reduced-motion`.
- Copy: sentence case, plain verbs, same action name through a flow ("Log a meal" → "Meal logged").

## Conventions
- Never commit `node_modules`, `.env` files or `.DS_Store`.
- Tests next to code (`*.test.ts`); use-cases are tested with fake providers.
