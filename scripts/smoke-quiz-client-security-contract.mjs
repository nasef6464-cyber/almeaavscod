import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [apiSource, storeSource, quizPageSource, hardeningSmokeSource] = await Promise.all([
  read("services/api.ts"),
  read("store/useStore.ts"),
  read("pages/QuizPage.tsx"),
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

check("frontend has no direct quiz-result creation helper", () => {
  assertNotIncludes(apiSource, "createQuizResult");
  assertNotIncludes(apiSource, '"/quizzes/results", {\n      method: "POST"');
  assertNotIncludes(storeSource, "api.createQuizResult");
});

check("quiz completion uses the server-side scoring endpoint", () => {
  assertIncludes(quizPageSource, "api.submitQuiz(quiz.id");
  assertIncludes(quizPageSource, "answers: selectedOptions");
  assertNotIncludes(quizPageSource, "api.createQuizResult");
});

check("question-attempt sync does not send client-calculated correctness", () => {
  assertIncludes(storeSource, "const { isCorrect: _localOnly, ...serverAttempt } = attempt;");
  assertIncludes(storeSource, "api.createQuestionAttempt(serverAttempt)");
  assertNotIncludes(storeSource, "api.createQuestionAttempt(attempt)");
});

check("backend hardening contract still rejects direct result creation", () => {
  assertIncludes(hardeningSmokeSource, "direct quiz result creation is disabled");
  assertIncludes(hardeningSmokeSource, "StatusCodes.GONE");
});

const failed = checks.filter((item) => item.status === "FAIL");
console.log(JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));

if (failed.length > 0) {
  process.exit(1);
}
