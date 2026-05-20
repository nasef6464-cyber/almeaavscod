import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const k6Source = await readFile(new URL("../load-tests/k6-platform-journey.js", import.meta.url), "utf8");
const loadReadme = await readFile(new URL("../load-tests/README.md", import.meta.url), "utf8");
const phaseReport = await readFile(new URL("../17_18_TESTING_REPORT.md", import.meta.url), "utf8");
const testingReport = await readFile(new URL("../TESTING_REPORT.md", import.meta.url), "utf8");

const scripts = packageJson.scripts || {};
const checks = [];

function check(name, assertion) {
  try {
    assertion();
    checks.push({ name, status: "PASS" });
  } catch (error) {
    checks.push({ name, status: "FAIL", message: error.message });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(source, fragment) {
  assert(source.includes(fragment), `Missing fragment: ${fragment}`);
}

function assertScript(name) {
  assert(Boolean(scripts[name]), `Missing package script: ${name}`);
}

check("core build/typecheck scripts exist", () => {
  ["typecheck", "build", "server:check", "server:build"].forEach(assertScript);
});

check("security and anti-cheating smoke scripts exist", () => {
  [
    "smoke:api-security",
    "smoke:security-rbac-phase6",
    "smoke:quiz-client-security",
    "smoke:exam-payment-phase8",
    "smoke:package-course-split",
    "smoke:payment-providers",
  ].forEach(assertScript);
});

check("production and performance smoke scripts exist", () => {
  [
    "smoke:performance",
    "smoke:deployment-cache",
    "smoke:health-readiness",
    "smoke:monitoring",
    "smoke:production-ops-phase14",
    "smoke:load-tests",
  ].forEach(assertScript);
});

check("k6 script covers staged load levels and thresholds", () => {
  ["pilot_100", "scale_500", "scale_1000", "http_req_failed", "p(95)<1500", "p(99)<3000"].forEach((fragment) =>
    assertIncludes(k6Source, fragment),
  );
});

check("k6 journey covers critical student flow", () => {
  ["/health", "/content/bootstrap", "/taxonomy/bootstrap", "/auth/login", "/auth/me", "/quizzes/results", "/quizzes/${QUIZ_ID}/submit"].forEach(
    (fragment) => assertIncludes(k6Source, fragment),
  );
});

check("load testing docs prevent false 10k claims", () => {
  assertIncludes(loadReadme, "10k users");
  assertIncludes(phaseReport, "not declared `10,000+`");
  assertIncludes(phaseReport, "Result Recording Template");
  assertIncludes(testingReport, "should not be described as ready");
});

const failed = checks.filter((item) => item.status === "FAIL");
if (failed.length > 0) {
  console.error(JSON.stringify({ total: checks.length, failed }, null, 2));
  process.exit(1);
}

console.log(`QA phase 17/18 contract passed (${checks.length} checks).`);
