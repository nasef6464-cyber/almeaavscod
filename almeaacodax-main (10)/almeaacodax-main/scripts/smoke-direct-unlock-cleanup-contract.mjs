import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  apiSource,
  storeSource,
  authRoutesSource,
  seedApiSource,
  hardeningSmokeSource,
] = await Promise.all([
  read("services/api.ts"),
  read("store/useStore.ts"),
  read("server/src/routes/auth.routes.ts"),
  read("server/src/scripts/seedOperationalScenarioApi.ts"),
  read("scripts/smoke-production-hardening-contract.mjs"),
]);

const checks = [];

function check(name, assertion) {
  try {
    assertion();
    checks.push({ name, status: "PASS" });
  } catch (error) {
    checks.push({ name, status: "FAIL", details: error instanceof Error ? error.message : String(error) });
  }
}

function assertIncludes(source, fragment, message) {
  if (!source.includes(fragment)) {
    throw new Error(message || `Missing fragment: ${fragment}`);
  }
}

function assertNotIncludes(source, fragment, message) {
  if (source.includes(fragment)) {
    throw new Error(message || `Unexpected fragment: ${fragment}`);
  }
}

check("frontend API exposes no direct learner purchase helper", () => {
  assertNotIncludes(apiSource, "completePurchase");
  assertNotIncludes(apiSource, '"/auth/me/purchase"');
  assertNotIncludes(storeSource, "completePurchase");
  assertNotIncludes(storeSource, "purchasedCourses: Array.from(new Set");
});

check("backend direct purchase route stays disabled and audited", () => {
  assertIncludes(authRoutesSource, '"/me/purchase"');
  assertIncludes(authRoutesSource, "auth.direct_purchase.blocked");
  assertIncludes(authRoutesSource, "StatusCodes.GONE");
  assertIncludes(authRoutesSource, "Direct purchase unlock is disabled");
  const directRouteBlock = authRoutesSource.slice(
    authRoutesSource.indexOf('"/me/purchase"'),
    authRoutesSource.indexOf('"/me/redeem-access-code"'),
  );
  assertNotIncludes(directRouteBlock, "applyPurchaseToUser(");
  assertNotIncludes(directRouteBlock, "purchaseSchema.parse");
  assertNotIncludes(directRouteBlock, "purchasedCourses");
  assertNotIncludes(directRouteBlock, "purchasedPackages");
});

check("operational API seed uses payment approval instead of direct purchase", () => {
  assertNotIncludes(seedApiSource, '"/auth/me/purchase"');
  assertIncludes(seedApiSource, '"/payments/requests"');
  assertIncludes(seedApiSource, "/review");
  assertIncludes(seedApiSource, "ensureApprovedPayment");
});

check("operational API seed submits quizzes instead of creating direct results", () => {
  assertNotIncludes(seedApiSource, '"/quizzes/results", "POST"');
  assertIncludes(seedApiSource, "/submit");
  assertIncludes(seedApiSource, "submitResultIfMissing");
});

check("production hardening smoke still protects the disabled backend route", () => {
  assertIncludes(hardeningSmokeSource, "direct learner purchase unlock is disabled");
  assertIncludes(hardeningSmokeSource, "StatusCodes.GONE");
});

const failed = checks.filter((item) => item.status === "FAIL");
console.log(JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));

if (failed.length > 0) {
  process.exit(1);
}
