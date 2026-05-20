import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../server/src/app.ts', import.meta.url), 'utf8');
const authRoutesSource = await readFile(new URL('../server/src/routes/auth.routes.ts', import.meta.url), 'utf8');
const quizRoutesSource = await readFile(new URL('../server/src/routes/quiz.routes.ts', import.meta.url), 'utf8');

const checks = [];

function check(name, assertion) {
  try {
    assertion();
    checks.push({ name, status: 'PASS' });
  } catch (error) {
    checks.push({ name, status: 'FAIL', details: error instanceof Error ? error.message : String(error) });
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

function assertAnyIncludes(source, fragments, message) {
  if (!fragments.some((fragment) => source.includes(fragment))) {
    throw new Error(message || `Missing all expected fragments: ${fragments.join(", ")}`);
  }
}

check('direct learner purchase unlock is disabled', () => {
  assertIncludes(authRoutesSource, '"/me/purchase"');
  assertIncludes(authRoutesSource, 'StatusCodes.GONE');
  assertIncludes(authRoutesSource, 'Direct purchase unlock is disabled');
  assertNotIncludes(authRoutesSource, 'const payload = purchaseSchema.parse(req.body)');
});

check('access-code redemption uses an atomic usage reservation', () => {
  assertIncludes(authRoutesSource, 'AccessCodeModel.findOneAndUpdate');
  assertIncludes(authRoutesSource, '$expr: { $lt: ["$currentUses", "$maxUses"] }');
  assertIncludes(authRoutesSource, '$inc: { currentUses: 1 }');
  assertNotIncludes(authRoutesSource, 'accessCode.currentUses = (accessCode.currentUses || 0) + 1');
});

check('direct quiz result creation is disabled', () => {
  assertIncludes(quizRoutesSource, '"/results"');
  assertIncludes(quizRoutesSource, 'Direct quiz result creation is disabled');
  assertIncludes(quizRoutesSource, 'Submit quiz answers through /api/quizzes/:id/submit');
  assertNotIncludes(quizRoutesSource, '...req.body,');
});

check('question attempts calculate correctness on the server', () => {
  assertNotIncludes(quizRoutesSource, 'isCorrect: z.boolean().default(false)');
  assertIncludes(quizRoutesSource, 'correctOptionIndex');
  assertIncludes(quizRoutesSource, 'selectedOptionIndex === Number(question.correctOptionIndex ?? 0)');
  assertIncludes(quizRoutesSource, 'isCorrect,');
});

check('server has baseline production security middleware', () => {
  assertIncludes(appSource, 'helmet({');
  assertIncludes(appSource, 'compression()');
  assertIncludes(appSource, 'app.set("trust proxy", 1)');
  assertAnyIncludes(
    appSource,
    ['rateLimit({', 'globalRateLimiter', 'authRateLimiter', 'sensitiveActionRateLimiter'],
    'Missing baseline rate limit middleware wiring',
  );
  assertIncludes(appSource, '"/api/auth/login"');
  assertIncludes(appSource, '"/api/quizzes/*/submit"');
  assertIncludes(appSource, 'express.json({ limit: "100kb" })');
  assertIncludes(appSource, 'express.json({ limit: "1mb" })');
  assertIncludes(appSource, 'express.json({ limit: "5mb" })');
});

const failed = checks.filter((item) => item.status === 'FAIL');
console.log(JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));

if (failed.length > 0) {
  process.exit(1);
}
