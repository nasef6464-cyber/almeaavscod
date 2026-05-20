import { readFile } from "node:fs/promises";

const files = {
  packageJson: await readFile(new URL("../server/package.json", import.meta.url), "utf8"),
  env: await readFile(new URL("../server/src/config/env.ts", import.meta.url), "utf8"),
  envExample: await readFile(new URL("../server/.env.example", import.meta.url), "utf8"),
  redis: await readFile(new URL("../server/src/config/redis.ts", import.meta.url), "utf8"),
  rateLimiters: await readFile(new URL("../server/src/middleware/rateLimiters.ts", import.meta.url), "utf8"),
  app: await readFile(new URL("../server/src/app.ts", import.meta.url), "utf8"),
  auth: await readFile(new URL("../server/src/middleware/auth.ts", import.meta.url), "utf8"),
  sockets: await readFile(new URL("../server/src/sockets/index.ts", import.meta.url), "utf8"),
  securityChecklist: await readFile(new URL("../SECURITY_CHECKLIST.md", import.meta.url), "utf8"),
  rbacMatrix: await readFile(new URL("../RBAC_MATRIX.md", import.meta.url), "utf8"),
  report: await readFile(new URL("../06_07_SECURITY_RBAC_REPORT.md", import.meta.url), "utf8").catch(() => ""),
};

const checks = [];

function check(name, fn) {
  checks.push([name, fn]);
}

function assertIncludes(source, expected) {
  if (!source.includes(expected)) {
    throw new Error(`Expected to find: ${expected}`);
  }
}

check("Redis security dependencies are installed and documented", () => {
  assertIncludes(files.packageJson, "ioredis");
  assertIncludes(files.packageJson, "rate-limit-redis");
  assertIncludes(files.packageJson, "@socket.io/redis-adapter");
  assertIncludes(files.env, "REDIS_URL");
  assertIncludes(files.envExample, "REDIS_URL=");
});

check("rate limits use RedisStore when Redis is configured", () => {
  assertIncludes(files.rateLimiters, "RedisStore");
  assertIncludes(files.rateLimiters, "createRedisClient");
  assertIncludes(files.rateLimiters, "globalRateLimiter");
  assertIncludes(files.rateLimiters, "authRateLimiter");
  assertIncludes(files.rateLimiters, "sensitiveActionRateLimiter");
  assertIncludes(files.rateLimiters, "passOnStoreError: true");
  assertIncludes(files.app, "globalRateLimiter");
  assertIncludes(files.app, "authRateLimiter");
  assertIncludes(files.app, "sensitiveActionRateLimiter");
});

check("Socket.IO can scale horizontally with Redis adapter", () => {
  assertIncludes(files.sockets, "createAdapter");
  assertIncludes(files.sockets, "createRedisDuplicate");
  assertIncludes(files.sockets, "Redis adapter enabled");
});

check("RBAC middleware verifies current user state from MongoDB", () => {
  assertIncludes(files.auth, "UserModel.findById");
  assertIncludes(files.auth, "currentUser.isActive === false");
  assertIncludes(files.auth, "role: currentUser.role");
  assertIncludes(files.auth, "!allowedRoles.includes(req.authUser.role)");
});

check("security documents cover phase six controls", () => {
  assertIncludes(files.securityChecklist, "Redis-backed distributed storage");
  assertIncludes(files.securityChecklist, "requireRole");
  assertIncludes(files.securityChecklist, "@socket.io/redis-adapter");
  assertIncludes(files.rbacMatrix, "Role Rules");
  assertIncludes(files.rbacMatrix, "Phase 6/7 Hardening Delivered");
  assertIncludes(files.report, "No UI/UX changes were made");
  assertIncludes(files.report, "STOP");
});

for (const [name, fn] of checks) {
  try {
    fn();
  } catch (error) {
    console.error(`Security/RBAC phase 6 contract failed: ${name}`);
    console.error(error);
    process.exit(1);
  }
}

console.log(`Security/RBAC phase 6 contract passed (${checks.length} checks).`);
