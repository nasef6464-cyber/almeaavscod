import { createServer } from "http";
import { createApp } from "./app.js";
import { connectToDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { ensureAdminAccount } from "./services/ensureAdminAccount.js";
import { ensureSkillTaxonomy } from "./services/ensureSkillTaxonomy.js";
import { createSocketServer, setIoInstance } from "./sockets/index.js";
import { startNotificationWorker } from "./queues/notificationQueue.js";
import { applyPgMigration } from "./scripts/applyPgMigration.js";
import bcrypt from "bcryptjs";
import { db } from "./db/connection.js";
import { users } from "./db/schema/index.js";
import { eq } from "drizzle-orm";

async function bootstrap() {
  await connectToDatabase();

  if (env.USE_POSTGRES && env.DATABASE_URL) {
    console.log("PostgreSQL mode — running migration...");
    await applyPgMigration();
    console.log("PostgreSQL mode — migration complete");
  }

  if (env.USE_POSTGRES && env.DATABASE_URL) {
    // Seed admin for PG
    try {
      const existing = await db.select().from(users).where(eq(users.email, env.ADMIN_EMAIL.toLowerCase())).limit(1);
      if (!existing[0]) {
        const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
        await db.insert(users).values({
          id: `admin_${Date.now()}`,
          name: env.ADMIN_NAME,
          email: env.ADMIN_EMAIL.toLowerCase(),
          passwordHash,
          role: "admin",
          isActive: true,
        });
        console.log("[admin] Created admin account for", env.ADMIN_EMAIL);
      } else if (existing[0].role !== "admin") {
        await db.update(users).set({ role: "admin", isActive: true }).where(eq(users.id, existing[0].id));
        console.log("[admin] Upgraded user to admin:", env.ADMIN_EMAIL);
      }
    } catch (err) {
      console.error("[admin] Error seeding admin:", err);
    }
  }

  if (!env.USE_POSTGRES) {
    await ensureSkillTaxonomy();
    await ensureAdminAccount();
  }

  const app = createApp();
  const server = createServer(app);
  const io = createSocketServer(server);
  setIoInstance(io);

  if (env.NOTIFICATION_QUEUE_ENABLED) {
    startNotificationWorker();
    console.log("Notification worker started");
  }

  server.listen(env.PORT, () => {
    console.log(`API server listening on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start API server", error);
  process.exit(1);
});
