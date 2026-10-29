import "dotenv/config";
import { readFile } from "node:fs/promises";
import { connectDatabase } from "@portfolio/database";
import { createRepository, importContent } from "@portfolio/content";
import { importSchema } from "@portfolio/contracts";
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file)
  throw new Error("Usage: pnpm run import path.json [--dry-run] [--overwrite]");
const input = importSchema.parse(JSON.parse(await readFile(file, "utf8")));
if (args.includes("--dry-run") && !process.env.DATABASE_URL) {
  console.log(
    JSON.stringify(
      {
        valid: true,
        records: input.records.length,
        note: "Schema validation only; configure DATABASE_URL to check existing records",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
if (!process.env.DATABASE_URL || !process.env.ADMIN_USER_ID)
  throw new Error(
    "DATABASE_URL and ADMIN_USER_ID are required for database imports",
  );
const connection = connectDatabase(process.env.DATABASE_URL);
try {
  console.log(
    JSON.stringify(
      await importContent(createRepository(connection.db), input, {
        dryRun: args.includes("--dry-run"),
        overwrite: args.includes("--overwrite"),
        actorId: process.env.ADMIN_USER_ID,
      }),
      null,
      2,
    ),
  );
} finally {
  await connection.close();
}
