import { readFile } from 'node:fs/promises';

const resultsSource = await readFile(new URL('../pages/Results.tsx', import.meta.url), 'utf8');
const planSource = await readFile(new URL('../docs/CURRENT_EXECUTION_PLAN_AR.md', import.meta.url), 'utf8');

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

function assertPattern(source, pattern, message) {
  if (!pattern.test(source)) {
    throw new Error(message || `Missing pattern: ${pattern}`);
  }
}

check('result page keeps review behind saved questionReview', () => {
  assertIncludes(resultsSource, 'const questionReviewCount = latestResult?.questionReview?.length || 0');
  assertIncludes(resultsSource, "setViewMode('review')");
  assertPattern(
    resultsSource,
    /disabled=\{questionReviewCount === 0\}/,
    'review button must be disabled when there are no saved questions',
  );
});

check('review can supplement missing saved questions from the question bank', () => {
  assertIncludes(resultsSource, 'supplementMissingReviewQuestions');
  assertIncludes(resultsSource, 'getQuestionContextScore');
  assertIncludes(resultsSource, 'rebuiltQuestions');
  assertIncludes(resultsSource, 'quizQuestionIds.length');
  assertIncludes(resultsSource, 'toQuestionReviewFromBank(question)');
});

check('retry result action preserves quiz context', () => {
  assertIncludes(resultsSource, 'buildQuizRouteWithContext(latestResult.quizId');
  assertIncludes(resultsSource, 'returnTo: safeResultReturnTo || undefined');
  assertIncludes(resultsSource, 'source: latestResult.source');
  assertIncludes(resultsSource, 'to={retryQuizLink}');
});

check('additional quiz is targeted from weak skills', () => {
  assertIncludes(resultsSource, "params.set('mode', 'self')");
  assertIncludes(resultsSource, "params.set('autostart', '1')");
  assertIncludes(resultsSource, "params.set('skillIds', skillIds.join(','))");
  assertIncludes(resultsSource, "item.status === 'weak' || item.mastery < 70");
});

check('details stay opt-in for student result', () => {
  assertIncludes(resultsSource, "const [resultDepth, setResultDepth] = React.useState<'simple' | 'full'>('simple')");
  assertIncludes(resultsSource, "setResultDepth((current) => (current === 'simple' ? 'full' : 'simple'))");
  assertIncludes(resultsSource, "const isFullResult = resultDepth === 'full'");
  assertIncludes(resultsSource, 'isFullResult');
});

check('current execution plan documents the closed result scope', () => {
  assertIncludes(planSource, 'questionReview');
  assertIncludes(planSource, 'returnTo');
  assertIncludes(planSource, 'smoke:results');
});

for (const item of checks) {
  console.log(`${item.status} ${item.name}${item.details ? ` - ${item.details}` : ''}`);
}

const failed = checks.filter((item) => item.status === 'FAIL');
if (failed.length > 0) {
  console.error(`\n${failed.length} result contract smoke check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} result contract smoke checks passed.`);
