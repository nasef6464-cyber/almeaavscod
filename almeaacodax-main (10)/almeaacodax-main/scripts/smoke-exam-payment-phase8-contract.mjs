import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [quizRoutes, quizResultModel, accessGrantService, paymentRoutes, authRoutes] = await Promise.all([
  read("server/src/routes/quiz.routes.ts"),
  read("server/src/models/QuizResult.ts"),
  read("server/src/services/accessGrantService.ts"),
  read("server/src/routes/payment.routes.ts"),
  read("server/src/routes/auth.routes.ts"),
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

check("direct result creation remains blocked and audited", () => {
  assertIncludes(quizRoutes, '"/results"');
  assertIncludes(quizRoutes, "quiz.direct_result.blocked");
  assertIncludes(quizRoutes, "StatusCodes.GONE");
  assertIncludes(quizRoutes, "DIRECT_RESULT_DISABLED_MESSAGE");
});

check("quiz submit enforces server-side window, attempt limits, and duplicate protection", () => {
  assertIncludes(quizRoutes, "assertQuizWindowIsOpen");
  assertIncludes(quizRoutes, "getQuizMaxAttempts");
  assertIncludes(quizRoutes, "previousAttempts >= maxAttempts");
  assertIncludes(quizRoutes, "submissionKey");
  assertIncludes(quizRoutes, "Quiz submission already processed");
});

check("quiz score and pass/fail are calculated only on the server", () => {
  assertIncludes(quizRoutes, "const score = Math.round((correctAnswers / Math.max(totalQuestions, 1)) * 100)");
  assertIncludes(quizRoutes, "passed: score >= passingScore");
  assertIncludes(quizRoutes, "const isCorrect = selectedOptionIndex === Number(question.correctOptionIndex ?? 0)");
  assertNotIncludes(quizRoutes, "payload.score");
  assertNotIncludes(quizRoutes, "payload.passed");
});

check("learner question list does not expose answer keys before submission", () => {
  assertIncludes(quizRoutes, "sanitizeQuestionForLearner");
  assertIncludes(quizRoutes, "const { correctOptionIndex, explanation, __v, ...safeQuestion } = question");
  assertIncludes(quizRoutes, "canSeeAnswers");
});

check("result model stores attempt metadata for audit and race protection", () => {
  assertIncludes(quizResultModel, "passed");
  assertIncludes(quizResultModel, "attemptNumber");
  assertIncludes(quizResultModel, "timeSpentSeconds");
  assertIncludes(quizResultModel, "submissionKey");
  assertIncludes(quizResultModel, "userId: 1, quizId: 1, attemptNumber: 1");
});

check("subscriptions and access still flow through AccessGrant and atomic approvals", () => {
  assertIncludes(accessGrantService, "grantAccessToUser");
  assertIncludes(accessGrantService, "$addToSet");
  assertIncludes(paymentRoutes, "PaymentRequestModel.findOneAndUpdate");
  assertIncludes(paymentRoutes, "grantApprovedPaymentAccess");
  assertIncludes(authRoutes, "AccessCodeModel.findOneAndUpdate");
  assertIncludes(authRoutes, 'sourceType: "access_code"');
});

const failed = checks.filter((item) => item.status === "FAIL");
console.log(JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));

if (failed.length > 0) {
  process.exit(1);
}
