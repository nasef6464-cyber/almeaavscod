
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, Target, PieChart, BookOpen, Video, Clock, CheckCircle, FileText, Download, Copy, Share2, Sparkles, Loader2, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Role } from '../types';
import { sanitizeArabicText } from '../utils/sanitizeMojibakeArabic';
import { printElementAsPdf } from '../utils/printPdf';
import { shareTextSummary } from '../utils/shareText';
import { matchesEntityId } from '../utils/entityIds';

type XlsxModule = typeof import('xlsx');

const loadXlsx = async (): Promise<XlsxModule> => import('xlsx');

interface ScopedAnalyticsOverview {
    scope: {
        role: string;
        studentCount: number;
        groupCount: number;
        quizAttempts: number;
        questionAttempts?: number;
        earlyWeakSkillSignalCount?: number;
        minSkillEvidence?: number;
    };
    weakestStudents: Array<{
        id: string;
        name: string;
        averageScore: number;
        attempts: number;
        weakSkillCount: number;
        earlyWeakSignalCount?: number;
        schoolName?: string;
        groupIds?: string[];
        groupNames?: string[];
        weakestSkills?: Array<{ skill: string; mastery: number; attempts?: number; isReliable?: boolean; evidenceThreshold?: number }>;
        recommendedAction?: string;
    }>;
    weakestSkills: Array<{
        skillId?: string;
        skill: string;
        section?: string;
        mastery: number;
        affectedStudents: number;
        attempts: number;
        isReliable?: boolean;
        evidenceThreshold?: number;
        recommendedAction?: string;
    }>;
    subjectSummaries: Array<{
        subjectId?: string;
        subjectName: string;
        mastery: number;
        weakStudents: number;
    }>;
    assignedFollowUps: Array<{
        id: string;
        title: string;
        mode: 'regular' | 'saher' | 'central';
        targetGroupIds?: string[];
        targetUserIds?: string[];
        dueDate?: string;
    }>;
}

interface ScopedQuizResult {
    id?: string;
    _id?: string;
    userId?: string;
    studentName?: string;
    studentEmail?: string;
    quizTitle: string;
    score: number;
    totalQuestions?: number;
    correctAnswers?: number;
    wrongAnswers?: number;
    date?: string;
    createdAt?: string;
    skillsAnalysis?: Array<{ skill?: string; mastery?: number; status?: string }>;
}

interface StudentAggregatedSkill {
    skill: string;
    skillId?: string;
    pathId?: string;
    subjectName?: string;
    sectionName?: string;
    mastery: number;
    attempts: number;
    correctAttempts: number;
    totalEvidence: number;
    isReliable: boolean;
    status: 'weak' | 'average' | 'strong';
}

const roleScopeTitle: Record<string, string> = {
    admin: 'نطاق المنصة بالكامل',
    supervisor: 'نطاق المجموعات والمدرسة التابعة لك',
    teacher: 'نطاق الطلاب المرتبطين بك',
    parent: 'الأبناء المرتبطون بك',
    student: 'نطاقك الشخصي',
};

const displayText = (value?: string | null) => sanitizeArabicText(value) || '';
const MIN_SKILL_EVIDENCE_COUNT = 3;

const getReportSkillKey = (skill: { skill: string; skillId?: string }) => skill.skillId || skill.skill;

const buildSkillSessionLink = (skill?: { skill?: string; skillId?: string; subjectName?: string; sectionName?: string } | null) => {
    if (!skill) return '/book-session';

    const params = new URLSearchParams();
    if (skill.skillId) params.set('skillId', skill.skillId);
    if (skill.skill) params.set('skillName', displayText(skill.skill));
    if (skill.subjectName) params.set('subjectName', displayText(skill.subjectName));
    if (skill.sectionName) params.set('sectionName', displayText(skill.sectionName));
    params.set('source', 'reports');

    return `/book-session?${params.toString()}`;
};

const buildDirectedQuizManagerLink = (context?: {
    pathId?: string;
    subjectId?: string;
    sectionId?: string;
    skillId?: string;
    targetUserId?: string;
    targetGroupId?: string;
}) => {
    const params = new URLSearchParams({
        tab: 'quizzes',
        source: 'reports',
        mode: 'central',
    });

    if (context?.pathId) params.set('pathId', context.pathId);
    if (context?.subjectId) params.set('subjectId', context.subjectId);
    if (context?.sectionId) params.set('sectionId', context.sectionId);
    if (context?.skillId) params.set('skillId', context.skillId);
    if (context?.targetUserId) params.set('targetUserId', context.targetUserId);
    if (context?.targetGroupId) params.set('targetGroupId', context.targetGroupId);

    return `/admin-dashboard?${params.toString()}`;
};

const getReportMasteryTone = (mastery: number) => {
    if (mastery < 50) {
        return {
            label: 'ابدأ بها',
            bg: 'bg-rose-50',
            text: 'text-rose-700',
            bar: 'bg-rose-500',
            border: 'border-rose-100',
        };
    }

    if (mastery < 75) {
        return {
            label: 'راجعها قريبًا',
            bg: 'bg-amber-50',
            text: 'text-amber-700',
            bar: 'bg-amber-500',
            border: 'border-amber-100',
        };
    }

    return {
        label: 'مطمئنة',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        bar: 'bg-emerald-500',
        border: 'border-emerald-100',
    };
};

const scoreTone = (score: number) => {
    if (score < 60) return 'text-rose-600 bg-rose-50 border-rose-100';
    if (score < 80) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-emerald-600 bg-emerald-50 border-emerald-100';
};

interface SkillRecommendation {
    lessonTitle?: string;
    lessonLink?: string;
    lessonTopicTitle?: string;
    quizTitle?: string;
    quizLink?: string;
    resourceTitle?: string;
    resourceUrl?: string;
    subjectName?: string;
    sectionName?: string;
    actionText?: string;
}

interface SmartRemediationPlan {
    title?: string;
    summary?: string;
    steps?: Array<{ day?: string; skill?: string; action?: string; check?: string }>;
    parentNote?: string;
}

const getSkillRecommendation = (
    skill: { skill?: string; skillId?: string } | undefined,
    allSkills: ReturnType<typeof useStore.getState>['skills'],
    lessons: ReturnType<typeof useStore.getState>['lessons'],
    quizzes: ReturnType<typeof useStore.getState>['quizzes'],
    libraryItems: ReturnType<typeof useStore.getState>['libraryItems'],
    questions: ReturnType<typeof useStore.getState>['questions'],
    topics: ReturnType<typeof useStore.getState>['topics'],
): SkillRecommendation => {
    if (!skill) return {};

    const resolvedSkill = skill.skillId
        ? allSkills.find((item) => item.id === skill.skillId)
        : allSkills.find((item) => displayText(item.name) === displayText(skill.skill));

    if (!resolvedSkill) return {};

    const recommendedLesson = lessons.find(
        (lesson) =>
            lesson.skillIds?.includes(resolvedSkill.id) &&
            lesson.showOnPlatform !== false &&
            (!lesson.approvalStatus || lesson.approvalStatus === 'approved'),
    );
    const recommendedQuiz = quizzes.find((quiz) =>
        quiz.showOnPlatform !== false &&
        quiz.isPublished !== false &&
        (!quiz.approvalStatus || quiz.approvalStatus === 'approved') &&
        (quiz.questionIds?.some((questionId) => questions.find((question) => question.id === questionId)?.skillIds?.includes(resolvedSkill.id)) ||
            quiz.skillIds?.includes(resolvedSkill.id))
    );
    const recommendedResource = libraryItems.find(
        (item) =>
            item.skillIds?.includes(resolvedSkill.id) &&
            item.showOnPlatform !== false &&
            (!item.approvalStatus || item.approvalStatus === 'approved'),
    );
    const recommendationPathId = resolvedSkill.pathId;
    const recommendationSubjectId = resolvedSkill.subjectId;
    const recommendationSectionId = resolvedSkill.sectionId;
    const recommendedTopic =
        recommendedLesson && recommendationPathId && recommendationSubjectId
            ? topics.find(
                (topic) =>
                    topic.pathId === recommendationPathId &&
                    topic.subjectId === recommendationSubjectId &&
                    topic.showOnPlatform !== false &&
                    (topic.lessonIds || []).some((lessonId) => matchesEntityId(recommendedLesson, lessonId)),
            )
            : undefined;
    const lessonLink =
        recommendationPathId && recommendationSubjectId
            ? (() => {
                const params = new URLSearchParams({
                    subject: recommendationSubjectId,
                    tab: 'skills',
                });

                if (recommendedTopic?.id && recommendedLesson?.id) {
                    params.set('topic', recommendedTopic.id);
                    params.set('content', 'lessons');
                    params.set('lesson', recommendedLesson.id);
                }

                return `/category/${recommendationPathId}?${params.toString()}`;
            })()
            : undefined;

    return {
        lessonTitle: displayText(recommendedLesson?.title),
        lessonLink,
        lessonTopicTitle: displayText(recommendedTopic?.title),
        quizTitle: displayText(recommendedQuiz?.title),
        quizLink: recommendedQuiz?.id ? `/quiz/${recommendedQuiz.id}` : undefined,
        resourceTitle: displayText(recommendedResource?.title),
        resourceUrl: recommendedResource?.url,
        subjectName: recommendationSubjectId ? displayText(useStore.getState().subjects.find((item) => item.id === recommendationSubjectId)?.name) : undefined,
        sectionName: recommendationSectionId ? displayText(useStore.getState().sections.find((item) => item.id === recommendationSectionId)?.name) : undefined,
        actionText:
            recommendedLesson && recommendedQuiz
                ? 'ابدأ بالشرح أولًا ثم نفّذ اختبارًا قصيرًا لقياس التحسن.'
                : recommendedLesson
                    ? 'هذه المهارة تحتاج مراجعة شرحها قبل أي تدريب إضافي.'
                    : recommendedQuiz
                        ? 'هذه المهارة جاهزة لتدريب علاجي مباشر عبر الاختبار المقترح.'
                        : recommendedResource
                            ? 'راجع الملف الداعم ثم ارجع لتكرار التدريب على نفس المهارة.'
                            : 'أعد المحاولة عبر اختبار ساهر مخصص لهذه المهارة.',
    };
};

const Reports: React.FC = () => {
    const { examResults, questionAttempts, skills, lessons, quizzes, libraryItems, questions, topics, subjects, sections, paths, enrolledPaths, user } = useStore();
    const [scopedAnalytics, setScopedAnalytics] = useState<ScopedAnalyticsOverview | null>(null);
    const [scopedResults, setScopedResults] = useState<ScopedQuizResult[]>([]);
    const [scopedAnalyticsLoading, setScopedAnalyticsLoading] = useState(false);
    const [selectedSkillKey, setSelectedSkillKey] = useState<string | null>(null);
    const [copiedScopedSummary, setCopiedScopedSummary] = useState(false);
    const [copiedInstitutionalAlert, setCopiedInstitutionalAlert] = useState(false);
    const [sharedScopedSummary, setSharedScopedSummary] = useState(false);
    const [copiedStudentSummary, setCopiedStudentSummary] = useState(false);
    const [sharedStudentSummary, setSharedStudentSummary] = useState(false);
    const [smartRemediation, setSmartRemediation] = useState<SmartRemediationPlan | null>(null);
    const [smartRemediationLoading, setSmartRemediationLoading] = useState(false);
    const [scopedSmartRemediation, setScopedSmartRemediation] = useState<SmartRemediationPlan | null>(null);
    const [scopedSmartRemediationLoading, setScopedSmartRemediationLoading] = useState(false);
    const [studentReportDepth, setStudentReportDepth] = useState<'simple' | 'full'>('simple');
    const [scopedReportMode, setScopedReportMode] = useState<'combined' | 'aggregated' | 'individual'>('combined');
    const [scopedGroupFilter, setScopedGroupFilter] = useState<string>('all');

    useEffect(() => {
        if (!user?.email || user.role === Role.STUDENT) {
            setScopedAnalytics(null);
            return;
        }

        let cancelled = false;
        setScopedAnalyticsLoading(true);

        Promise.all([
            api.getQuizAnalyticsOverview(),
            api.getScopedQuizResults(),
        ])
            .then(([analyticsResponse, resultsResponse]) => {
                if (!cancelled) {
                    setScopedAnalytics(analyticsResponse as ScopedAnalyticsOverview);
                    const scopedPayload = resultsResponse as { results?: ScopedQuizResult[] };
                    setScopedResults(Array.isArray(scopedPayload?.results) ? scopedPayload.results : []);
                }
            })
            .catch((error) => {
                console.warn('Failed to load scoped analytics overview', error);
                if (!cancelled) {
                    setScopedAnalytics(null);
                    setScopedResults([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setScopedAnalyticsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [user?.email, user.role]);

    // Calculate Performance Analysis
    const stats = useMemo(() => {
        if (examResults.length === 0) {
            if (questionAttempts.length === 0) return null;

            const answeredAttempts = questionAttempts.filter((attempt) => attempt.selectedOptionIndex >= 0);
            const correctAttempts = answeredAttempts.filter((attempt) => attempt.isCorrect).length;
            const averageScore = answeredAttempts.length > 0 ? Math.round((correctAttempts / answeredAttempts.length) * 100) : 0;

            return {
                averageScore,
                bestSubject: { name: 'تدريبات الأسئلة', score: averageScore },
                worstSubject: { name: 'تحتاج متابعة', score: averageScore },
            };
        }

        const totalScore = examResults.reduce((acc, curr) => acc + curr.score, 0);
        const averageScore = Math.round(totalScore / examResults.length);

        // Group by quizTitle (as a proxy for subject)
        const subjectScores: Record<string, { total: number, count: number }> = {};
        examResults.forEach(result => {
            // Try to extract a general subject name from the quiz title (e.g., "اختبار الهندسة" -> "الهندسة")
            const subjectName = displayText(result.quizTitle).replace('اختبار ', '').replace('الوحدة الأولى', 'أساسيات');
            
            if (!subjectScores[subjectName]) {
                subjectScores[subjectName] = { total: 0, count: 0 };
            }
            subjectScores[subjectName].total += result.score;
            subjectScores[subjectName].count += 1;
        });

        let bestSubject = { name: '-', score: 0 };
        let worstSubject = { name: '-', score: 100 };

        Object.entries(subjectScores).forEach(([name, data]) => {
            const avg = data.total / data.count;
            if (avg >= bestSubject.score) bestSubject = { name, score: Math.round(avg) };
            if (avg <= worstSubject.score) worstSubject = { name, score: Math.round(avg) };
        });

        return { averageScore, bestSubject, worstSubject };
    }, [examResults, questionAttempts]);

    // Aggregate Skill Analysis
    const aggregatedSkills = useMemo(() => {
        const skillsMap: Record<string, { totalMastery: number, count: number, skillName: string; skillId?: string; pathId?: string; subjectId?: string; sectionId?: string }> = {};
        
        examResults.forEach(result => {
            if (result.skillsAnalysis) {
                result.skillsAnalysis.forEach(skill => {
                    const skillKey = skill.skillId || skill.skill;
                    if (!skillsMap[skillKey]) {
                        skillsMap[skillKey] = {
                        totalMastery: 0,
                        count: 0,
                        skillName: skill.skill,
                        skillId: skill.skillId,
                            pathId: skill.pathId,
                            subjectId: skill.subjectId,
                            sectionId: skill.sectionId,
                        };
                    }
                    skillsMap[skillKey].totalMastery += skill.mastery;
                    skillsMap[skillKey].count += 1;
                    if (!skillsMap[skillKey].skillId && skill.skillId) {
                        skillsMap[skillKey].skillId = skill.skillId;
                    }
                    if (!skillsMap[skillKey].pathId && skill.pathId) skillsMap[skillKey].pathId = skill.pathId;
                    if (!skillsMap[skillKey].subjectId && skill.subjectId) skillsMap[skillKey].subjectId = skill.subjectId;
                    if (!skillsMap[skillKey].sectionId && skill.sectionId) skillsMap[skillKey].sectionId = skill.sectionId;
                });
            }
        });

        if (Object.keys(skillsMap).length === 0 && questionAttempts.length > 0) {
            const questionById = new Map(questions.map((question) => [question.id, question]));
            const skillById = new Map(skills.map((skill) => [skill.id, skill]));

            questionAttempts.forEach((attempt) => {
                const question = questionById.get(attempt.questionId);
                const questionSkillIds = Array.isArray(question?.skillIds) ? question.skillIds : [];

                questionSkillIds.forEach((skillId) => {
                    const resolvedSkill = skillById.get(skillId);
                    if (!resolvedSkill) return;

                    const skillName = displayText(resolvedSkill.name);
                    if (!skillName) return;

                    if (!skillsMap[skillName]) {
                        skillsMap[skillName] = { totalMastery: 0, count: 0, skillName, skillId: resolvedSkill.id, pathId: resolvedSkill.pathId, subjectId: resolvedSkill.subjectId, sectionId: resolvedSkill.sectionId };
                    }

                    skillsMap[skillName].totalMastery += attempt.isCorrect ? 100 : 0;
                    skillsMap[skillName].count += 1;
                });
            });
        }

        return Object.entries(skillsMap).map(([skill, data]): StudentAggregatedSkill => {
            const mastery = Math.round(data.totalMastery / data.count);
            const resolvedSkill = data.skillId
                ? skills.find((item) => item.id === data.skillId)
                : skills.find((item) => displayText(item.name) === displayText(skill));
            const pathId = data.pathId || resolvedSkill?.pathId;
            const subjectName = resolvedSkill?.subjectId
                ? displayText(subjects.find((subject) => subject.id === resolvedSkill.subjectId)?.name)
                : undefined;
            const sectionName = resolvedSkill?.sectionId
                ? displayText(sections.find((section) => section.id === resolvedSkill.sectionId)?.name)
                : undefined;

            return {
                skill: displayText(data.skillName || skill),
                skillId: data.skillId,
                pathId,
                subjectName,
                sectionName,
                mastery,
                attempts: data.count,
                correctAttempts: Math.round((mastery / 100) * data.count),
                totalEvidence: data.count,
                isReliable: data.count >= MIN_SKILL_EVIDENCE_COUNT,
                status: mastery < 50 ? 'weak' : mastery < 75 ? 'average' : 'strong'
            };
        }).sort((a, b) => a.mastery - b.mastery); // Sort by weakest first
    }, [examResults, questionAttempts, questions, sections, skills, subjects]);

    const weakestSkill = aggregatedSkills.length > 0 ? aggregatedSkills[0] : null;
    const studentEvidenceSummary = useMemo(() => {
        const totalQuestions = aggregatedSkills.reduce((sum, skill) => sum + (skill.totalEvidence || skill.attempts || 0), 0);
        const uniqueSkills = aggregatedSkills.length;
        return { totalQuestions, uniqueSkills };
    }, [aggregatedSkills]);
    const studentEnrolledPathIds = useMemo(() => Array.from(new Set(enrolledPaths || [])).filter(Boolean), [enrolledPaths]);
    const studentEnrolledPathLabels = useMemo(
        () => studentEnrolledPathIds.map((pathId, index) => displayText(paths.find((path) => path.id === pathId)?.name) || `مسار مسجل ${index + 1}`),
        [paths, studentEnrolledPathIds],
    );
    const studentPathScopedSkills = useMemo(
        () =>
            studentEnrolledPathIds.length > 0
                ? aggregatedSkills.filter((skill) => skill.pathId && studentEnrolledPathIds.includes(skill.pathId))
                : aggregatedSkills,
        [aggregatedSkills, studentEnrolledPathIds],
    );
    const reportBaseSkills = studentPathScopedSkills.length > 0 ? studentPathScopedSkills : aggregatedSkills;
    const reliableAggregatedSkills = reportBaseSkills.filter((skill) => skill.isReliable);
    const reliableWeakSkills = reliableAggregatedSkills.filter((skill) => skill.mastery < 50);
    const reliableAverageSkills = reliableAggregatedSkills.filter((skill) => skill.mastery >= 50 && skill.mastery < 75);
    const earlyWeakSignals = reportBaseSkills.filter((skill) => skill.mastery < 50 && !skill.isReliable);
    const focusedReportSkills = (
        reliableWeakSkills.length > 0
            ? [...reliableWeakSkills, ...reliableAverageSkills]
            : reliableAggregatedSkills.length > 0
                ? reliableAggregatedSkills
                : reportBaseSkills
    ).slice(0, 6);
    const primaryReportSkill = focusedReportSkills[0] || weakestSkill;
    const selectedReportSkill = aggregatedSkills.find((skill) => getReportSkillKey(skill) === selectedSkillKey) || primaryReportSkill;
    const selectedSkillRecommendation = getSkillRecommendation(selectedReportSkill || undefined, skills, lessons, quizzes, libraryItems, questions, topics);
    const isStudentView = user.role === Role.STUDENT;
    const hasStudentAnalytics = examResults.length > 0 || aggregatedSkills.length > 0;
    const isStudentReportFull = studentReportDepth === 'full';
    const studentTrackLabel = studentEnrolledPathLabels.length > 0 ? studentEnrolledPathLabels.join('، ') : '';
    const hasStudentTrackScope = studentEnrolledPathIds.length > 0;
    const skillReadinessSummary = useMemo(() => {
        const weak = reportBaseSkills.filter((skill) => skill.mastery < 50 && skill.isReliable).length;
        const early = reportBaseSkills.filter((skill) => skill.mastery < 50 && !skill.isReliable).length;
        const average = reportBaseSkills.filter((skill) => skill.mastery >= 50 && skill.mastery < 75).length;
        const strong = reportBaseSkills.filter((skill) => skill.mastery >= 75).length;
        const total = reportBaseSkills.length;

        return {
            weak,
            early,
            average,
            strong,
            total,
            reliable: reliableAggregatedSkills.length,
            minEvidence: MIN_SKILL_EVIDENCE_COUNT,
            message:
                weak > 0
                    ? `ابدأ بـ ${weak} مهارة ضعفها مؤكد بعد ${MIN_SKILL_EVIDENCE_COUNT} محاولات أو أكثر.`
                    : average > 0
                        ? `مستواك جيد، وراجع ${average} مهارة لتثبيت التحسن.`
                        : early > 0
                            ? `${early} مهارة بها إشارات أولية وتحتاج محاولات أكثر قبل الحكم.`
                            : total > 0
                                ? 'مؤشراتك مطمئنة. حافظ على التدريب القصير.'
                            : 'ابدأ اختبارًا قصيرًا حتى تظهر خريطة مهاراتك.',
        };
    }, [reliableAggregatedSkills.length, reportBaseSkills]);
    const studentWeeklyPlan = useMemo(() => {
        const dayLabels = ['اليوم 1', 'اليوم 2', 'اليوم 3'];

        return focusedReportSkills.slice(0, 3).map((skill, index) => {
            const recommendation = getSkillRecommendation(skill, skills, lessons, quizzes, libraryItems, questions, topics);

            return {
                day: dayLabels[index],
                skillId: skill.skillId,
                skill: displayText(skill.skill),
                subjectName: displayText(skill.subjectName),
                sectionName: displayText(skill.sectionName),
                mastery: skill.mastery,
                attempts: skill.attempts,
                isReliable: skill.isReliable,
                lessonTitle: recommendation.lessonTitle,
                lessonLink: recommendation.lessonLink,
                lessonTopicTitle: recommendation.lessonTopicTitle,
                quizTitle: recommendation.quizTitle,
                quizLink: recommendation.quizLink,
                actionText:
                    recommendation.actionText ||
                    (skill.mastery < 50
                        ? 'راجع شرحًا قصيرًا ثم حل تدريبًا بسيطًا.'
                        : 'حل تدريبًا قصيرًا للتأكد من ثبات المستوى.'),
            };
        });
    }, [focusedReportSkills, lessons, quizzes, libraryItems, questions, skills, topics]);
    const studentTodayFocus = studentWeeklyPlan[0] || null;
    const studentQuickActions = useMemo(() => {
        if (!studentTodayFocus) return [];

        return [
            {
                title: 'راجع الشرح',
                body: studentTodayFocus.lessonTitle
                    ? displayText(studentTodayFocus.lessonTopicTitle || studentTodayFocus.lessonTitle)
                    : 'أقرب شرح لهذه المهارة.',
                label: studentTodayFocus.lessonLink ? 'فتح الشرح' : 'استعراض الشروحات',
                link: studentTodayFocus.lessonLink || '/courses',
                Icon: Video,
                className: 'border-indigo-100 bg-indigo-50 text-indigo-800',
            },
            {
                title: 'حل تدريب قصير',
                body: studentTodayFocus.quizTitle
                    ? displayText(studentTodayFocus.quizTitle)
                    : 'تدريب موجه على نفس المهارة.',
                label: studentTodayFocus.quizLink ? 'بدء التدريب' : 'اختيار تدريب',
                link: studentTodayFocus.quizLink || (studentTodayFocus.skillId ? `/quiz?skillIds=${encodeURIComponent(studentTodayFocus.skillId)}` : '/dashboard?tab=saher'),
                Icon: FileText,
                className: 'border-amber-100 bg-amber-50 text-amber-800',
            },
            {
                title: 'أعد القياس',
                body: 'اختبار قصير بعد الشرح والتدريب.',
                label: 'قياس التحسن',
                link: studentTodayFocus.quizLink || (studentTodayFocus.skillId ? `/quiz?skillIds=${encodeURIComponent(studentTodayFocus.skillId)}` : '/dashboard?tab=saher'),
                Icon: CheckCircle,
                className: 'border-emerald-100 bg-emerald-50 text-emerald-800',
            },
        ];
    }, [studentTodayFocus]);
    const studentFollowUpSummary = useMemo(() => {
        if (!isStudentView || !hasStudentAnalytics) return '';

        const weakest = focusedReportSkills[0];
        const nextTwo = focusedReportSkills.slice(0, 2).map((skill) => displayText(skill.skill)).filter(Boolean);
        const weaknessLabel = weakest?.isReliable ? 'ضعف مؤكد' : 'إشارة أولية';
        const parts = [
            `متوسطك الحالي ${stats?.averageScore || 0}%.`,
            studentTrackLabel ? `المسار: ${studentTrackLabel}.` : 'اختر مسارك حتى نرتب التقارير والاختبارات حسبه.',
            weakest ? `${weaknessLabel}: ${displayText(weakest.skill)} (${weakest.mastery}%) من ${weakest.attempts} محاولة.` : null,
            nextTwo.length ? `الأولوية: ${nextTwo.join('، ')}.` : null,
            'الخطوة: شرح قصير، تدريب بسيط، ثم إعادة قياس بعد عدة أسئلة.',
        ].filter(Boolean);

        return parts.join(' ');
    }, [focusedReportSkills, hasStudentAnalytics, isStudentView, stats?.averageScore, studentTrackLabel]);
    const copyStudentSummary = async () => {
        if (!studentFollowUpSummary) return;

        try {
            await navigator.clipboard.writeText(studentFollowUpSummary);
            setCopiedStudentSummary(true);
            window.setTimeout(() => setCopiedStudentSummary(false), 1800);
        } catch {
            setCopiedStudentSummary(false);
        }
    };
    const shareStudentSummary = async () => {
        if (!studentFollowUpSummary) return;

        try {
            await shareTextSummary('ملخص تقرير الطالب', studentFollowUpSummary);
            setSharedStudentSummary(true);
            window.setTimeout(() => setSharedStudentSummary(false), 1800);
        } catch {
            setSharedStudentSummary(false);
        }
    };
    const buildSmartRemediation = async () => {
        if (!focusedReportSkills.length) return;

        setSmartRemediationLoading(true);
        try {
            const response = await api.aiRemediationPlan({
                skills: focusedReportSkills.slice(0, 5),
                ageBand: 'general',
            });
            setSmartRemediation(response);
        } catch {
            setSmartRemediation({
                title: 'خطة علاجية قصيرة',
                summary: 'ابدأ بأضعف مهارة، راجع شرحًا بسيطًا، ثم حل تدريبًا قصيرًا وأعد القياس.',
                steps: focusedReportSkills.slice(0, 3).map((skill, index) => ({
                    day: `اليوم ${index + 1}`,
                    skill: [displayText(skill.subjectName), displayText(skill.sectionName), displayText(skill.skill)].filter(Boolean).join(' - '),
                    action: skill.mastery < 50 ? 'راجع شرحًا قصيرًا ثم حل 5 أسئلة سهلة.' : 'حل تدريبًا متدرجًا ثم راجع الأخطاء.',
                    check: 'أعد اختبارًا مصغرًا من 5 أسئلة على نفس المهارة.',
                })),
                parentNote: 'تابع التقدم بهدوء. المطلوب الآن خطوة صغيرة يوميًا وليس ضغطًا زائدًا.',
            });
        } finally {
            setSmartRemediationLoading(false);
        }
    };
    const scopedInterventionPlan = useMemo(() => {
        if (!scopedAnalytics) return [];

        const weakestScopedSkill = scopedAnalytics.weakestSkills[0];
        const weakestScopedStudent = scopedAnalytics.weakestStudents[0];
        const weakestScopedSubject = scopedAnalytics.subjectSummaries[0];

        return [
            {
                title: 'ابدأ بالمهارة الأكثر احتياجًا',
                label: weakestScopedSkill ? `${displayText(weakestScopedSkill.skill)} - ${weakestScopedSkill.mastery}%` : 'بانتظار بيانات مهارات أكثر',
                body: weakestScopedSkill
                    ? `وجّه شرحًا قصيرًا وتدريبًا علاجيًا للطلاب المتأثرين (${weakestScopedSkill.affectedStudents}) ثم أعد القياس باختبار قصير.`
                    : 'بعد أول محاولات كافية، سيظهر هنا أكثر محور يحتاج تدخلًا.',
                className: 'border-rose-100 bg-rose-50 text-rose-800',
            },
            {
                title: 'تابع الطالب الأكثر احتياجًا',
                label: weakestScopedStudent ? `${displayText(weakestScopedStudent.name)} - ${weakestScopedStudent.averageScore}%` : 'لا يوجد طالب يحتاج تدخلًا واضحًا',
                body: weakestScopedStudent
                    ? `ابدأ برسالة متابعة أو حصة قصيرة، وركّز على ${weakestScopedStudent.weakestSkills?.slice(0, 2).map((skill) => displayText(skill.skill)).join('، ') || 'المهارات الأضعف لديه'}.`
                    : 'عند ظهور طلاب يحتاجون دعمًا سيقترح النظام أول طالب تبدأ به.',
                className: 'border-amber-100 bg-amber-50 text-amber-800',
            },
            {
                title: 'حوّلها لخطة متابعة',
                label: weakestScopedSubject ? `${displayText(weakestScopedSubject.subjectName)} - ${weakestScopedSubject.mastery}%` : 'اختر مادة للمتابعة',
                body: weakestScopedSubject
                    ? `أنشئ اختبار متابعة أو تدريبًا قصيرًا في هذه المادة للطلاب الضعاف (${weakestScopedSubject.weakStudents}).`
                    : 'اربط الاختبارات بالمواد والمهارات حتى يظهر اقتراح المتابعة تلقائيًا.',
                className: 'border-indigo-100 bg-indigo-50 text-indigo-800',
            },
        ];
    }, [scopedAnalytics]);
    const scopedFollowUpSummary = useMemo(() => {
        if (!scopedAnalytics) return '';

        const weakestScopedSkill = scopedAnalytics.weakestSkills[0];
        const weakestScopedStudent = scopedAnalytics.weakestStudents[0];
        const weakestScopedSubject = scopedAnalytics.subjectSummaries[0];
        const parts = [
            `نطاق المتابعة: ${roleScopeTitle[user.role] || 'النطاق الحالي'}.`,
            `عدد الطلاب: ${scopedAnalytics.scope.studentCount}.`,
            `محاولات الاختبار: ${scopedAnalytics.scope.quizAttempts}.`,
            weakestScopedSkill ? `أضعف مهارة: ${displayText(weakestScopedSkill.skill)} (${weakestScopedSkill.mastery}%).` : null,
            weakestScopedStudent ? `أول طالب للمتابعة: ${displayText(weakestScopedStudent.name)} (${weakestScopedStudent.averageScore}%).` : null,
            weakestScopedSubject ? `المادة التي تحتاج تدخلًا: ${displayText(weakestScopedSubject.subjectName)} (${weakestScopedSubject.mastery}%).` : null,
            'الإجراء المقترح: شرح قصير، تدريب علاجي، ثم اختبار قياس قصير.',
        ].filter(Boolean);

        return parts.join(' ');
    }, [scopedAnalytics, user.role]);
    const copyScopedSummary = async () => {
        if (!scopedFollowUpSummary) return;

        try {
            await navigator.clipboard.writeText(scopedFollowUpSummary);
            setCopiedScopedSummary(true);
            window.setTimeout(() => setCopiedScopedSummary(false), 1800);
        } catch {
            setCopiedScopedSummary(false);
        }
    };
    const shareScopedSummary = async () => {
        if (!scopedFollowUpSummary) return;

        try {
            await shareTextSummary('ملخص متابعة الأداء', scopedFollowUpSummary);
            setSharedScopedSummary(true);
            window.setTimeout(() => setSharedScopedSummary(false), 1800);
        } catch {
            setSharedScopedSummary(false);
        }
    };
    const buildScopedSmartRemediation = async () => {
        if (!scopedAnalytics?.weakestSkills.length) return;

        setScopedSmartRemediationLoading(true);
        const skillPayload = scopedAnalytics.weakestSkills.slice(0, 5).map((skill) => ({
            skill: skill.skill,
            skillId: skill.skillId,
            mastery: skill.mastery,
            status: skill.mastery < 50 ? 'weak' : skill.mastery < 75 ? 'average' : 'strong',
            affectedStudents: skill.affectedStudents,
            attempts: skill.attempts,
        }));

        try {
            const response = await api.aiRemediationPlan({
                skills: skillPayload,
                ageBand: 'general',
            });
            setScopedSmartRemediation(response);
        } catch {
            setScopedSmartRemediation({
                title: 'خطة تدخل للنطاق الحالي',
                summary: 'ابدأ بالمهارة الأكثر ضعفًا، وجه شرحًا قصيرًا، ثم اختبار متابعة لقياس التحسن.',
                steps: skillPayload.slice(0, 3).map((skill, index) => ({
                    day: `خطوة ${index + 1}`,
                    skill: displayText(skill.skill),
                    action: index === 0 ? 'أنشئ شرحًا أو حصة قصيرة لهذه المهارة.' : 'وجّه تدريبًا علاجيًا للطلاب المتأثرين.',
                    check: 'أعد القياس باختبار قصير موجه لنفس المهارة.',
                })),
                parentNote: 'تابع الطلاب الضعاف بهدوء، واجعل التغذية الراجعة قصيرة وواضحة بعد كل محاولة.',
            });
        } finally {
            setScopedSmartRemediationLoading(false);
        }
    };
    const scopedLeadStudent = scopedAnalytics?.weakestStudents?.[0] || null;
    const scopedLeadSkill = scopedAnalytics?.weakestSkills?.[0] || null;
    const scopedLeadSubject = scopedAnalytics?.subjectSummaries?.[0] || null;
    const scopedAvailableGroups = useMemo(() => {
        const names = new Set<string>();
        (scopedAnalytics?.weakestStudents || []).forEach((student) => {
            (student.groupNames || []).forEach((name) => {
                const normalized = displayText(name);
                if (normalized) names.add(normalized);
            });
        });
        return Array.from(names);
    }, [scopedAnalytics?.weakestStudents]);
    const scopedFilteredStudents = useMemo(() => {
        if (!scopedAnalytics?.weakestStudents?.length) return [];
        if (scopedGroupFilter === 'all') return scopedAnalytics.weakestStudents;
        return scopedAnalytics.weakestStudents.filter((student) => (student.groupNames || []).some((name) => displayText(name) === scopedGroupFilter));
    }, [scopedAnalytics?.weakestStudents, scopedGroupFilter]);
    const scopedLatestResults = useMemo(() => {
        if (!scopedResults.length) return [];
        const filtered = scopedGroupFilter === 'all'
            ? scopedResults
            : scopedResults.filter((result) => {
                const student = scopedFilteredStudents.find((item) => item.id === result.userId);
                return !!student;
            });
        return filtered.slice(0, 6);
    }, [scopedResults, scopedGroupFilter, scopedFilteredStudents]);
    const showScopedAggregatedSections = scopedReportMode === 'combined' || scopedReportMode === 'aggregated';
    const showScopedIndividualSections = scopedReportMode === 'combined' || scopedReportMode === 'individual';
    const scopedLeadStudentSummary = useMemo(() => {
        if (!scopedLeadStudent) return '';

        const weakSkillsText = scopedLeadStudent.weakestSkills?.slice(0, 2).map((skill) => `${displayText(skill.skill)} (${skill.mastery}%)`).join('، ');
        return [
            `ابدأ بمتابعة ${displayText(scopedLeadStudent.name)}.`,
            `متوسطه الحالي ${scopedLeadStudent.averageScore}%.`,
            weakSkillsText ? `أبرز المهارات: ${weakSkillsText}.` : null,
            displayText(scopedLeadStudent.recommendedAction) ? `الإجراء المقترح: ${displayText(scopedLeadStudent.recommendedAction)}.` : 'الإجراء المقترح: شرح قصير ثم تدريب علاجي ثم إعادة قياس.',
        ].filter(Boolean).join(' ');
    }, [scopedLeadStudent]);
    const institutionalReportHub = useMemo(() => {
        if (user.role === Role.STUDENT || !scopedAnalytics) return null;

        const roleLabel =
            user.role === Role.ADMIN
                ? 'مدير المنصة'
                : user.role === Role.SUPERVISOR
                    ? 'مشرف'
                    : user.role === Role.TEACHER
                        ? 'معلم'
                        : 'ولي أمر';
        const nextAction = scopedLeadSkill
            ? `وجّه اختبار متابعة على ${displayText(scopedLeadSkill.skill)} للطلاب المتأثرين.`
            : scopedLeadStudent
                ? `ابدأ برسالة متابعة إلى ${displayText(scopedLeadStudent.name)}.`
                : 'انتظر نتائج أكثر أو وجّه اختبارًا تشخيصيًا قصيرًا.';
        const targetLine = scopedLeadStudent
            ? `${displayText(scopedLeadStudent.name)} يحتاج متابعة بمتوسط ${scopedLeadStudent.averageScore}%.`
            : scopedLeadSkill
                ? `${scopedLeadSkill.affectedStudents} طلاب متأثرون بمهارة ${displayText(scopedLeadSkill.skill)}.`
                : `${scopedAnalytics.scope.studentCount} طالب داخل النطاق.`;
        const resolvedSkill = scopedLeadSkill?.skillId ? skills.find((skill) => skill.id === scopedLeadSkill.skillId) : undefined;
        const followUpLink = user.role === Role.PARENT
            ? '/dashboard?tab=reports'
            : buildDirectedQuizManagerLink({
                pathId: resolvedSkill?.pathId,
                subjectId: resolvedSkill?.subjectId,
                sectionId: resolvedSkill?.sectionId,
                skillId: scopedLeadSkill?.skillId,
                targetUserId: scopedLeadStudent?.id,
            });
        const studentsLink =
            user.role === Role.ADMIN
                ? '/admin-dashboard?tab=users'
                : user.role === Role.SUPERVISOR
                    ? '/admin-dashboard?tab=groups'
                    : user.role === Role.TEACHER
                        ? '/admin-dashboard?tab=quizzes'
                        : '/dashboard?tab=reports';
        const alertLink = user.role === Role.ADMIN ? '/admin-dashboard?tab=notifications' : '/reports';
        const alertText = [
            `تنبيه متابعة من منصة المئة - ${roleLabel}`,
            targetLine,
            scopedLeadSkill ? `أولوية المهارة: ${displayText(scopedLeadSkill.skill)} (${scopedLeadSkill.mastery}%).` : null,
            scopedLeadSubject ? `المادة: ${displayText(scopedLeadSubject.subjectName)}.` : null,
            'المطلوب: شرح قصير، تدريب علاجي، ثم اختبار قياس قصير.',
        ].filter(Boolean).join('\n');

        return {
            roleLabel,
            nextAction,
            targetLine,
            followUpLink,
            studentsLink,
            alertLink,
            alertText,
        };
    }, [scopedAnalytics, scopedLeadSkill, scopedLeadStudent, scopedLeadSubject, skills, user.role]);
    const copyInstitutionalAlert = async () => {
        if (!institutionalReportHub?.alertText) return;

        try {
            await navigator.clipboard.writeText(institutionalReportHub.alertText);
            setCopiedInstitutionalAlert(true);
            window.setTimeout(() => setCopiedInstitutionalAlert(false), 1800);
        } catch {
            setCopiedInstitutionalAlert(false);
        }
    };
    const scopedSkillReportCards = useMemo(() => {
        return (scopedAnalytics?.weakestSkills || []).slice(0, 4).map((skill) => {
            const tone = skill.mastery < 50
                ? {
                    label: 'دعم عاجل',
                    card: 'border-rose-100 bg-rose-50/70',
                    text: 'text-rose-700',
                    bar: 'bg-rose-500',
                }
                : {
                    label: 'دعم قريب',
                    card: 'border-amber-100 bg-amber-50/70',
                    text: 'text-amber-700',
                    bar: 'bg-amber-500',
                };
            const recommendation = getSkillRecommendation(skill, skills, lessons, quizzes, libraryItems, questions, topics);

            return {
                ...skill,
                tone,
                lessonLink: recommendation.lessonLink,
                lessonTitle: recommendation.lessonTopicTitle || recommendation.lessonTitle,
                quizLink: recommendation.quizLink,
                quizTitle: recommendation.quizTitle,
            };
        });
    }, [lessons, libraryItems, questions, quizzes, scopedAnalytics?.weakestSkills, skills, topics]);
    const scopedStudentFocusCards = useMemo(() => {
        return scopedFilteredStudents.slice(0, 4).map((student) => {
            const topSkills = (student.weakestSkills || []).slice(0, 2);
            const primarySkillName = topSkills[0]?.skill;
            const resolvedSkill = primarySkillName
                ? skills.find((skill) => displayText(skill.name) === displayText(primarySkillName))
                : undefined;

            return {
                ...student,
                topSkills,
                followUpLink: buildDirectedQuizManagerLink({
                    pathId: resolvedSkill?.pathId,
                    subjectId: resolvedSkill?.subjectId,
                    sectionId: resolvedSkill?.sectionId,
                    skillId: resolvedSkill?.id,
                    targetUserId: student.id,
                    targetGroupId: student.groupIds?.[0],
                }),
                tone: student.averageScore < 50
                    ? 'border-rose-100 bg-rose-50/70 text-rose-700'
                    : 'border-amber-100 bg-amber-50/70 text-amber-700',
            };
        });
    }, [scopedFilteredStudents, skills]);
    const downloadScopedSkillsWorkbook = async () => {
        if (!scopedAnalytics?.weakestSkills?.length) return;

        const XLSX = await loadXlsx();
        const workbook = XLSX.utils.book_new();
        const rows = [
            ['المهارة', 'المحور', 'نسبة الإتقان', 'طلاب متأثرون', 'محاولات', 'الإجراء المقترح', 'شرح / دعم', 'اختبار موجه'],
            ...scopedSkillReportCards.map((skill) => [
                displayText(skill.skill) || '-',
                displayText(skill.section) || '-',
                `${skill.mastery}%`,
                skill.affectedStudents,
                skill.attempts,
                displayText(skill.recommendedAction) || 'شرح قصير ثم تدريب علاجي ثم اختبار متابعة.',
                displayText(skill.lessonTitle) || '-',
                displayText(skill.quizTitle) || '-',
            ]),
        ];

        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'skills-report');
        XLSX.writeFile(workbook, `skills-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };
    const downloadScopedStudentsWorkbook = async () => {
        if (!scopedAnalytics?.weakestStudents?.length) return;

        const XLSX = await loadXlsx();
        const workbook = XLSX.utils.book_new();
        const rows = [
            ['الطالب', 'المجموعات', 'متوسط الأداء', 'عدد المحاولات', 'مهارات تحتاج دعم', 'أبرز المهارات', 'الإجراء المقترح'],
            ...scopedStudentFocusCards.map((student) => [
                displayText(student.name) || '-',
                student.groupNames?.length ? student.groupNames.map((name) => displayText(name)).join('، ') : '-',
                `${student.averageScore}%`,
                student.attempts,
                student.weakSkillCount,
                student.topSkills.length ? student.topSkills.map((skill) => `${displayText(skill.skill)} ${skill.mastery}%`).join('، ') : '-',
                displayText(student.recommendedAction) || 'شرح قصير ثم تدريب موجه ثم قياس.',
            ]),
        ];

        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'students-report');
        XLSX.writeFile(workbook, `students-performance-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };
    const downloadStudentSkillsWorkbook = async () => {
        if (!aggregatedSkills.length) return;

        const XLSX = await loadXlsx();
        const workbook = XLSX.utils.book_new();
        const rows = [
            ['المادة', 'المهارة الرئيسية', 'المهارة', 'نسبة الإتقان', 'الحالة', 'شرح مقترح', 'تدريب مقترح'],
            ...aggregatedSkills.map((skill) => {
                const recommendation = getSkillRecommendation(skill, skills, lessons, quizzes, libraryItems, questions, topics);
                const tone = getReportMasteryTone(skill.mastery);

                return [
                    displayText(skill.subjectName) || '-',
                    displayText(skill.sectionName) || '-',
                    displayText(skill.skill) || '-',
                    `${skill.mastery}%`,
                    tone.label,
                    displayText(recommendation.lessonTitle || recommendation.lessonTopicTitle) || '-',
                    displayText(recommendation.quizTitle) || '-',
                ];
            }),
        ];

        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'my-skills');
        XLSX.writeFile(workbook, `my-skills-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };
    const downloadStudentAttemptsWorkbook = async () => {
        if (!examResults.length) return;

        const XLSX = await loadXlsx();
        const workbook = XLSX.utils.book_new();
        const rows = [
            ['اسم الاختبار', 'الدرجة', 'عدد الأسئلة', 'الصحيح', 'الخطأ', 'بدون إجابة', 'الوقت', 'التاريخ', 'أضعف مهارة'],
            ...examResults.map((result) => {
                const weakSkill = [...(result.skillsAnalysis || [])].sort((a, b) => Number(a.mastery || 0) - Number(b.mastery || 0))[0];

                return [
                    displayText(result.quizTitle) || '-',
                    `${result.score}%`,
                    result.totalQuestions,
                    result.correctAnswers,
                    result.wrongAnswers,
                    result.unanswered,
                    displayText(result.timeSpent) || '-',
                    displayText(result.date) || '-',
                    weakSkill ? `${displayText(weakSkill.skill)} ${Number(weakSkill.mastery || 0)}%` : '-',
                ];
            }),
        ];

        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'my-attempts');
        XLSX.writeFile(workbook, `my-attempts-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };
    const downloadPerformanceWorkbook = async () => {
        const XLSX = await loadXlsx();
        const workbook = XLSX.utils.book_new();
        const now = new Date().toLocaleString('ar-SA');
        const summaryRows = isStudentView
            ? [
                ['البند', 'القيمة'],
                ['نوع التقرير', 'تقرير طالب'],
                ['تاريخ التصدير', now],
                ['متوسط الأداء', `${stats?.averageScore || 0}%`],
                ['أفضل محور', `${displayText(stats?.bestSubject?.name)} - ${stats?.bestSubject?.score || 0}%`],
                ['أضعف محور', `${displayText(stats?.worstSubject?.name)} - ${stats?.worstSubject?.score || 0}%`],
                ['عدد المهارات الضعيفة', skillReadinessSummary.weak],
                ['عدد المهارات المتوسطة', skillReadinessSummary.average],
                ['عدد المهارات المطمئنة', skillReadinessSummary.strong],
                ['الملخص', studentFollowUpSummary || skillReadinessSummary.message],
            ]
            : [
                ['البند', 'القيمة'],
                ['نوع التقرير', roleScopeTitle[user.role] || 'تقرير نطاق'],
                ['تاريخ التصدير', now],
                ['عدد الطلاب', scopedAnalytics?.scope.studentCount || 0],
                ['عدد المجموعات', scopedAnalytics?.scope.groupCount || 0],
                ['محاولات الاختبار', scopedAnalytics?.scope.quizAttempts || 0],
                ['إجابات مرصودة', scopedAnalytics?.scope.questionAttempts || 0],
                ['أول مهارة تحتاج تدخل', displayText(scopedLeadSkill?.skill) || '-'],
                ['أول طالب للمتابعة', displayText(scopedLeadStudent?.name) || '-'],
                ['الملخص', scopedFollowUpSummary || 'لا توجد بيانات كافية بعد.'],
            ];

        const skillRows = isStudentView
            ? [
                ['المادة', 'المهارة الرئيسية', 'المهارة', 'نسبة الإتقان', 'الحالة', 'الإجراء المقترح', 'شرح مقترح', 'اختبار مقترح'],
                ...aggregatedSkills.map((skill) => {
                    const recommendation = getSkillRecommendation(skill, skills, lessons, quizzes, libraryItems, questions, topics);
                    const tone = getReportMasteryTone(skill.mastery);

                    return [
                        displayText(skill.subjectName) || '-',
                        displayText(skill.sectionName) || '-',
                        displayText(skill.skill) || '-',
                        `${skill.mastery}%`,
                        tone.label,
                        displayText(recommendation.actionText) || 'شرح قصير ثم تدريب ثم إعادة قياس.',
                        displayText(recommendation.lessonTitle) || '-',
                        displayText(recommendation.quizTitle) || '-',
                    ];
                }),
            ]
            : [
                ['المهارة', 'المهارة الرئيسية', 'نسبة الإتقان', 'طلاب متأثرون', 'محاولات', 'الإجراء المقترح'],
                ...(scopedAnalytics?.weakestSkills || []).map((skill) => [
                    displayText(skill.skill) || '-',
                    displayText(skill.section) || '-',
                    `${skill.mastery}%`,
                    skill.affectedStudents,
                    skill.attempts,
                    displayText(skill.recommendedAction) || 'شرح قصير ثم تدريب علاجي ثم اختبار متابعة.',
                ]),
            ];

        const actionRows = isStudentView
            ? [
                ['اليوم', 'المادة', 'المهارة الرئيسية', 'المهارة', 'الإتقان', 'الخطوة العملية', 'شرح', 'رابط الشرح', 'اختبار', 'رابط الاختبار'],
                ...studentWeeklyPlan.map((step) => [
                    displayText(step.day),
                    displayText(step.subjectName) || '-',
                    displayText(step.sectionName) || '-',
                    displayText(step.skill) || '-',
                    `${step.mastery}%`,
                    displayText(step.actionText) || '-',
                    displayText(step.lessonTitle) || '-',
                    step.lessonLink || '-',
                    displayText(step.quizTitle) || '-',
                    step.quizLink || '-',
                ]),
            ]
            : [
                ['الأولوية', 'العنوان', 'التفصيل', 'الإجراء العملي'],
                ...scopedInterventionPlan.map((item, index) => [
                    index + 1,
                    displayText(item.title),
                    displayText(item.label),
                    displayText(item.body),
                ]),
            ];

        const attemptsRows = [
            ['اسم الاختبار', 'الدرجة', 'عدد الأسئلة', 'الصحيح', 'الخطأ', 'بدون إجابة', 'الوقت', 'التاريخ'],
            ...examResults.map((result) => [
                displayText(result.quizTitle) || '-',
                `${result.score}%`,
                result.totalQuestions,
                result.correctAnswers,
                result.wrongAnswers,
                result.unanswered,
                displayText(result.timeSpent) || '-',
                displayText(result.date) || '-',
            ]),
        ];

        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'summary');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(skillRows), 'skills');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(actionRows), 'action-plan');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(attemptsRows), 'attempts');
        XLSX.writeFile(workbook, isStudentView ? 'student-performance-report.xlsx' : 'scoped-performance-report.xlsx');
    };

    if (isStudentView && !hasStudentAnalytics) {
        return (
            <div className="space-y-6 pb-20 animate-fade-in">
                <header className="flex items-center gap-3 sm:gap-4">
                    <Link to="/dashboard" className="text-gray-500 hover:text-gray-700">
                        <ArrowRight size={24} />
                    </Link>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">تقارير الأداء</h1>
                        <p className="text-sm text-gray-500">نظرة شاملة على مستوى التقدم</p>
                    </div>
                </header>
                <Card className="p-12 text-center flex flex-col items-center justify-center border-dashed border-2 border-gray-200">
                    <div className="w-20 h-20 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-4">
                        <PieChart size={40} />
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-2 leading-tight">لا توجد بيانات كافية</h2>
                    <p className="text-gray-500 mb-6">قم بإجراء بعض الاختبارات لنتمكن من تحليل أدائك وتقديم توصيات مخصصة لك.</p>
                    <Link to="/quiz" className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                        ابدأ أول اختبار
                    </Link>
                </Card>
            </div>
        );
    }

    if (user.role === Role.PARENT) {
        const latestResult = scopedLatestResults[0];
        const averageScore = scopedResults.length
            ? Math.round(scopedResults.reduce((total, result) => total + (Number(result.score) || 0), 0) / scopedResults.length)
            : 0;
        const weakSkill = scopedAnalytics?.weakestSkills?.[0] || null;
        const leadStudent = scopedAnalytics?.weakestStudents?.[0] || null;
        const parentWeakSkillRecommendation = getSkillRecommendation(weakSkill || undefined, skills, lessons, quizzes, libraryItems, questions, topics);
        const parentSkillActions = [
            parentWeakSkillRecommendation.lessonLink
                ? {
                    title: 'فتح الشرح',
                    body: displayText(parentWeakSkillRecommendation.lessonTopicTitle || parentWeakSkillRecommendation.lessonTitle) || 'شرح المهارة الأضعف',
                    link: parentWeakSkillRecommendation.lessonLink,
                    Icon: BookOpen,
                    className: 'border-indigo-100 bg-indigo-50 text-indigo-800 hover:bg-indigo-100',
                }
                : null,
            parentWeakSkillRecommendation.quizLink
                ? {
                    title: 'بدء تدريب',
                    body: displayText(parentWeakSkillRecommendation.quizTitle) || 'تدريب قصير على نفس المهارة',
                    link: parentWeakSkillRecommendation.quizLink,
                    Icon: FileText,
                    className: 'border-amber-100 bg-amber-50 text-amber-800 hover:bg-amber-100',
                }
                : null,
            weakSkill
                ? {
                    title: 'حصة علاجية',
                    body: 'عند تكرار الضعف في نفس المهارة',
                    link: buildSkillSessionLink({ skill: weakSkill.skill, skillId: weakSkill.skillId, sectionName: weakSkill.section }),
                    Icon: Clock,
                    className: 'border-emerald-100 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
                }
                : null,
        ].filter(Boolean) as Array<{ title: string; body: string; link: string; Icon: LucideIcon; className: string }>;
        const parentBriefSummary = scopedFollowUpSummary || [
            `الأداء العام ${averageScore}%.`,
            weakSkill ? `ابدأ بمتابعة ${displayText(weakSkill.skill)}.` : null,
            leadStudent ? `أكثر طالب يحتاج متابعة الآن: ${displayText(leadStudent.name)}.` : null,
            'الخطوة العملية: شرح قصير، تدريب بسيط، ثم إعادة قياس هادئة.',
        ].filter(Boolean).join(' ');
        const parentActionItems = [
            {
                title: 'اليوم',
                body: weakSkill
                    ? `${displayText(weakSkill.skill)}: شرح قصير ثم سؤالان.`
                    : 'ابدأ باختبار قصير لتظهر المهارة الأضعف.',
                tone: 'bg-emerald-50 text-emerald-800 border-emerald-100',
            },
            {
                title: 'بعد الشرح',
                body: '5 أسئلة فقط على نفس الفكرة.',
                tone: 'bg-indigo-50 text-indigo-800 border-indigo-100',
            },
            {
                title: 'نهاية الأسبوع',
                body: averageScore < 60
                    ? 'أعد القياس، وإن بقي الضعف احجز حصة.'
                    : 'أعد قياسًا بسيطًا ثم انتقل لمهارة أخرى.',
                tone: 'bg-amber-50 text-amber-800 border-amber-100',
            },
        ];

        return (
            <div id="reports-print-area" className="space-y-6 pb-20 animate-fade-in">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <Link to="/dashboard" className="text-gray-500 hover:text-gray-700">
                            <ArrowRight size={24} />
                        </Link>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">تقرير ولي الأمر</h1>
                            <p className="text-sm text-gray-500">ملخص بسيط وواضح عن أداء الأبناء بدون تفاصيل مرهقة.</p>
                        </div>
                    </div>
                    <div className="print-hide flex flex-wrap gap-2">
                        <button
                            onClick={copyScopedSummary}
                            disabled={!parentBriefSummary}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {copiedScopedSummary ? <CheckCircle size={16} /> : <Copy size={16} />}
                            {copiedScopedSummary ? 'تم النسخ' : 'نسخ الملخص'}
                        </button>
                        <button
                            onClick={shareScopedSummary}
                            disabled={!parentBriefSummary}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-white px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {sharedScopedSummary ? <CheckCircle size={16} /> : <Share2 size={16} />}
                            {sharedScopedSummary ? 'تمت المشاركة' : 'مشاركة'}
                        </button>
                        <button
                            onClick={() => printElementAsPdf('reports-print-area', 'تقرير ولي الأمر')}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-white px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm hover:bg-emerald-50"
                        >
                            <Download size={16} />
                            تحميل PDF
                        </button>
                    </div>
                </header>

                {scopedAnalyticsLoading ? (
                    <Card className="p-8 text-center text-sm font-bold text-gray-500">
                        جارٍ تحميل تقرير الأبناء...
                    </Card>
                ) : !scopedAnalytics || scopedResults.length === 0 ? (
                    <Card className="p-10 text-center">
                        <PieChart size={42} className="mx-auto mb-4 text-gray-300" />
                        <h2 className="text-xl font-black text-gray-900">لا توجد نتائج بعد</h2>
                        <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-gray-500">
                            بعد أن يحل الطالب أول اختبار ستظهر هنا الدرجة، آخر محاولة، والمهارة التي تحتاج متابعة.
                        </p>
                    </Card>
                ) : (
                    <>
                        <Card className="overflow-hidden border border-emerald-100 bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <div className="mb-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">الملخص السريع</div>
                                    <h2 className="text-2xl font-black text-gray-900">الأداء العام {averageScore}%</h2>
                                    <p className="mt-2 max-w-2xl text-sm leading-7 text-gray-600">
                                        {averageScore >= 80
                                            ? 'الأداء مطمئن. استمر في متابعة تدريب قصير أسبوعيًا.'
                                            : averageScore >= 60
                                                ? 'المستوى جيد، ويحتاج مراجعة هادئة للمهارات الأضعف.'
                                                : 'يحتاج الطالب متابعة قريبة، ابدأ بمهارة واحدة فقط حتى لا تزيد عليه الضغط.'}
                                    </p>
                                </div>
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div className="rounded-2xl bg-emerald-50 p-4">
                                        <div className="text-2xl font-black text-emerald-700">{scopedAnalytics.scope.studentCount}</div>
                                        <div className="mt-1 text-xs font-bold text-emerald-700">أبناء</div>
                                    </div>
                                    <div className="rounded-2xl bg-indigo-50 p-4">
                                        <div className="text-2xl font-black text-indigo-700">{scopedAnalytics.scope.quizAttempts}</div>
                                        <div className="mt-1 text-xs font-bold text-indigo-700">محاولات</div>
                                    </div>
                                    <div className="rounded-2xl bg-amber-50 p-4">
                                        <div className="text-2xl font-black text-amber-700">{scopedAnalytics.weakestSkills.length}</div>
                                        <div className="mt-1 text-xs font-bold text-amber-700">مهارات</div>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-5 border-emerald-100 bg-white">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                                        ملخص ولي الأمر
                                    </div>
                                    <h2 className="mt-3 text-xl font-black text-gray-900">المتابعة اليوم</h2>
                                    <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-600">
                                        {parentBriefSummary}
                                    </p>
                                </div>
                                <Link
                                    to="/book-session"
                                    className="print-hide inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white hover:bg-emerald-700"
                                >
                                    <Clock size={15} />
                                    حصة علاجية عند الحاجة
                                </Link>
                            </div>
                            <div className="mt-5 grid gap-3 md:grid-cols-3">
                                {parentActionItems.map((item) => (
                                    <div key={item.title} className={`rounded-2xl border p-4 ${item.tone}`}>
                                        <div className="text-xs font-black opacity-80">{item.title}</div>
                                        <p className="mt-2 text-sm font-bold leading-7">{item.body}</p>
                                    </div>
                                ))}
                            </div>
                            {parentSkillActions.length > 0 ? (
                                <div className="print-hide mt-4 grid gap-3 md:grid-cols-3">
                                    {parentSkillActions.map(({ title, body, link, Icon, className }) => (
                                        <Link
                                            key={title}
                                            to={link}
                                            className={`flex min-h-[88px] flex-col justify-between rounded-2xl border p-3 transition ${className}`}
                                        >
                                            <div className="flex items-center gap-2 text-sm font-black">
                                                <Icon size={17} />
                                                {title}
                                            </div>
                                            <div className="mt-2 text-xs font-bold leading-5 opacity-80">{body}</div>
                                        </Link>
                                    ))}
                                </div>
                            ) : null}
                            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-600">
                                المهارات الظاهرة هنا مبنية على {scopedAnalytics.scope.minSkillEvidence || MIN_SKILL_EVIDENCE_COUNT} محاولات أو أكثر، والإشارات الأولية لا تُحسب ضعفًا مؤكدًا.
                            </div>
                        </Card>

                        <div className="grid gap-4 lg:grid-cols-3">
                            <Card className="p-5">
                                <div className="text-xs font-bold text-gray-500">آخر نتيجة</div>
                                <div className="mt-3 text-xl font-black text-gray-900">{displayText(latestResult?.quizTitle) || 'لا يوجد اختبار'}</div>
                                <div className="mt-2 text-sm text-gray-500">{displayText(latestResult?.studentName || latestResult?.studentEmail) || 'طالب مرتبط'}</div>
                                <div className={`mt-4 inline-flex rounded-2xl border px-4 py-3 text-2xl font-black ${scoreTone(Number(latestResult?.score) || 0)}`}>
                                    {Math.round(Number(latestResult?.score) || 0)}%
                                </div>
                            </Card>

                            <Card className="p-5">
                                <div className="text-xs font-bold text-gray-500">أهم مهارة تحتاج متابعة</div>
                                <div className="mt-3 text-xl font-black text-gray-900">{displayText(weakSkill?.skill) || 'بانتظار بيانات المهارات'}</div>
                                <div className="mt-2 text-sm text-gray-500">{displayText(weakSkill?.section) || 'مهارة عامة'}</div>
                                <div className="mt-4 rounded-full bg-gray-100 h-2 overflow-hidden">
                                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(0, Math.min(100, Number(weakSkill?.mastery) || 0))}%` }} />
                                </div>
                                <div className="mt-2 text-xs font-bold text-amber-700">الإتقان: {Math.round(Number(weakSkill?.mastery) || 0)}%</div>
                            </Card>

                            <Card className="p-5">
                                <div className="text-xs font-bold text-gray-500">المتابعة المقترحة</div>
                                <div className="mt-3 text-xl font-black text-gray-900">{displayText(leadStudent?.name) || 'كل الأبناء'}</div>
                                <p className="mt-3 text-sm leading-7 text-gray-600">شرح قصير ثم تدريب بسيط.</p>
                            </Card>
                        </div>

                        <Card className="p-5">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-black text-gray-900">آخر المحاولات</h2>
                                    <p className="mt-1 text-sm text-gray-500">قائمة مختصرة تكفي للمتابعة اليومية.</p>
                                </div>
                                <Link to="/dashboard?tab=parent-results" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-100">
                                    عرض النتائج
                                </Link>
                            </div>
                            <div className="space-y-3">
                                {scopedLatestResults.slice(0, 4).map((result) => (
                                    <div key={result.id || result._id || `${result.quizTitle}-${result.date}`} className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <div className="font-black text-gray-900">{displayText(result.quizTitle)}</div>
                                            <div className="mt-1 text-xs font-bold text-gray-500">{displayText(result.studentName || result.studentEmail) || 'طالب مرتبط'} - {displayText(result.date || result.createdAt) || 'تاريخ غير محدد'}</div>
                                        </div>
                                        <div className={`self-start rounded-xl border px-3 py-2 text-lg font-black sm:self-auto ${scoreTone(Number(result.score) || 0)}`}>
                                            {Math.round(Number(result.score) || 0)}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </>
                )}
            </div>
        );
    }

    return (
        <div id="reports-print-area" className="space-y-8 pb-20 animate-fade-in">
            {/* Header */}
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                    <Link to="/dashboard" className="text-gray-500 hover:text-gray-700">
                        <ArrowRight size={24} />
                    </Link>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">تقارير الأداء</h1>
                        <p className="text-sm text-gray-500">تحليل ذكي لمستواك بناءً على نتائج اختباراتك</p>
                    </div>
                </div>
                <div className="print-hide flex flex-wrap gap-2">
                    <button
                        onClick={() => printElementAsPdf('reports-print-area', 'تقرير الأداء')}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs font-black text-indigo-700 shadow-sm hover:bg-indigo-50 sm:text-sm"
                    >
                        <Download size={15} />
                        PDF
                    </button>
                    <button
                        onClick={downloadPerformanceWorkbook}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-black text-emerald-700 shadow-sm hover:bg-emerald-50 sm:text-sm"
                    >
                        <FileText size={15} />
                        Excel
                    </button>
                    {isStudentView && hasStudentAnalytics ? (
                    <button
                        onClick={() => setStudentReportDepth((current) => (current === 'simple' ? 'full' : 'simple'))}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50 sm:text-sm"
                    >
                        <Sparkles size={15} />
                        {isStudentReportFull ? 'ملخص' : 'تفاصيل'}
                    </button>
                    ) : null}
                </div>
            </header>

            {!isStudentView ? (
            <Card className="p-4 sm:p-6 border-0 shadow-sm bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white overflow-hidden relative">
                <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-12 right-10 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl" />
                <div className="relative z-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                    <div>
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-indigo-100">
                            <Sparkles size={14} />
                            القرار السريع من التقرير
                        </div>
                        <h2 className="text-2xl font-black leading-9">
                            {isStudentView ? 'ابدأ بخطوة واحدة واضحة اليوم' : 'ابدأ التدخل من أعلى نقطة تأثير'}
                        </h2>
                        <p className="mt-3 max-w-3xl text-sm leading-8 text-indigo-100">
                            {isStudentView
                                ? (studentFollowUpSummary || 'حل اختبارًا قصيرًا أولًا حتى نحدد المهارة التي تحتاج متابعة.')
                                : (scopedFollowUpSummary || 'بمجرد تحميل بيانات النطاق سيظهر هنا ملخص سريع للطالب أو المهارة التي تحتاج تدخلًا.')}
                        </p>
                        <div className="print-hide mt-4 flex flex-wrap gap-2">
                            {isStudentView ? (
                                <>
                                    <button
                                        onClick={copyStudentSummary}
                                        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-900 hover:bg-indigo-50"
                                    >
                                        {copiedStudentSummary ? <CheckCircle size={16} /> : <Copy size={16} />}
                                        {copiedStudentSummary ? 'تم النسخ' : 'نسخ ملخص ولي الأمر'}
                                    </button>
                                    <button
                                        onClick={shareStudentSummary}
                                        className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/15"
                                    >
                                        {sharedStudentSummary ? <CheckCircle size={16} /> : <Share2 size={16} />}
                                        {sharedStudentSummary ? 'تمت المشاركة' : 'مشاركة الملخص'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={copyScopedSummary}
                                        disabled={!scopedFollowUpSummary}
                                        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-900 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {copiedScopedSummary ? <CheckCircle size={15} /> : <Copy size={15} />}
                                        {copiedScopedSummary ? 'تم' : 'نسخ'}
                                    </button>
                                    <button
                                        onClick={shareScopedSummary}
                                        disabled={!scopedFollowUpSummary}
                                        className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {sharedScopedSummary ? <CheckCircle size={15} /> : <Share2 size={15} />}
                                        {sharedScopedSummary ? 'تم' : 'مشاركة'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                        <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                            <div className="text-xs font-bold text-indigo-100">أهم مؤشر</div>
                            <div className="mt-2 text-xl font-black">
                                {isStudentView ? `${stats?.averageScore ?? 0}%` : `${scopedAnalytics?.scope.studentCount ?? 0} طالب`}
                            </div>
                            <div className="mt-1 text-xs font-bold text-indigo-100">
                                {isStudentView ? 'متوسط الأداء' : 'داخل نطاق المتابعة'}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                            <div className="text-xs font-bold text-indigo-100">أولوية الآن</div>
                            <div className="mt-2 text-sm font-black leading-6">
                                {isStudentView
                                    ? displayText(weakestSkill?.skill) || 'ابدأ باختبار قصير'
                                    : displayText(scopedAnalytics?.weakestSkills?.[0]?.skill) || 'بانتظار بيانات المهارات'}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                            <div className="text-xs font-bold text-indigo-100">الخطوة التالية</div>
                            <div className="mt-2 text-sm font-bold leading-6">
                                {isStudentView ? 'شرح قصير + تدريب + إعادة قياس' : 'تدخل موجه + اختبار متابعة'}
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
            ) : null}

            {!isStudentView && (
                <Card className="p-4 border-0 shadow-sm bg-white">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-black text-gray-900 leading-tight">تقارير الدور</h2>
                            <p className="text-sm text-gray-500 mt-1">{roleScopeTitle[user.role] || 'نطاقك الحالي'}</p>
                        </div>
                        <div className="text-xs px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold">
                            {user.role === Role.ADMIN ? 'مدير' : user.role === Role.SUPERVISOR ? 'مشرف' : user.role === Role.TEACHER ? 'معلم' : 'ولي أمر'}
                        </div>
                    </div>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setScopedReportMode('combined')}
                            className={`rounded-full px-3 py-1.5 text-xs font-black transition ${scopedReportMode === 'combined' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                        >
                            عرض كامل
                        </button>
                        <button
                            type="button"
                            onClick={() => setScopedReportMode('aggregated')}
                            className={`rounded-full px-3 py-1.5 text-xs font-black transition ${scopedReportMode === 'aggregated' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                        >
                            تقرير مجمّع
                        </button>
                        <button
                            type="button"
                            onClick={() => setScopedReportMode('individual')}
                            className={`rounded-full px-3 py-1.5 text-xs font-black transition ${scopedReportMode === 'individual' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                        >
                            تقرير مفرد
                        </button>
                        {scopedAvailableGroups.length > 0 ? (
                            <select
                                value={scopedGroupFilter}
                                onChange={(event) => setScopedGroupFilter(event.target.value)}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 focus:border-indigo-400 focus:outline-none"
                            >
                                <option value="all">كل المجموعات</option>
                                {scopedAvailableGroups.map((groupName) => (
                                    <option key={groupName} value={groupName}>{groupName}</option>
                                ))}
                            </select>
                        ) : null}
                    </div>

                    {scopedAnalyticsLoading ? (
                        <div className="text-sm text-gray-500">جارٍ تحميل التقارير المجمعة...</div>
                    ) : scopedAnalytics ? (
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="rounded-2xl bg-gray-50 p-3">
                                    <div className="text-xs text-gray-500 mb-1">الطلاب داخل النطاق</div>
                                    <div className="text-xl font-black text-gray-900">{scopedAnalytics.scope.studentCount}</div>
                                </div>
                                <div className="rounded-2xl bg-amber-50 p-3">
                                    <div className="text-xs text-amber-600 mb-1">المحاولات</div>
                                    <div className="text-xl font-black text-amber-700">{scopedAnalytics.scope.quizAttempts}</div>
                                </div>
                                <div className="rounded-2xl bg-rose-50 p-3">
                                    <div className="text-xs text-rose-600 mb-1">بحاجة متابعة</div>
                                    <div className="text-xl font-black text-rose-700">{scopedAnalytics.weakestStudents.length}</div>
                                </div>
                                <div className="rounded-2xl bg-purple-50 p-3">
                                    <div className="text-xs text-purple-600 mb-1">إجابات</div>
                                    <div className="text-xl font-black text-purple-700">{scopedAnalytics.scope.questionAttempts || 0}</div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold leading-6 text-slate-600">
                                يتم عرض المهارات الضعيفة المؤكدة فقط بعد {scopedAnalytics.scope.minSkillEvidence || MIN_SKILL_EVIDENCE_COUNT} محاولات أو أكثر.
                                {scopedAnalytics.scope.earlyWeakSkillSignalCount ? ` توجد ${scopedAnalytics.scope.earlyWeakSkillSignalCount} إشارة أولية تحتاج قياسًا إضافيًا قبل الحكم.` : ''}
                            </div>

                            {institutionalReportHub ? (
                                <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-4">
                                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                        <div className="min-w-0">
                                            <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700">
                                                مركز متابعة مؤسسي
                                            </div>
                                            <h3 className="mt-2 text-lg font-black leading-7 text-gray-900">
                                                {institutionalReportHub.roleLabel}: خطوة تشغيل واضحة
                                            </h3>
                                            <p className="mt-1 text-sm font-bold leading-7 text-gray-600">
                                                {institutionalReportHub.nextAction}
                                            </p>
                                        </div>
                                        <div className="print-hide grid gap-2 sm:grid-cols-2 xl:min-w-[520px]">
                                            <Link
                                                to={institutionalReportHub.followUpLink}
                                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-indigo-700"
                                            >
                                                <Target size={14} />
                                                توجيه اختبار
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={copyInstitutionalAlert}
                                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-700 shadow-sm hover:bg-emerald-50"
                                            >
                                                {copiedInstitutionalAlert ? <CheckCircle size={14} /> : <Copy size={14} />}
                                                {copiedInstitutionalAlert ? 'تم النسخ' : 'نسخ تنبيه'}
                                            </button>
                                            <Link
                                                to={institutionalReportHub.studentsLink}
                                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50"
                                            >
                                                <FileText size={14} />
                                                إدارة النطاق
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={downloadScopedStudentsWorkbook}
                                                disabled={!scopedStudentFocusCards.length}
                                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black text-rose-700 shadow-sm hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <Download size={14} />
                                                تصدير الطلاب
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                                        <div className="rounded-2xl bg-white/80 px-3 py-2 text-xs font-bold leading-6 text-slate-600">
                                            النطاق: {roleScopeTitle[user.role] || 'النطاق الحالي'}
                                        </div>
                                        <div className="rounded-2xl bg-white/80 px-3 py-2 text-xs font-bold leading-6 text-slate-600">
                                            الهدف: {institutionalReportHub.targetLine}
                                        </div>
                                        <Link
                                            to={institutionalReportHub.alertLink}
                                            className="print-hide rounded-2xl bg-white/80 px-3 py-2 text-xs font-black leading-6 text-indigo-700 hover:bg-white"
                                        >
                                            فتح مركز التنبيهات
                                        </Link>
                                    </div>
                                </div>
                            ) : null}

                            <div className={`grid gap-4 ${showScopedAggregatedSections && showScopedIndividualSections ? 'xl:grid-cols-[1.25fr_0.95fr]' : 'xl:grid-cols-1'}`}>
                                {showScopedAggregatedSections ? (
                                <div className="rounded-3xl border border-indigo-100 bg-white p-4">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <div className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                                                تقرير مهارات مجمع
                                            </div>
                                            <h3 className="mt-2 text-lg font-black text-gray-900">مهارات تحتاج دعم</h3>
                                        </div>
                                        <div className="print-hide flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">
                                                {scopedSkillReportCards.length} أولويات
                                            </span>
                                            <button
                                                type="button"
                                                onClick={downloadScopedSkillsWorkbook}
                                                disabled={!scopedSkillReportCards.length}
                                                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-black text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <Download size={13} />
                                                Excel
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        {scopedSkillReportCards.length > 0 ? scopedSkillReportCards.map((skill) => (
                                            <div key={skill.skillId || skill.skill} className={`rounded-2xl border p-3 ${skill.tone.card}`}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <span className={`rounded-full bg-white px-3 py-1 text-[11px] font-black ${skill.tone.text}`}>
                                                            {skill.tone.label}
                                                        </span>
                                                        <div className="mt-2 text-base font-black leading-6 text-gray-900">{displayText(skill.skill)}</div>
                                                        <div className="mt-1 text-xs font-bold text-gray-500">{displayText(skill.section) || 'مهارة عامة'}</div>
                                                    </div>
                                                    <div className={`text-xl font-black ${skill.tone.text}`}>{skill.mastery}%</div>
                                                </div>
                                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                                                    <div className={`h-full rounded-full ${skill.tone.bar}`} style={{ width: `${Math.max(0, Math.min(100, skill.mastery))}%` }} />
                                                </div>
                                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold">
                                                    <div className="rounded-xl bg-white/80 px-3 py-1.5">طلاب: {skill.affectedStudents}</div>
                                                    <div className="rounded-xl bg-white/80 px-3 py-1.5">محاولات: {skill.attempts}</div>
                                                </div>
                                                <div className="print-hide mt-2 grid gap-2 sm:grid-cols-2">
                                                    <Link
                                                        to={skill.quizLink || '/quiz'}
                                                        className="rounded-xl bg-white px-3 py-2 text-center text-xs font-black text-amber-700 hover:bg-amber-50"
                                                    >
                                                        اختبار
                                                    </Link>
                                                    <Link
                                                        to={skill.lessonLink || buildSkillSessionLink({ skill: skill.skill, skillId: skill.skillId, sectionName: skill.section })}
                                                        className="rounded-xl bg-white px-3 py-2 text-center text-xs font-black text-indigo-700 hover:bg-indigo-50"
                                                    >
                                                        شرح
                                                    </Link>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="rounded-2xl border border-dashed border-gray-200 bg-slate-50 p-5 text-sm font-bold leading-7 text-gray-500 md:col-span-2">
                                                لا توجد مهارات ضعيفة مجمعة الآن.
                                            </div>
                                        )}
                                    </div>
                                </div>
                                ) : null}

                                {showScopedIndividualSections ? (
                                <div className="rounded-3xl border border-rose-100 bg-white p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">
                                                تقرير الطلاب
                                            </div>
                                            <h3 className="mt-2 text-lg font-black text-gray-900">طلاب للمتابعة</h3>
                                        </div>
                                        <div className="print-hide flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">
                                                {scopedStudentFocusCards.length}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={downloadScopedStudentsWorkbook}
                                                disabled={!scopedStudentFocusCards.length}
                                                className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-black text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <Download size={13} />
                                                Excel
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        {scopedStudentFocusCards.length > 0 ? scopedStudentFocusCards.map((student) => (
                                            <div key={student.id} className="rounded-2xl border border-gray-100 bg-slate-50 p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="font-black leading-7 text-gray-900">{displayText(student.name)}</div>
                                                        <div className="mt-1 text-xs font-bold text-gray-500">{student.attempts} محاولات - {student.weakSkillCount} مهارات</div>
                                                        {student.groupNames?.length ? (
                                                            <div className="mt-1 text-[11px] font-black text-indigo-600">
                                                                {student.groupNames.slice(0, 2).map((name) => displayText(name)).join('، ')}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                    <div className={`rounded-xl border px-3 py-1.5 text-base font-black ${student.tone}`}>
                                                        {student.averageScore}%
                                                    </div>
                                                </div>
                                                {student.topSkills.length > 0 ? (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {student.topSkills.map((skill) => (
                                                            <span key={`${student.id}-${skill.skill}`} className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-rose-700">
                                                                {displayText(skill.skill)} {skill.mastery}%
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null}
                                                <div className="print-hide mt-2 flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => navigator.clipboard.writeText([
                                                            `الطالب: ${displayText(student.name)}`,
                                                            `المتوسط: ${student.averageScore}%`,
                                                            student.topSkills.length ? `المهارات: ${student.topSkills.map((skill) => `${displayText(skill.skill)} ${skill.mastery}%`).join('، ')}` : '',
                                                            'الخطوة: شرح قصير ثم تدريب موجه ثم قياس.'
                                                        ].filter(Boolean).join('\n')).catch(() => undefined)}
                                                        className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-indigo-700 hover:bg-indigo-50"
                                                    >
                                                        نسخ
                                                    </button>
                                                    <Link to={student.followUpLink} className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-black text-white hover:bg-indigo-700">
                                                        توجيه اختبار
                                                    </Link>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="rounded-2xl border border-dashed border-gray-200 bg-slate-50 p-5 text-sm font-bold leading-7 text-gray-500">
                                                لا يوجد طالب يحتاج متابعة واضحة الآن.
                                            </div>
                                        )}
                                    </div>
                                </div>
                                ) : null}
                            </div>

                            <div className="rounded-3xl border border-gray-100 bg-slate-50/70 p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
                                    <div>
                                        <div className="text-lg font-black text-gray-900">خطة تدخل مختصرة</div>
                                        <p className="text-sm leading-6 text-gray-500">تشخيص، تدخل، ثم قياس.</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={copyScopedSummary}
                                            className="print-hide inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700 hover:bg-indigo-50"
                                        >
                                            {copiedScopedSummary ? <CheckCircle size={13} /> : <Copy size={13} />}
                                            {copiedScopedSummary ? 'تم' : 'نسخ'}
                                        </button>
                                        <button
                                            onClick={shareScopedSummary}
                                            className="print-hide inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700 hover:bg-emerald-50"
                                        >
                                            {sharedScopedSummary ? <CheckCircle size={13} /> : <Share2 size={13} />}
                                            {sharedScopedSummary ? 'تم' : 'مشاركة'}
                                        </button>
                                        <button
                                            onClick={buildScopedSmartRemediation}
                                            disabled={scopedSmartRemediationLoading || !scopedAnalytics.weakestSkills.length}
                                            className="print-hide inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {scopedSmartRemediationLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                            {scopedSmartRemediationLoading ? 'تجهيز' : 'اقتراح'}
                                        </button>
                                    </div>
                                </div>
                                {scopedFollowUpSummary ? (
                                    <div className="mb-3 rounded-2xl border border-white bg-white/70 p-3 text-xs font-bold leading-6 text-slate-600">
                                        {scopedFollowUpSummary}
                                    </div>
                                ) : null}
                                <div className="mb-3 grid gap-3 lg:grid-cols-3">
                                    <div className="rounded-2xl border border-rose-100 bg-white p-3">
                                        <div className="text-xs font-black text-rose-600">أولوية الطالب</div>
                                        <div className="mt-2 text-base font-black leading-6 text-gray-900">
                                            {displayText(scopedLeadStudent?.name) || 'بانتظار ظهور طالب يحتاج متابعة'}
                                        </div>
                                        <p className="mt-2 text-xs font-bold leading-6 text-gray-600">
                                            {scopedLeadStudent
                                                ? `${scopedLeadStudent.averageScore}% - ${scopedLeadStudent.weakSkillCount} مهارات`
                                                : 'تظهر بعد توفر بيانات كافية.'}
                                        </p>
                                        {scopedLeadStudent ? (
                                            <div className="print-hide mt-2 flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(scopedLeadStudentSummary).catch(() => undefined)}
                                                    className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100"
                                                >
                                                    نسخ
                                                </button>
                                                <Link to="/dashboard?tab=reports" className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-700 hover:bg-gray-200">
                                                    تقرير
                                                </Link>
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="rounded-2xl border border-amber-100 bg-white p-3">
                                        <div className="text-xs font-black text-amber-600">أولوية المهارة</div>
                                        <div className="mt-2 text-base font-black leading-6 text-gray-900">
                                            {displayText(scopedLeadSkill?.skill) || 'بانتظار بيانات المهارات'}
                                        </div>
                                        <p className="mt-2 text-xs font-bold leading-6 text-gray-600">
                                            {scopedLeadSkill
                                                ? `${scopedLeadSkill.affectedStudents} طلاب - ${scopedLeadSkill.mastery}%`
                                                : 'تظهر بعد تراكم النتائج.'}
                                        </p>
                                        {scopedLeadSkill ? (
                                            <div className="print-hide mt-2 flex flex-wrap gap-2">
                                                <Link to="/quiz" className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 hover:bg-amber-100">
                                                    اختبار
                                                </Link>
                                                <Link to={buildSkillSessionLink({ skill: scopedLeadSkill.skill, skillId: scopedLeadSkill.skillId, sectionName: scopedLeadSkill.section })} className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-700 hover:bg-gray-200">
                                                    شرح
                                                </Link>
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="rounded-2xl border border-indigo-100 bg-white p-3">
                                        <div className="text-xs font-black text-indigo-600">أولوية المادة</div>
                                        <div className="mt-2 text-base font-black leading-6 text-gray-900">
                                            {displayText(scopedLeadSubject?.subjectName) || 'بانتظار توزيع المواد'}
                                        </div>
                                        <p className="mt-2 text-xs font-bold leading-6 text-gray-600">
                                            {scopedLeadSubject
                                                ? `${scopedLeadSubject.weakStudents} طلاب - ${scopedLeadSubject.mastery}%`
                                                : 'تظهر عند وجود فرق واضح.'}
                                        </p>
                                        {scopedLeadSubject ? (
                                            <div className="mt-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold leading-6 text-indigo-700">
                                                تدريب قصير ثم قياس.
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="grid gap-3 lg:grid-cols-3">
                                    {scopedInterventionPlan.map((item) => (
                                        <div key={item.title} className={`rounded-2xl border p-3 ${item.className}`}>
                                            <div className="text-xs font-black opacity-70">{item.title}</div>
                                            <div className="mt-2 text-sm font-black leading-6">{item.label}</div>
                                            <p className="mt-1 text-xs font-bold leading-6">{item.body}</p>
                                        </div>
                                    ))}
                                </div>
                                {scopedSmartRemediation ? (
                                    <div className="mt-4 rounded-3xl border border-amber-100 bg-white/80 p-4">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                                                    <Sparkles size={14} />
                                                    خطة ذكية قابلة للتنفيذ
                                                </div>
                                                <div className="text-base font-black text-gray-900">{displayText(scopedSmartRemediation.title) || 'خطة تدخل للنطاق الحالي'}</div>
                                                <p className="mt-2 text-xs font-bold leading-6 text-gray-600">
                                                    {displayText(scopedSmartRemediation.summary) || 'ابدأ بالمهارة الأكثر ضعفًا، ثم أنشئ متابعة قصيرة وقابلة للقياس.'}
                                                </p>
                                            </div>
                                            <Link to="/quiz" className="self-start rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800">
                                                اختبار متابعة
                                            </Link>
                                        </div>
                                        <div className="mt-3 grid gap-3 lg:grid-cols-3">
                                            {(scopedSmartRemediation.steps || []).slice(0, 3).map((step, index) => (
                                                <div key={`${step.day || index}-${step.skill || index}`} className="rounded-2xl border border-gray-100 bg-slate-50 p-3">
                                                    <div className="rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700 inline-flex">
                                                        {displayText(step.day) || `خطوة ${index + 1}`}
                                                    </div>
                                                    <div className="mt-2 font-black leading-6 text-gray-900">{displayText(step.skill) || 'مهارة تحتاج متابعة'}</div>
                                                    <p className="mt-1 text-xs font-bold leading-6 text-gray-600">{displayText(step.action) || 'وجّه نشاطًا علاجيًا قصيرًا.'}</p>
                                                    <div className="mt-2 text-xs font-bold leading-6 text-gray-500">
                                                        قياس: {displayText(step.check) || 'اختبار قصير.'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {scopedSmartRemediation.parentNote ? (
                                            <div className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold leading-6 text-emerald-800">
                                                متابعة: {displayText(scopedSmartRemediation.parentNote)}
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>

                            {showScopedIndividualSections ? (
                            <div className="rounded-3xl border border-gray-100 bg-white p-4">
                                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <div className="text-lg font-black text-gray-900">محاولات حديثة</div>
                                    </div>
                                    <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                                        {scopedLatestResults.length} محاولة حديثة
                                    </span>
                                </div>
                                {scopedLatestResults.length > 0 ? (
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        {scopedLatestResults.map((result, index) => {
                                            const resultId = String(result.id || result._id || `${result.userId || 'student'}-${index}`);
                                            const weakSkills = (result.skillsAnalysis || [])
                                                .filter((skill) => Number(skill.mastery ?? 100) < 75)
                                                .slice(0, 2);
                                            const primaryWeakSkill = weakSkills[0];
                                            const resolvedAttemptSkill = primaryWeakSkill?.skill
                                                ? skills.find((skill) => displayText(skill.name) === displayText(primaryWeakSkill.skill))
                                                : undefined;
                                            const attemptStudent = result.userId
                                                ? scopedAnalytics.weakestStudents.find((student) => student.id === result.userId)
                                                : undefined;
                                            const attemptFollowUpLink = buildDirectedQuizManagerLink({
                                                pathId: resolvedAttemptSkill?.pathId,
                                                subjectId: resolvedAttemptSkill?.subjectId,
                                                sectionId: resolvedAttemptSkill?.sectionId,
                                                skillId: resolvedAttemptSkill?.id,
                                                targetUserId: result.userId || attemptStudent?.id,
                                                targetGroupId: attemptStudent?.groupIds?.[0],
                                            });
                                            const resultDate = result.date || result.createdAt;

                                            return (
                                                <div key={resultId} className="rounded-2xl border border-gray-100 bg-slate-50 p-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-bold text-gray-500">{displayText(result.studentName) || 'طالب'}</div>
                                                            <div className="mt-1 font-black leading-6 text-gray-900">{displayText(result.quizTitle) || 'اختبار'}</div>
                                                        </div>
                                                        <div className={`rounded-full px-3 py-1 text-sm font-black ${Number(result.score || 0) >= 75 ? 'bg-emerald-50 text-emerald-700' : Number(result.score || 0) >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                                                            {Number(result.score || 0)}%
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                                        <div className="rounded-xl bg-white px-3 py-1.5">
                                                            <div className="font-bold text-gray-500">صحيح</div>
                                                            <div className="mt-1 font-black text-gray-900">{Number(result.correctAnswers || 0)}</div>
                                                        </div>
                                                        <div className="rounded-xl bg-white px-3 py-1.5">
                                                            <div className="font-bold text-gray-500">الأسئلة</div>
                                                            <div className="mt-1 font-black text-gray-900">{Number(result.totalQuestions || 0)}</div>
                                                        </div>
                                                    </div>
                                                    {weakSkills.length ? (
                                                        <>
                                                            <div className="mt-2 text-xs font-bold leading-6 text-rose-700">
                                                                متابعة: {weakSkills.map((skill) => `${displayText(skill.skill) || 'مهارة'} (${Number(skill.mastery || 0)}%)`).join('، ')}
                                                            </div>
                                                            <Link
                                                                to={attemptFollowUpLink}
                                                                className="print-hide mt-2 inline-flex rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-black text-white hover:bg-indigo-700"
                                                            >
                                                                اختبار متابعة
                                                            </Link>
                                                        </>
                                                    ) : (
                                                        <div className="mt-2 text-xs font-bold leading-6 text-emerald-700">لا توجد أولوية واضحة.</div>
                                                    )}
                                                    {resultDate ? (
                                                        <div className="mt-2 text-[11px] font-bold text-gray-400">
                                                            {new Date(resultDate).toLocaleDateString('ar-SA')}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-gray-200 bg-slate-50 p-4 text-sm leading-7 text-gray-500">
                                        لا توجد محاولات حديثة داخل هذا النطاق بعد. بعد أول اختبار للطالب ستظهر المحاولة هنا مباشرة للمشرف أو ولي الأمر المرتبط.
                                    </div>
                                )}
                            </div>
                            ) : null}

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <div className="font-black text-gray-900">مواد تحتاج تدخل</div>
                                    {scopedAnalytics.subjectSummaries.length > 0 ? scopedAnalytics.subjectSummaries.slice(0, 6).map((subject) => (
                                        <div key={subject.subjectId || subject.subjectName} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <div className="font-bold text-gray-900">{displayText(subject.subjectName)}</div>
                                                <div className="text-xs text-gray-500">طلاب ضعفاء: {subject.weakStudents}</div>
                                                <div className="mt-1 text-xs font-bold text-indigo-600">تدريب قصير ثم قياس.</div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className={`text-lg font-black ${subject.mastery < 50 ? 'text-rose-600' : 'text-amber-600'}`}>{subject.mastery}%</div>
                                                <Link
                                                    to={buildDirectedQuizManagerLink({
                                                        subjectId: subject.subjectId,
                                                        targetUserId: scopedLeadStudent?.id,
                                                        targetGroupId: scopedLeadStudent?.groupIds?.[0],
                                                    })}
                                                    className="print-hide rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-black text-white hover:bg-indigo-700"
                                                >
                                                    توجيه اختبار
                                                </Link>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="border border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-500">لا توجد مواد تحتاج تدخلًا ظاهرًا الآن.</div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div className="font-black text-gray-900">اختبارات موجهة</div>
                                    {scopedAnalytics.assignedFollowUps.length > 0 ? scopedAnalytics.assignedFollowUps.slice(0, 5).map((quiz) => {
                                        const targetUserCount = quiz.targetUserIds?.length || 0;
                                        const targetGroupCount = quiz.targetGroupIds?.length || 0;
                                        const targetLabel = targetUserCount > 0 || targetGroupCount > 0
                                            ? `${targetUserCount ? `${targetUserCount} طالب` : ''}${targetUserCount && targetGroupCount ? ' - ' : ''}${targetGroupCount ? `${targetGroupCount} مجموعة` : ''}`
                                            : 'النطاق الحالي';

                                        return (
                                            <div key={quiz.id} className="border border-gray-100 rounded-xl p-3 bg-white flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="font-bold text-gray-900">{displayText(quiz.title)}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {quiz.mode === 'central' ? 'اختبار مركزي موجه' : 'اختبار ساهر جاهز'}
                                                        {quiz.dueDate ? ` - حتى ${new Date(quiz.dueDate).toLocaleDateString('ar-SA')}` : ''}
                                                    </div>
                                                    <div className="mt-1 inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700">
                                                        موجه إلى: {targetLabel}
                                                    </div>
                                                </div>
                                                <Link to={`/quiz/${quiz.id}`} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-black hover:bg-gray-800">
                                                    فتح
                                                </Link>
                                            </div>
                                        );
                                    }) : (
                                        <div className="border border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-500">لا توجد اختبارات متابعة موجهة داخل هذا النطاق حاليًا.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-4">
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                    <div>
                                        <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700">
                                            مركز متابعة مؤسسي
                                        </div>
                                        <h3 className="mt-2 text-lg font-black leading-7 text-gray-900">ابدأ بقياس تشخيصي قصير</h3>
                                        <p className="mt-1 text-sm font-bold leading-7 text-gray-600">
                                            لا توجد بيانات مجمعة كافية بعد. وجّه اختبارًا قصيرًا للمسار أو المجموعة، ثم ستظهر تقارير الطلاب والمهارات تلقائيًا.
                                        </p>
                                    </div>
                                    <div className="print-hide grid gap-2 sm:grid-cols-2 xl:min-w-[520px]">
                                        <Link
                                            to={buildDirectedQuizManagerLink()}
                                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-indigo-700"
                                        >
                                            <Target size={14} />
                                            توجيه اختبار
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => navigator.clipboard.writeText('تنبيه متابعة من منصة المئة: نرجو حل الاختبار التشخيصي القصير حتى يظهر تقرير المهارات وخطة المتابعة.').catch(() => undefined)}
                                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-700 shadow-sm hover:bg-emerald-50"
                                        >
                                            <Copy size={14} />
                                            نسخ تنبيه
                                        </button>
                                        <Link
                                            to={user.role === Role.ADMIN ? '/admin-dashboard?tab=users' : user.role === Role.SUPERVISOR ? '/admin-dashboard?tab=groups' : '/admin-dashboard?tab=quizzes'}
                                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50"
                                        >
                                            <FileText size={14} />
                                            إدارة النطاق
                                        </Link>
                                        <Link
                                            to={user.role === Role.ADMIN ? '/admin-dashboard?tab=notifications' : '/reports'}
                                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black text-amber-700 shadow-sm hover:bg-amber-50"
                                        >
                                            <Share2 size={14} />
                                            فتح التنبيهات
                                        </Link>
                                    </div>
                                </div>
                            </div>
                            <div className="border border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-500">
                                لا توجد بيانات مجمعة كافية لهذا الدور حتى الآن. إن كان الدور ولي أمر، اربطه أولًا بالطلاب من إدارة المستخدمين.
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {isStudentView && hasStudentAnalytics && (
            <>
            <Card className="p-4 sm:p-6 border border-indigo-100 shadow-sm bg-white overflow-hidden">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="mb-3 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                            تقرير مبسط للطالب
                        </div>
                        <h2 className="text-2xl font-black leading-tight text-gray-900">خطوة واحدة واضحة اليوم</h2>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
                            {studentFollowUpSummary}
                        </p>
                    </div>
                    <div className="print-hide flex min-w-full flex-wrap gap-2 lg:min-w-[360px] lg:justify-end">
                        {!isStudentReportFull ? (
                            <>
                                <button
                                    onClick={copyStudentSummary}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 sm:text-sm"
                                >
                                    {copiedStudentSummary ? <CheckCircle size={15} /> : <Copy size={15} />}
                                    {copiedStudentSummary ? 'تم' : 'نسخ ملخص'}
                                </button>
                                <button
                                    onClick={() => printElementAsPdf('reports-print-area', 'تقرير الأداء')}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs font-black text-indigo-700 transition hover:bg-indigo-50 sm:text-sm"
                                >
                                    <Download size={15} />
                                    تحميل
                                </button>
                                <button
                                    onClick={() => setStudentReportDepth('full')}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white transition hover:bg-indigo-700 sm:text-sm"
                                >
                                    <FileText size={15} />
                                    تقرير تفصيلي
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={copyStudentSummary}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 sm:text-sm"
                                >
                                    {copiedStudentSummary ? <CheckCircle size={15} /> : <Copy size={15} />}
                                    {copiedStudentSummary ? 'تم' : 'نسخ'}
                                </button>
                                <button
                                    onClick={shareStudentSummary}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white transition hover:bg-indigo-700 sm:text-sm"
                                >
                                    {sharedStudentSummary ? <CheckCircle size={15} /> : <Share2 size={15} />}
                                    {sharedStudentSummary ? 'تمت المشاركة' : 'مشاركة'}
                                </button>
                                <button
                                    onClick={downloadStudentSkillsWorkbook}
                                    disabled={!aggregatedSkills.length}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                                >
                                    <FileText size={15} />
                                    المهارات
                                </button>
                                <button
                                    onClick={downloadStudentAttemptsWorkbook}
                                    disabled={!examResults.length}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                                >
                                    <Download size={15} />
                                    المحاولات
                                </button>
                                <Link to="/plan" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-600 sm:text-sm">
                                    <Target size={15} />
                                    الخطة
                                </Link>
                                <button
                                    onClick={() => {
                                        void buildSmartRemediation();
                                    }}
                                    disabled={smartRemediationLoading || focusedReportSkills.length === 0}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-slate-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                                >
                                    {smartRemediationLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                                    {smartRemediationLoading ? 'تجهيز' : 'اقتراح'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </Card>

            <Card className={`p-3 sm:p-4 border shadow-sm ${hasStudentTrackScope ? 'border-emerald-100 bg-emerald-50/70' : 'border-amber-100 bg-amber-50/80'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className={`text-xs font-black ${hasStudentTrackScope ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {hasStudentTrackScope ? 'تقاريرك مرتبة حسب مسارك' : 'اختر مسارك أولًا'}
                        </div>
                        <p className="mt-1 text-sm font-bold leading-6 text-gray-700">
                            {hasStudentTrackScope
                                ? `نركز الآن على: ${studentTrackLabel}.`
                                : 'عند اختيار المسار ستظهر لك الاختبارات والتقارير المناسبة مثل نافس أو القدرات أو التحصيلي.'}
                        </p>
                    </div>
                    <Link
                        to="/dashboard?tab=paths"
                        className={`print-hide inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-black sm:text-sm ${hasStudentTrackScope ? 'bg-white text-emerald-700 hover:bg-emerald-100' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
                    >
                        {hasStudentTrackScope ? 'إدارة المسارات' : 'اختيار المسار'}
                    </Link>
                </div>
            </Card>

            {!isStudentReportFull ? (
                <Card className="p-4 sm:p-6 border-0 shadow-sm bg-white">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h2 className="text-xl font-black text-gray-900">أضعف مهارة الآن</h2>
                            <p className="mt-1 text-sm leading-6 text-gray-500">
                                ملخص سريع: المهارة، السبب المختصر، والخطوة التالية.
                            </p>
                            <p className="mt-1 text-xs font-bold text-indigo-600">
                                القياس مبني على {studentEvidenceSummary.totalQuestions} سؤال عبر {studentEvidenceSummary.uniqueSkills} مهارة.
                            </p>
                        </div>
                        <button
                            onClick={() => setStudentReportDepth('full')}
                            className="print-hide self-start rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                        >
                            عرض كل التفاصيل
                        </button>
                    </div>

                    <div className="mt-5">
                        {focusedReportSkills.length > 0 ? focusedReportSkills.slice(0, 1).map((skill, index) => {
                            const tone = getReportMasteryTone(skill.mastery);

                            return (
                                <div key={`${getReportSkillKey(skill)}-${index}`} className={`rounded-3xl border p-4 ${tone.bg} ${tone.border}`}>
                                    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_1.4fr]">
                                        <div>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <span className={`inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-black ${tone.text}`}>
                                                        {skill.isReliable ? 'ابدأ هنا' : 'قراءة أولية'}
                                                    </span>
                                                    <div className="mt-3 text-lg font-black leading-8 text-gray-900 break-words">{displayText(skill.skill)}</div>
                                                </div>
                                                <div className={`text-3xl font-black ${tone.text}`}>{skill.mastery}%</div>
                                            </div>
                                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
                                                <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${skill.mastery}%` }} />
                                            </div>
                            <div className="mt-3 grid gap-2 text-xs font-bold text-gray-600">
                                {skill.subjectName ? <span className="rounded-xl bg-white/80 px-3 py-2">المادة: {displayText(skill.subjectName)}</span> : null}
                                {skill.sectionName ? <span className="rounded-xl bg-white/80 px-3 py-2">المهارة الرئيسية: {displayText(skill.sectionName)}</span> : null}
                                <span className="rounded-xl bg-white/80 px-3 py-2">
                                    القياس: {skill.totalEvidence} سؤال عبر المحاولات
                                </span>
                                <span className="rounded-xl bg-white/80 px-3 py-2">
                                    الصحيح: {skill.correctAttempts} من {skill.totalEvidence}
                                </span>
                            </div>
                                            <p className="mt-3 text-sm font-bold leading-6 text-gray-700">
                                                {skill.isReliable
                                                    ? 'ابدأ بالشرح، ثم تدريب قصير، وبعدها أعد القياس.'
                                                    : `هذه إشارة أولية. ثبّتها بعد ${Math.max(MIN_SKILL_EVIDENCE_COUNT - skill.attempts, 1)} محاولة إضافية.`}
                                            </p>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            {studentQuickActions.map(({ title, label, link, Icon, className }) => (
                                                <Link key={title} to={link} className={`print-hide flex min-h-[84px] flex-col justify-between rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm ${className}`}>
                                                    <div>
                                                        <Icon size={18} />
                                                        <div className="mt-2 text-sm font-black">{title}</div>
                                                    </div>
                                                    <span className="mt-2 inline-flex justify-center rounded-xl bg-white px-3 py-1.5 text-xs font-black text-slate-800">
                                                        {label}
                                                    </span>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm font-bold leading-7 text-gray-500">
                                لا توجد مهارات كافية بعد. حل اختبارًا قصيرًا مرتبطًا بالمهارات، وسيظهر هنا ملخص واضح تلقائيًا.
                            </div>
                        )}
                    </div>

                </Card>
            ) : null}

            {smartRemediation && isStudentReportFull ? (
                <Card className="p-4 sm:p-6 border-0 shadow-sm bg-gradient-to-br from-amber-50 via-white to-emerald-50">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-black text-amber-700 shadow-sm">
                                <Sparkles size={14} />
                                خطة علاجية مولدة من أدائك
                            </div>
                            <h2 className="text-xl font-black text-gray-900">{displayText(smartRemediation.title) || 'خطة علاجية قصيرة'}</h2>
                            <p className="mt-2 max-w-4xl text-sm leading-7 text-gray-600">
                                {displayText(smartRemediation.summary) || 'ابدأ بأضعف مهارة، راجع شرحًا بسيطًا، ثم حل تدريبًا قصيرًا وأعد القياس.'}
                            </p>
                        </div>
                        <Link to="/plan" className="self-start rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
                            تحويلها لخطة مذاكرة
                        </Link>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                        {(smartRemediation.steps || []).slice(0, 3).map((step, index) => (
                            <div key={`${step.day || index}-${step.skill || index}`} className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                                        {displayText(step.day) || `اليوم ${index + 1}`}
                                    </span>
                                    <CheckCircle size={18} className="text-emerald-500" />
                                </div>
                                <div className="mt-3 text-base font-black leading-7 text-gray-900">{displayText(step.skill) || 'مهارة تحتاج متابعة'}</div>
                                <p className="mt-2 text-sm leading-7 text-gray-600">{displayText(step.action) || 'راجع شرحًا قصيرًا ثم حل تدريبًا بسيطًا.'}</p>
                                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold leading-6 text-slate-600">
                                    التحقق: {displayText(step.check) || 'أعد القياس بسؤال أو اختبار قصير.'}
                                </div>
                            </div>
                        ))}
                    </div>

                    {smartRemediation.parentNote ? (
                        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold leading-7 text-emerald-800">
                            ملاحظة لولي الأمر: {displayText(smartRemediation.parentNote)}
                        </div>
                    ) : null}
                </Card>
            ) : null}

            {isStudentReportFull ? (
            <Card className="p-4 sm:p-6 border-0 shadow-sm bg-white">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-5">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">مهاراتك أولًا</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            نرتب المهارات من الأضعف للأقوى بناءً على الأسئلة التي حللتها في كل اختبار، ثم نقترح لك خطوة علاجية مناسبة.
                        </p>
                    </div>
                    <Link to="/dashboard?tab=saher" className="self-start rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
                        اختبر مهارة جديدة
                    </Link>
                </div>

                {selectedReportSkill ? (
                    <div className="mb-5 rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-4 sm:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                                <div className="mb-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-rose-700">
                                    المهارة التي تبدأ بها اليوم
                                </div>
                                <div className="grid grid-cols-1 gap-2 text-xs font-bold sm:grid-cols-3">
                                    {selectedReportSkill.subjectName ? (
                                        <div className="rounded-xl bg-white px-3 py-2 text-gray-700">
                                            <span className="mb-1 block text-gray-400">المادة</span>
                                            {displayText(selectedReportSkill.subjectName)}
                                        </div>
                                    ) : null}
                                    {selectedReportSkill.sectionName ? (
                                        <div className="rounded-xl bg-white px-3 py-2 text-indigo-700">
                                            <span className="mb-1 block text-indigo-300">المهارة الرئيسية</span>
                                            {displayText(selectedReportSkill.sectionName)}
                                        </div>
                                    ) : null}
                                    <div className="rounded-xl bg-white px-3 py-2 text-rose-700">
                                        <span className="mb-1 block text-rose-300">المهارة الفرعية</span>
                                        {displayText(selectedReportSkill.skill)}
                                    </div>
                                </div>
                                <p className="mt-3 text-sm leading-7 text-gray-600">
                                    {displayText(selectedSkillRecommendation.actionText) || 'ابدأ بمراجعة قصيرة، ثم حل تدريبًا بسيطًا، وبعدها أعد القياس.'}
                                </p>
                            </div>
                            <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[320px]">
                                {selectedSkillRecommendation.lessonLink ? (
                                    <Link to={selectedSkillRecommendation.lessonLink} className="rounded-xl bg-white px-4 py-3 text-sm font-black text-indigo-700 border border-indigo-100 hover:bg-indigo-50 flex items-center justify-center gap-2">
                                        <Video size={16} />
                                        {selectedSkillRecommendation.lessonTopicTitle ? `شرح: ${selectedSkillRecommendation.lessonTopicTitle}` : 'ابدأ بالشرح'}
                                    </Link>
                                ) : (
                                    <Link to="/courses" className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-600 border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-2">
                                        <Video size={16} />
                                        استعرض الشروح
                                    </Link>
                                )}
                                {selectedSkillRecommendation.quizLink ? (
                                    <Link to={selectedSkillRecommendation.quizLink} className="rounded-xl bg-white px-4 py-3 text-sm font-black text-amber-700 border border-amber-100 hover:bg-amber-50 flex items-center justify-center gap-2">
                                        <FileText size={16} />
                                        ابدأ بالتدريب
                                    </Link>
                                ) : (
                                    <Link to="/dashboard?tab=saher" className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-600 border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-2">
                                        <FileText size={16} />
                                        ابحث عن تدريب
                                    </Link>
                                )}
                                {selectedSkillRecommendation.resourceUrl ? (
                                    <a href={selectedSkillRecommendation.resourceUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-700 border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-2">
                                        <BookOpen size={16} />
                                        ملف مساعد
                                    </a>
                                ) : null}
                                <Link to={buildSkillSessionLink(selectedReportSkill)} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white hover:bg-indigo-700 flex items-center justify-center gap-2">
                                    <Clock size={16} />
                                    حجز حصة
                                </Link>
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_2fr]">
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                        <div className="text-xs font-black text-indigo-600">قراءة سريعة للتقرير</div>
                        <p className="mt-2 text-sm font-bold leading-7 text-indigo-900">{skillReadinessSummary.message}</p>
                        <div className="mt-3 text-xs font-bold text-indigo-500">
                            إجمالي المهارات المرصودة: {skillReadinessSummary.total}
                            {skillReadinessSummary.early > 0 ? ` - إشارات أولية تحتاج تأكيد: ${skillReadinessSummary.early}` : ''}
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-2xl bg-rose-50 p-4 text-center">
                            <div className="text-2xl font-black text-rose-700">{skillReadinessSummary.weak}</div>
                            <div className="mt-1 text-xs font-bold text-rose-600">ابدأ بها</div>
                        </div>
                        <div className="rounded-2xl bg-amber-50 p-4 text-center">
                            <div className="text-2xl font-black text-amber-700">{skillReadinessSummary.average}</div>
                            <div className="mt-1 text-xs font-bold text-amber-600">تحت المراجعة</div>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 p-4 text-center">
                            <div className="text-2xl font-black text-emerald-700">{skillReadinessSummary.strong}</div>
                            <div className="mt-1 text-xs font-bold text-emerald-600">مطمئنة</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {focusedReportSkills.map((skill) => {
                        const tone = getReportMasteryTone(skill.mastery);
                        const isSelected = selectedReportSkill && getReportSkillKey(selectedReportSkill) === getReportSkillKey(skill);

                        return (
                            <button
                                key={getReportSkillKey(skill)}
                                onClick={() => setSelectedSkillKey(getReportSkillKey(skill))}
                                className={`text-right rounded-2xl border p-4 transition-all hover:shadow-md ${tone.bg} ${isSelected ? `${tone.border} ring-2 ring-indigo-100` : 'border-transparent'}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${tone.text} bg-white/70`}>
                                            {tone.label}
                                        </div>
                                        <div className="mt-3 font-black text-gray-900 leading-7 break-words">{displayText(skill.skill)}</div>
                                    </div>
                                    <div className={`text-2xl font-black ${tone.text}`}>{skill.mastery}%</div>
                                </div>
                                <div className="mt-4 h-2 rounded-full bg-white/70 overflow-hidden">
                                    <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${skill.mastery}%` }} />
                                </div>
                                <div className="mt-3 text-xs font-bold text-gray-500">
                                    {skill.isReliable ? 'قياس مؤكد من عدة محاولات' : `قراءة أولية حتى ${MIN_SKILL_EVIDENCE_COUNT} محاولات`}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {selectedReportSkill ? (
                    <div className="mt-5 rounded-3xl border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700">مقترحات لهذه المهارة</span>
                                </div>
                                <h3 className="text-lg font-black text-gray-900 break-words">{displayText(selectedReportSkill.skill)}</h3>
                                <p className="mt-2 text-sm leading-7 text-gray-600">
                                    اختر من المقترحات التالية ما يناسب وقتك الآن. الأفضل أن تبدأ بالشرح ثم تنتقل للتدريب.
                                </p>
                                <p className="mt-2 text-xs font-bold text-indigo-600">
                                    يمكنك تغيير المقترحات بالضغط على أي مهارة من البطاقات بالأعلى.
                                </p>
                            </div>
                            <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[360px]">
                                {selectedSkillRecommendation.lessonLink ? (
                                    <Link to={selectedSkillRecommendation.lessonLink} className="rounded-xl bg-white px-4 py-3 text-sm font-black text-indigo-700 border border-indigo-100 hover:bg-indigo-50 flex items-center gap-2">
                                        <Video size={16} />
                                        {selectedSkillRecommendation.lessonTopicTitle ? `درس: ${selectedSkillRecommendation.lessonTopicTitle}` : 'فيديو أو درس'}
                                    </Link>
                                ) : (
                                    <Link to="/courses" className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-600 border border-slate-200 hover:bg-slate-50 flex items-center gap-2">
                                        <Video size={16} />
                                        استعرض الشروح
                                    </Link>
                                )}
                                {selectedSkillRecommendation.quizLink ? (
                                    <Link to={selectedSkillRecommendation.quizLink} className="rounded-xl bg-white px-4 py-3 text-sm font-black text-amber-700 border border-amber-100 hover:bg-amber-50 flex items-center gap-2">
                                        <FileText size={16} />
                                        اختبار علاجي
                                    </Link>
                                ) : (
                                    <Link to="/dashboard?tab=saher" className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-600 border border-slate-200 hover:bg-slate-50 flex items-center gap-2">
                                        <FileText size={16} />
                                        ابحث عن اختبار
                                    </Link>
                                )}
                                {selectedSkillRecommendation.resourceUrl ? (
                                    <a href={selectedSkillRecommendation.resourceUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-700 border border-slate-200 hover:bg-slate-50 flex items-center gap-2">
                                        <BookOpen size={16} />
                                        ملف داعم
                                    </a>
                                ) : null}
                                <Link to={buildSkillSessionLink(selectedReportSkill)} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white hover:bg-indigo-700 flex items-center gap-2">
                                    <Clock size={16} />
                                    حجز حصة
                                </Link>
                            </div>
                        </div>
                    </div>
                ) : null}
            </Card>
            ) : null}

            {isStudentReportFull && studentWeeklyPlan.length > 0 ? (
                <Card className="p-4 sm:p-6 border-0 shadow-sm bg-white">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-5">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">خطة أسبوعية صغيرة</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                ثلاث خطوات خفيفة تبدأ من أضعف المهارات، مناسبة للمذاكرة اليومية وولي الأمر يقدر يتابعها بسهولة.
                            </p>
                        </div>
                        <Link to="/plan" className="self-start rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
                            افتح خطتي الدراسية
                        </Link>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                        {studentWeeklyPlan.map((item) => (
                            <div key={`${item.day}-${item.skill}`} className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700">{item.day}</span>
                                    <span className={`rounded-full px-3 py-1 text-xs font-black ${item.mastery < 50 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                                        {item.mastery}%
                                    </span>
                                </div>
                                <div className="mt-3 font-black text-gray-900 leading-7 break-words">{item.skill}</div>
                                {(item.subjectName || item.sectionName) ? (
                                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold text-gray-500">
                                        {item.subjectName ? <span className="rounded-full bg-white px-2 py-1">المادة: {displayText(item.subjectName)}</span> : null}
                                        {item.sectionName ? <span className="rounded-full bg-white px-2 py-1">المهارة الرئيسية: {displayText(item.sectionName)}</span> : null}
                                    </div>
                                ) : null}
                                <p className="mt-2 text-sm leading-7 text-gray-600">{displayText(item.actionText)}</p>
                                <div className="mt-3 space-y-1 text-xs text-gray-500">
                                    {item.lessonTitle ? <div>شرح مقترح: <span className="font-bold">{displayText(item.lessonTitle)}</span></div> : null}
                                    {item.lessonTopicTitle ? <div>داخل موضوع: <span className="font-bold">{displayText(item.lessonTopicTitle)}</span></div> : null}
                                    {item.quizTitle ? <div>تدريب مقترح: <span className="font-bold">{displayText(item.quizTitle)}</span></div> : null}
                                </div>
                                <div className="print-hide mt-4 grid gap-2">
                                    {item.lessonLink ? (
                                        <Link to={item.lessonLink} className="rounded-xl bg-indigo-600 px-3 py-2 text-center text-xs font-black text-white hover:bg-indigo-700">
                                            فتح شرح اليوم
                                        </Link>
                                    ) : null}
                                    {item.quizLink ? (
                                        <Link to={item.quizLink} className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-black text-amber-700 hover:bg-amber-100">
                                            فتح تدريب اليوم
                                        </Link>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            ) : null}

            </>
            )}
        </div>
    );
};

export default Reports;
