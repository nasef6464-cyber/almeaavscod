
import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { 
    Clock, TrendingUp, AlertTriangle, Zap, FileText, 
    PieChart, Heart, Map as MapIcon, HelpCircle, LayoutDashboard, 
    ShoppingCart, ChevronLeft, Menu, X, Target, Loader2, CheckCircle, BookOpen, Star,
    Route as RouteIcon, Brain, Calendar, User, Video, Copy, MessageCircle
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Link, useLocation } from 'react-router-dom';
import { SmartLearningPath } from '../components/SmartLearningPath';
import { useStore } from '../store/useStore';
import { QuizResult, Role, SkillGap } from '../types';
import { api } from '../services/api';

// Lazy Load Sub-Pages to optimize Dashboard initial load
const Quizzes = React.lazy(() => import('./Quizzes'));
const Reports = React.lazy(() => import('./Reports'));
const Favorites = React.lazy(() => import('./Favorites'));
const Plan = React.lazy(() => import('./Plan'));
const QA = React.lazy(() => import('./QA'));
const MyRequests = React.lazy(() => import('./MyRequests').then(module => ({ default: module.MyRequests })));

const TabLoading = () => (
    <div className="flex items-center justify-center h-64 text-amber-500">
        <Loader2 size={40} className="animate-spin" />
    </div>
);

const buildSmartPathSkillsFromResults = (examResults: QuizResult[]): SkillGap[] => {
    if (!examResults || examResults.length === 0) return [];

    const skillMap = new globalThis.Map<string, {
        skillId?: string;
        pathId?: string;
        subjectId?: string;
        sectionId?: string;
        section?: string;
        skill: string;
        masterySum: number;
        attempts: number;
    }>();

    examResults.forEach(result => {
        result.skillsAnalysis?.forEach(skill => {
            const key = skill.skillId || [skill.pathId, skill.subjectId, skill.sectionId, skill.skill].join(':');
            const existing = skillMap.get(key);

            if (existing) {
                existing.masterySum += skill.mastery;
                existing.attempts += 1;
                return;
            }

            skillMap.set(key, {
                skillId: skill.skillId,
                pathId: skill.pathId,
                subjectId: skill.subjectId,
                sectionId: skill.sectionId,
                section: skill.section,
                skill: skill.skill,
                masterySum: skill.mastery,
                attempts: 1
            });
        });
    });

    return Array.from(skillMap.values())
        .map((item): SkillGap => {
            const mastery = Math.round(item.masterySum / item.attempts);
            const status: SkillGap['status'] = mastery < 50 ? 'weak' : mastery < 75 ? 'average' : 'strong';

            return {
                skillId: item.skillId,
                pathId: item.pathId,
                subjectId: item.subjectId,
                sectionId: item.sectionId,
                section: item.section,
                skill: item.skill,
                mastery,
                status,
                recommendation: status === 'weak'
                    ? 'مراجعة عاجلة مع درس وتدريب'
                    : status === 'average'
                        ? 'تثبيت المهارة بتدريب إضافي'
                        : 'استمرار وتمارين تعزيز'
            };
        })
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, 12);
};

const formatQuizCardDate = (createdAt?: number) => {
    if (!createdAt) return 'متاح الآن';
    return new Date(createdAt).toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

type ScopedQuizResult = QuizResult & {
    id?: string;
    studentId?: string;
    studentName?: string;
    studentEmail?: string;
    createdAt?: number;
    submittedAt?: number | string;
    date?: number | string;
};

const extractScopedQuizResults = (payload: unknown): ScopedQuizResult[] => {
    if (Array.isArray(payload)) return payload as ScopedQuizResult[];
    if (payload && typeof payload === 'object' && Array.isArray((payload as { results?: unknown[] }).results)) {
        return (payload as { results: unknown[] }).results as ScopedQuizResult[];
    }
    return [];
};

const getResultTimestamp = (result: ScopedQuizResult) => {
    const raw = result.createdAt ?? result.submittedAt ?? result.date;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
        const parsed = new Date(raw).getTime();
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};

type DashboardTab =
    | 'overview'
    | 'paths'
    | 'my-courses'
    | 'smart-path'
    | 'sessions'
    | 'saher'
    | 'quizzes'
    | 'reports'
    | 'favorites'
    | 'plan'
    | 'qa'
    | 'requests'
    | 'parent-results'
    | 'parent-skills'
    | 'parent-followup';

const formatParentDate = (result: ScopedQuizResult) => {
    const timestamp = getResultTimestamp(result);
    if (!timestamp) return 'غير محدد';
    return new Date(timestamp).toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

const getStudentLabel = (result: ScopedQuizResult) =>
    result.studentName || result.studentEmail || result.studentId || result.userId || 'طالب مرتبط';

const scoreTone = (score: number) => {
    if (score < 60) return 'text-rose-600 bg-rose-50 border-rose-100';
    if (score < 80) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-emerald-600 bg-emerald-50 border-emerald-100';
};

const useParentScopedResults = () => {
    const { user, users } = useStore();
    const [scopedResults, setScopedResults] = useState<ScopedQuizResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (user.role !== Role.PARENT) return;

        let isMounted = true;
        setIsLoading(true);
        setLoadError(null);

        api.getScopedQuizResults()
            .then((payload) => {
                if (!isMounted) return;
                setScopedResults(
                    extractScopedQuizResults(payload)
                        .sort((a, b) => getResultTimestamp(b) - getResultTimestamp(a))
                );
            })
            .catch((error) => {
                console.error('Failed to load parent scoped quiz results', error);
                if (isMounted) {
                    setLoadError('تعذر تحميل نتائج الأبناء الآن. حاول تحديث الصفحة بعد قليل.');
                }
            })
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [user.role]);

    return useMemo(() => {
        const linkedStudentIds = new Set(user.linkedStudentIds || []);
        const linkedStudents = users.filter((item) => item.role === Role.STUDENT && linkedStudentIds.has(item.id));
        const resultsByStudent = new globalThis.Map<string, ScopedQuizResult[]>();

        scopedResults.forEach((result) => {
            const key = String(result.studentId || result.userId || getStudentLabel(result));
            const current = resultsByStudent.get(key) || [];
            current.push(result);
            resultsByStudent.set(key, current);
        });

        const fallbackNames = Array.from(
            new Set(scopedResults.map((result) => getStudentLabel(result)).filter(Boolean))
        );

        const childCards = linkedStudents.length > 0
            ? linkedStudents.map((student) => {
                const studentResults = resultsByStudent.get(student.id) || scopedResults.filter((result) => result.studentId === student.id || result.userId === student.id);
                const average = studentResults.length
                    ? Math.round(studentResults.reduce((sum, result) => sum + (Number(result.score) || 0), 0) / studentResults.length)
                    : 0;
                const weakCount = studentResults.reduce(
                    (sum, result) => sum + (result.skillsAnalysis || []).filter((skill) => skill.mastery < 75 || skill.status === 'weak').length,
                    0
                );
                return {
                    id: student.id,
                    name: student.name,
                    email: student.email,
                    avatar: student.avatar,
                    results: studentResults.length,
                    average,
                    weakCount,
                    latestResult: studentResults[0],
                };
            })
            : fallbackNames.map((name) => {
                const studentResults = scopedResults.filter((result) => getStudentLabel(result) === name);
                const average = studentResults.length
                    ? Math.round(studentResults.reduce((sum, result) => sum + (Number(result.score) || 0), 0) / studentResults.length)
                    : 0;
                const weakCount = studentResults.reduce(
                    (sum, result) => sum + (result.skillsAnalysis || []).filter((skill) => skill.mastery < 75 || skill.status === 'weak').length,
                    0
                );
                const studentName = String(name);
                return {
                    id: studentName,
                    name: studentName,
                    email: '',
                    avatar: `https://i.pravatar.cc/100?u=${encodeURIComponent(studentName)}`,
                    results: studentResults.length,
                    average,
                    weakCount,
                    latestResult: studentResults[0],
                };
            });

        const weakSkills = scopedResults
            .flatMap((result) =>
                (result.skillsAnalysis || [])
                    .filter((skill) => skill.mastery < 75 || skill.status === 'weak')
                    .map((skill) => ({
                        key: skill.skillId || `${skill.subjectId || ''}:${skill.sectionId || ''}:${skill.skill}`,
                        skill: skill.skill,
                        section: skill.section,
                        mastery: skill.mastery,
                        status: skill.status,
                        studentName: getStudentLabel(result),
                        quizTitle: result.quizTitle,
                    }))
            )
            .sort((a, b) => a.mastery - b.mastery);

        const followUpPlan = weakSkills.slice(0, 3).map((skill, index) => {
            const dayLabels = ['اليوم الأول', 'اليوم الثاني', 'اليوم الثالث'];
            const action =
                skill.mastery < 50
                    ? 'راجع معه شرحًا قصيرًا ثم اطلب منه حل 5 أسئلة سهلة فقط.'
                    : 'اطلب منه حل تدريب متوسط ثم مراجعة السؤال الذي أخطأ فيه بصوت عال.';
            const check =
                skill.mastery < 50
                    ? 'علامة النجاح: يشرح لك فكرة المهارة في دقيقة واحدة.'
                    : 'علامة النجاح: يصل إلى 75% أو أكثر في محاولة قصيرة.';

            return {
                id: `${skill.key}-${skill.studentName}-${index}`,
                day: dayLabels[index],
                studentName: skill.studentName,
                skill: skill.skill,
                mastery: skill.mastery,
                action,
                check,
            };
        });

        const topWeakSkill = weakSkills[0];
        const coachMessage = topWeakSkill
            ? `ابدأ بهدوء مع ${topWeakSkill.studentName}. الأولوية الآن: ${topWeakSkill.skill} لأنها عند ${Math.round(topWeakSkill.mastery)}%. الأفضل جلسة قصيرة 15 دقيقة: شرح سريع، 5 أسئلة، ثم مراجعة خطأ واحد فقط بدون ضغط.`
            : scopedResults.length > 0
                ? 'الأداء مطمئن حاليًا. استمر بمتابعة خفيفة: سؤال واحد يوميًا عن ما تعلمه، ومراجعة قصيرة قبل أي اختبار.'
                : 'اربط حساب الطالب أو انتظر أول اختبار حتى تظهر خطة متابعة مخصصة.';

        const averageScore = scopedResults.length
            ? Math.round(scopedResults.reduce((sum, result) => sum + (Number(result.score) || 0), 0) / scopedResults.length)
            : 0;
        const lastThreeAverage = scopedResults.slice(0, 3).length
            ? Math.round(scopedResults.slice(0, 3).reduce((sum, result) => sum + (Number(result.score) || 0), 0) / scopedResults.slice(0, 3).length)
            : 0;
        const olderThreeAverage = scopedResults.slice(3, 6).length
            ? Math.round(scopedResults.slice(3, 6).reduce((sum, result) => sum + (Number(result.score) || 0), 0) / scopedResults.slice(3, 6).length)
            : 0;

        return {
            linkedStudents,
            childCards,
            scopedResults,
            recentResults: scopedResults.slice(0, 6),
            weakSkills,
            priorityWeakSkills: weakSkills.slice(0, 6),
            followUpPlan,
            coachMessage,
            childrenCount: Math.max(childCards.length, linkedStudents.length),
            averageScore,
            lastThreeAverage,
            olderThreeAverage,
            isLoading,
            loadError,
        };
    }, [isLoading, linkedStudentIdsKey(user.linkedStudentIds), loadError, scopedResults, user.linkedStudentIds, users]);
};

const linkedStudentIdsKey = (ids?: string[]) => (ids || []).join('|');

const PathsTab = () => {
    const { paths: storePaths, courses, enrolledPaths, enrollPath, unenrollPath, enrolledCourses, completedLessons, user } = useStore();
    const canSeeHiddenPaths = ['admin', 'teacher', 'supervisor'].includes(user?.role || '');
    
    // Fallback for icons and colors
    const getPathStyle = (pathId: string) => {
        if (pathId === 'p_qudrat') return { icon: <Target size={24} className="text-purple-500" />, bg: 'bg-purple-50', color: 'purple' };
        if (pathId === 'p_tahsili') return { icon: <BookOpen size={24} className="text-blue-500" />, bg: 'bg-blue-50', color: 'blue' };
        if (pathId === 'p_nafes' || pathId === 'nafes') return { icon: <Star size={24} className="text-emerald-500" />, bg: 'bg-emerald-50', color: 'emerald' };
        return { icon: <RouteIcon size={24} className="text-indigo-500" />, bg: 'bg-indigo-50', color: 'indigo' };
    };

    const dPaths = storePaths
        .filter(p => canSeeHiddenPaths || p.isActive !== false)
        .filter(p => typeof p.id === 'string' && p.id.trim().length > 0 && typeof p.name === 'string' && p.name.trim().length > 0)
        .map(p => ({
            id: p.id,
            title: p.name,
            description: `مسار ${p.name}`,
            category: p.name,
            ...getPathStyle(p.id)
        }));

    const activePaths = dPaths.filter(p => enrolledPaths?.includes(p.id));
    const availablePaths = dPaths.filter(p => !enrolledPaths?.includes(p.id));

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">إدارة المسارات التعليمية</h2>
                <p className="text-gray-500">تابع تقدمك في المسارات المسجل بها واستكشف مسارات جديدة.</p>
            </div>

            {/* Active Paths */}
            <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <CheckCircle className="text-emerald-500" size={20} />
                    المسارات الحالية
                </h3>
                {activePaths.length > 0 ? (
                    <div className="grid gap-6">
                        {activePaths.map(path => {
                            // Calculate progress based on enrolled courses in this path
                            const pathCourses = courses.filter(c => !c.isPackage && (c.category === path.category || c.category === path.title) && enrolledCourses.includes(c.id));
                            let pathTotalLessons = 0;
                            let pathCompletedLessons = 0;
                            pathCourses.forEach(course => {
                                course.modules?.forEach(mod => {
                                    pathTotalLessons += mod.lessons.length;
                                    pathCompletedLessons += mod.lessons.filter(l => completedLessons.includes(l.id)).length;
                                });
                            });
                            const pathProgress = pathTotalLessons > 0 ? Math.round((pathCompletedLessons / pathTotalLessons) * 100) : 0;

                            return (
                                <Card key={path.id} className="p-6 border-2 border-transparent hover:border-gray-100 transition-all">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${path.bg}`}>
                                                {path.icon}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-xl text-gray-900 mb-1">{path.title}</h3>
                                                <p className="text-sm text-gray-500">{path.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex-1 max-w-md w-full">
                                            <div className="flex justify-between text-sm mb-2">
                                                <span className="font-bold text-gray-700">نسبة الإنجاز</span>
                                                <span className="font-bold text-amber-500">{pathProgress}%</span>
                                            </div>
                                            <ProgressBar percentage={pathProgress} color="secondary" />
                                            <p className="text-xs text-gray-400 mt-2 text-left">
                                                {pathCourses.length} دورات مسجلة
                                            </p>
                                        </div>
                                        <div className="shrink-0 flex flex-col gap-2">
                                            <Link to={`/category/${path.id}`} className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors inline-block text-center w-full md:w-auto">
                                                متابعة المسار
                                            </Link>
                                            <button 
                                                onClick={() => unenrollPath(path.id)}
                                                className="text-red-500 text-sm font-bold hover:text-red-600 transition-colors text-center w-full"
                                            >
                                                إلغاء التسجيل
                                            </button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-300">
                        <RouteIcon size={40} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">لست مسجلاً في أي مسار حالياً.</p>
                    </div>
                )}
            </div>

            {/* Available Paths */}
            {availablePaths.length > 0 && (
                <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Target className="text-indigo-500" size={20} />
                        مسارات متاحة للتسجيل
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {availablePaths.map(path => (
                            <Card key={path.id} className="p-6 flex flex-col h-full hover:shadow-md transition-shadow">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${path.bg}`}>
                                    {path.icon}
                                </div>
                                <h3 className="font-bold text-lg text-gray-900 mb-2">{path.title}</h3>
                                <p className="text-sm text-gray-500 mb-6 flex-1">{path.description}</p>
                                <button 
                                    onClick={() => enrollPath(path.id)}
                                    className="w-full bg-indigo-50 text-indigo-700 py-2 rounded-lg font-bold hover:bg-indigo-100 transition-colors"
                                >
                                    تسجيل في المسار
                                </button>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const SmartPathTab = () => {
    const { examResults } = useStore();
    const smartPathSkills = buildSmartPathSkillsFromResults(examResults);

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">مسار التعلم الذكي</h2>
            <p className="text-gray-600 mb-8">نظام الذكاء الاصطناعي يحلل أداءك ويقترح لك أفضل الخطوات التالية لرفع مستواك.</p>
            <SmartLearningPath skills={smartPathSkills} />
        </div>
    );
};

const SessionsTab = () => {
    const { recentActivity, lessons, user } = useStore();
    const sessions = recentActivity.filter(a => a.type === 'session_booked');
    const liveSessions = lessons
        .filter((lesson) => ['live_youtube', 'zoom', 'google_meet', 'teams'].includes(lesson.type))
        .filter((lesson) => {
            if (lesson.showOnPlatform === false && user.role === 'student') return false;
            if (lesson.approvalStatus && lesson.approvalStatus !== 'approved' && user.role === 'student') return false;
            if (lesson.accessControl === 'public' || !lesson.accessControl) return true;
            if (lesson.accessControl === 'specific_groups') {
                const userGroups = user.groupIds || [];
                return (lesson.allowedGroupIds || []).some((groupId: string) => userGroups.includes(groupId));
            }
            return user.role !== 'student' || user.subscription?.plan === 'premium' || (user.subscription?.purchasedPackages || []).length > 0;
        })
        .sort((a, b) => {
            const aDate = a.meetingDate ? new Date(a.meetingDate).getTime() : Number.MAX_SAFE_INTEGER;
            const bDate = b.meetingDate ? new Date(b.meetingDate).getTime() : Number.MAX_SAFE_INTEGER;
            return aDate - bDate;
        })
        .slice(0, 3);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                <h2 className="text-2xl font-bold text-gray-800">جلساتي الخاصة</h2>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Link to="/live-sessions" className="bg-white border border-indigo-200 text-indigo-700 px-5 py-2 rounded-xl font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2">
                        <Video size={18} />
                        الحصص المباشرة
                    </Link>
                    <Link to="/book-session" className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                        <Calendar size={18} />
                        حجز حصة جديدة
                    </Link>
                </div>
            </div>

            {liveSessions.length > 0 && (
                <Card className="p-5 border border-indigo-100 bg-indigo-50/60">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="text-right">
                            <h3 className="text-lg font-bold text-gray-900">أقرب الحصص المباشرة</h3>
                            <p className="text-sm text-gray-600 mt-1">هذه الحصص متاحة لك الآن من المعلمين أو الإدارة داخل المنصة.</p>
                        </div>
                        <Link to="/live-sessions" className="text-indigo-700 font-bold hover:text-indigo-800 transition-colors">
                            عرض كل الحصص
                        </Link>
                    </div>
                    <div className="grid gap-3 mt-4">
                        {liveSessions.map((lesson) => (
                            <div key={lesson.id} className="bg-white rounded-xl border border-indigo-100 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="text-right">
                                    <div className="font-bold text-gray-900">{lesson.title}</div>
                                    <div className="text-sm text-gray-500 mt-1">
                                        {lesson.meetingDate
                                            ? new Date(lesson.meetingDate).toLocaleString('ar-SA', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })
                                            : 'سيُحدد الموعد قريبًا'}
                                    </div>
                                </div>
                                <Link to="/live-sessions" className="text-sm font-bold text-indigo-700 hover:text-indigo-800 transition-colors">
                                    تفاصيل الحصة
                                </Link>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {sessions.length > 0 ? (
                <div className="grid gap-4">
                    {sessions.map(session => (
                        <Card key={session.id} className="p-5 flex items-center justify-between border-l-4 border-indigo-500">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                                    <Clock size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-gray-900">{session.title}</h3>
                                    <p className="text-sm text-gray-500">{new Date(session.date).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                </div>
                            </div>
                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                                مؤكد
                            </span>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                    <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-bold text-gray-700 mb-2">لا توجد جلسات قادمة</h3>
                    <p className="text-gray-500 mb-6">احجز حصة خاصة مع نخبة من المعلمين أو تابع الحصص المباشرة المتاحة داخل المنصة.</p>
                    <Link to="/book-session" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors inline-block">
                        احجز الآن
                    </Link>
                </div>
            )}
        </div>
    );
};

const MyCoursesTab = () => {
    const { courses, enrolledCourses, completedLessons } = useStore();
    const activeCourses = courses.filter(c => !c.isPackage && enrolledCourses.includes(c.id));

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">دوراتي</h2>
                <Link to="/courses" className="text-amber-500 font-bold hover:text-amber-600 transition-colors">
                    تصفح المزيد من الدورات
                </Link>
            </div>

            {activeCourses.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeCourses.map(course => {
                        const totalLessons = course.modules?.reduce((acc, mod) => acc + mod.lessons.length, 0) || 0;
                        const completed = course.modules?.reduce((acc, mod) => acc + mod.lessons.filter(l => completedLessons.includes(l.id)).length, 0) || 0;
                        const progress = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;

                        return (
                            <Card key={course.id} className="flex flex-col h-full hover:shadow-xl transition-shadow duration-300 border border-gray-100 overflow-hidden">
                                <div className="relative h-40 bg-gray-100 group overflow-hidden">
                                    <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
                                </div>
                                <div className="p-5 flex-1 flex flex-col">
                                    <h3 className="font-bold text-lg text-gray-900 mb-2">{course.title}</h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                                        <User size={14} />
                                        <span>{course.instructor}</span>
                                    </div>
                                    <div className="mt-auto">
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="font-bold text-gray-700">نسبة الإنجاز</span>
                                            <span className="font-bold text-amber-500">{progress}%</span>
                                        </div>
                                        <ProgressBar percentage={progress} color="secondary" />
                                        <Link to={`/course/${course.id}`} className="mt-4 w-full bg-gray-900 text-white py-2 rounded-lg font-bold hover:bg-gray-800 transition-colors block text-center">
                                            متابعة التعلم
                                        </Link>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                    <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-bold text-gray-700 mb-2">لا توجد دورات مسجلة</h3>
                    <p className="text-gray-500 mb-6">قم بالتسجيل في دورات لتبدأ رحلتك التعليمية</p>
                    <Link to="/courses" className="bg-amber-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-amber-600 transition-colors inline-block">
                        تصفح الدورات
                    </Link>
                </div>
            )}
        </div>
    );
};

const Dashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { user } = useStore();
    const location = useLocation();
    const isParentDashboard = user.role === Role.PARENT;

    const studentMenuItems = [
        { id: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard size={20} /> },
        { id: 'paths', label: 'مساراتي', icon: <RouteIcon size={20} /> },
        { id: 'my-courses', label: 'دوراتي', icon: <BookOpen size={20} /> },
        { id: 'smart-path', label: 'التعلم الذكي', icon: <Brain size={20} /> },
        { id: 'sessions', label: 'جلساتي', icon: <Calendar size={20} /> },
        { id: 'saher', label: 'مركز الاختبارات', icon: <Zap size={20} /> },
        { id: 'quizzes', label: 'اختباراتي', icon: <FileText size={20} /> },
        { id: 'reports', label: 'تقاريري', icon: <PieChart size={20} /> },
        { id: 'favorites', label: 'مركز مراجعة الأسئلة', icon: <Heart size={20} /> },
                { id: 'plan', label: 'خطتي', icon: <MapIcon size={20} /> },
        { id: 'qa', label: 'سؤال وجواب', icon: <HelpCircle size={20} /> },
        { id: 'requests', label: 'طلباتي', icon: <ShoppingCart size={20} /> },
    ];

    const parentMenuItems = [
        { id: 'overview', label: 'متابعة الأبناء', icon: <LayoutDashboard size={20} /> },
        { id: 'parent-results', label: 'نتائج الأبناء', icon: <FileText size={20} /> },
        { id: 'parent-skills', label: 'المهارات الضعيفة', icon: <Target size={20} /> },
        { id: 'reports', label: 'تقرير مبسط', icon: <PieChart size={20} /> },
        { id: 'requests', label: 'طلبات الدفع', icon: <ShoppingCart size={20} /> },
        { id: 'qa', label: 'سؤال وجواب', icon: <HelpCircle size={20} /> },
    ];

    const menuItems = isParentDashboard ? parentMenuItems : studentMenuItems;

    useEffect(() => {
        const requestedTab = new URLSearchParams(location.search).get('tab');
        const allowedTabs = new Set(menuItems.map((item) => item.id));

        if (requestedTab && allowedTabs.has(requestedTab)) {
            setActiveTab(requestedTab as typeof activeTab);
        }
    }, [location.search]);

    // Render Content Based on Tab
    const renderContent = () => {
        if (isParentDashboard) {
            switch(activeTab) {
                case 'overview': return <ParentDashboardOverview setActiveTab={setActiveTab} />;
                case 'parent-results': return <ParentResultsTab />;
                case 'parent-skills': return <ParentSkillsTab />;
                case 'parent-followup': return <ParentDashboardOverview setActiveTab={setActiveTab} />;
                case 'reports': return <Suspense fallback={<TabLoading />}><Reports /></Suspense>;
                case 'requests': return <Suspense fallback={<TabLoading />}><MyRequests /></Suspense>;
                case 'qa': return <Suspense fallback={<TabLoading />}><QA /></Suspense>;
                default: return <ParentDashboardOverview setActiveTab={setActiveTab} />;
            }
        }

        switch(activeTab) {
            case 'overview': return <OverviewTab setActiveTab={setActiveTab} />;
            case 'paths': return <PathsTab />;
            case 'my-courses': return <MyCoursesTab />;
            case 'smart-path': return <SmartPathTab />;
            case 'sessions': return <SessionsTab />;
            case 'saher': return <Suspense fallback={<TabLoading />}><Quizzes /></Suspense>;
            case 'quizzes': return <Suspense fallback={<TabLoading />}><Quizzes view="attempts" /></Suspense>;
            case 'reports': return <Suspense fallback={<TabLoading />}><Reports /></Suspense>;
            case 'favorites': return <Suspense fallback={<TabLoading />}><Favorites /></Suspense>;
            case 'plan': return <Suspense fallback={<TabLoading />}><Plan /></Suspense>;
            case 'qa': return <Suspense fallback={<TabLoading />}><QA /></Suspense>;
            case 'requests': return <Suspense fallback={<TabLoading />}><MyRequests /></Suspense>;
            default: return <OverviewTab setActiveTab={setActiveTab} />;
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* Mobile Menu Toggle */}
            <button 
                className="lg:hidden fixed bottom-6 left-6 z-50 bg-amber-500 text-white p-3 rounded-full shadow-lg"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
                {isSidebarOpen ? <X /> : <Menu />}
            </button>

            {/* Sidebar Navigation */}
            <aside className={`
                fixed lg:sticky top-20 right-0 bottom-0 w-64 bg-white border-l border-gray-200 z-40 transition-transform duration-300 overflow-y-auto h-[calc(100vh-5rem)]
                ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
            `}>
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full border-2 border-amber-100" loading="lazy" />
                        <div>
                            <h3 className="font-bold text-gray-800 text-sm">{user.name}</h3>
                            <span className="text-xs text-gray-500">
                                {user.role === Role.PARENT ? 'لوحة تحكم ولي الأمر' : 'لوحة تحكم الطالب'}
                            </span>
                        </div>
                    </div>

                    <nav className="space-y-2">
                        {menuItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActiveTab(item.id as any);
                                    setIsSidebarOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                                    activeTab === item.id 
                                    ? 'bg-amber-50 text-amber-600 shadow-sm' 
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    {item.icon}
                                    {item.label}
                                </div>
                                {activeTab === item.id && <ChevronLeft size={16} />}
                            </button>
                        ))}
                    </nav>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 p-4 lg:p-8 w-full max-w-[100vw] lg:max-w-[calc(100vw-16rem)]">
                <div className="max-w-5xl mx-auto">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

// -- Sub-Components --

const ParentLoadingState = () => (
    <div className="flex items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-sm font-bold text-gray-500">
        <Loader2 size={18} className="ml-2 animate-spin text-emerald-600" />
        جاري تحميل بيانات الأبناء...
    </div>
);

const ParentEmptyState = () => (
    <Card className="p-8 text-center">
        <User size={42} className="mx-auto mb-4 text-gray-300" />
        <h3 className="text-xl font-black text-gray-900">لا توجد بيانات متابعة بعد</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-gray-500">
            اربط حساب ولي الأمر بالطالب من إدارة المستخدمين. بعد أول اختبار أو محاولة تدريب ستظهر النتائج والمهارات هنا تلقائيًا.
        </p>
    </Card>
);

const ParentErrorState = ({ message }: { message: string }) => (
    <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 text-sm font-bold text-rose-700">
        {message}
    </div>
);

const ParentDashboardOverview = ({ setActiveTab }: { setActiveTab: (tab: DashboardTab) => void }) => {
    const data = useParentScopedResults();
    const trend = data.lastThreeAverage - data.olderThreeAverage;
    const [copiedCoachMessage, setCopiedCoachMessage] = useState(false);
    const [showParentDetails, setShowParentDetails] = useState(false);

    const copyCoachMessage = async () => {
        try {
            await navigator.clipboard?.writeText(data.coachMessage);
            setCopiedCoachMessage(true);
            window.setTimeout(() => setCopiedCoachMessage(false), 1800);
        } catch {
            setCopiedCoachMessage(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-slate-900 p-5 text-white shadow-lg">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="mb-2 text-xs font-black text-emerald-100">لوحة ولي الأمر</div>
                        <h2 className="text-xl font-black md:text-2xl">متابعة الأبناء ببساطة</h2>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-emerald-50">درجة، مهارة تحتاج متابعة، وخطوة واحدة واضحة.</p>
                    </div>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className="self-start rounded-xl bg-white px-4 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-50"
                    >
                        التقرير
                    </button>
                </div>
            </div>

            {data.isLoading ? <ParentLoadingState /> : data.loadError ? <ParentErrorState message={data.loadError} /> : null}

            {!data.isLoading && !data.loadError ? (
                data.scopedResults.length === 0 ? (
                    <ParentEmptyState />
                ) : (
                    <>
                        <Card className="p-4">
                            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900">متابعة اليوم</h3>
                                    <p className="mt-1 text-sm text-gray-500">خطوة واحدة تكفي.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowParentDetails((current) => !current)}
                                    className="self-start rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                                >
                                    {showParentDetails ? 'إخفاء التفاصيل' : 'استعراض أكثر'}
                                </button>
                            </div>
                            {data.priorityWeakSkills.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 md:col-span-2">
                                        <div className="text-xs font-black text-amber-700">الأولوية الأقرب</div>
                                        <div className="mt-2 text-lg font-black leading-7 text-gray-900">{data.priorityWeakSkills[0].skill}</div>
                                        <p className="mt-2 text-sm leading-6 text-gray-600">10 دقائق مع {data.priorityWeakSkills[0].studentName}، ثم سؤالان فقط.</p>
                                    </div>
                                    <div className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
                                        <div className="text-xs font-black text-gray-500">درجة الإتقان</div>
                                        <div className="mt-2 text-3xl font-black text-amber-700">{Math.round(data.priorityWeakSkills[0].mastery)}%</div>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('parent-skills')}
                                            className="mt-4 w-full rounded-xl bg-white px-4 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-50"
                                        >
                                            عرض المهارات
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-2xl bg-emerald-50 p-5 text-sm font-bold leading-7 text-emerald-700">
                                    الأداء الحالي مطمئن. يكفي سؤال قصير بعد المذاكرة.
                                </div>
                            )}
                        </Card>

                        {showParentDetails ? (
                        <>
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <Card className="p-4">
                                <div className="text-xs font-bold text-gray-500">الأبناء المرتبطون</div>
                                <div className="mt-2 text-2xl font-black text-gray-900">{data.childrenCount}</div>
                            </Card>
                            <Card className="p-4">
                                <div className="text-xs font-bold text-gray-500">اختبارات مرصودة</div>
                                <div className="mt-2 text-2xl font-black text-blue-700">{data.scopedResults.length}</div>
                            </Card>
                            <Card className="p-4">
                                <div className="text-xs font-bold text-gray-500">متوسط الأداء</div>
                                <div className="mt-2 text-2xl font-black text-emerald-700">{data.averageScore}%</div>
                            </Card>
                            <Card className="p-4">
                                <div className="text-xs font-bold text-gray-500">اتجاه آخر المحاولات</div>
                                <div className={`mt-2 text-2xl font-black ${trend >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                    {trend > 0 ? '+' : ''}{trend}%
                                </div>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                            <Card className="p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-lg font-black text-gray-900">الأبناء</h3>
                                    <button onClick={() => setActiveTab('parent-results')} className="text-xs font-black text-emerald-700 hover:underline">
                                        كل النتائج
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {data.childCards.map((child) => (
                                        <div key={child.id} className="rounded-2xl border border-gray-100 p-3">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <img src={child.avatar} alt={child.name} className="h-10 w-10 rounded-full object-cover" />
                                                    <div className="min-w-0">
                                                        <div className="truncate font-black text-gray-900">{child.name}</div>
                                                        <div className="text-xs text-gray-500">{child.results} محاولة مرصودة</div>
                                                    </div>
                                                </div>
                                                <div className={`rounded-xl border px-3 py-2 text-sm font-black ${scoreTone(child.average)}`}>
                                                    {child.average}%
                                                </div>
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
                                                <div className="truncate rounded-xl bg-gray-50 px-3 py-2 text-gray-600">{child.latestResult?.quizTitle || 'لا يوجد'}</div>
                                                <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-700">متابعة: {child.weakCount}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            <Card className="p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-lg font-black text-gray-900">أولويات هذا الأسبوع</h3>
                                    <button onClick={() => setActiveTab('parent-skills')} className="text-xs font-black text-emerald-700 hover:underline">
                                        كل المهارات
                                    </button>
                                </div>
                                {data.priorityWeakSkills.length > 0 ? (
                                    <div className="space-y-3">
                                        {data.priorityWeakSkills.map((skill) => (
                                            <div key={`${skill.key}-${skill.studentName}-${skill.quizTitle}`} className="rounded-2xl bg-amber-50 p-3">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <div className="truncate font-black text-gray-900">{skill.skill}</div>
                                                        <div className="mt-1 text-xs text-gray-500">{skill.studentName} - {skill.quizTitle}</div>
                                                    </div>
                                                    <div className="font-black text-amber-700">{Math.round(skill.mastery)}%</div>
                                                </div>
                                                <div className="mt-2 text-xs font-bold text-amber-700">شرح قصير ثم تدريب خفيف.</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl bg-emerald-50 p-5 text-sm font-bold text-emerald-700">
                                        لا توجد نقاط ضعف واضحة في آخر النتائج. استمر في المتابعة الهادئة.
                                    </div>
                                )}
                            </Card>

                            <Card className="p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-lg font-black text-gray-900">رسالة ولي الأمر</h3>
                                    <MessageCircle size={18} className="text-emerald-600" />
                                </div>
                                <div className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold leading-6 text-emerald-900">
                                    {data.coachMessage}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void copyCoachMessage()}
                                    className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-50"
                                >
                                    <Copy size={15} />
                                    {copiedCoachMessage ? 'تم النسخ' : 'نسخ الرسالة'}
                                </button>
                            </Card>
                        </div>
                        </>
                        ) : null}
                    </>
                )
            ) : null}
        </div>
    );
};

const ParentResultsTab = () => {
    const data = useParentScopedResults();

    if (data.isLoading) return <ParentLoadingState />;
    if (data.loadError) return <ParentErrorState message={data.loadError} />;
    if (data.scopedResults.length === 0) return <ParentEmptyState />;

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div>
                <h2 className="text-2xl font-black text-gray-900">نتائج الأبناء</h2>
                <p className="mt-1 text-sm text-gray-500">آخر المحاولات مرتبة من الأحدث للأقدم مع الدرجة وتاريخ الاختبار.</p>
            </div>
            <div className="space-y-3">
                {data.scopedResults.map((result, index) => {
                    const weakSkills = [...(result.skillsAnalysis || [])]
                        .filter((skill) => Number(skill.mastery ?? 100) < 75 || skill.status === 'weak')
                        .sort((a, b) => Number(a.mastery || 0) - Number(b.mastery || 0))
                        .slice(0, 2);

                    return (
                        <Card key={result.id || `${result.quizId}-${index}`} className="p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="text-lg font-black text-gray-900">{result.quizTitle}</div>
                                    <div className="mt-1 text-sm text-gray-500">{getStudentLabel(result)} - {formatParentDate(result)}</div>
                                </div>
                                <div className={`self-start rounded-2xl border px-4 py-3 text-xl font-black md:self-auto ${scoreTone(Number(result.score) || 0)}`}>
                                    {Math.round(Number(result.score) || 0)}%
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-gray-600 sm:grid-cols-4">
                                <div className="rounded-xl bg-gray-50 p-3">الأسئلة: {result.totalQuestions || 0}</div>
                                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">صحيح: {result.correctAnswers || 0}</div>
                                <div className="rounded-xl bg-rose-50 p-3 text-rose-700">خطأ: {result.wrongAnswers || 0}</div>
                                <div className="rounded-xl bg-blue-50 p-3 text-blue-700">الوقت: {result.timeSpent || 'غير محدد'}</div>
                            </div>
                            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                                <div className="text-xs font-black text-slate-500">تحليل هذه المحاولة</div>
                                {weakSkills.length ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {weakSkills.map((skill) => (
                                            <span key={`${result.id || result.quizId}-${skill.skillId || skill.skill}`} className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700">
                                                {skill.skill}: {Math.round(Number(skill.mastery) || 0)}%
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-2 text-sm font-bold text-emerald-700">لا توجد مهارة ضعيفة واضحة في هذه المحاولة.</div>
                                )}
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <Link to="/dashboard?tab=parent-skills" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-sm font-black text-white hover:bg-indigo-700">
                                    التحليل العام للمهارات
                                </Link>
                                <Link to="/reports" className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-center text-sm font-black text-emerald-700 hover:bg-emerald-100">
                                    تقرير ولي الأمر
                                </Link>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

const ParentSkillsTab = () => {
    const data = useParentScopedResults();

    if (data.isLoading) return <ParentLoadingState />;
    if (data.loadError) return <ParentErrorState message={data.loadError} />;
    if (data.scopedResults.length === 0) return <ParentEmptyState />;

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div>
                <h2 className="text-2xl font-black text-gray-900">المهارات التي تحتاج متابعة</h2>
                <p className="mt-1 text-sm text-gray-500">ترتيب عملي لما يحتاجه الأبناء بناءً على نتائجهم الفعلية.</p>
            </div>
            {data.weakSkills.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {data.weakSkills.map((skill) => (
                        <Card key={`${skill.key}-${skill.studentName}-${skill.quizTitle}`} className="p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <h3 className="truncate text-lg font-black text-gray-900">{skill.skill}</h3>
                                    <p className="mt-1 text-sm text-gray-500">{skill.studentName}</p>
                                    <p className="mt-1 text-xs text-gray-400">{skill.quizTitle}</p>
                                </div>
                                <div className={`rounded-xl border px-3 py-2 text-sm font-black ${scoreTone(skill.mastery)}`}>
                                    {Math.round(skill.mastery)}%
                                </div>
                            </div>
                            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                                خطة متابعة مقترحة: مراجعة شرح قصير، حل 5 أسئلة على نفس المهارة، ثم إعادة محاولة صغيرة بعد يوم.
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="p-8 text-center">
                    <CheckCircle size={42} className="mx-auto mb-4 text-emerald-500" />
                    <h3 className="text-xl font-black text-gray-900">الأداء مستقر حاليًا</h3>
                    <p className="mt-2 text-sm text-gray-500">لا توجد مهارات ضعيفة واضحة في النتائج الحالية.</p>
                </Card>
            )}
        </div>
    );
};

const ParentFollowUpTab = () => {
    const data = useParentScopedResults();
    const [copiedPlan, setCopiedPlan] = useState(false);
    const urgentChildren = data.childCards.filter((child) => child.average < 70 || child.weakCount >= 3);
    const stableChildren = data.childCards.filter((child) => child.average >= 80 && child.weakCount === 0);
    const weeklyPlanText = [
        'خطة متابعة ولي الأمر:',
        ...data.followUpPlan.map((item) => `${item.day}: ${item.studentName} - ${item.skill} (${Math.round(item.mastery)}%). ${item.action} ${item.check}`),
        data.coachMessage ? `ملاحظة عامة: ${data.coachMessage}` : '',
    ].filter(Boolean).join('\n');

    const copyWeeklyPlan = async () => {
        try {
            await navigator.clipboard?.writeText(weeklyPlanText);
            setCopiedPlan(true);
            window.setTimeout(() => setCopiedPlan(false), 1800);
        } catch {
            setCopiedPlan(false);
        }
    };

    if (data.isLoading) return <ParentLoadingState />;
    if (data.loadError) return <ParentErrorState message={data.loadError} />;
    if (data.scopedResults.length === 0) return <ParentEmptyState />;

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="text-sm font-bold text-emerald-600">خطة ولي الأمر</div>
                        <h2 className="mt-2 text-2xl font-black text-gray-900">متابعة أسبوعية بدون ضغط</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-7 text-gray-500">
                            هذه الصفحة تحول النتائج والمهارات الضعيفة إلى خطوات متابعة بسيطة تستطيع تنفيذها في البيت.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void copyWeeklyPlan()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700"
                    >
                        <Copy size={16} />
                        {copiedPlan ? 'تم نسخ الخطة' : 'نسخ خطة المتابعة'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="p-5">
                    <div className="text-xs font-bold text-gray-500">يحتاجون متابعة قريبة</div>
                    <div className="mt-2 text-3xl font-black text-rose-600">{urgentChildren.length}</div>
                    <p className="mt-2 text-xs leading-6 text-gray-500">متوسط أقل من 70% أو ثلاث مهارات ضعيفة فأكثر.</p>
                </Card>
                <Card className="p-5">
                    <div className="text-xs font-bold text-gray-500">أداء مستقر</div>
                    <div className="mt-2 text-3xl font-black text-emerald-700">{stableChildren.length}</div>
                    <p className="mt-2 text-xs leading-6 text-gray-500">متوسط 80% فأكثر ولا توجد مهارات ضعيفة واضحة.</p>
                </Card>
                <Card className="p-5">
                    <div className="text-xs font-bold text-gray-500">خطوات هذا الأسبوع</div>
                    <div className="mt-2 text-3xl font-black text-indigo-700">{data.followUpPlan.length}</div>
                    <p className="mt-2 text-xs leading-6 text-gray-500">كل خطوة قصيرة ومحددة بعلامة تحقق واضحة.</p>
                </Card>
            </div>

            <Card className="p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className="text-lg font-black text-gray-900">جدول 3 أيام</h3>
                        <p className="mt-1 text-sm text-gray-500">نفذ خطوة واحدة فقط في اليوم، والهدف هو تحسين عادة المراجعة لا الضغط.</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                        مناسب لولي الأمر
                    </span>
                </div>

                {data.followUpPlan.length > 0 ? (
                    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                        {data.followUpPlan.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-gray-100 bg-slate-50 p-5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700">{item.day}</span>
                                    <span className={`rounded-full px-3 py-1 text-xs font-black ${item.mastery < 50 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                                        {Math.round(item.mastery)}%
                                    </span>
                                </div>
                                <div className="mt-4 text-sm font-bold text-gray-500">{item.studentName}</div>
                                <h4 className="mt-1 text-lg font-black leading-7 text-gray-900">{item.skill}</h4>
                                <p className="mt-3 text-sm leading-7 text-gray-600">{item.action}</p>
                                <div className="mt-4 rounded-xl bg-white p-3 text-xs font-bold leading-6 text-emerald-700">{item.check}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-5 rounded-2xl bg-emerald-50 p-5 text-sm font-bold text-emerald-700">
                        لا توجد خطة علاجية الآن لأن النتائج الحالية لا تظهر ضعفًا واضحًا.
                    </div>
                )}
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card className="p-5">
                    <h3 className="text-lg font-black text-gray-900">تنبيهات تحتاج انتباه</h3>
                    <div className="mt-4 space-y-3">
                        {urgentChildren.length > 0 ? urgentChildren.map((child) => (
                            <div key={child.id} className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="font-black text-gray-900">{child.name}</div>
                                    <div className="rounded-full bg-white px-3 py-1 text-xs font-black text-rose-700">{child.average}%</div>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-rose-700">
                                    ابدأ معه بجلسة قصيرة، وركز على مهارة واحدة فقط من القائمة بدل مراجعة كل شيء مرة واحدة.
                                </p>
                            </div>
                        )) : (
                            <div className="rounded-2xl bg-emerald-50 p-5 text-sm font-bold leading-7 text-emerald-700">
                                لا توجد تنبيهات عاجلة الآن. المتابعة الخفيفة كافية.
                            </div>
                        )}
                    </div>
                </Card>

                <Card className="p-5">
                    <h3 className="text-lg font-black text-gray-900">أسئلة تسألها لابنك</h3>
                    <div className="mt-4 space-y-3">
                        {[
                            'ما السؤال الذي كان أصعب شيء عليك اليوم؟',
                            'ما المهارة التي تريد أن نراجعها في 10 دقائق فقط؟',
                            'هل الخطأ كان بسبب فهم الفكرة أم بسبب السرعة؟',
                            'اشرح لي الحل بصوتك كأنك أنت المعلم.',
                        ].map((question) => (
                            <div key={question} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-bold leading-7 text-gray-700">
                                {question}
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};

const ParentFollowUpPanel = ({ setActiveTab }: { setActiveTab: (tab: any) => void }) => {
    const data = useParentScopedResults();
    const trend = data.lastThreeAverage - data.olderThreeAverage;

    if (data.scopedResults.length === 0 && !data.isLoading && !data.loadError) return null;

    return (
        <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="text-xl font-black text-gray-900">متابعة الأبناء</h3>
                    <p className="mt-1 text-sm leading-6 text-gray-500">
                        ملخص سريع لآخر نتائج الأبناء المرتبطين بحسابك ونقاط الضعف التي تحتاج متابعة.
                    </p>
                </div>
                <button
                    onClick={() => setActiveTab('parent-followup')}
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700"
                >
                    فتح خطة المتابعة
                </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-emerald-50 p-4">
                    <div className="text-xs font-bold text-emerald-700">الأبناء المرتبطون</div>
                    <div className="mt-2 text-2xl font-black text-emerald-800">{data.childrenCount}</div>
                </div>
                <div className="rounded-2xl bg-blue-50 p-4">
                    <div className="text-xs font-bold text-blue-700">اختبارات مرصودة</div>
                    <div className="mt-2 text-2xl font-black text-blue-800">{data.scopedResults.length}</div>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4">
                    <div className="text-xs font-bold text-amber-700">متوسط الأداء</div>
                    <div className="mt-2 text-2xl font-black text-amber-800">{data.averageScore}%</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs font-bold text-slate-700">الاتجاه</div>
                    <div className={`mt-2 text-2xl font-black ${trend >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{trend > 0 ? '+' : ''}{trend}%</div>
                </div>
            </div>
        </section>
    );
};

// 1. OverviewTab (Smart Dashboard Content)
const OverviewTab = ({ setActiveTab }: { setActiveTab: (tab: any) => void }) => {
    const { courses, user, enrolledCourses, completedLessons, examResults, recentActivity, paths: storePaths, enrolledPaths } = useStore();
    const smartPathSkills = buildSmartPathSkillsFromResults(examResults);
    const canSeeHiddenPaths = ['admin', 'teacher', 'supervisor'].includes(user?.role || '');
    
    // Debugging logs as requested
    // Get full course objects for enrolled courses
    const activeCourses = courses.filter(c => !c.isPackage && enrolledCourses.includes(c.id));

    // Calculate overall progress
    let totalLessonsInEnrolled = 0;
    activeCourses.forEach(course => {
        course.modules?.forEach(mod => {
            totalLessonsInEnrolled += mod.lessons.length;
        });
    });
    const overallProgress = totalLessonsInEnrolled > 0 
        ? Math.round((completedLessons.length / totalLessonsInEnrolled) * 100) 
        : 0;

    // --- Smart Action Logic ---
    let smartAction = null;
    
    // 1. Check for weak skills in recent exams
    const recentExamsWithSkills = examResults.filter(r => r.skillsAnalysis && r.skillsAnalysis.length > 0);
    if (recentExamsWithSkills.length > 0) {
        const latestExam = recentExamsWithSkills[0];
        const weakSkill = latestExam.skillsAnalysis.find(s => s.status === 'weak' || s.mastery < 50);
        if (weakSkill) {
            smartAction = {
                type: 'skill',
                title: 'مراجعة مهارة ضعيفة',
                desc: `لاحظنا ضعف في مهارة "${weakSkill.skill}". ننصحك بمراجعتها.`,
                buttonText: 'راجع المهارة الآن',
                link: '/reports',
                icon: <AlertTriangle size={24} className="text-rose-500" />,
                bg: 'bg-rose-50',
                btnBg: 'bg-rose-600 hover:bg-rose-700'
            };
        }
    }

    // 2. If no weak skill, check for next lesson in an active course
    if (!smartAction && activeCourses.length > 0) {
        const courseToContinue = activeCourses.find(course => {
            const courseLessons = course.modules?.flatMap(m => m.lessons) || [];
            const completedInCourse = courseLessons.filter(l => completedLessons.includes(l.id)).length;
            return completedInCourse < courseLessons.length;
        });

        if (courseToContinue) {
            smartAction = {
                type: 'course',
                title: 'استكمل تعلمك',
                desc: `أنت تبلي بلاءً حسناً في دورة "${courseToContinue.title}". واصل التقدم!`,
                buttonText: 'متابعة الدورة',
                link: `/course/${courseToContinue.id}`,
                icon: <TrendingUp size={24} className="text-indigo-500" />,
                bg: 'bg-indigo-50',
                btnBg: 'bg-indigo-600 hover:bg-indigo-700'
            };
        }
    }

    // 3. Fallback action
    if (!smartAction) {
        smartAction = {
            type: 'quiz',
            title: 'اختبر مستواك',
            desc: 'جرب اختبار ساهر السريع لتقييم مستواك العام.',
            buttonText: 'ابدأ اختبار ساهر',
            link: '/quiz',
            icon: <Zap size={24} className="text-amber-500" />,
            bg: 'bg-amber-50',
            btnBg: 'bg-amber-600 hover:bg-amber-700'
        };
    }

    // --- Group courses by real paths for "My Paths" ---
    const normalize = (value?: string) => (value ?? '').trim().toLowerCase();
    const getSmallPathStyle = (pathId: string) => {
        if (pathId === 'p_qudrat') return { icon: <Target size={20} className="text-purple-500" />, bg: 'bg-purple-50' };
        if (pathId === 'p_tahsili') return { icon: <BookOpen size={20} className="text-blue-500" />, bg: 'bg-blue-50' };
        if (pathId === 'p_nafes' || pathId === 'nafes') return { icon: <Star size={20} className="text-emerald-500" />, bg: 'bg-emerald-50' };
        return { icon: <RouteIcon size={20} className="text-indigo-500" />, bg: 'bg-indigo-50' };
    };

    const enrolledPathSet = new Set(enrolledPaths ?? []);
    const hasExplicitEnrolledPaths = enrolledPathSet.size > 0;
    const relevantPaths = hasExplicitEnrolledPaths
        ? storePaths.filter((path) => enrolledPathSet.has(path.id) && (canSeeHiddenPaths || path.isActive !== false))
        : storePaths.filter((path) => {
            if (!canSeeHiddenPaths && path.isActive === false) return false;
            const pathName = normalize(path.name);
            const pathId = normalize(path.id);
            return activeCourses.some((course) => {
                const category = normalize(course.category);
                return category === pathName || category === pathId;
            });
        });

    const paths = relevantPaths
        .map((path) => {
            const pathName = normalize(path.name);
            const pathId = normalize(path.id);
            const pathCourses = activeCourses.filter((course) => {
                const category = normalize(course.category);
                return category === pathName || category === pathId;
            });

            return {
                id: path.id,
                title: `مسار ${path.name}`,
                courses: pathCourses,
                ...getSmallPathStyle(path.id)
            };
        })
        .filter((path) => path.courses.length > 0);

    return (
    <div className="space-y-8 animate-fade-in pb-20">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
            <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2 leading-tight">لوحة تحكم ذكية - مرحباً، {user.name.split(' ')[0]} 👋</h2>
                <p className="text-gray-500 text-base md:text-lg">جاهز لتحقيق أهدافك اليوم؟</p>
            </div>
            <Link to="/book-session" className="w-full md:w-auto bg-indigo-100 text-indigo-700 px-4 py-2 md:px-6 md:py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-indigo-200 transition-colors">
                <Clock size={20} />
                <span className="hidden md:inline">حجز حصة خاصة</span>
                <span className="md:hidden">حجز حصة</span>
            </Link>
        </div>

        <ParentFollowUpPanel setActiveTab={setActiveTab} />

        <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                
                {/* 1. Smart Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="p-4 flex flex-col items-center text-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-0">
                        <div className="font-black text-2xl sm:text-3xl mb-1">{overallProgress}%</div>
                        <div className="text-xs font-medium text-indigo-100">التقدم العام</div>
                    </Card>
                    <Card className="p-4 flex flex-col items-center text-center justify-center">
                        <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                            <CheckCircle size={20} />
                        </div>
                        <div className="font-black text-xl text-gray-800">{completedLessons.length}</div>
                        <div className="text-xs font-medium text-gray-500">دروس مكتملة</div>
                    </Card>
                    <Card className="p-4 flex flex-col items-center text-center justify-center">
                        <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-2">
                            <FileText size={20} />
                        </div>
                        <div className="font-black text-xl text-gray-800">{examResults.length}</div>
                        <div className="text-xs font-medium text-gray-500">اختبارات منتهية</div>
                    </Card>
                </div>

                {/* 2. Smart Action ("ماذا أفعل الآن؟") */}
                <section>
                    <h3 className="text-xl font-bold text-gray-900 mb-4">ماذا أفعل الآن؟</h3>
                    <Card className={`p-6 border-0 shadow-md ${smartAction.bg}`}>
                        <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-right">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                                {smartAction.icon}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-lg text-gray-900 mb-2">{smartAction.title}</h4>
                                <p className="text-gray-600 text-sm mb-4">{smartAction.desc}</p>
                            </div>
                            <Link 
                                to={smartAction.link || '#'}
                                className={`${smartAction.btnBg} inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-center text-sm font-black text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md md:w-auto`}
                            >
                                <span className="h-2 w-2 rounded-full bg-white/80 animate-pulse" />
                                {smartAction.buttonText}
                            </Link>
                        </div>
                    </Card>
                </section>

                {/* 3. My Paths ("مساراتي") */}
                {paths.length > 0 && (
                    <section>
                        <h3 className="text-xl font-bold text-gray-900 mb-4">مساراتي</h3>
                        <div className="space-y-4">
                            {paths.map(path => {
                                // Calculate progress for this specific path
                                let pathTotalLessons = 0;
                                let pathCompletedLessons = 0;
                                path.courses.forEach(course => {
                                    course.modules?.forEach(mod => {
                                        pathTotalLessons += mod.lessons.length;
                                        pathCompletedLessons += mod.lessons.filter(l => completedLessons.includes(l.id)).length;
                                    });
                                });
                                const pathProgress = pathTotalLessons > 0 ? Math.round((pathCompletedLessons / pathTotalLessons) * 100) : 0;

                                return (
                                    <Card key={path.id} className="p-5 flex flex-col md:flex-row items-center gap-4 hover:shadow-md transition-shadow">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${path.bg}`}>
                                            {path.icon}
                                        </div>
                                        <div className="flex-1 w-full text-center md:text-right">
                                            <h4 className="font-bold text-gray-900 mb-1">{path.title}</h4>
                                            <p className="text-xs text-gray-500 mb-3">{path.courses.length} دورات مسجلة</p>
                                            <ProgressBar percentage={pathProgress} color="secondary" showPercentage={true} />
                                        </div>
                                        <Link 
                                            to={`/course/${path.courses[0].id}`} 
                                            className="w-full md:w-auto mt-4 md:mt-0 bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors text-center"
                                        >
                                            استكمل
                                        </Link>
                                    </Card>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Quick Access Grid (Shortcuts) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                    <button onClick={() => setActiveTab('saher')} className="min-h-[120px] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-2 group">
                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                            <Zap size={24} />
                        </div>
                        <span className="font-bold text-gray-800 text-xs">ساهر</span>
                    </button>
                    <button onClick={() => setActiveTab('quizzes')} className="min-h-[120px] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-2 group">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <FileText size={24} />
                        </div>
                        <span className="font-bold text-gray-800 text-xs">اختباراتي</span>
                    </button>
                    <button onClick={() => setActiveTab('reports')} className="min-h-[120px] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-2 group">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <PieChart size={24} />
                        </div>
                        <span className="font-bold text-gray-800 text-xs">التقارير</span>
                    </button>
                    <button onClick={() => setActiveTab('plan')} className="min-h-[120px] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-2 group">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <MapIcon size={24} />
                        </div>
                        <span className="font-bold text-gray-800 text-xs">خطتي</span>
                    </button>
                </div>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
                {/* 4. Recent Activity (100% from useStore) */}
                <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-900">آخر الأنشطة</h3>
                    </div>
                    {recentActivity.length > 0 ? (
                        <div className="space-y-4">
                            {recentActivity.slice(0, 5).map((activity, index) => (
                                <div key={activity.id} className="flex items-start gap-3 border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                        activity.type === 'lesson_complete' ? 'bg-emerald-50 text-emerald-600' :
                                        activity.type === 'quiz_complete' ? 'bg-blue-50 text-blue-600' :
                                        activity.type === 'skill_practice' ? 'bg-purple-50 text-purple-600' :
                                        'bg-gray-50 text-gray-600'
                                    }`}>
                                        {activity.type === 'lesson_complete' ? <CheckCircle size={18} /> :
                                         activity.type === 'quiz_complete' ? <FileText size={18} /> :
                                         activity.type === 'skill_practice' ? <Clock size={18} /> :
                                         <Clock size={18} />}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-sm text-gray-800 leading-snug">{activity.title}</p>
                                        <p className="text-xs text-gray-500 mt-1">{new Date(activity.date).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            <Clock size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">لم تقم بأي نشاط بعد.</p>
                        </div>
                    )}
                </section>

                <SmartLearningPath skills={smartPathSkills} />
            </div>
        </div>
    </div>
)};

// 2. Saher Tab
const SaherTab = () => {
    const { quizzes, user, checkAccess, examResults, subjects, lessons, libraryItems } = useStore();
    const canAccessQuiz = (quiz: (typeof quizzes)[number]) => {
        if (!quiz.isPublished || (quiz.type ?? 'quiz') !== 'quiz') return false;

        if (quiz.dueDate) {
            const deadline = new Date(`${quiz.dueDate}T23:59:59`);
            if (!Number.isNaN(deadline.getTime()) && Date.now() > deadline.getTime()) return false;
        }

        if ((quiz.mode || 'regular') === 'central') {
            const userGroups = user.groupIds || [];
            const userTargeted = (quiz.targetUserIds || []).length === 0 || (quiz.targetUserIds || []).includes(user.id);
            const groupTargeted =
                (quiz.targetGroupIds || []).length === 0 ||
                (quiz.targetGroupIds || []).some(groupId => userGroups.includes(groupId));
            if (!userTargeted || !groupTargeted) return false;
        }

        const access = quiz.access || { type: 'free' as const };
        if (access.type === 'free') return true;
        if (access.type === 'paid') return checkAccess(quiz.id, true);
        if (access.type === 'private') {
            const userGroups = user.groupIds || [];
            return !!access.allowedGroupIds?.some(groupId => userGroups.includes(groupId));
        }
        return false;
    };

    const preparedTests = quizzes
        .filter((quiz) => canAccessQuiz(quiz))
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const saherTests = preparedTests
        .filter((quiz) => (quiz.mode || 'regular') === 'saher')
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .slice(0, 4);
    const centralTests = preparedTests
        .filter((quiz) => (quiz.mode || 'regular') === 'central')
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .slice(0, 4);
    const weakSkillRecommendations = Array.from(
        examResults.reduce((map, result) => {
            (result.skillsAnalysis || []).forEach(skill => {
                if (skill.mastery >= 75 && skill.status !== 'weak') return;

                const key = skill.skillId || [skill.subjectId, skill.sectionId, skill.skill].filter(Boolean).join(':');
                const existing = map.get(key);
                if (existing) {
                    existing.masterySum += skill.mastery;
                    existing.attempts += 1;
                    return;
                }

                map.set(key, {
                    key,
                    skillId: skill.skillId,
                    pathId: skill.pathId,
                    subjectId: skill.subjectId,
                    sectionId: skill.sectionId,
                    section: skill.section,
                    skill: skill.skill,
                    masterySum: skill.mastery,
                    attempts: 1,
                });
            });

            return map;
        }, new globalThis.Map<string, {
            key: string;
            skillId?: string;
            pathId?: string;
            subjectId?: string;
            sectionId?: string;
            section?: string;
            skill: string;
            masterySum: number;
            attempts: number;
        }>())
    )
        .map(([, item]) => {
            const mastery = Math.round(item.masterySum / item.attempts);
            const relatedQuiz = preparedTests.find((quiz) => {
                const skillMatch = !!item.skillId && (quiz.skillIds || []).includes(item.skillId);
                const subjectMatch = !!item.subjectId && quiz.subjectId === item.subjectId;
                const sectionMatch = !item.sectionId || quiz.sectionId === item.sectionId;
                return skillMatch || (subjectMatch && sectionMatch);
            });

            return {
                ...item,
                mastery,
                subjectName: subjects.find(subject => subject.id === item.subjectId)?.name || 'بدون مادة',
                relatedQuiz,
                recommendedLesson: lessons.find((lesson) =>
                    lesson.showOnPlatform !== false &&
                    (!lesson.approvalStatus || lesson.approvalStatus === 'approved') &&
                    ((!!item.skillId && lesson.skillIds?.includes(item.skillId)) ||
                    (!!item.subjectId && lesson.subjectId === item.subjectId && (!item.sectionId || lesson.sectionId === item.sectionId)))
                ),
                recommendedResource: libraryItems.find((resource) =>
                    resource.showOnPlatform !== false &&
                    (!resource.approvalStatus || resource.approvalStatus === 'approved') &&
                    ((!!item.skillId && resource.skillIds?.includes(item.skillId)) ||
                    (!!item.subjectId && resource.subjectId === item.subjectId && (!item.sectionId || resource.sectionId === item.sectionId)))
                ),
            };
        })
        .filter(item => item.mastery < 75)
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, 2);

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
            {/* Hero Card */}
            <div className="bg-[#a855f7] text-white rounded-2xl p-5 sm:p-8 md:p-12 shadow-lg shadow-purple-100 text-center relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-3 leading-tight">اختبار "ساهر" السريع</h1>
                    <p className="text-purple-100 text-base sm:text-lg mb-6 sm:mb-8">اختبر معرفتك في جميع المواد باختبار شامل وسريع</p>
                    
                    <Link 
                        to="/quiz" 
                        className="cta-attention inline-flex w-full justify-center rounded-xl bg-white px-6 py-2.5 text-base font-black text-[#7c3aed] shadow-md transition-transform hover:-translate-y-1 hover:bg-gray-50 sm:w-auto"
                    >
                        ابدأ اختبار ساهر
                    </Link>
                </div>
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-900 opacity-10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>
            </div>

            {weakSkillRecommendations.length > 0 && (
                <div className="bg-white rounded-2xl border border-amber-100 p-5 space-y-4">
                    <div className="text-right">
                        <h3 className="text-lg font-bold text-gray-800">ترشيحات سريعة حسب نقاط الضعف</h3>
                        <p className="text-sm text-gray-500 mt-1">هذه التوصيات مبنية على نتائجك الأخيرة لمساعدتك على العلاج بسرعة.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {weakSkillRecommendations.map(item => (
                            <Card key={item.key} className="p-4 border border-amber-100">
                                <div className="space-y-3 text-right">
                                    <div>
                                        <div className="font-bold text-gray-800">{item.skill}</div>
                                        <div className="text-xs text-gray-500">
                                            {item.subjectName}
                                            {item.section ? ` - ${item.section}` : ''}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className={`font-bold ${item.mastery < 50 ? 'text-red-500' : 'text-amber-600'}`}>{item.mastery}%</span>
                                        <span className="text-gray-500">الإتقان الحالي</span>
                                    </div>
                                    {(item.recommendedLesson || item.recommendedResource) ? (
                                        <div className="text-xs text-gray-600 space-y-1">
                                            {item.recommendedLesson ? <div>شرح مقترح: <span className="font-bold">{item.recommendedLesson.title}</span></div> : null}
                                            {item.recommendedResource ? <div>ملف داعم: <span className="font-bold">{item.recommendedResource.title}</span></div> : null}
                                        </div>
                                    ) : null}
                                    <div className="space-y-2">
                                        <Link
                                            to={item.relatedQuiz ? `/quiz/${item.relatedQuiz.id}` : '/quiz'}
                                            className="cta-attention inline-block w-full rounded-lg bg-amber-500 px-4 py-2 text-center text-sm font-black text-white transition-colors hover:bg-amber-600"
                                        >
                                            {item.relatedQuiz ? 'ابدأ الاختبار المقترح' : 'أنشئ اختبار ساهر'}
                                        </Link>
                                        {item.recommendedLesson ? (
                                            <Link
                                                to={
                                                    item.subjectId && (item.recommendedLesson.pathId || item.pathId)
                                                        ? `/category/${item.recommendedLesson.pathId || item.pathId}?subject=${item.subjectId}&tab=skills`
                                                        : '/courses'
                                                }
                                                className="inline-block w-full rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-2 text-center text-sm font-black text-indigo-700 transition-colors hover:bg-indigo-100"
                                            >
                                                راجع الشرح أولًا
                                            </Link>
                                        ) : null}
                                        {item.recommendedResource?.url ? (
                                            <a
                                                href={item.recommendedResource.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-block w-full text-center bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-amber-100 transition-colors"
                                            >
                                                افتح الملف الداعم
                                            </a>
                                        ) : null}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Ready Saher Tests */}
            <div>
                <h3 className="text-xl font-bold text-gray-800 mb-6 text-right">اختبارات ساهر الجاهزة</h3>
                <div className="space-y-4">
                    {saherTests.length > 0 ? (
                        saherTests.map(test => (
                            <Card key={test.id} className="p-4 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center hover:shadow-md transition-all border border-gray-100">
                                {/* Button on Left (End in Flex RTL) */}
                                <Link to={`/quiz/${test.id}`} className="w-full sm:w-auto text-center bg-amber-500 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-amber-600 transition-colors shadow-sm">
                                    تفاصيل
                                </Link>

                                {/* Content on Right (Start in Flex RTL) */}
                                <div className="flex items-center gap-4 self-end sm:self-auto">
                                    <div className="text-right">
                                        <h4 className="font-bold text-gray-800 text-sm md:text-base">{test.title}</h4>
                                        <span className="text-gray-400 text-sm font-sans font-medium">{formatQuizCardDate(test.createdAt)}</span>
                                    </div>
                                    <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 border-2 border-purple-100 shrink-0">
                                        <Target size={24} />
                                    </div>
                                </div>
                            </Card>
                        ))
                    ) : (
                        <Card className="p-6 text-center border border-dashed border-gray-200">
                            <p className="text-sm text-gray-500">لا توجد اختبارات ساهر جاهزة لك حاليًا.</p>
                        </Card>
                    )}
                </div>
            </div>

            <div>
                <h3 className="text-xl font-bold text-gray-800 mb-6 text-right">الاختبارات المركزية الموجهة</h3>
                <div className="space-y-4">
                    {centralTests.length > 0 ? (
                        centralTests.map(test => (
                            <Card key={test.id} className="p-4 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center hover:shadow-md transition-all border border-amber-100">
                                <Link to={`/quiz/${test.id}`} className="w-full sm:w-auto text-center bg-amber-500 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-amber-600 transition-colors shadow-sm">
                                    دخول
                                </Link>

                                <div className="flex items-center gap-4 self-end sm:self-auto">
                                    <div className="text-right">
                                        <h4 className="font-bold text-gray-800 text-sm md:text-base">{test.title}</h4>
                                        <span className="text-gray-400 text-sm font-sans font-medium">{formatQuizCardDate(test.createdAt)}</span>
                                    </div>
                                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 border-2 border-amber-100 shrink-0">
                                        <FileText size={24} />
                                    </div>
                                </div>
                            </Card>
                        ))
                    ) : (
                        <Card className="p-6 text-center border border-dashed border-gray-200">
                            <p className="text-sm text-gray-500">لا توجد اختبارات مركزية موجهة لك الآن.</p>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

