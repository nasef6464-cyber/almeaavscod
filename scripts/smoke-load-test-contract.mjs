import { readFile } from "node:fs/promises";

const k6Source = await readFile(new URL("../load-tests/k6-platform-journey.js", import.meta.url), "utf8");
const readmeSource = await readFile(new URL("../load-tests/README.md", import.meta.url), "utf8");
const reportSource = await readFile(new URL("../LOAD_TEST_REPORT.md", import.meta.url), "utf8");

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

check("k6 script has staged 100/500/1000 user gates", () => {
  assertIncludes(k6Source, "pilot_100");
  assertIncludes(k6Source, "scale_500");
  assertIncludes(k6Source, "scale_1000");
});

check("k6 script covers health, bootstrap, login, and quiz submit", () => {
  assertIncludes(k6Source, "/health");
  assertIncludes(k6Source, "/content/bootstrap");
  assertIncludes(k6Source, "/taxonomy/bootstrap");
  assertIncludes(k6Source, "/auth/login");
  assertIncludes(k6Source, "/quizzes/${QUIZ_ID}/submit");
});

check("k6 script writes a machine-readable summary", () => {
  assertIncludes(k6Source, "load-tests/results/k6-platform-summary.json");
  assertIncludes(k6Source, "handleSummary");
});

check("load testing README documents required env values", () => {
  assertIncludes(readmeSource, "API_BASE");
  assertIncludes(readmeSource, "STUDENT_EMAIL");
  assertIncludes(readmeSource, "QUIZ_ID");
});

check("load test report documents the execution contract", () => {
  assertIncludes(reportSource, "10k User Readiness Gate");
  assertIncludes(reportSource, "Load Test Scripts - 2026-05-12");
});

const failed = checks.filter((item) => item.status === "FAIL");
if (failed.length > 0) {
  console.error(JSON.stringify({ total: checks.length, failed }, null, 2));
  process.exit(1);
}

console.log(`Load test contract passed (${checks.length} checks).`);
