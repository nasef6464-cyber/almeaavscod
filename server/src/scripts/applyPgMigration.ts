import { Pool } from "pg";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function seedAdmin(pool: Pool) {
  const email = (process.env.ADMIN_EMAIL || "nasef6464@gmail.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "Nn@0120110367";
  const name = process.env.ADMIN_NAME || "NASFAHME";

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await pool.query('SELECT id, role FROM users WHERE email = $1', [email]);
  if (existing.rows.length === 0) {
    const id = `admin_${Date.now()}`;
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, 'admin', true)`,
      [id, name, email, passwordHash]
    );
    console.log(`[seed] Created admin: ${email}`);
  } else {
    await pool.query(
      'UPDATE users SET name = $1, password_hash = $2, role = $3, is_active = true WHERE email = $4',
      [name, passwordHash, 'admin', email]
    );
    console.log(`[seed] Updated admin: ${email}`);
  }
}

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
      // Fix approved_at: integer → bigint (overflow at ~2.1B, Date.now() returns ~1.7T)
      "ALTER TABLE courses ALTER COLUMN approved_at TYPE bigint",
      "ALTER TABLE lessons ALTER COLUMN approved_at TYPE bigint",
      "ALTER TABLE groups ALTER COLUMN approved_at TYPE bigint",
      "ALTER TABLE library_items ALTER COLUMN approved_at TYPE bigint",
      "ALTER TABLE questions ALTER COLUMN approved_at TYPE bigint",
      "ALTER TABLE quizzes ALTER COLUMN approved_at TYPE bigint",
      // Fix other timestamp integer columns
      "ALTER TABLE access_codes ALTER COLUMN expires_at TYPE bigint",
      "ALTER TABLE access_codes ALTER COLUMN created_at TYPE bigint",
      "ALTER TABLE b2b_packages ALTER COLUMN created_at TYPE bigint",
      "ALTER TABLE payment_requests ALTER COLUMN reviewed_at TYPE bigint",
      "ALTER TABLE skills ALTER COLUMN created_at TYPE bigint",
      "ALTER TABLE skills ALTER COLUMN updated_at TYPE bigint",
      "ALTER TABLE study_plans ALTER COLUMN created_at TYPE bigint",
      "ALTER TABLE study_plans ALTER COLUMN updated_at TYPE bigint",
      // Missing columns on certificates table
      "ALTER TABLE certificates ADD COLUMN IF NOT EXISTS path_id text DEFAULT ''",
      "ALTER TABLE certificates ADD COLUMN IF NOT EXISTS student_name text DEFAULT ''",
      "ALTER TABLE certificates ADD COLUMN IF NOT EXISTS completion_percentage integer DEFAULT 100",
    ];

    for (const stmt of alterStatements) {
      try {
        await pool.query(stmt);
        ok++;
      } catch { fail++; }
    }

    await seedAdmin(pool);

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
