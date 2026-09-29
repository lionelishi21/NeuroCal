# NeuroCal

Nutrition companion that logs meals from a photo and suggests what to eat next based on how you want to think and feel.

## Run it

Requires Node 22 and pnpm 10.

```sh
pnpm install
pnpm dev          # web app on http://localhost:5173 using the built-in mock API
```

- `/` — Today: bio-state dial, meals, check-in, suggestions
- `/lab` — component states for design review

Set `VITE_API_URL` in `apps/web/.env.local` to point at a real API instead of the mocks.

## Workspace

| Path | What |
|---|---|
| `apps/web` | React + Vite PWA |
| `packages/contracts` | Zod schemas shared by web and backend |
| `backend` | Clean-architecture API (in progress) |

```sh
pnpm typecheck
pnpm test
pnpm build
```

Roadmap and design direction: [`docs/EXECUTION_PLAN.md`](docs/EXECUTION_PLAN.md).
