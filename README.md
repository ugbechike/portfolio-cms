# portfolio-cms

A private editorial workspace for an engineering portfolio: Next.js Pages Router, Fastify, Supabase Auth and private Storage, PostgreSQL, Drizzle, shared Zod contracts, and pnpm workspaces.

## Run locally

Use Node 22.20+ and pnpm 10.33.0.

```sh
nvm install 22
nvm use 22
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env
cp apps/cms/.env.example apps/cms/.env.local
```

Fill the files using [deployment setup](docs/DEPLOYMENT.md). The CMS starts without credentials and shows connection instructions; the API intentionally fails closed without required configuration.

```sh
# Export the DATABASE_URL from the Supabase Connect panel (never commit it).
export DATABASE_URL='postgresql://...'
pnpm db:migrate
# Apply packages/database/supabase-storage.sql in Supabase SQL editor.
pnpm dev
```

CMS: http://localhost:3000 · API: http://localhost:4000 · health: http://localhost:4000/health

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm run import scripts/fixtures/empty.json --dry-run
```

## Architecture

- `apps/cms`: server-protected administration, email/password login, project and case-study editor, profile, experience, Markdown notes, private media library, revision restore, preview, explicit publication.
- `apps/api`: bearer-token verification via Supabase `getUser`, fixed administrator allowlist, versioned REST routes, validation, rate limiting, restricted CORS, multipart uploads.
- `packages/contracts`: framework-independent discriminated Zod schemas, DTOs and constraints.
- `packages/database`: Drizzle schema, SQL migration and migration runner.
- `packages/content`: repositories, content and import services; transactions own revisions and publication.
- `tests`: database-backed behavior tests using PGlite (embedded PostgreSQL); no external credentials needed.

Content uses a relational `content` table for stable UUID, kind, unique slug, status and version. Typed JSONB holds each kind's editable payload and published snapshot. `revisions`, `media`, and `content_media` are separate relations. The join preserves references in both draft and published snapshots. This avoids separate, almost identical publication mechanisms per content kind while keeping schema validation strict.

A published record may have newer unpublished draft edits. Its `status` remains `published` until unpublished or archived. Saving never promotes it. Archive withdraws the published snapshot; restoring a revision affects only the draft. Revision records survive deletion for audit/recovery. The CMS restores revisions for existing content; deleted content can be recovered through an explicit reviewed import using a revision payload.

No portfolio content is invented or preloaded. Empty workspace states are intentional. Playground filters personal projects.

## Documentation

- [API reference](docs/API.md)
- [Supabase, Railway and Vercel deployment](docs/DEPLOYMENT.md)
- [Import format and migration procedure](docs/CONTENT_MIGRATION.md)
- [Future MCP architecture](docs/MCP_INTEGRATION.md)
- [Verification and limitations](docs/VERIFICATION.md)

The Supabase management MCP connection is configured in Codex, separately from application credentials. No custom portfolio MCP server is implemented. No automatic deployment occurs.
