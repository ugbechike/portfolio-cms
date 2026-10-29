import { createClient } from "@supabase/supabase-js";
import { connectDatabase } from "@portfolio/database";
import { createRepository } from "@portfolio/content";
import { sql } from "drizzle-orm";
import { envSchema } from "@/config/env";
import { createMediaService } from "@/modules/media/service";
import { buildApp } from "@/app";
const env = envSchema.parse(process.env);
const connection = connectDatabase(env.DATABASE_URL);
const repo = createRepository(connection.db);
const auth = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const storage = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const app = await buildApp({
  repo,
  adminId: env.ADMIN_USER_ID,
  origins: [
    env.CMS_ORIGIN,
    ...env.PUBLIC_ORIGINS.split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  ],
  logger: true,
  verify: async (token) => {
    const { data, error } = await auth.auth.getUser(token);
    return error ? null : (data.user?.id ?? null);
  },
  media: createMediaService(repo, storage, env.STORAGE_BUCKET),
  health: async () => {
    await connection.db.execute(sql`SELECT 1`);
  },
});
app.addHook("onClose", async () => {
  await connection.close();
});
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    await app.close();
    process.exit(0);
  });
await app.listen({ port: env.PORT, host: "0.0.0.0" });
