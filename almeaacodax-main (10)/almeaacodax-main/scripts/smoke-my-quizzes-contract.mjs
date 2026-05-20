import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
const headerSource = await readFile(new URL('../components/Header.tsx', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../pages/Dashboard.tsx', import.meta.url), 'utf8');
const quizzesSource = await readFile(new URL('../pages/Quizzes.tsx', import.meta.url), 'utf8');
const smartLearningPathSource = await readFile(new URL('../components/SmartLearningPath.tsx', import.meta.url), 'utf8');

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

check('standalone routes separate quiz center from my attempts without dashboard sidebar', () => {
  assertIncludes(appSource, "const Quizzes = React.lazy(() => import('./pages/Quizzes'))");
  assertIncludes(appSource, '<Route path="/quizzes" element={<Quizzes />} />');
  assertIncludes(appSource, '<Route path="/my-quizzes" element={<Quizzes view="attempts" />} />');
});

check('account menu opens the simple my quizzes attempts page', () => {
  assertIncludes(headerSource, '<UserMenuItem to="/my-quizzes"');
  assertIncludes(headerSource, 'label={text.quizzes}');
});

check('student dashboard still embeds the same attempts view for sidebar users', () => {
  assertIncludes(dashboardSource, "case 'quizzes': return <Suspense fallback={<TabLoading />}><Quizzes view=\"attempts\" /></Suspense>;");
});

check('my quizzes groups attempts by quiz and separates regular from mock exams', () => {
  assertIncludes(quizzesSource, "type AttemptCategory = 'regular' | 'mock'");
  assertIncludes(quizzesSource, "result.source === 'mock-exam'");
  assertIncludes(quizzesSource, 'isStandaloneMockExam(quiz)');
  assertIncludes(quizzesSource, 'const attemptGroups = useMemo<QuizAttemptGroup[]>');
  assertIncludes(quizzesSource, 'attemptGroupsByCategory');
});

check('my quizzes keeps attempts behind an explicit toggle to reduce crowding', () => {
  assertIncludes(quizzesSource, 'openAttemptGroupKey');
  assertIncludes(quizzesSource, 'AttemptGroupCard');
  assertIncludes(quizzesSource, 'onToggle={() => setOpenAttemptGroupKey');
  assertPattern(quizzesSource, /\{isOpen \? '.*' : '.*'\}/s, 'Attempt card should switch open/close label');
});

check('each attempt keeps result, review, analysis, and retry actions', () => {
  assertIncludes(quizzesSource, "getAttemptResultLink(attempt, 'review')");
  assertIncludes(quizzesSource, "getAttemptResultLink(attempt, 'analysis')");
  assertIncludes(quizzesSource, 'getAttemptRetryLink(latest)');
  assertIncludes(quizzesSource, 'buildQuizRouteWithContext(result.quizId');
});

check('student quiz actions have clear compact visual cues', () => {
  assertIncludes(indexSource, '.cta-attention');
  assertIncludes(quizzesSource, "label.includes('محاكية')");
  assertIncludes(quizzesSource, 'bg-gradient-to-br from-indigo-600 to-violet-600');
  assertIncludes(quizzesSource, 'bg-gradient-to-br from-amber-400 to-orange-500');
  assertIncludes(quizzesSource, 'px-4 py-2.5 text-sm font-black');
});

check('smart learning action buttons stay prominent but compact', () => {
  assertIncludes(dashboardSource, 'hover:-translate-y-0.5 hover:shadow-md');
  assertIncludes(dashboardSource, 'h-2 w-2 rounded-full bg-white/80 animate-pulse');
  assertIncludes(smartLearningPathSource, 'bg-gradient-to-l from-indigo-600 to-purple-600');
  assertIncludes(smartLearningPathSource, 'hover:-translate-y-0.5 hover:shadow-md');
  assertIncludes(smartLearningPathSource, 'h-2 w-2 rounded-full bg-white/80 animate-pulse');
});

for (const item of checks) {
  console.log(`${item.status} ${item.name}${item.details ? ` - ${item.details}` : ''}`);
}

const failed = checks.filter((item) => item.status === 'FAIL');
if (failed.length > 0) {
  console.error(`\n${failed.length} my quizzes contract smoke check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} my quizzes contract smoke checks passed.`);
