# Deployment and local configuration

## 1. Supabase

Use project `obdatvrbucwhixhtigsy` or a separate development project.

1. In Authentication settings, enable email/password and **disable new user signups** and anonymous sign-ins. There is no registration UI, but disabling signup at the provider is also required.
2. Create your administrator in Authentication → Users. Set a password through Supabase's supported user management flow. Copy the user's UUID into `ADMIN_USER_ID` in both the API and CMS server environments. Do not use email addresses or user-editable metadata as the allowlist.
3. From project settings copy the project URL and publishable key. These may be used by the browser. Copy the service-role key **only** into the API server environment, never a `NEXT_PUBLIC_` variable.
4. From Connect, copy the PostgreSQL connection string. Use the session pooler for local IPv4 access or transaction pooler for Railway when appropriate. Supply the database password and require SSL (`?sslmode=require`). The application disables prepared statements for pooler compatibility. Keep the connection private.
5. Run the SQL migration using a privileged database connection from a trusted terminal:

   ```sh
   export DATABASE_URL='postgresql://...'
   pnpm db:migrate
   ```

   The runner acquires an advisory transaction lock and records applied migrations in `portfolio_migrations`. It is safe to run again. Migration DDL and history are committed atomically. Use this project runner, not `drizzle push`, for deployments.

6. Run `packages/database/supabase-storage.sql` in Supabase's SQL editor. It creates/updates the **private** `portfolio-media` bucket with a 10 MB limit and PNG/JPEG/WebP allowlist, and revokes content-table privileges from Data API roles. Do not add public upload or read policies. The backend service-role client performs storage access after authorization. Content tables have RLS with no public policies.
7. Set Authentication → URL Configuration → Site URL to the CMS origin; include `http://localhost:3000` for development if needed. This implementation uses email/password, not OAuth redirects.
8. Create a draft in the CMS, verify the public API excludes it, publish explicitly, then verify the public route returns it. Upload an image and confirm it is inaccessible through `/api/v1/media/:id` until referenced by a published snapshot.

### API environment (`apps/api/.env` locally)

| Variable                    | Value                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `PORT`                      | `4000` locally; Railway supplies its own                                                                   |
| `CMS_ORIGIN`                | Exact CMS origin, no trailing slash                                                                        |
| `PUBLIC_ORIGINS`            | Comma-separated allowed browser origins for public portfolio reads; may be empty for server-only consumers |
| `SUPABASE_URL`              | `https://obdatvrbucwhixhtigsy.supabase.co`                                                                 |
| `SUPABASE_PUBLISHABLE_KEY`  | Project publishable key                                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service-role key                                                                               |
| `ADMIN_USER_ID`             | Allowed Supabase user UUID                                                                                 |
| `DATABASE_URL`              | Private PostgreSQL connection string with SSL                                                              |
| `STORAGE_BUCKET`            | `portfolio-media`                                                                                          |

### CMS environment (`apps/cms/.env.local` locally)

| Variable                               | Value                                    |
| -------------------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Same Supabase project URL                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same publishable key                     |
| `NEXT_PUBLIC_API_URL`                  | API origin, e.g. `http://localhost:4000` |
| `ADMIN_USER_ID`                        | Same allowed UUID; server-only           |

Next.js embeds `NEXT_PUBLIC_` variables at build time; rebuild when these change. Never add the service-role key or database URL to the CMS. Session cookies are managed by `@supabase/ssr`, with SameSite=Lax and Secure in production. Cookies are readable by the browser SDK so it can refresh sessions; avoid third-party scripts and untrusted HTML. Markdown renders without raw HTML support.

## 2. Railway API

1. Create a Railway project → Deploy from GitHub → `ugbechike/portfolio-cms`.
2. Use the repository root, Dockerfile builder, and the committed `railway.json`. Do not set root to `apps/api`; the build needs workspace packages.
3. Add every API environment value above. Railway supplies `PORT`; the process binds `0.0.0.0`.
4. Generate a public HTTPS domain. Set health check `/health` (the committed configuration already does this). It verifies database connectivity.
5. Apply migrations once from a trusted terminal **before** deploying code that needs the new schema. The start command deliberately does not mutate schema.
6. Deploy manually. The Dockerfile installs from the lockfile, bundles the API, runs as the non-root `node` user, and starts `node apps/api/dist/server.js`. Dependencies remain in the image; no environment files are copied.
7. Set `CMS_ORIGIN` to the final Vercel origin, and `PUBLIC_ORIGINS` to the future public portfolio origin if browser reads are needed. CORS is an origin restriction, never the authorization boundary.
8. Verify `GET /health`, unauthenticated admin rejection, authenticated CRUD, draft isolation and uploads.

SIGTERM/SIGINT closes Fastify and the database pool gracefully. Logs redact Authorization and Cookie headers. One API instance is sufficient initially. The in-memory rate limiter is per process; use a shared store before scaling to multiple instances.

## 3. Vercel CMS

1. Import the GitHub repository into Vercel.
2. Set **Root Directory** to `apps/cms`, **Framework** to Next.js, and enable access to files outside the root directory (workspace packages).
3. Use Node.js 22.x. Install command: `pnpm install --frozen-lockfile` (Vercel detects the root workspace lockfile). Build command: `pnpm build` from `apps/cms`. Output directory: Next.js default.
4. Add all four CMS environment variables above for the target environment. Set `NEXT_PUBLIC_API_URL` to the Railway HTTPS origin. Set the server-only administrator UUID to match the API.
5. Deploy manually. Set the final Vercel origin in Railway `CMS_ORIGIN` and Supabase Site URL.
6. Verify `/` redirects signed-out requests to `/login`, sign in as the allowlisted user, and confirm another Supabase user receives no CMS/admin access.

Use a separate Supabase development project and Railway service for previews, or explicitly configure each preview origin. Do not use a wildcard CORS origin.

## Local Supabase option

A hosted development project is simplest. For a fully local provider, install the official Supabase CLI and Docker, use `supabase init` and `supabase start` in a separate infrastructure directory, then copy the local URLs/keys from `supabase status` into the files above. Apply this repository's migrations using its runner against the local PostgreSQL URL, and run the storage SQL against the local database. Create and allowlist the admin in local Studio. No production credentials are needed for the automated test suite.

## Recovery and operational notes

- Enable database backups/PITR according to your Supabase plan; revisions are not a substitute for backups.
- Private media URLs expire after 60 seconds. Already-issued signed URLs may remain valid until expiry after unpublishing.
- Storage and PostgreSQL cannot share a transaction. Upload failures clean up storage objects when possible. A process crash may leave an orphaned storage object; reconcile bucket paths against `media.path` during maintenance. Failed deletion restores metadata for retry.
- Never disable RLS to fix application access. The application uses a private server connection; the browser must not query the content tables directly.
- Credentials and external acceptance checks are required before calling a hosted deployment production-ready.
