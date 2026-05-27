import { readFile } from "node:fs/promises";

const healthRoutes = await readFile(new URL("../server/src/routes/health.routes.ts", import.meta.url), "utf8");
const redisConfig = await readFile(new URL("../server/src/config/redis.ts", import.meta.url), "utf8");
const envConfig = await readFile(new URL("../server/src/config/env.ts", import.meta.url), "utf8");
const serverSource = await readFile(new URL("../server/src/server.ts", import.meta.url), "utf8");
const queueSource = await readFile(new URL("../server/src/queues/notificationQueue.ts", import.meta.url), "utf8");
const report = await readFile(new URL("../14_15_16_PRODUCTION_OPS_REPORT.md", import.meta.url), "utf8");

const checks = [];

function check(name, assertion) {
  try {
    assertion();
    checks.push({ name, status: "PASS" });
  } catch (error) {
    checks.push({ name, status: "FAIL", message: error.message });
  }
}

function assertIncludes(source, fragment) {
  if (!source.includes(fragment)) {
    throw new Error(`Missing fragment: ${fragment}`);
  }
}

check("health readiness checks MongoDB and Redis dependencies", () => {
  assertIncludes(healthRoutes, "getDependencyHealth");
  assertIncludes(healthRoutes, 'getRedisHealth("rate-limit"');
  assertIncludes(healthRoutes, 'getRedisHealth("queue"');
  assertIncludes(healthRoutes, "redisRateLimit");
  assertIncludes(healthRoutes, "redisQueue");
  assertIncludes(healthRoutes, "redisConfiguredForScale");
});

check("readiness keeps liveness separate from dependency checks", () => {
  assertIncludes(healthRoutes, 'healthRouter.get("/live"');
  assertIncludes(healthRoutes, 'healthRouter.get("/ready"');
  assertIncludes(healthRoutes, "res.status(databaseReady ? 200 : 503)");
});

check("Redis health uses bounded ping timeout", () => {
  assertIncludes(redisConfig, "getRedisHealth");
  assertIncludes(redisConfig, "DEFAULT_REDIS_HEALTH_TIMEOUT_MS");
  assertIncludes(redisConfig, "client.ping()");
  assertIncludes(redisConfig, "redis_health_timeout");
});

check("Redis is required in production when scale features are enabled", () => {
  assertIncludes(healthRoutes, 'env.NODE_ENV === "production"');
  assertIncludes(envConfig, "RATE_LIMIT_REDIS_ENABLED");
  assertIncludes(envConfig, "NOTIFICATION_QUEUE_ENABLED");
});

check("server shuts down HTTP, queues, Redis, and MongoDB cleanly", () => {
  assertIncludes(serverSource, 'process.once("SIGTERM"');
  assertIncludes(serverSource, 'process.once("SIGINT"');
  assertIncludes(serverSource, "server.close");
  assertIncludes(serverSource, "closeNotificationQueue()");
  assertIncludes(serverSource, "closeRedisClients()");
  assertIncludes(serverSource, "mongoose.connection.close(false)");
  assertIncludes(queueSource, "export async function closeNotificationQueue()");
  assertIncludes(redisConfig, "export async function closeRedisClients()");
});

check("phase report documents production ops deliverables", () => {
  assertIncludes(report, "Phase 14/15/16");
  assertIncludes(report, "/api/health/live");
  assertIncludes(report, "/api/health/ready");
  assertIncludes(report, "MongoDB Atlas");
  assertIncludes(report, "Redis");
  assertIncludes(report, "Sentry");
  assertIncludes(report, "No UI/UX changes");
});

const failed = checks.filter((item) => item.status === "FAIL");
if (failed.length > 0) {
  console.error(JSON.stringify({ total: checks.length, failed }, null, 2));
  process.exit(1);
}

console.log(`Production ops phase 14 contract passed (${checks.length} checks).`);
