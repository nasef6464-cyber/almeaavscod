import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../server/src/app.ts", import.meta.url), "utf8");
const sanitizerSource = await readFile(new URL("../server/src/middleware/mongoSanitize.ts", import.meta.url), "utf8");
const securityChecklist = await readFile(new URL("../SECURITY_CHECKLIST.md", import.meta.url), "utf8");
const readinessSource = await readFile(new URL("../PRODUCTION_READINESS_REPORT.md", import.meta.url), "utf8");
const deploymentGuide = await readFile(new URL("../DEPLOYMENT_GUIDE.md", import.meta.url), "utf8");

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

check("NoSQL sanitizer is mounted before API routes", () => {
  assertIncludes(appSource, 'import { rejectUnsafeMongoKeys } from "./middleware/mongoSanitize.js";');
  assertIncludes(appSource, "app.use(rejectUnsafeMongoKeys);");
  if (appSource.indexOf("app.use(rejectUnsafeMongoKeys);") > appSource.indexOf('app.use("/api", apiRouter);')) {
    throw new Error("NoSQL sanitizer must run before API routes");
  }
});

check("NoSQL sanitizer rejects operator and dotted keys", () => {
  assertIncludes(sanitizerSource, 'key.startsWith("$")');
  assertIncludes(sanitizerSource, 'key.includes(".")');
  assertIncludes(sanitizerSource, "findUnsafeMongoKey(req.body");
  assertIncludes(sanitizerSource, "findUnsafeMongoKey(req.query");
  assertIncludes(sanitizerSource, "Request contains unsafe field names");
});

check("NoSQL sanitizer keeps responses traceable", () => {
  assertIncludes(sanitizerSource, "StatusCodes.BAD_REQUEST");
  assertIncludes(sanitizerSource, "requestId: req.requestId");
});

check("NoSQL hardening is documented", () => {
  assertIncludes(securityChecklist, "NoSQL operator/dotted-key sanitizer");
  assertIncludes(readinessSource, "NoSQL Injection Guard Sprint - 2026-05-12");
  assertIncludes(deploymentGuide, "npm run smoke:nosql-sanitizer");
});

const failed = checks.filter((item) => item.status === "FAIL");
if (failed.length > 0) {
  console.error(JSON.stringify({ total: checks.length, failed }, null, 2));
  process.exit(1);
}

console.log(`NoSQL sanitizer contract passed (${checks.length} checks).`);
