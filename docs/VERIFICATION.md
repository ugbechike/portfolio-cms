# Verification boundaries

Automated coverage uses the same Drizzle repository, content service, Fastify application and SQL migration as production, with an embedded PostgreSQL engine (PGlite) replacing the network driver in tests.

Covered behaviors include schema validation, unauthenticated and non-admin rejection, verifier failures, CRUD, explicit publication, private draft edits after publication, published-slug stability, failed-publish transaction rollback, stale edit conflicts, revision restore, archive/unpublish, retained deletion history, public filtering for every kind, pagination, media references, image signatures, import dry-run/idempotency/newer-content protection, and RLS activation.

Production authentication calls Supabase `getUser` using a server-created client for the configured project. Automated API tests inject a deterministic token verifier; they do not prove live Supabase connectivity. Likewise, the suite does not claim a real Storage upload or hosted database migration.

Required external acceptance checks after configuring credentials:

- Sign in with the real administrator and verify another user is denied.
- Verify session refresh and logout with the provider.
- Apply migrations and storage configuration to the intended project.
- Upload an actual PNG/JPEG/WebP, attach it to a draft, confirm public denial, then publish and fetch its public media route.
- Deploy manually to Railway and Vercel; confirm HTTPS/CORS, health checks and shutdown behavior.

The login screen and signed-out redirect can be inspected without credentials. Protected pages are not exposed through a demo authentication bypass. No hosted deployment is performed by this implementation.

## Results from this implementation

- `pnpm typecheck`: passed for all five workspace packages.
- `pnpm test`: 15 tests passed.
- `pnpm build`: Fastify bundle and Next.js production build passed.
- Synthetic import fixture: schema-only dry-run passed without credentials.
- Production CMS login page: browser layout inspected; HTTP 200 verified.
- Signed-out CMS root: HTTP 307 to `/login`, with private/no-store caching.
- Live Supabase Auth, Storage and hosted database remain unverified until application credentials are configured.
