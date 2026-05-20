import { createServer } from "http";
import { createApp } from "./app.js";
import { connectToDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { ensureAdminAccount } from "./services/ensureAdminAccount.js";
import { ensureSkillTaxonomy } from "./services/ensureSkillTaxonomy.js";
import { createSocketServer, setIoInstance } from "./sockets/index.js";
import { startNotificationWorker } from "./queues/notificationQueue.js";

async function bootstrap() {
  await connectToDatabase();

  if (!env.USE_POSTGRES) {
    // Mongoose-only bootstrap (skip when using PostgreSQL)
    await ensureSkillTaxonomy();
    await ensureAdminAccount();
  } else {
    console.log("PostgreSQL mode — skipping Mongoose bootstrap");
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
