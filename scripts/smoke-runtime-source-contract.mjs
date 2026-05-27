import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const appSource = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
const adapterSource = await readFile(new URL("../services/adapter.ts", import.meta.url), "utf8");
const storeSource = await readFile(new URL("../store/useStore.ts", import.meta.url), "utf8");
const authMiddlewareSource = await readFile(new URL("../server/src/middleware/auth.ts", import.meta.url), "utf8");
const envExample = await readFile(new URL("../server/.env.example", import.meta.url), "utf8");
const readinessSource = await readFile(new URL("../PRODUCTION_READINESS_REPORT.md", import.meta.url), "utf8");
const securityChecklist = await readFile(new URL("../SECURITY_CHECKLIST.md", import.meta.url), "utf8");

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

check("production frontend always uses the real API path", () => {
  assertIncludes(adapterSource, "env?.PROD === true");
  assertIncludes(appSource, "import.meta.env.PROD || import.meta.env.VITE_USE_REAL_API !== 'false'");
  assertIncludes(storeSource, "runtimeEnv?.PROD === true || runtimeEnv?.VITE_USE_REAL_API !== 'false'");
});

check("legacy Firebase path is fully removed from runtime", () => {
  if (existsSync(new URL("../services/firebaseSync.ts", import.meta.url))) {
    throw new Error("Unexpected file still exists: services/firebaseSync.ts");
  }
  if (existsSync(new URL("../services/firebase.ts", import.meta.url))) {
    throw new Error("Unexpected file still exists: services/firebase.ts");
  }
  assertNotIncludes(appSource, "./services/firebaseSync");
  assertNotIncludes(storeSource, "firebase/firestore");
  assertNotIncludes(storeSource, "../services/firebase");
});

check("local admin bypass is impossible in production", () => {
  assertIncludes(authMiddlewareSource, 'env.DEV_LOCAL_ADMIN_BYPASS && env.NODE_ENV !== "production" && isStrictLocalRequest(req)');
  assertNotIncludes(authMiddlewareSource, "if (env.DEV_LOCAL_ADMIN_BYPASS && isStrictLocalRequest(req))");
});

check("production env template carries safe runtime defaults", () => {
  assertIncludes(envExample, "NODE_ENV=production");
  assertIncludes(envExample, "DEV_LOCAL_ADMIN_BYPASS=false");
});

check("reports record source-of-truth hardening", () => {
  assertIncludes(readinessSource, "Runtime Source-Of-Truth Sprint - 2026-05-12");
  assertIncludes(securityChecklist, "Legacy Firebase sync is development-only");
  assertIncludes(securityChecklist, "Local admin bypass is blocked when `NODE_ENV=production`");
});

const failed = checks.filter((item) => item.status === "FAIL");
if (failed.length > 0) {
  console.error(JSON.stringify({ total: checks.length, failed }, null, 2));
  process.exit(1);
}

console.log(`Runtime source-of-truth contract passed (${checks.length} checks).`);
