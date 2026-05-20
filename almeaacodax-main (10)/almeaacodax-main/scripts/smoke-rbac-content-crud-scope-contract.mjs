import fs from "node:fs";

const source = fs.readFileSync("server/src/routes/content.routes.ts", "utf8");

const checks = [];
const add = (name, fn) => checks.push({ name, fn });

const assertIncludes = (snippet, message) => {
  if (!source.includes(snippet)) {
    throw new Error(message || `Missing snippet: ${snippet}`);
  }
};

add("adds topic scope guard helper", () => {
  assertIncludes("const hasTopicManagementScope = (", "Missing topic scope helper");
  assertIncludes("You do not have access to this topic", "Missing topic forbidden response");
});

add("adds group scope guard helper", () => {
  assertIncludes("const hasGroupManagementScope = async (", "Missing group scope helper");
  assertIncludes("You cannot manage this group", "Missing group forbidden response");
});

add("adds schoolId scope helper", () => {
  assertIncludes("const hasSchoolIdManagementScope = async (", "Missing schoolId scope helper");
  assertIncludes("You cannot manage this school", "Missing school scope forbidden response");
});

add("enforces scope on b2b-packages and access-codes mutations", () => {
  assertIncludes('"/b2b-packages"', "Missing b2b-packages route");
  assertIncludes('"/access-codes"', "Missing access-codes route");
  assertIncludes("if (req.authUser?.role === \"supervisor\")", "Missing supervisor-specific school scope checks");
  assertIncludes("hasSchoolIdManagementScope", "Missing school scope helper usage");
});

let failed = 0;
for (const check of checks) {
  try {
    check.fn();
    console.log(`PASS ${check.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${check.name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${checks.length} content scope hardening checks failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} content scope hardening checks passed.`);
