import { z } from "zod";
export const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CMS_ORIGIN: z.string().url(),
  PUBLIC_ORIGINS: z.string().default(""),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ADMIN_USER_ID: z.string().uuid(),
  DATABASE_URL: z.string().min(1),
  STORAGE_BUCKET: z.string().default("portfolio-media"),
});
export type Env = z.infer<typeof envSchema>;
