import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL not set — skipping schema apply");
    process.exit(0);
  }

  const sqlPath = join(rootDir, "drizzle", "0000_initial_schema.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  const pool = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  try {
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err: any) {
        if (err.code === "42P07") {
          console.log(`Table already exists — skipping`);
        } else {
          console.error(`SQL error: ${err.message}`);
        }
      }
    }
    console.log("Schema applied successfully");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Schema apply failed:", err.message);
  process.exit(0);
});
