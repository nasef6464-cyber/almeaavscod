import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";

if (!env.USE_POSTGRES || !env.DATABASE_URL) {
  throw new Error("PostgreSQL not configured — set USE_POSTGRES=true and DATABASE_URL");
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool);
export { pool };
