import { readFile } from 'node:fs/promises';

const reportsSource = await readFile(new URL('../pages/Reports.tsx', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../pages/Dashboard.tsx', import.meta.url), 'utf8');
const quizRoutesSource = await readFile(new URL('../server/src/routes/quiz.routes.ts', import.meta.url), 'utf8');
const apiSource = await readFile(new URL('../services/api.ts', import.meta.url), 'utf8');

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

check('reports load scoped analytics and scoped quiz results for non-student roles', () => {
  assertIncludes(reportsSource, 'api.getQuizAnalyticsOverview()');
  assertIncludes(reportsSource, 'api.getScopedQuizResults()');
  assertIncludes(apiSource, 'getQuizAnalyticsOverview');
  assertIncludes(apiSource, 'getScopedQuizResults');
  assertIncludes(quizRoutesSource, '"/analytics/overview"');
  assertIncludes(quizRoutesSource, '"/results/scoped"');
});

check('student report starts simple and keeps details opt-in', () => {
  assertIncludes(reportsSource, "const [studentReportDepth, setStudentReportDepth] = useState<'simple' | 'full'>('simple')");
  assertIncludes(reportsSource, "const isStudentReportFull = studentReportDepth === 'full'");
  assertIncludes(reportsSource, "onClick={() => setStudentReportDepth('full')}");
  assertIncludes(reportsSource, "{!isStudentReportFull ? (");
  assertIncludes(reportsSource, "isStudentReportFull ? (");
});

check('student report links weak skills to lesson, quiz, plan, and exports', () => {
  assertIncludes(reportsSource, 'getSkillRecommendation(selectedReportSkill');
  assertIncludes(reportsSource, 'lessonLink');
  assertIncludes(reportsSource, 'quizLink');
  assertIncludes(reportsSource, 'downloadStudentSkillsWorkbook');
  assertIncludes(reportsSource, 'downloadStudentAttemptsWorkbook');
  assertIncludes(reportsSource, 'to="/plan"');
});

check('student therapeutic report keeps a short weekly loop with direct actions', () => {
  assertIncludes(reportsSource, 'const studentWeeklyPlan = useMemo');
  assertIncludes(reportsSource, 'const studentTodayFocus = studentWeeklyPlan[0] || null');
  assertIncludes(reportsSource, 'const studentQuickActions = useMemo');
  assertIncludes(reportsSource, 'راجع الشرح');
  assertIncludes(reportsSource, 'حل تدريب قصير');
  assertIncludes(reportsSource, 'أعد القياس');
  assertIncludes(reportsSource, 'studentFollowUpSummary');
  assertIncludes(reportsSource, 'copyStudentSummary');
  assertIncludes(reportsSource, 'shareStudentSummary');
});

check('student smart remediation uses AI with a local fallback plan', () => {
  assertIncludes(reportsSource, 'const buildSmartRemediation = async () =>');
  assertIncludes(reportsSource, 'api.aiRemediationPlan');
  assertIncludes(reportsSource, 'skills: focusedReportSkills.slice(0, 5)');
  assertIncludes(reportsSource, 'setSmartRemediation({');
  assertIncludes(reportsSource, 'خطة علاجية قصيرة');
  assertIncludes(reportsSource, 'parentNote');
});

check('parent report stays brief with copied/shared/PDF summary and practical actions', () => {
  assertIncludes(reportsSource, 'if (user.role === Role.PARENT)');
  assertIncludes(reportsSource, 'parentBriefSummary');
  assertIncludes(reportsSource, 'parentActionItems');
  assertIncludes(reportsSource, 'parentSkillActions');
  assertIncludes(reportsSource, "printElementAsPdf('reports-print-area',");
  assertIncludes(reportsSource, 'copyScopedSummary');
  assertIncludes(reportsSource, 'shareScopedSummary');
});

check('parent report links the weakest skill to lesson, training, and measurement', () => {
  assertIncludes(reportsSource, 'const parentWeakSkillRecommendation = getSkillRecommendation');
  assertIncludes(reportsSource, 'فتح الشرح');
  assertIncludes(reportsSource, 'بدء تدريب');
  assertIncludes(reportsSource, 'حصة علاجية');
  assertIncludes(reportsSource, 'الخطوة العملية: شرح قصير، تدريب بسيط، ثم إعادة قياس هادئة.');
});

check('admin, supervisor, and teacher reports expose separate skills and students reports with export', () => {
  assertIncludes(reportsSource, '!isStudentView && (');
  assertIncludes(reportsSource, 'scopedSkillReportCards');
  assertIncludes(reportsSource, 'scopedStudentFocusCards');
  assertIncludes(reportsSource, 'minSkillEvidence?: number');
  assertIncludes(reportsSource, 'earlyWeakSkillSignalCount?: number');
  assertIncludes(reportsSource, 'يتم عرض المهارات الضعيفة المؤكدة فقط بعد');
  assertIncludes(reportsSource, 'downloadScopedSkillsWorkbook');
  assertIncludes(reportsSource, 'downloadScopedStudentsWorkbook');
  assertIncludes(reportsSource, 'scopedInterventionPlan');
  assertIncludes(reportsSource, 'followUpLink: buildDirectedQuizManagerLink');
  assertIncludes(reportsSource, 'targetUserId: student.id');
  assertIncludes(reportsSource, 'targetGroupId: student.groupIds?.[0]');
  assertIncludes(reportsSource, 'student.groupNames?.length');
  assertIncludes(reportsSource, 'to={student.followUpLink}');
  assertIncludes(reportsSource, 'subjectId: subject.subjectId');
  assertIncludes(reportsSource, 'targetGroupId: scopedLeadStudent?.groupIds?.[0]');
  assertIncludes(reportsSource, 'const attemptFollowUpLink = buildDirectedQuizManagerLink');
  assertIncludes(reportsSource, 'targetUserId: result.userId || attemptStudent?.id');
  assertIncludes(reportsSource, 'اختبار متابعة');
  assertIncludes(reportsSource, 'const targetUserCount = quiz.targetUserIds?.length || 0');
  assertIncludes(reportsSource, 'const targetGroupCount = quiz.targetGroupIds?.length || 0');
  assertIncludes(reportsSource, 'موجه إلى: {targetLabel}');
});

check('staff scoped reports keep intervention plan, summary, and smart remediation', () => {
  assertIncludes(reportsSource, 'const scopedInterventionPlan = useMemo');
  assertIncludes(reportsSource, 'ابدأ بالمهارة الأكثر احتياجًا');
  assertIncludes(reportsSource, 'تابع الطالب الأكثر احتياجًا');
  assertIncludes(reportsSource, 'حوّلها لخطة متابعة');
  assertIncludes(reportsSource, 'const scopedFollowUpSummary = useMemo');
  assertIncludes(reportsSource, 'const buildScopedSmartRemediation = async () =>');
  assertIncludes(reportsSource, 'const skillPayload = scopedAnalytics.weakestSkills.slice(0, 5)');
  assertIncludes(reportsSource, 'خطة تدخل للنطاق الحالي');
});

check('server analytics scopes reports by role before returning weak skills and students', () => {
  assertIncludes(quizRoutesSource, 'authUser.role === "admin"');
  assertIncludes(quizRoutesSource, 'authUser.role === "teacher" || authUser.role === "supervisor"');
  assertIncludes(quizRoutesSource, 'authUser.role === "parent"');
  assertIncludes(quizRoutesSource, 'linkedStudentIds');
  assertIncludes(quizRoutesSource, 'matchesManagedScope');
  assertIncludes(quizRoutesSource, 'const MIN_ANALYTICS_SKILL_EVIDENCE_COUNT = 3;');
  assertIncludes(quizRoutesSource, '.filter((item) => item.attempts >= MIN_ANALYTICS_SKILL_EVIDENCE_COUNT)');
  assertIncludes(quizRoutesSource, 'earlyWeakSkillSignalCount');
  assertIncludes(quizRoutesSource, 'minSkillEvidence: MIN_ANALYTICS_SKILL_EVIDENCE_COUNT');
  assertPattern(quizRoutesSource, /weakestStudents[\s\S]*weakestSkills[\s\S]*subjectSummaries/, 'analytics response should include students, skills, and subjects');
});

check('dashboard keeps parent report tabs separate from student report tabs', () => {
  assertIncludes(dashboardSource, "const isParentDashboard = user.role === Role.PARENT");
  assertIncludes(dashboardSource, "parent-results");
  assertIncludes(dashboardSource, "parent-skills");
  assertIncludes(dashboardSource, "case 'reports': return <Suspense fallback={<TabLoading />}><Reports /></Suspense>;");
});

for (const item of checks) {
  console.log(`${item.status} ${item.name}${item.details ? ` - ${item.details}` : ''}`);
}

const failed = checks.filter((item) => item.status === 'FAIL');
if (failed.length > 0) {
  console.error(`\n${failed.length} reports role contract smoke check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} reports role contract smoke checks passed.`);
