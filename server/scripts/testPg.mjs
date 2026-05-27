import { Pool } from "pg";
import { readFileSync } from "fs";

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const r = await pool.query("SELECT 1 as test");
    console.log("Connection OK:", r.rows[0].test);

    const sql = readFileSync("drizzle/0000_initial_schema.sql", "utf-8");
    const statements = sql.split(/-->\s*statement-breakpoint/).map((s) => s.trim()).filter(Boolean);

    console.log("Statements to execute:", statements.length);
    let ok = 0;

    for (const stmt of statements) {
      try {
        await pool.query(stmt);
        ok++;
      } catch (err) {
        console.log("FAIL:", stmt.substring(0, 80), "->", err.message.substring(0, 120));
      }
    }

    console.log(`Done: ${ok}/${statements.length} OK`);

    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );
    console.log("Tables:", tables.rows.length);
    tables.rows.forEach((r) => console.log(" -", r.table_name));

    const userCount = await pool.query("SELECT count(*) FROM users");
    console.log("Users:", userCount.rows[0].count);
  } catch (err) {
    console.error("Fatal:", err);
  }

  await pool.end();
}

run();
