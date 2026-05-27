import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "server/src/routes/course.routes.ts"), "utf8");

const checks = [];
const check = (name, fn) => checks.push({ name, fn });
const assertIncludes = (snippet, label = snippet) => {
  if (!source.includes(snippet)) throw new Error(`Missing: ${label}`);
};

check("scope guard helper exists", () => {
  assertIncludes("const assertCurriculumImportScope", "guard helper");
  assertIncludes("Lesson scope mismatch", "lesson mismatch error");
  assertIncludes("Quiz scope mismatch", "quiz mismatch error");
});

check("create route enforces curriculum scope", () => {
  assertIncludes("await assertCurriculumImportScope({\n      coursePathId: payload.pathId", "post scope guard");
});

check("update route enforces curriculum scope", () => {
  assertIncludes("const nextPathId = String(payload.pathId", "patch scope derivation");
  assertIncludes("await assertCurriculumImportScope({\n      coursePathId: nextPathId", "patch scope guard");
});

let failed = 0;
for (const item of checks) {
  try {
    item.fn();
    console.log(`PASS ${item.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${item.name}`);
    console.error(error.message);
  }
}

if (failed) {
  console.error(`\\n${failed}/${checks.length} curriculum scope guard checks failed.`);
  process.exit(1);
}

console.log(`\\nAll ${checks.length} curriculum scope guard checks passed.`);
