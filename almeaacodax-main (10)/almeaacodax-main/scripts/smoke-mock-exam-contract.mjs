import { readFile } from 'node:fs/promises';

const typeSource = await readFile(new URL('../types.ts', import.meta.url), 'utf8');
const mockUtilsSource = await readFile(new URL('../utils/mockExam.ts', import.meta.url), 'utf8');
const adminSource = await readFile(new URL('../dashboards/admin/MockExamManager.tsx', import.meta.url), 'utf8');
const pathPageSource = await readFile(new URL('../pages/GenericPathPage.tsx', import.meta.url), 'utf8');
const mockPageSource = await readFile(new URL('../pages/MockExams.tsx', import.meta.url), 'utf8');
const quizPageSource = await readFile(new URL('../pages/QuizPage.tsx', import.meta.url), 'utf8');
const headerSource = await readFile(new URL('../components/Header.tsx', import.meta.url), 'utf8');
const frontendSmokeSource = await readFile(new URL('../scripts/smoke-frontend-routes.mjs', import.meta.url), 'utf8');

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

check('mock exam data model is path-level with ordered sections from question bank refs', () => {
  assertIncludes(typeSource, 'export interface MockExamSection');
  assertIncludes(typeSource, 'subjectId?: string');
  assertIncludes(typeSource, 'questionIds: string[]');
  assertIncludes(typeSource, 'timeLimit?: number');
  assertIncludes(typeSource, 'export interface MockExamConfig');
  assertIncludes(typeSource, 'pathId: string');
  assertIncludes(typeSource, 'sections: MockExamSection[]');
});

check('mock exam utilities keep standalone mock exams out of material quiz centers', () => {
  assertIncludes(mockUtilsSource, 'export const isPathMockExam');
  assertIncludes(mockUtilsSource, 'quiz.mockExam?.pathId === pathId || quiz.pathId === pathId');
  assertIncludes(mockUtilsSource, 'export const isStandaloneMockExam = (quiz: Quiz) => quiz.mockExam?.enabled === true');
  assertIncludes(mockUtilsSource, 'export const isMaterialQuizCandidate = (quiz: Quiz) => !isStandaloneMockExam(quiz)');
  assertIncludes(mockUtilsSource, 'flattenMockExamQuestionIds');
  assertIncludes(mockUtilsSource, 'getMockExamTimeLimit');
});

check('admin mock exam manager creates independent path mock exams from question center questions', () => {
  assertIncludes(adminSource, 'pathQuestions');
  assertIncludes(adminSource, 'questions.filter((question) => question.pathId === selectedPathId || pathSubjects.some((subject) => subject.id === question.subject))');
  assertIncludes(adminSource, 'filterQuestionsForSection');
  assertIncludes(adminSource, 'skillFilter');
  assertIncludes(adminSource, 'difficultyFilter');
  assertIncludes(adminSource, 'toggleQuestion(section.id, question.id)');
});

check('admin mock exam save publishes a standalone mock quiz without training/material placement', () => {
  assertIncludes(adminSource, "mockExam: { enabled: true, pathId: selectedPathId, sections: cleanSections }");
  assertIncludes(adminSource, "placement: 'mock'");
  assertIncludes(adminSource, 'showInTraining: false');
  assertIncludes(adminSource, 'showInMock: false');
  assertIncludes(adminSource, 'questionIds: allQuestionIds');
  assertIncludes(adminSource, 'isPublished: true');
  assertIncludes(adminSource, 'showOnPlatform: true');
  assertIncludes(adminSource, "approvalStatus: 'approved'");
});

check('path page exposes mock exam card and path tab as separate from subject tests', () => {
  assertIncludes(pathPageSource, "searchParams.get('tab') === 'mock-exams'");
  assertIncludes(pathPageSource, 'renderMockExamEntryCard');
  assertIncludes(pathPageSource, "to={`/category/${path.id}?tab=mock-exams`}");
  assertIncludes(pathPageSource, 'pathMockQuizzes');
  assertIncludes(pathPageSource, 'isPathMockExam(quiz, path.id) && canStudentSeeContent(quiz)');
  assertIncludes(pathPageSource, "source: 'mock-exam'");
});

check('global mock exam page is a simple path picker and links to the same path mock tab', () => {
  assertIncludes(mockPageSource, 'getVisibleMockExams');
  assertIncludes(mockPageSource, 'isPathMockExam(quiz, pathId)');
  assertIncludes(mockPageSource, 'showMockEntry');
  assertIncludes(mockPageSource, "to={`/category/${path.id}?tab=mock-exams`}");
  assertIncludes(mockPageSource, '<details');
});

check('quiz runner loads mock exam sections and uses their total time and return source', () => {
  assertIncludes(quizPageSource, 'flattenMockExamQuestionIds(foundQuiz)');
  assertIncludes(quizPageSource, 'foundQuiz.mockExam?.enabled ? getMockExamTimeLimit(foundQuiz)');
  assertIncludes(quizPageSource, "if (quiz?.mockExam?.enabled) return 'mock-exam'");
  assertIncludes(quizPageSource, "sourceParam === 'mock-exam'");
  assertIncludes(quizPageSource, 'mockExamSectionSummaries');
  assertIncludes(quizPageSource, 'currentMockExamSection');
});

check('header updates mock exam navigation when quiz data changes', () => {
  assertIncludes(headerSource, 'isPathMockExam(quiz, path.id)');
  assertIncludes(headerSource, "id: 'mock-exams'");
  assertIncludes(headerSource, "link: '/mock-exams'");
  assertIncludes(headerSource, "[levels, paths, quizzes, subjects, user?.role]");
});

check('frontend smoke covers global and per-path mock exam route shells', () => {
  assertIncludes(frontendSmokeSource, "'/#/mock-exams'");
  assertIncludes(frontendSmokeSource, "routes.push(`/#/category/${pathId}?tab=mock-exams`)");
});

for (const item of checks) {
  console.log(`${item.status} ${item.name}${item.details ? ` - ${item.details}` : ''}`);
}

const failed = checks.filter((item) => item.status === 'FAIL');
if (failed.length > 0) {
  console.error(`\n${failed.length} mock exam contract smoke check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} mock exam contract smoke checks passed.`);
