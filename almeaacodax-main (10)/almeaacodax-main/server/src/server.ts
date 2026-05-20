import { createServer } from "http";
import { createApp } from "./app.js";
import { connectToDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { closeRedisClients } from "./config/redis.js";
import { ensureAdminAccount } from "./services/ensureAdminAccount.js";
import { ensureSkillTaxonomy } from "./services/ensureSkillTaxonomy.js";
import { closeNotificationQueue, startNotificationWorkers } from "./queues/notificationQueue.js";
import { createSocketServer } from "./sockets/index.js";
import mongoose from "mongoose";

async function runStartupMaintenance() {
  const tasks = [
    ["skill taxonomy", ensureSkillTaxonomy],
    ["admin account", ensureAdminAccount],
  ] as const;

  for (const [name, task] of tasks) {
    try {
      await task();
      console.info(`[startup] ${name} maintenance completed`);
    } catch (error) {
      console.error(`[startup] ${name} maintenance failed`, error);
    }
  }
}

async function bootstrap() {
  await connectToDatabase();

  const app = createApp();
  const server = createServer(app);
  createSocketServer(server);
  startNotificationWorkers();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.info(`[shutdown] received ${signal}; closing server resources`);
    const forceExitTimer = setTimeout(() => {
      console.error("[shutdown] forced exit after timeout");
      process.exit(1);
    }, 15_000);
    forceExitTimer.unref();

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      await closeNotificationQueue();
      await closeRedisClients();
      await mongoose.connection.close(false);
      clearTimeout(forceExitTimer);
      console.info("[shutdown] completed cleanly");
      process.exit(0);
    } catch (error) {
      clearTimeout(forceExitTimer);
      console.error("[shutdown] failed", error);
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  server.listen(env.PORT, () => {
    console.log(`API server listening on http://localhost:${env.PORT}`);
  });

  void runStartupMaintenance();
}

bootstrap().catch((error) => {
  console.error("Failed to start API server", error);

  // Help non-technical operators quickly diagnose common Atlas/Render issues.
  const message = String((error as any)?.message ?? "");
  const code = (error as any)?.code;
  const codeName = (error as any)?.codeName;
  const isMongoAuth =
    message.toLowerCase().includes("authentication failed") ||
    message.toLowerCase().includes("bad auth") ||
    code === 8000 ||
    codeName === "AtlasError";

  if (isMongoAuth) {
    console.error(
      [
        "",
        "MongoDB connection failed (likely Atlas auth/network). Quick checks:",
        "1) Render env var MONGODB_URI uses the correct username/password.",
        "2) If the password contains special chars (like @, #, /, %), URL-encode it (e.g. @ => %40).",
        "3) Atlas Network Access allows this Render service (temporary: 0.0.0.0/0).",
        "4) Atlas Database Access user exists and has readWrite access to the target DB.",
      ].join("\n")
    );
  }

  process.exit(1);
});
