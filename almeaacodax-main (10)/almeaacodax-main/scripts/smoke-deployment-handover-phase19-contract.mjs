import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const handover = await readFile(new URL("../19_20_DEPLOYMENT_HANDOVER_REPORT.md", import.meta.url), "utf8");
const deploymentGuide = await readFile(new URL("../DEPLOYMENT_GUIDE.md", import.meta.url), "utf8");
const docsDeployment = await readFile(new URL("../docs/DEPLOYMENT.md", import.meta.url), "utf8");
const envExample = await readFile(new URL("../server/.env.example", import.meta.url), "utf8");

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

function assertScript(name) {
  if (!packageJson.scripts?.[name]) {
    throw new Error(`Missing package script: ${name}`);
  }
}

check("handover documents Vercel, Render, MongoDB, and Redis", () => {
  ["Vercel", "Render", "MongoDB Atlas", "Managed Redis", "complete-platform-production-v1"].forEach((fragment) =>
    assertIncludes(handover, fragment),
  );
});

check("handover documents required production env variables", () => {
  [
    "VITE_API_URL",
    "MONGODB_URI",
    "JWT_SECRET",
    "REDIS_URL",
    "RATE_LIMIT_REDIS_ENABLED=true",
    "NOTIFICATION_QUEUE_ENABLED=true",
    "PAYMENT_WEBHOOK_SECRET",
    "SENTRY_DSN",
  ].forEach((fragment) => assertIncludes(handover, fragment));
});

check("handover documents health checks and rollback", () => {
  ["/api/health/live", "/api/health/ready", "Rollback", "Post-Deployment Smoke"].forEach((fragment) =>
    assertIncludes(handover, fragment),
  );
});

check("handover avoids false 10k readiness claim", () => {
  assertIncludes(handover, "must not be announced as `10,000+`");
  assertIncludes(handover, "Not certified for `10,000+`");
});

check("deployment docs include Redis and production readiness probes", () => {
  ["REDIS_URL", "RATE_LIMIT_REDIS_ENABLED", "NOTIFICATION_QUEUE_ENABLED", "/api/health/ready"].forEach((fragment) => {
    assertIncludes(deploymentGuide, fragment);
    assertIncludes(docsDeployment, fragment);
  });
});

check("env example exposes non-secret variable names only", () => {
  ["REDIS_URL=", "PAYMENT_WEBHOOK_SECRET=", "REQUEST_LOG_LEVEL=", "SLOW_REQUEST_LOG_MS="].forEach((fragment) =>
    assertIncludes(envExample, fragment),
  );
});

check("handover smoke script is registered", () => {
  assertScript("smoke:deployment-handover-phase19");
});

const failed = checks.filter((item) => item.status === "FAIL");
if (failed.length > 0) {
  console.error(JSON.stringify({ total: checks.length, failed }, null, 2));
  process.exit(1);
}

console.log(`Deployment handover phase 19/20 contract passed (${checks.length} checks).`);
