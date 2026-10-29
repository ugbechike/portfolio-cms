import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index";
export * from "./schema/index";
export const connectDatabase = (url: string) => {
  const sql = postgres(url, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return { db: drizzle(sql, { schema }), close: () => sql.end() };
};
export type Database = ReturnType<typeof connectDatabase>["db"];
