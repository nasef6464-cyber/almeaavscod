import { Pool } from "pg";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function applyPgMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const sqlPath = join(__dirname, "..", "..", "drizzle", "0000_initial_schema.sql");
    const sql = readFileSync(sqlPath, "utf-8");
    const statements = sql.split(";").filter((s) => s.trim().length > 0);
    let ok = 0, fail = 0;

    for (const stmt of statements) {
      try {
        await pool.query(stmt);
        ok++;
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes("already exists") || msg.includes("duplicate")) {
          ok++;
        } else {
          fail++;
        }
      }
    }

    const alterStatements = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id text",
    ];

    for (const stmt of alterStatements) {
      try {
        await pool.query(stmt);
        ok++;
      } catch { fail++; }
    }

    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );
    console.log(`Migration: ${ok} OK, ${fail} failed. Tables (${tables.rows.length}):`);
    tables.rows.forEach((r) => console.log("  - " + r.table_name));
  } catch (err) {
    console.error("Migration error:", err);
  }

  await pool.end();
}
