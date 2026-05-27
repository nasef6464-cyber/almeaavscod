import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const quizRoutesSource = await read("server/src/routes/quiz.routes.ts");

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

check("quiz publish path validates question integrity", () => {
  assertIncludes(quizRoutesSource, "const validateQuizQuestionIntegrity = async (quizLike: any) => {");
  assertIncludes(quizRoutesSource, "if (willBePublished) {");
  assertIncludes(quizRoutesSource, "const integrity = await validateQuizQuestionIntegrity(payload);");
  assertIncludes(quizRoutesSource, "Cannot publish quiz: some referenced questions are missing or have incomplete content");
});

check("quiz update path validates published quizzes", () => {
  assertIncludes(quizRoutesSource, "if (nextQuizState.isPublished === true) {");
  assertIncludes(quizRoutesSource, "const integrity = await validateQuizQuestionIntegrity(nextQuizState);");
});

check("integrity report endpoint exists for admins", () => {
  assertIncludes(quizRoutesSource, '"/integrity-report"');
  assertIncludes(quizRoutesSource, 'requireRole(["admin"])');
  assertIncludes(quizRoutesSource, "affected: issues.length");
});

check("learner quiz listing excludes unusable quizzes", () => {
  assertIncludes(quizRoutesSource, "safeItems = items.filter((quiz: any) =>");
  assertIncludes(quizRoutesSource, "getQuizQuestionIds(quiz).some((questionId: string) => usableById.get(String(questionId)) === true)");
});

const failed = checks.filter((item) => item.status === "FAIL");
console.log(JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));

if (failed.length > 0) {
  process.exit(1);
}
