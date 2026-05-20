import React, { useEffect, useMemo, useState } from 'react';
import {
    Activity,
    Bell,
    BookOpen,
    Building2,
    CreditCard,
    FileQuestion,
    FolderOpen,
    LayoutDashboard,
    Settings,
    Target,
    User,
    Users,
    Award,
    AlertTriangle,
    CheckCircle2,
    EyeOff,
    Video,
    Bot,
    Megaphone,
    Type,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useStore } from '../../store/useStore';
import { Role } from '../../types';
import { api } from '../../services/api';

const lazyNamed = <TProps extends object>(
    loader: () => Promise<Record<string, React.ComponentType<TProps>>>,
    exportName: string,
) =>
    React.lazy(async () => {
        const module = await loader();
        return { default: module[exportName] };
    });

const UsersManager = lazyNamed(() => import('./UsersManager'), 'UsersManager');
const SchoolsManager = lazyNamed(() => import('./SchoolsManager'), 'SchoolsManager');
const SchoolPortalManager = lazyNamed(() => import('./SchoolPortalManager'), 'SchoolPortalManager');
const PathsManager = lazyNamed(() => import('./PathsManager'), 'PathsManager');
const QuestionBankManager = lazyNamed(() => import('./QuestionBankManager'), 'QuestionBankManager');
const LessonsManager = lazyNamed(() => import('./LessonsManager'), 'LessonsManager');
const LibraryManager = lazyNamed<{ subjectId: string }>(() => import('./LibraryManager'), 'LibraryManager');
const QuizzesManager = lazyNamed(() => import('./QuizzesManager'), 'QuizzesManager');
const SkillsTreeManager = lazyNamed(() => import('./SkillsTreeManager'), 'SkillsTreeManager');
const FinancialManager = lazyNamed(() => import('./FinancialManager'), 'FinancialManager');
const HomepageManager = lazyNamed(() => import('./HomepageManager'), 'HomepageManager');
const PlatformFontsManager = lazyNamed(() => import('./PlatformFontsManager'), 'PlatformFontsManager');
const PlatformIntegrationsManager = lazyNamed(() => import('./PlatformIntegrationsManager'), 'PlatformIntegrationsManager');
const LiveSessionsManager = lazyNamed(() => import('./LiveSessionsManager'), 'LiveSessionsManager');
const BackupManager = lazyNamed(() => import('./BackupManager'), 'BackupManager');
const OperationsCommandCenter = lazyNamed(() => import('./OperationsCommandCenter'), 'OperationsCommandCenter');
const AiAssistantManager = lazyNamed(() => import('./AiAssistantManager'), 'AiAssistantManager');
const MockExamManager = lazyNamed(() => import('./MockExamManager'), 'MockExamManager');
const AnnouncementAdsManager = lazyNamed(() => import('./AnnouncementAdsManager'), 'AnnouncementAdsManager');

type ReviewQueueItem = {
    id: string;
    itemId: string;
    contentType: 'course' | 'lesson' | 'question' | 'quiz' | 'library';
    type: string;
    title: string;
    ownerType: string;
};

type TeacherContributionItem = {
    id: string;
    name: string;
    managedPaths: number;
    managedSubjects: number;
    totalItems: number;
    pendingItems: number;
    approvedItems: number;
    publishedItems: number;
};

type AiStatus = {
    provider: 'gemini' | 'ollama' | 'lmstudio' | 'none';
    ollamaConfigured: boolean;
    lmStudioConfigured?: boolean;
    geminiConfigured: boolean;
    model: string;
    timeoutMs: number;
};

type OperationalStatus = {
    checkedAt: string;
    database: { status: string; name: string };
    counts: Record<string, number>;
    visible: Record<string, number>;
    learningReadiness: {
        score: number;
        usableSpaces: number;
        emptySpaces: number;
        spaces: Array<{
            pathId: string;
            subjectId: string;
            subjectName: string;
            total: number;
            topics: number;
            lessons: number;
            quizzes: number;
            courses: number;
            library: number;
        }>;
    };
    issues: {
        missingTopicSubjects: number;
        missingLessonRefs: number;
        missingQuizRefs: number;
        unplayableLinkedLessons: number;
    };
    deployment: {
        api: string;
        database: string;
        frontend: string;
        nodeEnv: string;
        clientUrl: string;
    };
};

const AdminTabLoading = () => (
    <div className="rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-2xl bg-indigo-50" />
        <div className="text-sm font-black text-gray-700">جاري تجهيز القسم...</div>
        <div className="mt-2 text-xs text-gray-400">يتم تحميل أدوات الإدارة المطلوبة فقط.</div>
    </div>
);

const getRequestedAdminTab = () => {
    const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    const requestedTab = new URLSearchParams(hashQuery || window.location.search).get('tab');
    if (requestedTab === 'courses') {
        return 'paths';
    }
    return requestedTab;
};

export const AdminDashboard: React.FC = () => {
    const {
        user,
        users,
        groups,
        courses,
        quizzes,
        questions,
        lessons,
        libraryItems,
        b2bPackages,
        accessCodes,
        subjects,
        paths,
        examResults,
        updateCourse,
        updateLesson,
        updateQuestion,
        updateQuiz,
        updateLibraryItem,
    } = useStore();
    const [activeTab, setActiveTab] = useState(() => getRequestedAdminTab() || (user.role === Role.ADMIN ? 'paths' : 'overview'));
    const [tabRequestVersion, setTabRequestVersion] = useState(0);
    const [selectedLibrarySubjectId, setSelectedLibrarySubjectId] = useState('');
    const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
    const [aiStatusLoading, setAiStatusLoading] = useState(false);
    const [aiStatusError, setAiStatusError] = useState<string | null>(null);
    const [operationalStatus, setOperationalStatus] = useState<OperationalStatus | null>(null);
    const [operationalStatusError, setOperationalStatusError] = useState<string | null>(null);

    useEffect(() => {
        const syncRequestedTab = () => {
            const requestedTab = getRequestedAdminTab();
            if (requestedTab) {
                if (requestedTab !== activeTab) {
                    setActiveTab(requestedTab);
                }
                setTabRequestVersion((current) => current + 1);
            }
        };

        window.addEventListener('hashchange', syncRequestedTab);
        syncRequestedTab();
        return () => window.removeEventListener('hashchange', syncRequestedTab);
    }, [activeTab]);

    const loadAiStatus = async () => {
        if (user.role !== Role.ADMIN) {
            return;
        }

        setAiStatusLoading(true);
        setAiStatusError(null);
        setOperationalStatusError(null);

        try {
            const [aiResponse, operationsResponse] = await Promise.all([
                api.aiStatus(),
                api.getOperationalStatus(),
            ]);
            setAiStatus(aiResponse as AiStatus);
            setOperationalStatus(operationsResponse as OperationalStatus);
        } catch (error) {
            console.error('Failed to load AI status', error);
            setAiStatusError('تعذر قراءة حالة الذكاء الاصطناعي الآن. تأكد من تشغيل الخادم ثم أعد المحاولة.');
            setOperationalStatusError('تعذر قراءة حالة التشغيل من الخادم الآن.');
        } finally {
            setAiStatusLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab !== 'settings' || user.role !== Role.ADMIN) {
            return;
        }

        const requestIdle = window.requestIdleCallback?.bind(window);
        if (requestIdle) {
            const handle = requestIdle(() => {
                void loadAiStatus();
            }, { timeout: 1800 });
            return () => window.cancelIdleCallback?.(handle);
        }

        const timer = window.setTimeout(() => {
            void loadAiStatus();
        }, 600);
        return () => window.clearTimeout(timer);
    }, [activeTab, user.role]);

    const librarySubjectOptions = useMemo(
        () =>
            subjects
                .map((subject) => ({
                    subject,
                    path: paths.find((path) => path.id === subject.pathId),
                    fileCount: libraryItems.filter((item) => item.subjectId === subject.id).length,
                    readyCount: libraryItems.filter(
                        (item) =>
                            item.subjectId === subject.id &&
                            item.showOnPlatform !== false &&
                            item.approvalStatus === 'approved' &&
                            Boolean(item.url?.trim()) &&
                            Boolean(item.sectionId) &&
                            Boolean((item.skillIds || []).length),
                    ).length,
                }))
                .sort((a, b) => {
                    const pathCompare = (a.path?.name || '').localeCompare(b.path?.name || '', 'ar');
                    if (pathCompare !== 0) return pathCompare;
                    return a.subject.name.localeCompare(b.subject.name, 'ar');
                }),
        [libraryItems, paths, subjects],
    );

    useEffect(() => {
        if (selectedLibrarySubjectId && librarySubjectOptions.some((item) => item.subject.id === selectedLibrarySubjectId)) {
            return;
        }

        setSelectedLibrarySubjectId(librarySubjectOptions[0]?.subject.id || '');
    }, [librarySubjectOptions, selectedLibrarySubjectId]);

    const overviewStats = useMemo(() => {
        const pendingCourses = courses.filter((item) => item.approvalStatus === 'pending_review').length;
        const pendingLessons = lessons.filter((item) => item.approvalStatus === 'pending_review').length;
        const pendingQuestions = questions.filter((item) => item.approvalStatus === 'pending_review').length;
        const pendingQuizzes = quizzes.filter((item) => item.approvalStatus === 'pending_review').length;
        const pendingLibrary = libraryItems.filter((item) => item.approvalStatus === 'pending_review').length;
        const totalStudents = users.filter((user) => user.role === Role.STUDENT).length;
        const totalTeachers = users.filter((user) => user.role === Role.TEACHER).length;
        const totalSchools = groups.filter((group) => group.type === 'SCHOOL').length;

        return {
            totalStudents,
            totalTeachers,
            totalSchools,
            totalResults: examResults.length,
            pendingReview: pendingCourses + pendingLessons + pendingQuestions + pendingQuizzes + pendingLibrary,
            pendingBreakdown: {
                courses: pendingCourses,
                lessons: pendingLessons,
                questions: pendingQuestions,
                quizzes: pendingQuizzes,
                library: pendingLibrary,
            },
        };
    }, [courses, examResults.length, groups, lessons, libraryItems, questions, quizzes, users]);

    const platformReadiness = useMemo(() => {
        const getSkillIds = (item: {
            skillIds?: string[];
            skillId?: string;
            mainSkillId?: string;
            subSkillId?: string;
        }) =>
            [
                ...(item.skillIds || []),
                item.skillId,
                item.mainSkillId,
                item.subSkillId,
            ].filter(Boolean);

        const questionsById = new Map(questions.map((question) => [question.id, question]));
        const hiddenCourses = courses.filter((item) => item.showOnPlatform === false || item.isPublished === false).length;
        const hiddenLessons = lessons.filter((item) => item.showOnPlatform === false).length;
        const hiddenQuizzes = quizzes.filter((item) => item.showOnPlatform === false || item.isPublished === false).length;
        const hiddenLibrary = libraryItems.filter((item) => item.showOnPlatform === false).length;
        const quizzesWithoutQuestions = quizzes.filter((quiz) => (quiz.questionIds || []).length === 0).length;
        const quizzesWithoutSkills = quizzes.filter((quiz) => {
            const quizSkillIds = getSkillIds(quiz);
            const questionSkillIds = (quiz.questionIds || []).flatMap((questionId) => getSkillIds(questionsById.get(questionId) || {}));
            return [...quizSkillIds, ...questionSkillIds].length === 0;
        }).length;
        const lessonsWithoutSkills = lessons.filter((lesson) => getSkillIds(lesson).length === 0).length;
        const libraryWithoutSkills = libraryItems.filter((item) => getSkillIds(item).length === 0).length;
        const questionsWithoutSkills = questions.filter((question) => getSkillIds(question).length === 0).length;
        const hiddenContent = hiddenCourses + hiddenLessons + hiddenQuizzes + hiddenLibrary;
        const unlinkedContent = quizzesWithoutSkills + lessonsWithoutSkills + libraryWithoutSkills + questionsWithoutSkills;
        const totalManagedContent = courses.length + lessons.length + quizzes.length + libraryItems.length + questions.length;
        const issueCount =
            overviewStats.pendingReview +
            hiddenContent +
            quizzesWithoutQuestions +
            unlinkedContent;
        const readinessScore = totalManagedContent
            ? Math.max(0, Math.min(100, Math.round(((totalManagedContent - issueCount) / totalManagedContent) * 100)))
            : 100;

        const nextActions = [
            overviewStats.pendingReview > 0
                ? `راجع ${overviewStats.pendingReview.toLocaleString('ar-EG')} عنصرًا بانتظار الاعتماد قبل ظهوره للطلاب.`
                : '',
            hiddenContent > 0
                ? `افحص ${hiddenContent.toLocaleString('ar-EG')} عنصرًا مخفيًا أو غير منشور قبل الإطلاق.`
                : '',
            quizzesWithoutQuestions > 0
                ? `أضف أسئلة إلى ${quizzesWithoutQuestions.toLocaleString('ar-EG')} اختبارًا حتى لا يظهر فارغًا.`
                : '',
            unlinkedContent > 0
                ? `اربط ${unlinkedContent.toLocaleString('ar-EG')} عنصرًا بالمهارات حتى تعمل التقارير والتوصيات بدقة.`
                : '',
        ].filter(Boolean);

        return {
            hiddenContent,
            unlinkedContent,
            quizzesWithoutQuestions,
            readinessScore,
            nextActions,
            details: {
                questionsWithoutSkills,
                lessonsWithoutSkills,
                quizzesWithoutSkills,
                libraryWithoutSkills,
            },
        };
    }, [courses, lessons, libraryItems, overviewStats.pendingReview, questions, quizzes]);

    const dailyOperationQueue = useMemo(() => {
        const items = [
            {
                id: 'pending-review',
                title: 'مراجعة واعتماد المحتوى',
                description: 'يوجد محتوى أضافه الفريق وينتظر قرار الاعتماد قبل ظهوره للطلاب.',
                count: overviewStats.pendingReview,
                tab: 'overview',
                actionLabel: 'راجع طابور الاعتماد',
                color: 'amber',
            },
            {
                id: 'empty-quizzes',
                title: 'اختبارات بلا أسئلة',
                description: 'أي اختبار بلا أسئلة قد يظهر للطالب فارغًا أو يربك رحلة الاختبار.',
                count: platformReadiness.quizzesWithoutQuestions,
                tab: 'quizzes',
                actionLabel: 'فتح مركز الاختبارات',
                color: 'rose',
            },
            {
                id: 'question-skills',
                title: 'أسئلة غير مربوطة بمهارات',
                description: 'ربط الأسئلة بالمهارات يجعل التقارير والتوصيات الذكية أدق.',
                count: platformReadiness.details.questionsWithoutSkills,
                tab: 'questions',
                actionLabel: 'فتح بنك الأسئلة',
                color: 'indigo',
            },
            {
                id: 'lesson-skills',
                title: 'دروس غير مربوطة بمهارات',
                description: 'ربط الدروس بالمهارات يساعد الطالب ينتقل من نتيجة الاختبار إلى العلاج المناسب.',
                count: platformReadiness.details.lessonsWithoutSkills,
                tab: 'lessons',
                actionLabel: 'فتح مركز الدروس',
                color: 'emerald',
            },
            {
                id: 'hidden-content',
                title: 'محتوى مخفي عن الطلاب',
                description: 'راجع العناصر المخفية حتى تتأكد أنها مقصودة وليست سببًا في اختفاء مادة أو مسار.',
                count: platformReadiness.hiddenContent,
                tab: 'paths',
                actionLabel: 'فتح مساحات التعلم',
                color: 'slate',
            },
            {
                id: 'library-skills',
                title: 'ملفات مكتبة بلا مهارات',
                description: 'ربط ملفات المراجعة بالمهارات يجعلها تظهر كتوصيات علاجية بعد الاختبار.',
                count: platformReadiness.details.libraryWithoutSkills,
                tab: 'library',
                actionLabel: 'فتح مركز المكتبة',
                color: 'purple',
            },
        ];

        return items
            .filter((item) => item.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
    }, [
        overviewStats.pendingReview,
        platformReadiness.details.lessonsWithoutSkills,
        platformReadiness.details.libraryWithoutSkills,
        platformReadiness.details.questionsWithoutSkills,
        platformReadiness.hiddenContent,
        platformReadiness.quizzesWithoutQuestions,
    ]);

    const schoolCommandCenter = useMemo(() => {
        const schools = groups.filter((group) => group.type === 'SCHOOL');
        const classes = groups.filter((group) => group.type === 'CLASS');
        const students = users.filter((item) => item.role === Role.STUDENT);
        const parents = users.filter((item) => item.role === Role.PARENT);
        const supervisors = users.filter((item) => item.role === Role.SUPERVISOR || item.role === Role.TEACHER);
        const activeCodes = accessCodes.filter((code) => Number(code.expiresAt || 0) > Date.now());

        const schoolRows = schools.map((school) => {
            const schoolClasses = classes.filter((group) => group.parentId === school.id);
            const classIds = new Set(schoolClasses.map((group) => group.id));
            const schoolStudents = students.filter((student) => student.schoolId === school.id || (student.groupIds || []).some((groupId) => classIds.has(groupId)));
            const studentIds = new Set(schoolStudents.map((student) => student.id));
            const schoolResults = examResults.filter((result) => result.userId && studentIds.has(result.userId));
            const average = schoolResults.length
                ? Math.round(schoolResults.reduce((sum, result) => sum + Number(result.score || 0), 0) / schoolResults.length)
                : 0;
            const studentsWithoutClass = schoolStudents.filter((student) => !(student.groupIds || []).some((groupId) => classIds.has(groupId))).length;
            const studentsWithoutParent = schoolStudents.filter((student) => !parents.some((parent) => (parent.linkedStudentIds || []).includes(student.id))).length;
            const schoolPackages = b2bPackages.filter((pkg) => pkg.schoolId === school.id && pkg.status === 'active').length;
            const schoolCodes = activeCodes.filter((code) => code.schoolId === school.id).length;
            const schoolSupervisors = supervisors.filter((staff) =>
                staff.schoolId === school.id ||
                (staff.groupIds || []).includes(school.id) ||
                (staff.groupIds || []).some((groupId) => classIds.has(groupId)) ||
                (school.supervisorIds || []).includes(staff.id),
            ).length;
            const issueCount = [
                schoolClasses.length === 0,
                schoolSupervisors === 0,
                schoolStudents.length === 0,
                schoolPackages === 0,
                schoolCodes === 0,
                studentsWithoutClass > 0,
                studentsWithoutParent > 0,
            ].filter(Boolean).length;

            return {
                id: school.id,
                name: school.name,
                classCount: schoolClasses.length,
                studentCount: schoolStudents.length,
                supervisorCount: schoolSupervisors,
                packageCount: schoolPackages,
                activeCodeCount: schoolCodes,
                studentsWithoutClass,
                studentsWithoutParent,
                quizAttempts: schoolResults.length,
                average,
                issueCount,
            };
        });

        const needsSetup = schoolRows
            .filter((school) => school.issueCount > 0)
            .sort((a, b) => b.issueCount - a.issueCount || a.average - b.average)
            .slice(0, 5);
        const performanceWatch = schoolRows
            .filter((school) => school.quizAttempts > 0)
            .sort((a, b) => a.average - b.average)
            .slice(0, 5);

        return {
            schoolCount: schools.length,
            classCount: classes.length,
            schoolStudentCount: students.filter((student) => Boolean(student.schoolId)).length,
            studentsWithoutClass: schoolRows.reduce((sum, school) => sum + school.studentsWithoutClass, 0),
            studentsWithoutParent: schoolRows.reduce((sum, school) => sum + school.studentsWithoutParent, 0),
            activeSchoolPackages: b2bPackages.filter((pkg) => pkg.status === 'active').length,
            activeCodes: activeCodes.length,
            needsSetup,
            performanceWatch,
        };
    }, [accessCodes, b2bPackages, examResults, groups, users]);

    const reviewQueue = useMemo<ReviewQueueItem[]>(() => {
        const normalizeItem = (
            type: string,
            contentType: ReviewQueueItem['contentType'],
            item: { id: string; title?: string; question?: string; text?: string; name?: string; ownerType?: string; approvalStatus?: string },
        ): ReviewQueueItem => ({
            id: `${type}-${item.id}`,
            itemId: item.id,
            contentType,
            type,
            title: item.title || item.name || item.question || item.text || 'عنصر بدون عنوان',
            ownerType: item.ownerType || 'platform',
        });

        return [
            ...courses.filter((item) => item.approvalStatus === 'pending_review').map((item) => normalizeItem('دورة', 'course', item)),
            ...lessons.filter((item) => item.approvalStatus === 'pending_review').map((item) => normalizeItem('درس', 'lesson', item)),
            ...questions.filter((item) => item.approvalStatus === 'pending_review').map((item) => normalizeItem('سؤال', 'question', item)),
            ...quizzes.filter((item) => item.approvalStatus === 'pending_review').map((item) => normalizeItem('اختبار', 'quiz', item)),
            ...libraryItems.filter((item) => item.approvalStatus === 'pending_review').map((item) => normalizeItem('ملف', 'library', item)),
        ].slice(0, 8);
    }, [courses, lessons, libraryItems, questions, quizzes]);

    const reviewContentItem = (item: ReviewQueueItem, decision: 'approved' | 'rejected') => {
        if (user.role !== Role.ADMIN) return;

        const isApproved = decision === 'approved';
        const basePayload = {
            approvalStatus: decision,
            approvedBy: isApproved ? user.id : undefined,
            approvedAt: isApproved ? Date.now() : undefined,
            reviewerNotes: isApproved ? 'تم الاعتماد السريع من لوحة الإدارة.' : 'تم الرفض السريع من لوحة الإدارة.',
        };

        if (item.contentType === 'course') {
            updateCourse(item.itemId, {
                ...basePayload,
                isPublished: isApproved,
                showOnPlatform: isApproved,
            });
            return;
        }

        if (item.contentType === 'lesson') {
            updateLesson(item.itemId, {
                ...basePayload,
                showOnPlatform: isApproved,
            });
            return;
        }

        if (item.contentType === 'question') {
            updateQuestion(item.itemId, basePayload);
            return;
        }

        if (item.contentType === 'quiz') {
            updateQuiz(item.itemId, {
                ...basePayload,
                isPublished: isApproved,
                showOnPlatform: isApproved,
            });
            return;
        }

        updateLibraryItem(item.itemId, {
            ...basePayload,
            showOnPlatform: isApproved,
        });
    };

    const teacherContributionStats = useMemo<TeacherContributionItem[]>(() => {
        const teachers = users.filter((item) => item.role === Role.TEACHER);

        const countTeacherItems = (teacherId: string) => {
            const matchesTeacher = (item: {
                ownerId?: string;
                createdBy?: string;
                assignedTeacherId?: string;
                approvalStatus?: string;
                isPublished?: boolean;
            }) =>
                item.ownerId === teacherId || item.createdBy === teacherId || item.assignedTeacherId === teacherId;

            const teacherItems = [
                ...courses.filter(matchesTeacher),
                ...lessons.filter(matchesTeacher),
                ...questions.filter(matchesTeacher),
                ...quizzes.filter(matchesTeacher),
                ...libraryItems.filter(matchesTeacher),
            ];

            return {
                totalItems: teacherItems.length,
                pendingItems: teacherItems.filter((item) => item.approvalStatus === 'pending_review').length,
                approvedItems: teacherItems.filter((item) => item.approvalStatus === 'approved').length,
                publishedItems: teacherItems.filter((item) => 'isPublished' in item && !!item.isPublished).length,
            };
        };

        return teachers
            .map((teacher) => {
                const counts = countTeacherItems(teacher.id);
                return {
                    id: teacher.id,
                    name: teacher.name,
                    managedPaths: teacher.managedPathIds?.length || 0,
                    managedSubjects: teacher.managedSubjectIds?.length || 0,
                    ...counts,
                };
            })
            .filter((teacher) => teacher.totalItems > 0 || teacher.managedPaths > 0 || teacher.managedSubjects > 0)
            .sort((a, b) => b.pendingItems - a.pendingItems || b.totalItems - a.totalItems)
            .slice(0, 8);
    }, [courses, lessons, libraryItems, questions, quizzes, users]);

    const currentTeacherContribution = useMemo(
        () => teacherContributionStats.find((item) => item.id === user.id) || null,
        [teacherContributionStats, user.id],
    );

    const aiProviderMeta = useMemo(() => {
        const provider = aiStatus?.provider || 'none';

        if (provider === 'ollama') {
            return {
                label: 'Ollama / Gemma محلي',
                badge: 'بدون تكلفة لكل طلب',
                color: 'emerald',
                description: 'المنصة تستخدم نموذجًا محليًا مفتوح المصدر عند توفر Ollama، وهذا هو الاختيار الأفضل لتقليل التكلفة مستقبلاً.',
            };
        }

        if (provider === 'gemini') {
            return {
                label: 'Gemini API',
                badge: 'مزود خارجي',
                color: 'blue',
                description: 'المنصة تستخدم مفتاح Gemini الخارجي لتوليد التحليلات والمقترحات الذكية عبر الخادم وليس من المتصفح.',
            };
        }

        if (provider === 'lmstudio') {
            return {
                label: 'LM Studio محلي',
                badge: 'نموذج محلي OpenAI-compatible',
                color: 'emerald',
                description: 'المنصة تستخدم خادم LM Studio المحلي عبر بوابة الخادم، وهذا يسمح بتشغيل نماذج مفتوحة المصدر بدون كشف مفاتيح في المتصفح.',
            };
        }

        return {
            label: 'Fallback آمن',
            badge: 'تشغيل احتياطي',
            color: 'slate',
            description: 'لا يوجد مزود ذكاء مفعّل حاليًا، لذلك تستخدم المنصة ردودًا آمنة داخلية حتى لا تتوقف تجربة الطالب.',
        };
    }, [aiStatus?.provider]);

    const supervisorScopeSummary = useMemo(() => {
        const directGroupIds = new Set(user.groupIds || []);
        const directGroups = groups.filter((group) => directGroupIds.has(group.id));
        const scopedSchoolIds = new Set<string>();
        if (user.schoolId) scopedSchoolIds.add(user.schoolId);
        directGroups.forEach((group) => {
            if (group.type === 'SCHOOL') scopedSchoolIds.add(group.id);
            if (group.parentId) scopedSchoolIds.add(group.parentId);
        });

        const scopedGroupIds = new Set<string>(directGroupIds);
        groups.forEach((group) => {
            if (group.parentId && scopedSchoolIds.has(group.parentId)) {
                scopedGroupIds.add(group.id);
            }
        });

        const scopedGroupList = groups.filter((group) => scopedGroupIds.has(group.id) || scopedSchoolIds.has(group.id));
        const scopedStudents = users.filter((item) => {
            if (item.role !== Role.STUDENT) {
                return false;
            }

            const sharesGroup = (item.groupIds || []).some((groupId) => scopedGroupIds.has(groupId));
            const sharesSchool = !!item.schoolId && scopedSchoolIds.has(item.schoolId);
            return sharesGroup || sharesSchool;
        });
        const scopedStudentIds = new Set(scopedStudents.map((student) => student.id));
        const scopedResults = examResults.filter((result) => result.userId && scopedStudentIds.has(result.userId));

        const assignedFollowUps = quizzes.filter((quiz) => {
            const targetsScopedGroup = (quiz.targetGroupIds || []).some((groupId) => scopedGroupIds.has(groupId));
            const targetsScopedStudent = (quiz.targetUserIds || []).some((studentId) =>
                scopedStudentIds.has(studentId),
            );
            return targetsScopedGroup || targetsScopedStudent;
        });

        const averageScore = scopedResults.length
            ? Math.round(scopedResults.reduce((total, result) => total + Number(result.score || 0), 0) / scopedResults.length)
            : 0;

        const weakSkillMap = new Map<string, { skill: string; total: number; count: number; students: Set<string> }>();
        scopedResults.forEach((result) => {
            (result.skillsAnalysis || []).forEach((skill) => {
                const skillName = String(skill.skill || '').trim();
                if (!skillName) return;
                const key = skill.skillId || skillName;
                const current = weakSkillMap.get(key) || { skill: skillName, total: 0, count: 0, students: new Set<string>() };
                current.total += Number(skill.mastery || 0);
                current.count += 1;
                if (result.userId) current.students.add(result.userId);
                weakSkillMap.set(key, current);
            });
        });

        const weakestSkills = Array.from(weakSkillMap.values())
            .map((skill) => ({
                skill: skill.skill,
                mastery: skill.count ? Math.round(skill.total / skill.count) : 0,
                attempts: skill.count,
                affectedStudents: skill.students.size,
            }))
            .filter((skill) => skill.mastery < 70)
            .sort((a, b) => a.mastery - b.mastery || b.affectedStudents - a.affectedStudents)
            .slice(0, 4);

        const studentsNeedingFollowUp = scopedStudents
            .map((student) => {
                const studentResults = scopedResults.filter((result) => result.userId === student.id);
                const studentAverage = studentResults.length
                    ? Math.round(studentResults.reduce((total, result) => total + Number(result.score || 0), 0) / studentResults.length)
                    : 0;
                const latestResult = [...studentResults].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
                const topWeakSkills = [...(latestResult?.skillsAnalysis || [])]
                    .filter((skill) => Number(skill.mastery || 0) < 70)
                    .sort((a, b) => Number(a.mastery || 0) - Number(b.mastery || 0))
                    .slice(0, 2)
                    .map((skill) => skill.skill)
                    .filter(Boolean);

                return {
                    id: student.id,
                    name: student.name,
                    average: studentAverage,
                    attempts: studentResults.length,
                    latestQuiz: latestResult?.quizTitle || 'لم يبدأ بعد',
                    weakSkills: topWeakSkills,
                };
            })
            .filter((student) => student.attempts === 0 || student.average < 70)
            .sort((a, b) => a.attempts - b.attempts || a.average - b.average)
            .slice(0, 5);

        const groupSnapshots = scopedGroupList
            .map((group) => {
                const groupStudentIds = new Set(group.studentIds || []);
                const groupResults = scopedResults.filter((result) => result.userId && groupStudentIds.has(result.userId));
                const groupAverage = groupResults.length
                    ? Math.round(groupResults.reduce((total, result) => total + Number(result.score || 0), 0) / groupResults.length)
                    : 0;

                return {
                    id: group.id,
                    name: group.name,
                    studentCount: group.studentIds?.length || 0,
                    average: groupAverage,
                    attempts: groupResults.length,
                };
            })
            .sort((a, b) => a.average - b.average || b.studentCount - a.studentCount)
            .slice(0, 4);

        return {
            schoolCount: scopedSchoolIds.size,
            groupCount: scopedGroupList.length,
            studentCount: scopedStudents.length,
            followUpCount: assignedFollowUps.length,
            resultCount: scopedResults.length,
            averageScore,
            weakStudentsCount: studentsNeedingFollowUp.length,
            weakestSkills,
            studentsNeedingFollowUp,
            groupSnapshots,
        };
    }, [examResults, groups, quizzes, user.groupIds, user.schoolId, users]);

    const supervisorActionCards = useMemo(() => [
        {
            title: 'الطلاب الذين يحتاجون متابعة',
            value: supervisorScopeSummary.weakStudentsCount,
            hint: 'ابدأ بمن لم يختبر أو متوسطه أقل من 70%.',
            actionLabel: 'فتح التقرير',
            action: () => { window.location.hash = '#/reports'; },
            tone: 'rose',
        },
        {
            title: 'اختبار موجه للنطاق',
            value: supervisorScopeSummary.followUpCount,
            hint: 'استخدمه لقياس فصل أو مدرسة أو طلاب محددين.',
            actionLabel: 'توجيه اختبار',
            action: () => setActiveTab('quizzes'),
            tone: 'emerald',
        },
        {
            title: 'تنظيم الطلاب والمجموعات',
            value: supervisorScopeSummary.groupCount,
            hint: 'راجع الفصول والطلاب المرتبطين بحسابك.',
            actionLabel: 'بوابة المدرسة',
            action: () => setActiveTab('school-portal'),
            tone: 'indigo',
        },
        {
            title: 'رسالة متابعة جاهزة',
            value: supervisorScopeSummary.studentCount,
            hint: 'جهز قائمة الطلاب من التقرير ثم أرسل تنبيهًا مناسبًا.',
            actionLabel: 'قائمة الطلاب',
            action: () => setActiveTab('school-portal'),
            tone: 'amber',
        },
    ], [supervisorScopeSummary.followUpCount, supervisorScopeSummary.groupCount, supervisorScopeSummary.studentCount, supervisorScopeSummary.weakStudentsCount]);

    const menuItems = useMemo(() => {
        const adminItems = [
            { id: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard size={20} /> },
            { id: 'paths', label: 'إدارة المسارات (مساحات العمل)', icon: <FolderOpen size={20} /> },
            { id: 'lessons', label: 'مركز الدروس', icon: <BookOpen size={20} /> },
            { id: 'library', label: 'مركز المكتبة وملفات الدعم', icon: <BookOpen size={20} /> },
            { id: 'quizzes', label: 'مركز الاختبارات', icon: <FileQuestion size={20} /> },
            { id: 'mock-exams', label: 'مركز الاختبارات المحاكية', icon: <Award size={20} /> },
            { id: 'questions', label: 'مركز الأسئلة', icon: <Target size={20} /> },
            { id: 'skills', label: 'مركز المهارات', icon: <Award size={20} /> },
            { id: 'users', label: 'إدارة المستخدمين', icon: <Users size={20} /> },
            { id: 'groups', label: 'المجموعات والمدارس', icon: <Building2 size={20} /> },
            { id: 'financial', label: 'المالية والاشتراكات', icon: <CreditCard size={20} /> },
            { id: 'notifications', label: 'الإشعارات', icon: <Bell size={20} /> },
            { id: 'monitoring', label: 'مراقبة النظام', icon: <Activity size={20} /> },
            { id: 'settings', label: 'الإعدادات', icon: <Settings size={20} /> },
        ];

        if (user.role === Role.TEACHER) {
            return adminItems.filter((item) => ['overview', 'lessons', 'library', 'quizzes', 'mock-exams', 'questions', 'skills'].includes(item.id));
        }

        if (user.role === Role.SUPERVISOR) {
            return adminItems.filter((item) => ['overview', 'quizzes', 'mock-exams', 'questions', 'skills'].includes(item.id));
        }

        return adminItems;
    }, [user.role]);

    const enhancedMenuItems = useMemo(() => {
        let nextItems = [...menuItems];
        const notificationsIndex = nextItems.findIndex((item) => item.id === 'notifications');
        const insertIndex = notificationsIndex === -1 ? nextItems.length : notificationsIndex;

        if (user.role === Role.ADMIN && !nextItems.some((item) => item.id === 'homepage')) {
            nextItems = [
                ...nextItems.slice(0, insertIndex),
                { id: 'homepage', label: 'إدارة الصفحة الرئيسية', icon: <BookOpen size={20} /> },
                ...nextItems.slice(insertIndex),
            ];
        }

        if (user.role === Role.ADMIN && !nextItems.some((item) => item.id === 'announcement-ads')) {
            const homepageIndex = nextItems.findIndex((item) => item.id === 'homepage');
            const targetIndex = homepageIndex === -1 ? insertIndex : homepageIndex + 1;
            nextItems = [
                ...nextItems.slice(0, targetIndex),
                { id: 'announcement-ads', label: 'إدارة الإعلانات', icon: <Megaphone size={20} /> },
                ...nextItems.slice(targetIndex),
            ];
        }

        if (user.role === Role.ADMIN && !nextItems.some((item) => item.id === 'platform-fonts')) {
            const adsIndex = nextItems.findIndex((item) => item.id === 'announcement-ads');
            const targetIndex = adsIndex === -1 ? insertIndex : adsIndex + 1;
            nextItems = [
                ...nextItems.slice(0, targetIndex),
                { id: 'platform-fonts', label: 'إدارة خطوط المنصة', icon: <Type size={20} /> },
                ...nextItems.slice(targetIndex),
            ];
        }

        if (user.role === Role.ADMIN && !nextItems.some((item) => item.id === 'platform-integrations')) {
            const fontsIndex = nextItems.findIndex((item) => item.id === 'platform-fonts');
            const targetIndex = fontsIndex === -1 ? insertIndex : fontsIndex + 1;
            nextItems = [
                ...nextItems.slice(0, targetIndex),
                { id: 'platform-integrations', label: 'إدارة التكاملات والتسجيل', icon: <Settings size={20} /> },
                ...nextItems.slice(targetIndex),
            ];
        }

        if (user.role === Role.ADMIN && !nextItems.some((item) => item.id === 'backups')) {
            const settingsIndex = nextItems.findIndex((item) => item.id === 'settings');
            const targetIndex = settingsIndex === -1 ? nextItems.length : settingsIndex;
            nextItems = [
                ...nextItems.slice(0, targetIndex),
                { id: 'backups', label: 'النسخ الاحتياطي', icon: <Activity size={20} /> },
                ...nextItems.slice(targetIndex),
            ];
        }

        if (user.role === Role.ADMIN && !nextItems.some((item) => item.id === 'ai-assistant')) {
            const monitoringIndex = nextItems.findIndex((item) => item.id === 'monitoring');
            const targetIndex = monitoringIndex === -1 ? nextItems.length : monitoringIndex + 1;
            nextItems = [
                ...nextItems.slice(0, targetIndex),
                { id: 'ai-assistant', label: 'إدارة المساعد الذكي', icon: <Bot size={20} /> },
                ...nextItems.slice(targetIndex),
            ];
        }

        if (!nextItems.some((item) => item.id === 'live-sessions') && [Role.ADMIN, Role.TEACHER, Role.SUPERVISOR].includes(user.role)) {
            const dynamicInsertIndex = nextItems.findIndex((item) => item.id === 'notifications');
            const targetIndex = dynamicInsertIndex === -1 ? nextItems.length : dynamicInsertIndex;
            nextItems = [
                ...nextItems.slice(0, targetIndex),
                { id: 'live-sessions', label: 'الحصص المباشرة', icon: <Video size={20} /> },
                ...nextItems.slice(targetIndex),
            ];
        }

        if (user.role === Role.SUPERVISOR && !nextItems.some((item) => item.id === 'school-portal')) {
            const overviewIndex = nextItems.findIndex((item) => item.id === 'overview');
            const targetIndex = overviewIndex === -1 ? 0 : overviewIndex + 1;
            nextItems = [
                ...nextItems.slice(0, targetIndex),
                { id: 'school-portal', label: 'بوابة المدرسة', icon: <Building2 size={20} /> },
                ...nextItems.slice(targetIndex),
            ];
        }

        return nextItems;
    }, [menuItems, user.role]);

    useEffect(() => {
        if (!enhancedMenuItems.some((item) => item.id === activeTab)) {
            setActiveTab(enhancedMenuItems[0]?.id || 'overview');
        }
    }, [activeTab, enhancedMenuItems]);

    const renderSidebar = () => (
        <div className="py-6 space-y-1">
            <div className="mb-8 px-6">
                <h2 className="text-xl font-bold text-gray-900">لوحة الإدارة</h2>
                <p className="text-sm text-gray-500 mt-1">
                    {user.role === Role.ADMIN ? 'التحكم الكامل بالمنصة' : user.role === Role.TEACHER ? 'لوحة تشغيل المعلم والمحتوى' : 'لوحة متابعة المشرف'}
                </p>
            </div>
            {enhancedMenuItems.map((item) => (
                <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-6 py-3 transition-colors ${
                        activeTab === item.id
                            ? 'bg-amber-50 text-amber-600 font-bold border-r-4 border-amber-500'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-r-4 border-transparent'
                    }`}
                >
                    <div className={activeTab === item.id ? 'text-amber-500' : 'text-gray-400'}>{item.icon}</div>
                    <span className="text-sm">{item.label}</span>
                </button>
            ))}
        </div>
    );

    const renderOverview = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">نظرة عامة (Overview)</h1>
                <div className="text-sm text-gray-500 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
                    آخر تحديث: مباشر من بيانات المنصة
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    {
                        title: 'إجمالي الطلاب',
                        value: overviewStats.totalStudents.toLocaleString('ar-EG'),
                        trend: `${overviewStats.totalSchools} مدرسة`,
                        color: 'text-blue-600',
                        bg: 'bg-blue-50',
                    },
                    {
                        title: 'المعلمون النشطون',
                        value: overviewStats.totalTeachers.toLocaleString('ar-EG'),
                        trend: 'بصلاحيات تدريس',
                        color: 'text-emerald-600',
                        bg: 'bg-emerald-50',
                    },
                    {
                        title: 'المحتوى بانتظار اعتماد',
                        value: overviewStats.pendingReview.toLocaleString('ar-EG'),
                        trend: `${overviewStats.pendingBreakdown.questions} سؤال / ${overviewStats.pendingBreakdown.lessons} درس`,
                        color: 'text-purple-600',
                        bg: 'bg-purple-50',
                    },
                    {
                        title: 'نتائج الاختبارات',
                        value: overviewStats.totalResults.toLocaleString('ar-EG'),
                        trend: `${overviewStats.pendingBreakdown.quizzes} اختبارًا معلقًا`,
                        color: 'text-amber-600',
                        bg: 'bg-amber-50',
                    },
                ].map((kpi) => (
                    <div key={kpi.title} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                            <h3 className="text-gray-500 text-sm font-medium">{kpi.title}</h3>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${kpi.bg} ${kpi.color}`}>
                                {kpi.trend}
                            </span>
                        </div>
                        <p className="text-3xl font-bold text-gray-900 mt-4">{kpi.value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h3 className="text-lg font-black text-gray-900">مركز التشغيل اليومي</h3>
                        <p className="mt-1 text-sm leading-6 text-gray-500">
                            هذه القائمة تجمع أهم الأشياء التي قد تمنع الطالب من رؤية المحتوى أو الاستفادة من التقارير. ابدأ من الأعلى ثم انتقل للمركز المناسب للإصلاح.
                        </p>
                    </div>
                    <div className={`rounded-2xl px-5 py-3 text-center ${
                        dailyOperationQueue.length === 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                    }`}>
                        <div className="text-xs font-bold">مهام حرجة الآن</div>
                        <div className="mt-1 text-2xl font-black">{dailyOperationQueue.length}</div>
                    </div>
                </div>

                {dailyOperationQueue.length > 0 ? (
                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {dailyOperationQueue.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                                <div className="mb-3 flex items-start justify-between gap-3">
                                    <div className={`rounded-xl px-3 py-1 text-xs font-black ${
                                        item.color === 'rose' ? 'bg-rose-100 text-rose-700' :
                                        item.color === 'indigo' ? 'bg-indigo-100 text-indigo-700' :
                                        item.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                                        item.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                                        item.color === 'slate' ? 'bg-slate-100 text-slate-700' :
                                        'bg-amber-100 text-amber-700'
                                    }`}>
                                        {item.count.toLocaleString('ar-EG')}
                                    </div>
                                    <h4 className="text-right font-black text-gray-900">{item.title}</h4>
                                </div>
                                <p className="min-h-[48px] text-right text-xs leading-6 text-gray-500">{item.description}</p>
                                <button
                                    onClick={() => setActiveTab(item.tab)}
                                    className="mt-4 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-black text-white hover:bg-gray-800"
                                >
                                    {item.actionLabel}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-7 text-emerald-700">
                        لا توجد عوائق تشغيلية ظاهرة الآن. المحتوى المنشور والاختبارات والربط بالمهارات في حالة جيدة حسب البيانات الحالية.
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">مؤشر جاهزية المنصة قبل النشر</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            فحص سريع يساعدك تعرف هل المحتوى جاهز للطلاب أم يحتاج مراجعة أو ربط مهارات.
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full border-8 border-emerald-100 flex items-center justify-center bg-emerald-50">
                            <span className="text-xl font-black text-emerald-700">{platformReadiness.readinessScore}%</span>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500">حالة التشغيل</div>
                            <div className={`font-black ${platformReadiness.readinessScore >= 85 ? 'text-emerald-700' : platformReadiness.readinessScore >= 60 ? 'text-amber-700' : 'text-rose-700'}`}>
                                {platformReadiness.readinessScore >= 85 ? 'جاهزية عالية' : platformReadiness.readinessScore >= 60 ? 'تحتاج ضبط بسيط' : 'تحتاج مراجعة قبل النشر'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[
                        {
                            title: 'بانتظار الاعتماد',
                            value: overviewStats.pendingReview,
                            hint: 'دورات، دروس، أسئلة أو اختبارات أضيفت وتحتاج قرار نشر.',
                            icon: <AlertTriangle size={18} />,
                            color: 'amber',
                        },
                        {
                            title: 'مخفي عن الطلاب',
                            value: platformReadiness.hiddenContent,
                            hint: 'عناصر موجودة في الإدارة لكنها لن تظهر في واجهة الطالب.',
                            icon: <EyeOff size={18} />,
                            color: 'slate',
                        },
                        {
                            title: 'اختبارات بلا أسئلة',
                            value: platformReadiness.quizzesWithoutQuestions,
                            hint: 'اختبارات تحتاج سحب أسئلة من بنك الأسئلة قبل عرضها.',
                            icon: <FileQuestion size={18} />,
                            color: 'rose',
                        },
                        {
                            title: 'محتوى بلا مهارات',
                            value: platformReadiness.unlinkedContent,
                            hint: 'يؤثر على تقارير الضعف والتوصيات الذكية بعد الاختبار.',
                            icon: <Target size={18} />,
                            color: 'indigo',
                        },
                    ].map((item) => (
                        <div key={item.title} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                    item.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                                    item.color === 'rose' ? 'bg-rose-100 text-rose-700' :
                                    item.color === 'indigo' ? 'bg-indigo-100 text-indigo-700' :
                                    'bg-slate-100 text-slate-700'
                                }`}>
                                    {item.icon}
                                </div>
                                <span className="text-2xl font-black text-gray-900">{item.value.toLocaleString('ar-EG')}</span>
                            </div>
                            <h4 className="font-black text-gray-900">{item.title}</h4>
                            <p className="text-xs text-gray-500 mt-2 leading-6">{item.hint}</p>
                        </div>
                    ))}
                </div>

                <div className="px-6 pb-6">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                        <div className="flex items-center gap-2 font-black text-emerald-800 mb-3">
                            <CheckCircle2 size={18} />
                            أولوية العمل التالية
                        </div>
                        {platformReadiness.nextActions.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {platformReadiness.nextActions.slice(0, 4).map((action) => (
                                    <div key={action} className="rounded-xl bg-white border border-emerald-100 px-4 py-3 text-sm text-gray-700">
                                        {action}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-emerald-700">
                                ممتاز. لا توجد عوائق تشغيلية واضحة في المحتوى الحالي، ويمكنك التركيز على إضافة محتوى جديد أو مراجعة تجربة الطالب.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {user.role === Role.ADMIN && (
                <div className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
                    <div className="flex flex-col gap-4 border-b border-indigo-50 bg-indigo-50/50 p-6 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h3 className="text-xl font-black text-gray-900">مركز التقارير والإشراف المدرسي</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                متابعة جاهزية المدارس والفصول والطلاب قبل التعاقد أو التشغيل الفعلي.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => setActiveTab('groups')} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700">
                                المدارس والمجموعات
                            </button>
                            <a href="#/reports" className="rounded-xl bg-white px-4 py-2 text-xs font-black text-indigo-700 ring-1 ring-indigo-100 hover:bg-indigo-50">
                                التقارير
                            </a>
                            <button onClick={() => setActiveTab('quizzes')} className="rounded-xl bg-white px-4 py-2 text-xs font-black text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-50">
                                توجيه اختبار
                            </button>
                            <button onClick={() => setActiveTab('announcement-ads')} className="rounded-xl bg-white px-4 py-2 text-xs font-black text-amber-700 ring-1 ring-amber-100 hover:bg-amber-50">
                                رسالة أو إعلان
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-6 lg:grid-cols-6">
                        {[
                            { label: 'مدارس', value: schoolCommandCenter.schoolCount, tone: 'indigo' },
                            { label: 'فصول', value: schoolCommandCenter.classCount, tone: 'blue' },
                            { label: 'طلاب مدارس', value: schoolCommandCenter.schoolStudentCount, tone: 'emerald' },
                            { label: 'بلا فصل', value: schoolCommandCenter.studentsWithoutClass, tone: 'amber' },
                            { label: 'بلا ولي أمر', value: schoolCommandCenter.studentsWithoutParent, tone: 'rose' },
                            { label: 'أكواد نشطة', value: schoolCommandCenter.activeCodes, tone: 'purple' },
                        ].map((item) => (
                            <div key={item.label} className={`rounded-2xl border p-4 ${
                                item.tone === 'indigo' ? 'border-indigo-100 bg-indigo-50 text-indigo-700' :
                                item.tone === 'blue' ? 'border-blue-100 bg-blue-50 text-blue-700' :
                                item.tone === 'emerald' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' :
                                item.tone === 'amber' ? 'border-amber-100 bg-amber-50 text-amber-700' :
                                item.tone === 'rose' ? 'border-rose-100 bg-rose-50 text-rose-700' :
                                'border-purple-100 bg-purple-50 text-purple-700'
                            }`}>
                                <div className="text-xs font-black">{item.label}</div>
                                <div className="mt-2 text-2xl font-black">{item.value.toLocaleString('ar-EG')}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 gap-5 px-6 pb-6 lg:grid-cols-2">
                        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <h4 className="text-sm font-black text-gray-900">مدارس تحتاج ضبط</h4>
                                <button onClick={() => setActiveTab('groups')} className="text-xs font-black text-indigo-600 hover:text-indigo-700">
                                    إدارة المدارس
                                </button>
                            </div>
                            <div className="space-y-3">
                                {schoolCommandCenter.needsSetup.length ? schoolCommandCenter.needsSetup.map((school) => (
                                    <div key={school.id} className="rounded-xl bg-white p-3 shadow-sm">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-black text-gray-900">{school.name}</div>
                                                <div className="mt-1 text-xs text-gray-500">
                                                    {school.studentCount} طالب - {school.classCount} فصل - {school.supervisorCount} مشرف
                                                </div>
                                            </div>
                                            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
                                                {school.issueCount} تنبيه
                                            </span>
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-500">
                                            <span>بلا فصل: <b className="text-gray-900">{school.studentsWithoutClass}</b></span>
                                            <span>بلا ولي أمر: <b className="text-gray-900">{school.studentsWithoutParent}</b></span>
                                            <span>باقات: <b className="text-gray-900">{school.packageCount}</b></span>
                                            <span>أكواد: <b className="text-gray-900">{school.activeCodeCount}</b></span>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="rounded-xl border border-dashed border-emerald-200 bg-white p-4 text-sm font-bold text-emerald-700">
                                        المدارس الحالية جاهزة مبدئيًا ولا توجد نواقص ظاهرة.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <h4 className="text-sm font-black text-gray-900">أداء المدارس</h4>
                                <a href="#/reports" className="text-xs font-black text-indigo-600 hover:text-indigo-700">تقرير مفصل</a>
                            </div>
                            <div className="space-y-3">
                                {schoolCommandCenter.performanceWatch.length ? schoolCommandCenter.performanceWatch.map((school) => (
                                    <div key={school.id} className="rounded-xl bg-white p-3 shadow-sm">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-black text-gray-900">{school.name}</div>
                                                <div className="mt-1 text-xs text-gray-500">{school.quizAttempts} نتيجة مسجلة</div>
                                            </div>
                                            <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${
                                                school.average < 60 ? 'bg-rose-50 text-rose-700' :
                                                school.average < 75 ? 'bg-amber-50 text-amber-700' :
                                                'bg-emerald-50 text-emerald-700'
                                            }`}>
                                                {school.average}%
                                            </span>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                                        سيظهر أداء المدارس بعد توفر نتائج اختبارات موجهة للطلاب.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-96">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">مؤشرات الاعتماد والتشغيل</h3>
                            <p className="text-sm text-gray-500 mt-1">توزيع العناصر التي تنتظر اعتمادك الآن حسب نوع المحتوى.</p>
                        </div>
                        <div className="text-sm text-amber-600 font-bold">
                            {overviewStats.pendingReview.toLocaleString('ar-EG')} عنصر
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { label: 'الدورات', value: overviewStats.pendingBreakdown.courses, color: 'bg-blue-500' },
                            { label: 'الدروس', value: overviewStats.pendingBreakdown.lessons, color: 'bg-emerald-500' },
                            { label: 'الأسئلة', value: overviewStats.pendingBreakdown.questions, color: 'bg-purple-500' },
                            { label: 'الاختبارات', value: overviewStats.pendingBreakdown.quizzes, color: 'bg-amber-500' },
                            { label: 'ملفات المكتبة', value: overviewStats.pendingBreakdown.library, color: 'bg-pink-500' },
                        ].map((item) => {
                            const percentage = overviewStats.pendingReview
                                ? Math.round((item.value / overviewStats.pendingReview) * 100)
                                : 0;

                            return (
                                <div key={item.label} className="border border-gray-100 rounded-xl p-4 bg-gray-50/60">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-bold text-gray-900">{item.label}</span>
                                        <span className="text-sm text-gray-500">{item.value}</span>
                                    </div>
                                    <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${item.color}`}
                                            style={{ width: `${Math.max(percentage, item.value ? 8 : 0)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">يمثل {percentage}% من طابور المراجعة الحالي.</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-96 flex flex-col">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">أحدث ما ينتظر الاعتماد</h3>
                    <div className="flex-1 overflow-y-auto space-y-4">
                        {reviewQueue.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
                                <Activity size={42} className="mb-3 text-gray-200" />
                                <p className="font-medium">لا يوجد محتوى معلق الآن</p>
                                <p className="text-xs mt-1">كل ما أضيفه المعلمون تمت مراجعته أو لا يزال في المسودة.</p>
                            </div>
                        ) : (
                            reviewQueue.map((item) => (
                                <div key={item.id} className="flex items-start gap-3 pb-4 border-b border-gray-50 last:border-0">
                                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                        <User size={14} className="text-amber-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-gray-800 font-bold truncate">{item.title}</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {item.type} • المصدر: {item.ownerType === 'teacher' ? 'معلم' : item.ownerType === 'school' ? 'مدرسة' : 'المنصة'}
                                        </p>
                                        {user.role === Role.ADMIN && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => reviewContentItem(item, 'approved')}
                                                    className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                                                >
                                                    اعتماد ونشر
                                                </button>
                                                <button
                                                    onClick={() => reviewContentItem(item, 'rejected')}
                                                    className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100"
                                                >
                                                    رفض
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {(user.role === Role.ADMIN || user.role === Role.TEACHER || user.role === Role.SUPERVISOR) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {user.role === Role.ADMIN && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">نشاط المعلمين واعتماد المحتوى</h3>
                                    <p className="text-sm text-gray-500 mt-1">المعلمون الأكثر إضافة للمحتوى والنطاقات المسندة لهم الآن.</p>
                                </div>
                                <div className="text-sm text-emerald-600 font-bold">
                                    {teacherContributionStats.length.toLocaleString('ar-EG')} معلم
                                </div>
                            </div>

                            <div className="space-y-3">
                                {teacherContributionStats.length > 0 ? teacherContributionStats.map((teacher) => (
                                    <div key={teacher.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/70">
                                        <div className="flex items-center justify-between gap-3 mb-2">
                                            <div className="font-bold text-gray-900">{teacher.name}</div>
                                            <div className="text-sm font-black text-amber-600">{teacher.pendingItems}</div>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                                            <div>الإجمالي: <span className="font-bold text-gray-900">{teacher.totalItems}</span></div>
                                            <div>معتمد: <span className="font-bold text-emerald-700">{teacher.approvedItems}</span></div>
                                            <div>منشور: <span className="font-bold text-indigo-700">{teacher.publishedItems}</span></div>
                                            <div>بانتظارك: <span className="font-bold text-amber-700">{teacher.pendingItems}</span></div>
                                        </div>
                                        <div className="mt-2 text-xs text-gray-500">
                                            المسارات المسندة: <span className="font-bold">{teacher.managedPaths}</span>
                                            {' • '}
                                            المواد المسندة: <span className="font-bold">{teacher.managedSubjects}</span>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="border border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-500">
                                        لا توجد مساهمات معلمين ظاهرة بعد داخل المنصة.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {user.role === Role.TEACHER && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">نطاق عملي الحالي</h3>
                                    <p className="text-sm text-gray-500 mt-1">أي إضافة جديدة منك ستظهر أولًا في طابور المراجعة حتى اعتمادها من الإدارة.</p>
                                </div>
                                <div className="text-sm text-indigo-600 font-bold">معلم مادة</div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="rounded-xl bg-indigo-50 p-4">
                                    <div className="text-xs text-indigo-600 mb-1">المسارات المسندة</div>
                                    <div className="text-2xl font-black text-indigo-700">{user.managedPathIds?.length || 0}</div>
                                </div>
                                <div className="rounded-xl bg-emerald-50 p-4">
                                    <div className="text-xs text-emerald-600 mb-1">المواد المسندة</div>
                                    <div className="text-2xl font-black text-emerald-700">{user.managedSubjectIds?.length || 0}</div>
                                </div>
                                <div className="rounded-xl bg-amber-50 p-4">
                                    <div className="text-xs text-amber-600 mb-1">بانتظار الاعتماد</div>
                                    <div className="text-2xl font-black text-amber-700">{currentTeacherContribution?.pendingItems || 0}</div>
                                </div>
                                <div className="rounded-xl bg-purple-50 p-4">
                                    <div className="text-xs text-purple-600 mb-1">محتوى منشور</div>
                                    <div className="text-2xl font-black text-purple-700">{currentTeacherContribution?.publishedItems || 0}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {user.role === Role.SUPERVISOR && (
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">نطاق الإشراف الحالي</h3>
                                    <p className="text-sm text-gray-500 mt-1">متابعة سريعة للمجموعات والطلاب والاختبارات الموجهة داخل نطاقك.</p>
                                </div>
                                <div className="text-sm text-amber-600 font-bold">
                                    {supervisorScopeSummary.schoolCount > 0 ? 'مشرف مدرسة' : 'مشرف مجموعة'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="rounded-xl bg-indigo-50 p-4">
                                    <div className="text-xs text-indigo-600 mb-1">المدارس/المجموعات</div>
                                    <div className="text-2xl font-black text-indigo-700">{supervisorScopeSummary.groupCount}</div>
                                </div>
                                <div className="rounded-xl bg-emerald-50 p-4">
                                    <div className="text-xs text-emerald-600 mb-1">الطلاب داخل النطاق</div>
                                    <div className="text-2xl font-black text-emerald-700">{supervisorScopeSummary.studentCount}</div>
                                </div>
                                <div className="rounded-xl bg-blue-50 p-4">
                                    <div className="text-xs text-blue-600 mb-1">متوسط الأداء</div>
                                    <div className="text-2xl font-black text-blue-700">{supervisorScopeSummary.averageScore}%</div>
                                </div>
                                <div className="rounded-xl bg-rose-50 p-4">
                                    <div className="text-xs text-rose-600 mb-1">الطلاب الضعاف</div>
                                    <div className="text-2xl font-black text-rose-700">{supervisorScopeSummary.weakStudentsCount}</div>
                                </div>
                                <div className="rounded-xl bg-purple-50 p-4">
                                    <div className="text-xs text-purple-600 mb-1">اختبارات المتابعة</div>
                                    <div className="text-2xl font-black text-purple-700">{supervisorScopeSummary.followUpCount}</div>
                                </div>
                            </div>

                            <div className="mt-6 flex flex-wrap gap-2">
                                <a href="#/reports" className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700">
                                    التقارير
                                </a>
                                <button onClick={() => setActiveTab('school-portal')} className="rounded-xl bg-amber-50 px-4 py-2 text-xs font-black text-amber-700 hover:bg-amber-100">
                                    الطلاب والمجموعات
                                </button>
                                <button onClick={() => setActiveTab('quizzes')} className="rounded-xl bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100">
                                    توجيه اختبار
                                </button>
                            </div>

                            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                {supervisorActionCards.map((card) => (
                                    <button
                                        key={card.title}
                                        onClick={card.action}
                                        className={`rounded-2xl border p-4 text-right transition hover:-translate-y-0.5 hover:shadow-sm ${
                                            card.tone === 'rose' ? 'border-rose-100 bg-rose-50/70' :
                                            card.tone === 'emerald' ? 'border-emerald-100 bg-emerald-50/70' :
                                            card.tone === 'indigo' ? 'border-indigo-100 bg-indigo-50/70' :
                                            'border-amber-100 bg-amber-50/70'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-black text-gray-900">{card.title}</span>
                                            <span className={`rounded-xl px-2.5 py-1 text-sm font-black ${
                                                card.tone === 'rose' ? 'bg-white text-rose-700' :
                                                card.tone === 'emerald' ? 'bg-white text-emerald-700' :
                                                card.tone === 'indigo' ? 'bg-white text-indigo-700' :
                                                'bg-white text-amber-700'
                                            }`}>
                                                {card.value.toLocaleString('ar-EG')}
                                            </span>
                                        </div>
                                        <p className="mt-2 min-h-[40px] text-xs leading-5 text-gray-500">{card.hint}</p>
                                        <div className={`mt-3 text-xs font-black ${
                                            card.tone === 'rose' ? 'text-rose-700' :
                                            card.tone === 'emerald' ? 'text-emerald-700' :
                                            card.tone === 'indigo' ? 'text-indigo-700' :
                                            'text-amber-700'
                                        }`}>
                                            {card.actionLabel}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <h4 className="text-sm font-black text-gray-900">متابعة الطلاب</h4>
                                        <a href="#/reports" className="text-xs font-black text-indigo-600 hover:text-indigo-700">تقرير مفصل</a>
                                    </div>
                                    <div className="space-y-3">
                                        {supervisorScopeSummary.studentsNeedingFollowUp.length ? supervisorScopeSummary.studentsNeedingFollowUp.map((student) => (
                                            <div key={student.id} className="rounded-xl bg-white p-3 shadow-sm">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-black text-gray-900">{student.name}</div>
                                                        <div className="mt-1 truncate text-xs text-gray-500">{student.latestQuiz}</div>
                                                    </div>
                                                    <div className={`rounded-lg px-2.5 py-1 text-xs font-black ${student.average < 60 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                                                        {student.attempts ? `${student.average}%` : 'جديد'}
                                                    </div>
                                                </div>
                                                {student.weakSkills.length ? (
                                                    <div className="mt-2 text-xs text-gray-500">الأولوية: {student.weakSkills.join('، ')}</div>
                                                ) : null}
                                            </div>
                                        )) : (
                                            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm font-bold text-emerald-700">
                                                لا توجد حالات حرجة ظاهرة الآن.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <h4 className="text-sm font-black text-gray-900">أضعف المهارات</h4>
                                        <button onClick={() => setActiveTab('skills')} className="text-xs font-black text-indigo-600 hover:text-indigo-700">المهارات</button>
                                    </div>
                                    <div className="space-y-3">
                                        {supervisorScopeSummary.weakestSkills.length ? supervisorScopeSummary.weakestSkills.map((skill) => (
                                            <div key={skill.skill} className="rounded-xl bg-white p-3 shadow-sm">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0 truncate text-sm font-black text-gray-900">{skill.skill}</div>
                                                    <div className="text-xs font-black text-rose-700">{skill.mastery}%</div>
                                                </div>
                                                <div className="mt-2 h-2 rounded-full bg-gray-100">
                                                    <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.max(8, Math.min(skill.mastery, 100))}%` }} />
                                                </div>
                                                <div className="mt-2 text-xs text-gray-500">{skill.affectedStudents} طالب - {skill.attempts} محاولة</div>
                                            </div>
                                        )) : (
                                            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                                                تظهر المهارات بعد توفر نتائج كافية.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <h4 className="text-sm font-black text-gray-900">المجموعات</h4>
                                        <button onClick={() => setActiveTab('school-portal')} className="text-xs font-black text-indigo-600 hover:text-indigo-700">إدارة</button>
                                    </div>
                                    <div className="space-y-3">
                                        {supervisorScopeSummary.groupSnapshots.length ? supervisorScopeSummary.groupSnapshots.map((group) => (
                                            <div key={group.id} className="rounded-xl bg-white p-3 shadow-sm">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-black text-gray-900">{group.name}</div>
                                                        <div className="mt-1 text-xs text-gray-500">{group.studentCount} طالب - {group.attempts} نتيجة</div>
                                                    </div>
                                                    <div className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">{group.average}%</div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                                                اربط المشرف بمجموعة لعرض بياناتها هنا.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const renderLibraryCenter = () => {
        const selectedOption = librarySubjectOptions.find((item) => item.subject.id === selectedLibrarySubjectId);
        const selectedSubject = selectedOption?.subject;
        const selectedPathName = selectedOption?.path?.name || 'مسار غير محدد';
        const visibleFiles = libraryItems.filter((item) => item.showOnPlatform !== false).length;
        const readySupportFiles = libraryItems.filter(
            (item) =>
                item.showOnPlatform !== false &&
                item.approvalStatus === 'approved' &&
                Boolean(item.url?.trim()) &&
                Boolean(item.sectionId) &&
                Boolean((item.skillIds || []).length),
        ).length;
        const needsAttentionFiles = libraryItems.filter(
            (item) =>
                item.showOnPlatform === false ||
                item.approvalStatus !== 'approved' ||
                !item.url?.trim() ||
                !item.sectionId ||
                !(item.skillIds || []).length,
        ).length;

        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">مركز المكتبة وملفات الدعم</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            مكان واحد لإدارة الملفات والتلخيصات التي تظهر في مكتبة المادة وداخل موضوعات التأسيس.
                        </p>
                    </div>
                    <div className="w-full lg:w-80">
                        <label className="mb-2 block text-xs font-black text-gray-500">اختر المادة</label>
                        <select
                            value={selectedLibrarySubjectId}
                            onChange={(event) => setSelectedLibrarySubjectId(event.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        >
                            {librarySubjectOptions.map((item) => (
                                <option key={item.subject.id} value={item.subject.id}>
                                    {(item.path?.name || 'مسار غير محدد')} / {item.subject.name} ({item.fileCount})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    {[
                        { label: 'كل الملفات', value: libraryItems.length, className: 'bg-slate-50 text-slate-700 border-slate-100' },
                        { label: 'ظاهر للطلاب', value: visibleFiles, className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                        { label: 'جاهز كملف دعم', value: readySupportFiles, className: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
                        { label: 'يحتاج مراجعة', value: needsAttentionFiles, className: 'bg-amber-50 text-amber-700 border-amber-100' },
                    ].map((item) => (
                        <div key={item.label} className={`rounded-2xl border p-5 ${item.className}`}>
                            <div className="text-xs font-black">{item.label}</div>
                            <div className="mt-2 text-3xl font-black">{item.value.toLocaleString('ar-EG')}</div>
                        </div>
                    ))}
                </div>

                {selectedSubject ? (
                    <>
                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="text-xs font-black text-indigo-600">المادة الحالية</div>
                                    <h2 className="mt-1 text-xl font-black text-gray-900">{selectedSubject.name}</h2>
                                    <p className="mt-1 text-sm text-gray-500">{selectedPathName}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-center md:grid-cols-3">
                                    <div className="rounded-xl bg-white px-4 py-3">
                                        <div className="text-xs font-bold text-gray-500">ملفات المادة</div>
                                        <div className="mt-1 text-lg font-black text-gray-900">{selectedOption?.fileCount || 0}</div>
                                    </div>
                                    <div className="rounded-xl bg-white px-4 py-3">
                                        <div className="text-xs font-bold text-gray-500">جاهز للدعم</div>
                                        <div className="mt-1 text-lg font-black text-emerald-700">{selectedOption?.readyCount || 0}</div>
                                    </div>
                                    <div className="rounded-xl bg-white px-4 py-3">
                                        <div className="text-xs font-bold text-gray-500">المسار</div>
                                        <div className="mt-1 text-sm font-black text-gray-900">{selectedPathName}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <LibraryManager subjectId={selectedSubject.id} />
                    </>
                ) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
                        <BookOpen className="mx-auto mb-4 text-gray-300" size={44} />
                        <h2 className="text-xl font-black text-gray-900">لا توجد مواد لإدارة المكتبة</h2>
                        <p className="mt-2 text-sm text-gray-500">أضف مسارا ومادة أولا، ثم ارجع لإدارة ملفات الدعم والتلخيصات من هنا.</p>
                    </div>
                )}
            </div>
        );
    };

    const renderSystemOperations = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {activeTab === 'settings' ? 'الإعدادات التشغيلية' : 'مراقبة النظام'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        متابعة حالة الخدمات المهمة بدون تغيير تجربة الطالب أو تعطيل أي جزء يعمل بالفعل.
                    </p>
                </div>
                <button
                    onClick={loadAiStatus}
                    disabled={aiStatusLoading}
                    className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-black text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {aiStatusLoading ? 'جاري التحديث...' : 'تحديث الحالة'}
                </button>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h2 className="text-xl font-black text-gray-900">حالة التشغيل الحية</h2>
                        <p className="mt-1 text-sm leading-6 text-gray-500">
                            فحص مباشر من الخادم لقاعدة البيانات، المحتوى المرئي للطالب، وروابط التعلم الأساسية.
                        </p>
                    </div>
                    <div className={`rounded-2xl px-5 py-3 text-center ${
                        (operationalStatus?.learningReadiness.score || 0) >= 85
                            ? 'bg-emerald-50 text-emerald-700'
                            : (operationalStatus?.learningReadiness.score || 0) >= 60
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                    }`}>
                        <div className="text-xs font-bold">جاهزية التعلم</div>
                        <div className="mt-1 text-2xl font-black">
                            {operationalStatus ? `${operationalStatus.learningReadiness.score}%` : '...'}
                        </div>
                    </div>
                </div>

                {operationalStatusError ? (
                    <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                        {operationalStatusError}
                    </div>
                ) : null}

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {[
                        {
                            title: 'قاعدة البيانات',
                            value: operationalStatus?.database.status === 'connected' ? 'متصلة' : 'غير متصلة',
                            hint: operationalStatus?.database.name || 'غير محدد',
                            ok: operationalStatus?.database.status === 'connected',
                        },
                        {
                            title: 'مساحات ظاهرة',
                            value: `${operationalStatus?.learningReadiness.usableSpaces || 0}`,
                            hint: `فارغة: ${operationalStatus?.learningReadiness.emptySpaces || 0}`,
                            ok: (operationalStatus?.learningReadiness.usableSpaces || 0) > 0 && (operationalStatus?.learningReadiness.emptySpaces || 0) === 0,
                        },
                        {
                            title: 'روابط الدروس',
                            value: `${operationalStatus?.issues.missingLessonRefs || 0}`,
                            hint: `دروس غير قابلة للتشغيل: ${operationalStatus?.issues.unplayableLinkedLessons || 0}`,
                            ok: (operationalStatus?.issues.missingLessonRefs || 0) === 0 && (operationalStatus?.issues.unplayableLinkedLessons || 0) === 0,
                        },
                        {
                            title: 'النشر',
                            value: operationalStatus?.deployment.api || 'Render',
                            hint: `${operationalStatus?.deployment.frontend || 'Vercel'} + ${operationalStatus?.deployment.database || 'Atlas'}`,
                            ok: true,
                        },
                    ].map((item) => (
                        <div key={item.title} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${
                                    item.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                }`}>
                                    {item.ok ? 'سليم' : 'يحتاج مراجعة'}
                                </span>
                                <div className="text-sm font-bold text-gray-500">{item.title}</div>
                            </div>
                            <div className="mt-3 text-2xl font-black text-gray-900">{item.value}</div>
                            <div className="mt-2 text-xs leading-5 text-gray-500">{item.hint}</div>
                        </div>
                    ))}
                </div>

                {operationalStatus?.learningReadiness.spaces?.length ? (
                    <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100">
                        <div className="grid grid-cols-6 bg-gray-50 px-4 py-3 text-xs font-black text-gray-500">
                            <div className="col-span-2 text-right">المادة</div>
                            <div className="text-center">موضوعات</div>
                            <div className="text-center">دروس</div>
                            <div className="text-center">اختبارات</div>
                            <div className="text-center">ملفات</div>
                        </div>
                        {operationalStatus.learningReadiness.spaces.map((space) => (
                            <div key={`${space.pathId}-${space.subjectId}`} className="grid grid-cols-6 border-t border-gray-100 px-4 py-3 text-sm">
                                <div className="col-span-2 text-right font-bold text-gray-800">{space.subjectName}</div>
                                <div className="text-center text-gray-600">{space.topics}</div>
                                <div className="text-center text-gray-600">{space.lessons}</div>
                                <div className="text-center text-gray-600">{space.quizzes}</div>
                                <div className="text-center text-gray-600">{space.library}</div>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                    aiProviderMeta.color === 'emerald'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : aiProviderMeta.color === 'blue'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-slate-100 text-slate-700'
                                }`}>
                                    <Activity size={22} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-gray-900">حالة الذكاء الاصطناعي</h2>
                                    <p className="text-sm text-gray-500">مصدر التحليل والتوصيات الذكية داخل المنصة</p>
                                </div>
                            </div>
                            <p className="text-sm leading-7 text-gray-600 max-w-2xl">{aiProviderMeta.description}</p>
                        </div>
                        <div className={`rounded-2xl px-5 py-4 text-center ${
                            aiProviderMeta.color === 'emerald'
                                ? 'bg-emerald-50 text-emerald-700'
                                : aiProviderMeta.color === 'blue'
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-slate-50 text-slate-700'
                        }`}>
                            <div className="text-xs font-bold opacity-80">المزود الحالي</div>
                            <div className="text-lg font-black mt-1">{aiProviderMeta.label}</div>
                            <div className="text-xs font-bold mt-2">{aiProviderMeta.badge}</div>
                        </div>
                    </div>

                    {aiStatusError && (
                        <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                            {aiStatusError}
                        </div>
                    )}

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                            <div className="text-xs text-gray-500 mb-2">النموذج</div>
                            <div className="font-black text-gray-900 break-words">{aiStatus?.model || 'غير محدد'}</div>
                        </div>
                        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                            <div className="text-xs text-gray-500 mb-2">مهلة الطلب</div>
                            <div className="font-black text-gray-900">
                                {aiStatus?.timeoutMs ? `${aiStatus.timeoutMs.toLocaleString('ar-EG')} ms` : 'غير محدد'}
                            </div>
                        </div>
                        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                            <div className="text-xs text-gray-500 mb-2">Ollama / Gemma</div>
                            <div className={`font-black ${aiStatus?.ollamaConfigured ? 'text-emerald-700' : 'text-gray-500'}`}>
                                {aiStatus?.ollamaConfigured ? 'مفعل' : 'غير مفعل'}
                            </div>
                        </div>
                        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                            <div className="text-xs text-gray-500 mb-2">LM Studio</div>
                            <div className={`font-black ${aiStatus?.lmStudioConfigured ? 'text-emerald-700' : 'text-gray-500'}`}>
                                {aiStatus?.lmStudioConfigured ? 'مفعل' : 'غير مفعل'}
                            </div>
                        </div>
                        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                            <div className="text-xs text-gray-500 mb-2">Gemini</div>
                            <div className={`font-black ${aiStatus?.geminiConfigured ? 'text-emerald-700' : 'text-gray-500'}`}>
                                {aiStatus?.geminiConfigured ? 'مفعل' : 'غير مفعل'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-lg font-black text-gray-900 mb-4">قرار التشغيل الاحترافي</h3>
                    <div className="space-y-3 text-sm leading-7 text-gray-600">
                        <p className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-emerald-800">
                            الأولوية المستقبلية: تشغيل Ollama/Gemma أو LM Studio على سيرفر مستقل أو جهاز دائم لتقليل تكلفة الذكاء الاصطناعي.
                        </p>
                        <p className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-blue-800">
                            في الإنتاج: كل طلبات الذكاء تمر من الخادم، لذلك مفاتيح API لا تظهر للطالب ولا للمتصفح.
                        </p>
                        <p className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-amber-800">
                            لو تعطل مزود الذكاء، المنصة لا تتوقف وتعرض مقترحات احتياطية مناسبة حتى نعيد ضبط المزود.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    {
                        title: 'مصدر البيانات',
                        value: 'MongoDB Atlas',
                        hint: 'المسارات، المهارات، الاختبارات، النتائج، والتقارير مرتبطة بمصدر بيانات حقيقي.',
                    },
                    {
                        title: 'النشر الحالي',
                        value: 'Vercel + Render',
                        hint: 'الواجهة والخادم منفصلان وجاهزان للتطوير المستمر بدون الاعتماد على جهازك.',
                    },
                    {
                        title: 'السلامة',
                        value: 'JWT + Server AI',
                        hint: 'تسجيل الدخول الحقيقي وحماية مفاتيح الذكاء داخل الخادم بدل المتصفح.',
                    },
                ].map((item) => (
                    <div key={item.title} className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
                        <div className="text-sm text-gray-500">{item.title}</div>
                        <div className="mt-2 text-xl font-black text-gray-900">{item.value}</div>
                        <p className="mt-3 text-xs leading-6 text-gray-500">{item.hint}</p>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return renderOverview();
            case 'paths':
                return <PathsManager />;
            case 'lessons':
                return <LessonsManager />;
            case 'library':
                return renderLibraryCenter();
            case 'quizzes':
                return <QuizzesManager key={`quizzes-${tabRequestVersion}`} />;
            case 'mock-exams':
                return <MockExamManager />;
            case 'questions':
                return <QuestionBankManager />;
            case 'skills':
                return <SkillsTreeManager />;
            case 'users':
                return <UsersManager />;
            case 'groups':
                return <SchoolsManager />;
            case 'school-portal':
                return <SchoolPortalManager key={`school-portal-${tabRequestVersion}`} />;
            case 'financial':
                return <FinancialManager />;
            case 'homepage':
                return <HomepageManager />;
            case 'announcement-ads':
                return <AnnouncementAdsManager />;
            case 'platform-fonts':
                return <PlatformFontsManager />;
            case 'platform-integrations':
                return <PlatformIntegrationsManager />;
            case 'live-sessions':
                return <LiveSessionsManager />;
            case 'backups':
                return <BackupManager />;
            case 'monitoring':
                return <OperationsCommandCenter />;
            case 'ai-assistant':
                return <AiAssistantManager />;
            case 'settings':
                return renderSystemOperations();
            default:
                return renderOverview();
        }
    };

    return (
        <DashboardLayout sidebar={renderSidebar()}>
            <React.Suspense fallback={<AdminTabLoading />}>
                {renderContent()}
            </React.Suspense>
        </DashboardLayout>
    );
};
