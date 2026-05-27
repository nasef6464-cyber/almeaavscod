import { readFile } from 'node:fs/promises';

const typeSource = await readFile(new URL('../types.ts', import.meta.url), 'utf8');
const learningSectionSource = await readFile(new URL('../components/LearningSection.tsx', import.meta.url), 'utf8');
const genericPathSource = await readFile(new URL('../pages/GenericPathPage.tsx', import.meta.url), 'utf8');
const pathsManagerSource = await readFile(new URL('../dashboards/admin/PathsManager.tsx', import.meta.url), 'utf8');
const quizBuilderSource = await readFile(new URL('../dashboards/admin/QuizBuilder.tsx', import.meta.url), 'utf8');
const quizzesManagerSource = await readFile(new URL('../dashboards/admin/QuizzesManager.tsx', import.meta.url), 'utf8');
const subjectLearningSource = await readFile(new URL('../pages/SubjectLearningPage.tsx', import.meta.url), 'utf8');
const foundationManagerSource = await readFile(new URL('../dashboards/admin/FoundationManager.tsx', import.meta.url), 'utf8');
const quizRoutesSource = await readFile(new URL('../server/src/routes/quiz.routes.ts', import.meta.url), 'utf8');
const quizPlacementSource = await readFile(new URL('../utils/quizLearningPlacement.ts', import.meta.url), 'utf8');
const quizPageSource = await readFile(new URL('../pages/QuizPage.tsx', import.meta.url), 'utf8');
const simulatedTestExperienceSource = await readFile(new URL('../components/SimulatedTestExperience.tsx', import.meta.url), 'utf8');

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

check('quiz access model supports free, paid, private, and course-only access', () => {
  assertIncludes(typeSource, "type: 'free' | 'paid' | 'private' | 'course_only'");
  assertIncludes(typeSource, 'price?: number');
  assertIncludes(typeSource, 'allowedGroupIds?: string[]');
  assertIncludes(typeSource, "export type PackageContentType = 'courses' | 'foundation' | 'banks' | 'tests' | 'library' | 'all'");
});

check('quiz builder exposes the four access states with package and group controls', () => {
  assertIncludes(quizBuilderSource, '<option value="free">');
  assertIncludes(quizBuilderSource, '<option value="paid">');
  assertIncludes(quizBuilderSource, '<option value="private">');
  assertIncludes(quizBuilderSource, '<option value="course_only">');
  assertIncludes(quizBuilderSource, "currentQuiz.access?.type === 'paid'");
  assertIncludes(quizBuilderSource, 'price: Number(e.target.value)');
  assertIncludes(quizBuilderSource, "currentQuiz.access?.type === 'private'");
  assertIncludes(quizBuilderSource, 'allowedGroupIds: values');
});

check('quiz builder keeps publish and platform visibility separate', () => {
  assertIncludes(quizBuilderSource, 'checked={currentQuiz.isPublished || false}');
  assertIncludes(quizBuilderSource, 'isPublished: e.target.checked');
  assertIncludes(quizBuilderSource, 'checked={currentQuiz.showOnPlatform !== false}');
  assertIncludes(quizBuilderSource, 'showOnPlatform: e.target.checked');
});

check('student learning area resolves bank and test package access independently', () => {
  assertIncludes(learningSectionSource, "hasScopedPackageAccess('banks', category, subject)");
  assertIncludes(learningSectionSource, "hasScopedPackageAccess('tests', category, subject)");
  assertIncludes(learningSectionSource, "isQuizLockedForStudent(q, hasBanksAccess, 'training')");
  assertIncludes(learningSectionSource, "isQuizLockedForStudent(q, hasTestsAccess, 'tests')");
});

check('student learning keeps training and tests visually separate while reusing the quiz engine', () => {
  assertIncludes(learningSectionSource, 'mode="bank"');
  assertIncludes(learningSectionSource, "source: 'training'");
  assertIncludes(learningSectionSource, "source: 'tests'");
  assertIncludes(simulatedTestExperienceSource, "const listTitle = mode === 'bank' ? 'تدريبات المادة' : 'اختبارات المادة'");
  assertIncludes(simulatedTestExperienceSource, "const listAction = mode === 'bank' ? 'ابدأ التدريب' : 'ابدأ الاختبار'");
  assertIncludes(simulatedTestExperienceSource, 'openTestsCount');
  assertIncludes(simulatedTestExperienceSource, 'lockedTestsCount');
});

check('student quiz locking keeps placement-free open, private audience-only, and paid/package gated', () => {
  assertIncludes(learningSectionSource, 'resolveQuizLearningAccessType(quiz, slot ? { pathId: category, subjectId: subject, slot } : undefined)');
  assertIncludes(learningSectionSource, "if (accessType === 'free') return false");
  assertIncludes(learningSectionSource, "if (accessType === 'private') return !isQuizAudienceAllowed(quiz)");
  assertIncludes(learningSectionSource, 'return !hasPackageAccess');
});

check('learning placement access can override the reusable quiz without duplicating it', () => {
  assertIncludes(typeSource, "accessType?: 'inherit' | 'free' | 'paid'");
  assertIncludes(quizPlacementSource, 'export type LearningPlacementAccessType');
  assertIncludes(quizPlacementSource, 'getQuizLearningPlacementAccessType');
  assertIncludes(quizPlacementSource, 'resolveQuizLearningAccessType');
  assertIncludes(quizPlacementSource, 'setQuizLearningSlotAccess');
  assertIncludes(quizzesManagerSource, 'handleToggleLearningSlotAccess');
  assertIncludes(quizzesManagerSource, 'ضمن باقة هنا');
  assertIncludes(quizzesManagerSource, 'مجاني هنا');
});

check('locked learning quizzes open the matching package flow for bank and test slots', () => {
  assertIncludes(learningSectionSource, "bank: 'banks'");
  assertIncludes(learningSectionSource, "test: 'tests'");
  assertIncludes(learningSectionSource, 'openScopedPackageForType(matchedType, item, type)');
  assertIncludes(learningSectionSource, "onLockedClick={(test) => handleItemClick(test, 'bank')}");
  assertIncludes(learningSectionSource, "onLockedClick={(test) => handleItemClick(test, 'test')}");
});

check('learning-space admin chooses what appears in training and tests per material', () => {
  assertIncludes(quizzesManagerSource, "activeLearningSlot: LearningPlacementSlot | null = filterType === 'bank' ? 'training' : filterType === 'quiz' ? 'tests' : null");
  assertIncludes(quizzesManagerSource, 'isQuizVisibleInLearningSlot(quiz, activeLearningScope)');
  assertIncludes(quizzesManagerSource, 'setQuizLearningSlotVisibility(');
  assertIncludes(quizzesManagerSource, 'showOnPlatform: !isVisibleHere ? true : quiz.showOnPlatform');
  assertIncludes(quizzesManagerSource, 'isPublished: !isVisibleHere ? true : quiz.isPublished');
  assertIncludes(quizzesManagerSource, "approvalStatus: !isVisibleHere ? 'approved' : quiz.approvalStatus");
});

check('admin quiz readiness catches missing publication requirements before student visibility', () => {
  assertIncludes(quizzesManagerSource, 'getQuizReadinessMeta');
  assertIncludes(quizzesManagerSource, 'questionCount === 0');
  assertIncludes(quizzesManagerSource, 'measuredSkillIds.length === 0');
  assertIncludes(quizzesManagerSource, "quiz.mode || 'regular') === 'central'");
  assertPattern(
    quizzesManagerSource,
    /isVisible && \(!quiz\.isPublished \|\| !isApproved\)/,
    'visible quizzes must be published and approved before being considered ready',
  );
});

check('admin labels paid, private, course-only, central, and free access clearly', () => {
  assertIncludes(quizzesManagerSource, "quiz.access.type === 'paid'");
  assertIncludes(quizzesManagerSource, "quiz.access.type === 'private'");
  assertIncludes(quizzesManagerSource, "quiz.access.type === 'course_only'");
  assertIncludes(quizzesManagerSource, "(quiz.mode || 'regular') === 'central'");
  assertPattern(quizzesManagerSource, /return \{ label: '(مفتوح للعرض|Ù…ÙØªÙˆØ­ Ù„Ù„Ø¹Ø±Ø¶)'/);
});

check('path model supports separate subject, mock exam, and package cards', () => {
  assertIncludes(typeSource, 'export interface PathDisplaySettings');
  assertIncludes(typeSource, 'showSubjectCards?: boolean');
  assertIncludes(typeSource, 'showMockExamCard?: boolean');
  assertIncludes(typeSource, 'showPackageCard?: boolean');
  assertIncludes(typeSource, 'settings?: PathDisplaySettings');
});

check('admin can choose which path cards appear to students', () => {
  assertIncludes(pathsManagerSource, 'showSubjectCards: true');
  assertIncludes(pathsManagerSource, 'showMockExamCard: true');
  assertIncludes(pathsManagerSource, 'showPackageCard: true');
  assertIncludes(pathsManagerSource, 'newPathShowSubjectCards');
  assertIncludes(pathsManagerSource, 'newPathShowMockExamCard');
  assertIncludes(pathsManagerSource, 'newPathShowPackageCard');
  assertIncludes(pathsManagerSource, 'setNewPathShowSubjectCards');
  assertIncludes(pathsManagerSource, 'setNewPathShowMockExamCard');
  assertIncludes(pathsManagerSource, 'setNewPathShowPackageCard');
  assertIncludes(pathsManagerSource, 'showSubjectCards: newPathShowSubjectCards');
  assertIncludes(pathsManagerSource, 'showMockExamCard: newPathShowMockExamCard');
  assertIncludes(pathsManagerSource, 'showPackageCard: newPathShowPackageCard');
});

check('student path page respects card visibility switches', () => {
  assertIncludes(genericPathSource, 'const showSubjectCards = pathDisplaySettings.showSubjectCards !== false');
  assertIncludes(genericPathSource, 'const showMockExamCard = pathDisplaySettings.showMockExamCard !== false');
  assertIncludes(genericPathSource, 'const showPackageCard = pathDisplaySettings.showPackageCard !== false');
  assertIncludes(genericPathSource, 'showSubjectCards ? pathSubjects.map');
  assertIncludes(genericPathSource, 'const renderMockExamEntryCard = () => showMockExamCard ?');
  assertIncludes(genericPathSource, 'const renderPackageEntryCard = () => showPackageCard ?');
  assertPattern(
    genericPathSource,
    /showSubjectCards \? pathSubjects\.map[\s\S]*renderMockExamEntryCard\(\)[\s\S]*renderPackageEntryCard\(\)/,
    'path landing cards must keep the agreed order: subjects, mock exams, packages',
  );
});

check('path cards route to the same mock exam and package destinations used by navigation', () => {
  assertIncludes(genericPathSource, 'to={`/category/${path.id}?tab=mock-exams`}');
  assertIncludes(genericPathSource, 'to={`/category/${path.id}?tab=packages`}');
  assertIncludes(genericPathSource, "searchParams.get('tab') === 'mock-exams'");
  assertIncludes(genericPathSource, "searchParams.get('tab') === 'packages'");
});

check('subject learning page gates paid foundation, banks, tests, and library through scoped packages', () => {
  assertIncludes(subjectLearningSource, "hasScopedPackageAccess('foundation', pathId, subjectId)");
  assertIncludes(subjectLearningSource, "hasScopedPackageAccess('banks', pathId, subjectId)");
  assertIncludes(subjectLearningSource, "hasScopedPackageAccess('library', pathId, subjectId)");
  assertIncludes(subjectLearningSource, "isQuizLockedForStudent(quiz, 'tests', 'tests')");
  assertIncludes(subjectLearningSource, "params.set('tab', 'packages')");
  assertIncludes(subjectLearningSource, "isTopicLockedForStudent(mainTopic)");
  assertIncludes(subjectLearningSource, "isLibraryItemLockedForStudent(item)");
});

check('foundation admin treats topic lock as package access instead of readiness cleanup', () => {
  assertIncludes(foundationManagerSource, 'ضمن باقة التأسيس');
  assertIncludes(foundationManagerSource, 'مفتوح مجاني');
  assertIncludes(foundationManagerSource, 'جعل هذا الموضوع ضمن باقة التأسيس بدل الفتح المجاني');
  assertIncludes(foundationManagerSource, "updateTopic(topic.id, { isLocked: topic.isLocked !== true })");
  if (/handlePrepareTopicForLearner[\s\S]*isLocked:\s*false/.test(foundationManagerSource)) {
    throw new Error('Prepare-for-learner must not silently remove paid/package topic access');
  }
});

check('server paid quiz submission respects training and test package scopes separately', () => {
  assertIncludes(quizRoutesSource, 'const getPaidQuizPackageContentTypes = (quiz: any, source?: string) =>');
  assertIncludes(quizRoutesSource, 'const getPackageContentTypeForQuizSource = (source?: string) =>');
  assertIncludes(quizRoutesSource, 'const getQuizPlacementAccessType = (quiz: any, source?: string) =>');
  assertIncludes(quizRoutesSource, 'visibleSlots.has("training")');
  assertIncludes(quizRoutesSource, 'visibleSlots.has("tests")');
  assertIncludes(quizRoutesSource, 'if (hasTrainingSlot) contentTypes.push("banks")');
  assertIncludes(quizRoutesSource, 'if (hasTestSlot) contentTypes.push("tests")');
  assertIncludes(quizRoutesSource, 'const packageContentTypes = getPaidQuizPackageContentTypes(quiz, source)');
  assertIncludes(quizRoutesSource, 'for (const contentType of packageContentTypes)');
  assertIncludes(quizRoutesSource, 'hasPurchasedPackageAccess(purchasedPackageIds, contentType, pathId, subjectId)');
  assertIncludes(quizRoutesSource, 'if (!(await canSubmitQuiz(quiz, authUser, payload.source)))');
  assertIncludes(quizPageSource, 'source: result.source');
});

for (const item of checks) {
  console.log(`${item.status} ${item.name}${item.details ? ` - ${item.details}` : ''}`);
}

const failed = checks.filter((item) => item.status === 'FAIL');
if (failed.length > 0) {
  console.error(`\n${failed.length} quiz access contract smoke check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} quiz access contract smoke checks passed.`);
