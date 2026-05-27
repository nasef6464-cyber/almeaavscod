import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(file) {
  return readFileSync(join(root, file), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(file, needle) {
  const source = read(file);
  assert(source.includes(needle), `${file} must include: ${needle}`);
}

assertIncludes('server/src/routes/health.routes.ts', 'healthRouter.get("/live"');
assertIncludes('server/src/routes/health.routes.ts', 'healthRouter.get("/ready"');
assertIncludes('server/src/routes/health.routes.ts', 'healthRouter.get("/scale-ready"');
assertIncludes('server/src/routes/health.routes.ts', 'res.status(200).json({');
assertIncludes('server/src/routes/health.routes.ts', 'ready: dependencies.ok');
assertIncludes('server/src/routes/health.routes.ts', 'res.status(databaseReady ? 200 : 503)');
assertIncludes('server/src/routes/health.routes.ts', 'scaleReady: dependencies.summary.redisConfiguredForScale');
assertIncludes('server/src/routes/health.routes.ts', 'redis_not_configured_for_multi_instance_scale');
assertIncludes('server/src/routes/health.routes.ts', 'RENDER_GIT_COMMIT');
assertIncludes('server/src/routes/health.routes.ts', 'uptimeSeconds');
assertIncludes('server/src/routes/health.routes.ts', 'const checks = {');
assertIncludes('server/src/routes/health.routes.ts', 'redisConfiguredForScale');
assertIncludes('server/src/routes/health.routes.ts', 'redisRateLimit');
assertIncludes('server/src/routes/health.routes.ts', 'redisQueue');
assertIncludes('server/src/routes/health.routes.ts', 'service: "The Hundred Platform API"');
assertIncludes('server/src/middleware/requestLogger.ts', 'path.startsWith("/api/health/")');
assertIncludes('DEPLOYMENT_GUIDE.md', '/api/health/live');
assertIncludes('DEPLOYMENT_GUIDE.md', '/api/health/ready');
assertIncludes('DEPLOYMENT_GUIDE.md', '/api/health/scale-ready');
assertIncludes('PRODUCTION_READINESS_REPORT.md', 'Health Readiness Sprint - 2026-05-12');
assertIncludes('PRODUCTION_READINESS_REPORT.md', 'Health Readiness Split - 2026-05-13');
assertIncludes('docs/SHIFT_HANDOFF_AR.md', 'Health Readiness Sprint - 2026-05-12');
assertIncludes('docs/SHIFT_HANDOFF_AR.md', '/api/health/scale-ready');

console.log('Health readiness contract passed: live/ready/scale-ready probes and deployment docs are aligned.');
