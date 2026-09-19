# Marginalia

A private learning companion that turns dense PDFs into focused reading rooms, annotations, quizzes, and practice games.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Clerk and App Storage are provisioned through the workspace-managed integrations.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/marginalia` — React + Vite web app and the Marginalia visual language
- `artifacts/api-server` — Express API, Clerk middleware, study-set routes, and private object serving
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/db/src/schema/study-sets.ts` — Study Set and Document tables
- `lib/api-client-react/src/generated` — generated React Query client hooks

## Architecture decisions

- Clerk owns browser authentication; API routes derive the current user from the Clerk session cookie.
- PDF bytes are stored in private App Storage; PostgreSQL stores only ownership, metadata, and the returned object path.
- The Home surface is public for signed-out visitors and redirects signed-in users into the private portal.
- OpenAPI remains the contract boundary; generated hooks are used by the frontend for dashboard, Study Set, and upload requests.

## Product

- Branded landing, sign-in, and sign-up screens
- Private Home dashboard with Study Set creation from up to five PDFs
- Study Set hub shell with document metadata and future learning modes
- Private per-user object access for uploaded PDFs

## User preferences

- Warm, hand-illustrated, folk-art inspired direction with a calm paper-like reading surface.

## Gotchas

- Run API codegen after changing `lib/api-spec/openapi.yaml`.
- Run `pnpm --filter @workspace/db run push` after changing Drizzle schema.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
