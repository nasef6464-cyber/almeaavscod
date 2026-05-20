import { execSync } from "node:child_process";

const FRONTEND_URL = (process.env.SMOKE_FRONTEND_URL || "https://almeaacodax.vercel.app").replace(/\/$/, "");
const API_URL = (process.env.SMOKE_API_URL || "https://almeaacodax-k2ux.onrender.com/api").replace(/\/$/, "");
const EXPECTED_VERSION =
  process.env.SMOKE_EXPECT_VERSION ||
  (() => {
    try {
      return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    } catch {
      return "";
    }
  })();

const SOFT_LIMITS_MS = {
  frontendShell: 1200,
  entryAsset: 1800,
  apiHealth: 1200,
  apiReady: 1500,
  apiScaleReady: 1500,
  taxonomyBootstrap: 1800,
  contentBootstrap: 2500,
  courseList: 1800,
  questionSummary: 1800,
  announcementAds: 1200,
};

const results = [];

function now() {
  return globalThis.performance?.now?.() || Date.now();
}

async function timedFetch(name, url, options = {}, limitMs = 1500) {
  const startedAt = now();
  let response;
  let body = "";
  let json = null;
  const warnStatuses = new Set(options.warnStatuses || []);
  const fetchOptions = { ...options };
  delete fetchOptions.warnStatuses;

  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers: {
        "cache-control": "no-cache",
        pragma: "no-cache",
        ...(fetchOptions.headers || {}),
      },
    });
    body = await response.text();
    try {
      json = body ? JSON.parse(body) : null;
    } catch {
      json = null;
    }
  } catch (error) {
    const durationMs = Math.round(now() - startedAt);
    results.push({
      name,
      status: "fail",
      durationMs,
      limitMs,
      detail: error instanceof Error ? error.message : String(error),
    });
    return { response: null, body: "", json: null, durationMs };
  }

  const durationMs = Math.round(now() - startedAt);
  const statusIsWarning = !response.ok && warnStatuses.has(response.status);
  results.push({
    name,
    status: statusIsWarning ? "warn" : !response.ok ? "fail" : durationMs > limitMs ? "warn" : "pass",
    durationMs,
    limitMs,
    detail: `${response.status} ${response.statusText}`.trim(),
  });

  return { response, body, json, durationMs };
}

function summarizeHealth(health, ready) {
  const blockers = [];
  const warnings = [];

  if (health?.database && health.database !== "connected") {
    blockers.push(`database=${health.database}`);
  }

  const redisRateLimit = ready?.redis?.rateLimit || health?.redis?.rateLimit;
  const redisQueue = ready?.redis?.queue || health?.redis?.queue;
  if (redisRateLimit && ["missing", "not_configured", "unhealthy"].includes(redisRateLimit.status || redisRateLimit)) {
    warnings.push(`redis-rate-limit=${redisRateLimit.status || redisRateLimit}`);
  }
  if (redisQueue && ["missing", "not_configured", "unhealthy"].includes(redisQueue.status || redisQueue)) {
    warnings.push(`redis-queue=${redisQueue.status || redisQueue}`);
  }

  return { blockers, warnings };
}

const shell = await timedFetch(
  "frontend shell",
  `${FRONTEND_URL}/?speed=${Date.now()}`,
  {},
  SOFT_LIMITS_MS.frontendShell,
);
const assetMatch = shell.body.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/);
let entryAsset = { body: "" };
if (assetMatch) {
  entryAsset = await timedFetch(
    "frontend entry asset",
    new URL(assetMatch[1], FRONTEND_URL).toString(),
    {},
    SOFT_LIMITS_MS.entryAsset,
  );
  if (EXPECTED_VERSION && !entryAsset.body.includes(EXPECTED_VERSION)) {
    results.push({
      name: "deployed commit",
      status: "warn",
      durationMs: 0,
      limitMs: 0,
      detail: `entry asset does not include expected commit ${EXPECTED_VERSION}`,
    });
  }
} else {
  results.push({
    name: "frontend entry asset",
    status: "fail",
    durationMs: 0,
    limitMs: SOFT_LIMITS_MS.entryAsset,
    detail: "entry asset not found in shell HTML",
  });
}

const health = await timedFetch("api health", `${API_URL}/health`, {}, SOFT_LIMITS_MS.apiHealth);
const ready = await timedFetch(
  "api ready",
  `${API_URL}/health/ready`,
  {},
  SOFT_LIMITS_MS.apiReady,
);
const scaleReady = await timedFetch(
  "api scale-ready",
  `${API_URL}/health/scale-ready`,
  { warnStatuses: [503] },
  SOFT_LIMITS_MS.apiScaleReady,
);
await timedFetch("taxonomy bootstrap", `${API_URL}/taxonomy/bootstrap`, {}, SOFT_LIMITS_MS.taxonomyBootstrap);
await timedFetch("content bootstrap", `${API_URL}/content/bootstrap`, {}, SOFT_LIMITS_MS.contentBootstrap);
await timedFetch("course list", `${API_URL}/courses?limit=200`, {}, SOFT_LIMITS_MS.courseList);
await timedFetch(
  "question summary",
  `${API_URL}/quizzes/questions?summary=true&noTotal=true&limit=80&page=1&pathId=p_1777779639431&subject=sub_1777779748206`,
  {},
  SOFT_LIMITS_MS.questionSummary,
);
await timedFetch("announcement ads", `${API_URL}/content/announcement-ads`, {}, SOFT_LIMITS_MS.announcementAds);

const healthSummary = summarizeHealth(health.json, scaleReady.json || ready.json);

for (const item of results) {
  const mark = item.status === "pass" ? "PASS" : item.status === "warn" ? "WARN" : "FAIL";
  const limit = item.limitMs ? ` limit=${item.limitMs}ms` : "";
  console.log(`${mark} ${item.name} - ${item.durationMs}ms${limit} - ${item.detail}`);
}

if (healthSummary.warnings.length > 0) {
  console.log(`WARN scale dependencies - ${healthSummary.warnings.join(", ")}`);
}
if (healthSummary.blockers.length > 0) {
  console.log(`FAIL critical dependencies - ${healthSummary.blockers.join(", ")}`);
}

const failed = results.filter((item) => item.status === "fail");
if (healthSummary.blockers.length > 0 || failed.length > 0) {
  process.exit(1);
}

const slow = results.filter((item) => item.status === "warn");
console.log(
  `\nProduction speed smoke completed with ${slow.length} timing warning(s). Redis warnings mean the app can run, but is not ready for multi-instance 10k scale until REDIS_URL is configured.`,
);
