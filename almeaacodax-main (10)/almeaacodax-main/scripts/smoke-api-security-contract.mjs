import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../server/src/app.ts", import.meta.url), "utf8");
const envSource = await readFile(new URL("../server/src/config/env.ts", import.meta.url), "utf8");
const errorHandlerSource = await readFile(new URL("../server/src/middleware/errorHandler.ts", import.meta.url), "utf8");
const loggerSource = await readFile(new URL("../server/src/middleware/requestLogger.ts", import.meta.url), "utf8");
const typesSource = await readFile(new URL("../server/src/types/express.d.ts", import.meta.url), "utf8");
const envExample = await readFile(new URL("../server/.env.example", import.meta.url), "utf8");
const securityChecklist = await readFile(new URL("../SECURITY_CHECKLIST.md", import.meta.url), "utf8");
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

check("production CORS is environment scoped and configurable", () => {
  assertIncludes(envSource, "NODE_ENV");
  assertIncludes(envSource, "CORS_ALLOWED_ORIGINS");
  assertIncludes(appSource, "parseAllowedOrigins");
  assertIncludes(appSource, 'env.NODE_ENV === "production"');
  assertIncludes(appSource, "createCorsError");
  assertIncludes(appSource, "statusCode = 403");
});

check("request id is generated, returned, and logged", () => {
  assertIncludes(appSource, "randomUUID");
  assertIncludes(appSource, 'req.header("x-request-id")');
  assertIncludes(appSource, 'res.setHeader("x-request-id", requestId)');
  if (appSource.indexOf('res.setHeader("x-request-id", requestId)') > appSource.indexOf("cors({")) {
    throw new Error("request id middleware must run before CORS");
  }
  assertIncludes(typesSource, "requestId?: string");
  assertIncludes(loggerSource, "requestId: req.requestId");
});

check("sensitive API routes have smaller body limits", () => {
  assertIncludes(appSource, 'app.use("/api/auth", express.json({ limit: "100kb" }));');
  assertIncludes(appSource, 'app.use(["/api/quizzes", "/api/payments", "/api/ai"], express.json({ limit: "1mb" }));');
  assertIncludes(appSource, 'app.use(express.json({ limit: "5mb" }));');
});

check("production errors do not leak server details", () => {
  assertIncludes(errorHandlerSource, 'process.env.NODE_ENV === "production"');
  assertIncludes(errorHandlerSource, 'statusCode >= 500 && isProduction ? "Internal server error"');
  assertIncludes(errorHandlerSource, "requestId");
  assertIncludes(errorHandlerSource, 'message: "Route not found"');
});

check("deployment env template documents API hardening controls", () => {
  assertIncludes(envExample, "NODE_ENV=production");
  assertIncludes(envExample, "CORS_ALLOWED_ORIGINS=");
});

check("reports record API hardening sprint", () => {
  assertIncludes(securityChecklist, "Request IDs are returned and logged");
  assertIncludes(securityChecklist, "Production CORS can be restricted with `CORS_ALLOWED_ORIGINS`");
  assertIncludes(readinessSource, "API Surface Hardening Sprint - 2026-05-12");
});

const failed = checks.filter((item) => item.status === "FAIL");
if (failed.length > 0) {
  console.error(JSON.stringify({ total: checks.length, failed }, null, 2));
  process.exit(1);
}

console.log(`API security contract passed (${checks.length} checks).`);
