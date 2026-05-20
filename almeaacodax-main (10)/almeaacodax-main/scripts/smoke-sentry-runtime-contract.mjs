import { readFile } from "node:fs/promises";

const serverApp = await readFile(new URL("../server/src/app.ts", import.meta.url), "utf8");
const serverSentry = await readFile(new URL("../server/src/observability/sentry.ts", import.meta.url), "utf8");
const serverErrors = await readFile(new URL("../server/src/middleware/errorHandler.ts", import.meta.url), "utf8");
const opsRoutes = await readFile(new URL("../server/src/routes/operations.routes.ts", import.meta.url), "utf8");
const frontendEntry = await readFile(new URL("../index.tsx", import.meta.url), "utf8");
const frontendSentry = await readFile(new URL("../src/observability/sentry.ts", import.meta.url), "utf8");

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

check("server sentry init is wired in app bootstrap", () => {
  assertIncludes(serverApp, 'import { initSentry } from "./observability/sentry.js";');
  assertIncludes(serverApp, "initSentry();");
});

check("server sentry helper exists", () => {
  assertIncludes(serverSentry, "Sentry.init(");
  assertIncludes(serverSentry, "captureSentryException");
  assertIncludes(serverSentry, "captureSentryMessage");
});

check("error handler reports 5xx to sentry", () => {
  assertIncludes(serverErrors, "captureSentryException");
  assertIncludes(serverErrors, "if (statusCode >= 500 && isSentryEnabled())");
});

check("operations route exposes admin sentry test endpoint", () => {
  assertIncludes(opsRoutes, 'operationsRouter.post("/sentry/test-event"');
  assertIncludes(opsRoutes, "eventId");
});

check("frontend sentry init is wired", () => {
  assertIncludes(frontendEntry, "initFrontendSentry();");
  assertIncludes(frontendSentry, "Sentry.init(");
});

const failed = checks.filter((item) => item.status === "FAIL");
if (failed.length > 0) {
  console.error(JSON.stringify({ total: checks.length, failed }, null, 2));
  process.exit(1);
}

console.log(`Sentry runtime contract passed (${checks.length} checks).`);

