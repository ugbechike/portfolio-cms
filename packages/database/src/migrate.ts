import "dotenv/config";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = postgres(url, { max: 1, prepare: false });
try {
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(7246138)`;
    await tx`CREATE TABLE IF NOT EXISTS portfolio_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
    await tx`ALTER TABLE portfolio_migrations ENABLE ROW LEVEL SECURITY`;
    const name = "0001_content";
    const found =
      await tx`SELECT name FROM portfolio_migrations WHERE name = ${name}`;
    if (!found.length) {
      await tx.unsafe(
        await readFile(
          new URL("./migrations/0001_content.sql", import.meta.url),
          "utf8",
        ),
      );
      await tx`INSERT INTO portfolio_migrations (name) VALUES (${name})`;
    }
  });
  console.log("Migrations applied successfully");
} finally {
  await sql.end();
}
