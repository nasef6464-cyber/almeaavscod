import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../server/src/app.ts", import.meta.url), "utf8");
const loggerSource = await readFile(new URL("../server/src/middleware/requestLogger.ts", import.meta.url), "utf8");
const envExample = await readFile(new URL("../server/.env.example", import.meta.url), "utf8");
const guideSource = await readFile(new URL("../MONITORING_AND_LOGGING_GUIDE.md", import.meta.url), "utf8");
const readinessSource = await readFile(new URL("../PRODUCTION_READINESS_REPORT.md", import.meta.url), "utf8");

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

function assertNotIncludes(source, fragment) {
  if (source.includes(fragment)) {
    throw new Error(`Unexpected fragment: ${fragment}`);
  }
}

check("backend mounts request logger before routes", () => {
  assertIncludes(appSource, 'import { requestLogger } from "./middleware/requestLogger.js";');
  assertIncludes(appSource, "app.use(requestLogger);");
  if (appSource.indexOf("app.use(requestLogger);") > appSource.indexOf('app.use("/api", apiRouter);')) {
    throw new Error("requestLogger must run before API routes");
  }
});

check("request logger emits structured slow/error request logs", () => {
  assertIncludes(loggerSource, 'event: "http_request"');
  assertIncludes(loggerSource, "SLOW_REQUEST_LOG_MS");
  assertIncludes(loggerSource, "REQUEST_LOG_LEVEL");
  assertIncludes(loggerSource, "durationMs");
  assertIncludes(loggerSource, "statusCode >= 400 || isSlow");
});

check("request logger avoids sensitive payload logging", () => {
  assertNotIncludes(loggerSource, "req.body");
  assertNotIncludes(loggerSource.toLowerCase(), "authorization");
  assertNotIncludes(loggerSource.toLowerCase(), "cookie");
  assertNotIncludes(loggerSource.toLowerCase(), "password");
});

check("production env template documents monitoring switches", () => {
  assertIncludes(envExample, "REQUEST_LOG_LEVEL=normal");
  assertIncludes(envExample, "SLOW_REQUEST_LOG_MS=1000");
});

check("monitoring guide documents health checks and diagnosis", () => {
  assertIncludes(guideSource, "/api/health");
  assertIncludes(guideSource, "REQUEST_LOG_LEVEL=normal");
  assertIncludes(guideSource, "SLOW_REQUEST_LOG_MS=1000");
  assertIncludes(guideSource, "How To Diagnose Vercel Or Render Slowness");
});

check("readiness report records monitoring sprint", () => {
  assertIncludes(readinessSource, "Monitoring Diagnostics Sprint - 2026-05-12");
});

const failed = checks.filter((item) => item.status === "FAIL");
if (failed.length > 0) {
  console.error(JSON.stringify({ total: checks.length, failed }, null, 2));
  process.exit(1);
}

console.log(`Monitoring contract passed (${checks.length} checks).`);
