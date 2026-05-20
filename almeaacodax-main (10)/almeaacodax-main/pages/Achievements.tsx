import React, { useMemo } from 'react';
import { Award, TrendingUp, Star, Shield, Zap, Clock, ArrowRight, CheckCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';

type BadgeMeta = {
    key: string;
    title: string;
    description: string;
    color: string;
    icon: React.ReactNode;
    earned: (stats: {
        completedLessons: number;
        completedQuizzes: number;
        perfectQuizzes: number;
        activityCount: number;
        enrolledCourses: number;
        masteredSkills: number;
    }) => boolean;
};

const BADGE_CATALOG: BadgeMeta[] = [
    {
        key: 'starter',
        title: 'بداية قوية',
        description: 'أكملت 5 دروس تعليمية على الأقل.',
        color: 'bg-indigo-500',
        icon: <Zap size={24} />,
        earned: (stats) => stats.completedLessons >= 5,
    },
    {
        key: 'quiz_master',
        title: 'متمكن اختباري',
        description: 'أنهيت 3 اختبارات أو أكثر داخل المنصة.',
        color: 'bg-purple-500',
        icon: <TrendingUp size={24} />,
        earned: (stats) => stats.completedQuizzes >= 3,
    },
    {
        key: 'perfect_score',
        title: 'درجة كاملة',
        description: 'حققت نتيجة 100% في اختبار واحد على الأقل.',
        color: 'bg-amber-500',
        icon: <Star size={24} />,
        earned: (stats) => stats.perfectQuizzes >= 1,
    },
    {
        key: 'consistent',
        title: 'ملتزم',
        description: 'لديك سجل نشاط مستمر داخل المنصة.',
        color: 'bg-emerald-500',
        icon: <Clock size={24} />,
        earned: (stats) => stats.activityCount >= 5,
    },
    {
        key: 'skill_builder',
        title: 'باني المهارات',
        description: 'أتقنت 3 مهارات أو أكثر بمستوى قوي.',
        color: 'bg-sky-500',
        icon: <Shield size={24} />,
        earned: (stats) => stats.masteredSkills >= 3,
    },
    {
        key: 'path_runner',
        title: 'مستمر في المسار',
        description: 'التحقت بدورتين أو أكثر وبدأت التقدم فيهما.',
        color: 'bg-rose-500',
        icon: <Award size={24} />,
        earned: (stats) => stats.enrolledCourses >= 2,
    },
];

const formatRelativeActivityDate = (dateString: string) => {
    const activityDate = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.max(0, Math.round((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60)));

    if (Number.isNaN(activityDate.getTime())) {
        return 'منذ فترة قصيرة';
    }
    if (diffInHours < 1) {
        return 'منذ أقل من ساعة';
    }
    if (diffInHours < 24) {
        return `منذ ${diffInHours} ساعة`;
    }

    const diffInDays = Math.round(diffInHours / 24);
    if (diffInDays === 1) {
        return 'أمس';
    }
    if (diffInDays < 7) {
        return `منذ ${diffInDays} أيام`;
    }

    return activityDate.toLocaleDateString('ar-SA');
};

export const Achievements: React.FC = () => {
    const {
        user,
        completedLessons,
        examResults,
        recentActivity,
        enrolledCourses,
    } = useStore();

    const derivedStats = useMemo(() => {
        const completedQuizzes = examResults.length;
        const perfectQuizzes = examResults.filter((result) => result.score >= 100).length;
        const masteredSkills = examResults
            .flatMap((result) => result.skillsAnalysis || [])
            .filter((skill) => skill.mastery >= 80).length;

        return {
            completedLessons: completedLessons.length,
            completedQuizzes,
            perfectQuizzes,
            activityCount: recentActivity.length,
            enrolledCourses: enrolledCourses.length,
            masteredSkills,
        };
    }, [completedLessons.length, examResults, recentActivity.length, enrolledCourses.length]);

    const derivedPoints = useMemo(() => {
        const quizPoints = examResults.reduce((sum, result) => {
            const base = Math.max(20, Math.round(result.score / 2));
            const perfectBonus = result.score >= 100 ? 25 : 0;
            return sum + base + perfectBonus;
        }, 0);

        const lessonPoints = completedLessons.length * 10;
        const activityPoints = recentActivity.length * 5;
        const enrollmentPoints = enrolledCourses.length * 30;
        const storedPoints = Number(user?.points || 0);

        return Math.max(storedPoints, lessonPoints + quizPoints + activityPoints + enrollmentPoints);
    }, [completedLessons.length, enrolledCourses.length, examResults, recentActivity.length, user?.points]);

    const earnedBadges = useMemo(() => {
        const storedBadgeKeys = new Set((Array.isArray(user?.badges) ? user.badges : []).map((badge) => String(badge).toLowerCase()));

        return BADGE_CATALOG.filter((badge) => {
            return badge.earned(derivedStats) || storedBadgeKeys.has(badge.key) || storedBadgeKeys.has(badge.title.toLowerCase());
        });
    }, [derivedStats, user?.badges]);

    const suggestedBadges = useMemo(
        () => BADGE_CATALOG.filter((badge) => !earnedBadges.some((earned) => earned.key === badge.key)).slice(0, 2),
        [earnedBadges],
    );

    const currentLevel = Math.floor(derivedPoints / 1000) + 1;
    const nextLevelPoints = currentLevel * 1000;
    const progressToNextLevel = ((derivedPoints % 1000) / 1000) * 100;
    const remainingPoints = Math.max(0, nextLevelPoints - derivedPoints);

    const activityTimeline = useMemo(() => {
        if (recentActivity.length > 0) {
            return recentActivity.slice(0, 6).map((activity) => {
                const points =
                    activity.type === 'quiz_complete'
                        ? '+50 نقطة'
                        : activity.type === 'lesson_complete'
                          ? '+10 نقاط'
                          : activity.type === 'skill_practice'
                            ? '+20 نقطة'
                            : '+5 نقاط';

                const color =
                    activity.type === 'quiz_complete'
                        ? 'bg-emerald-500'
                        : activity.type === 'lesson_complete'
                          ? 'bg-blue-500'
                          : activity.type === 'skill_practice'
                            ? 'bg-purple-500'
                            : 'bg-amber-500';

                return {
                    id: activity.id,
                    title: activity.title,
                    subtitle: points,
                    date: formatRelativeActivityDate(activity.date),
                    color,
                };
            });
        }

        return examResults.slice(0, 4).map((result, index) => ({
            id: `${result.quizId}-${index}`,
            title: `أنهيت اختبار ${result.quizTitle}`,
            subtitle: `حققت ${result.score}%`,
            date: formatRelativeActivityDate(result.date),
            color: result.score >= 80 ? 'bg-emerald-500' : 'bg-amber-500',
        }));
    }, [examResults, recentActivity]);

    return (
        <div className="space-y-6 pb-20">
            <header className="flex items-start gap-3 sm:gap-4">
                <Link to="/dashboard" className="text-gray-500 hover:text-gray-700"><ArrowRight /></Link>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">الإنجازات</h1>
                    <p className="text-sm text-gray-500">سجل النجاحات والأوسمة والتقدم الحقيقي داخل المنصة</p>
                </div>
            </header>

            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-right">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-2xl sm:text-3xl font-black border-4 border-white/30">
                            {currentLevel}
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold">المستوى {currentLevel}</h2>
                            <p className="text-indigo-200">تقدمك محسوب من الدروس والاختبارات والنشاط الحقيقي</p>
                        </div>
                    </div>

                    <div className="w-full md:w-1/2">
                        <div className="flex justify-between gap-4 text-sm font-bold mb-2">
                            <span>{derivedPoints} نقطة</span>
                            <span>{nextLevelPoints} نقطة</span>
                        </div>
                        <div className="w-full bg-black/20 rounded-full h-4 overflow-hidden">
                            <div
                                className="bg-amber-400 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                                style={{ width: `${progressToNextLevel}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-indigo-200 mt-2 text-right sm:text-left">باقي {remainingPoints} نقطة للوصول إلى المستوى التالي</p>
                    </div>
                </div>
            </div>

            <section>
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Award className="text-amber-500" />
                    الأوسمة المكتسبة
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {earnedBadges.map((badge) => (
                        <Card key={badge.key} className="p-5 flex flex-col items-center text-center gap-3 hover:shadow-md transition-shadow border border-gray-100">
                            <div className={`w-16 h-16 rounded-2xl ${badge.color} text-white flex items-center justify-center shadow-lg rotate-3`}>
                                {badge.icon}
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800">{badge.title}</h4>
                                <p className="text-xs text-gray-500 mt-1">{badge.description}</p>
                            </div>
                        </Card>
                    ))}

                    {suggestedBadges.map((badge) => (
                        <Card key={`suggested-${badge.key}`} className="p-5 flex flex-col items-center text-center gap-3 border border-dashed border-gray-300 bg-gray-50">
                            <div className="w-16 h-16 rounded-2xl bg-gray-200 text-gray-500 flex items-center justify-center shadow-inner">
                                {badge.icon}
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-700">الوسام التالي: {badge.title}</h4>
                                <p className="text-xs text-gray-500 mt-1">{badge.description}</p>
                            </div>
                        </Card>
                    ))}
                </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-5 border border-gray-100">
                    <div className="text-sm text-gray-500 mb-2">الدروس المكتملة</div>
                    <div className="text-2xl font-black text-gray-900">{derivedStats.completedLessons}</div>
                </Card>
                <Card className="p-5 border border-gray-100">
                    <div className="text-sm text-gray-500 mb-2">الاختبارات المنجزة</div>
                    <div className="text-2xl font-black text-gray-900">{derivedStats.completedQuizzes}</div>
                </Card>
                <Card className="p-5 border border-gray-100">
                    <div className="text-sm text-gray-500 mb-2">النتائج الكاملة</div>
                    <div className="text-2xl font-black text-gray-900">{derivedStats.perfectQuizzes}</div>
                </Card>
                <Card className="p-5 border border-gray-100">
                    <div className="text-sm text-gray-500 mb-2">المهارات القوية</div>
                    <div className="text-2xl font-black text-gray-900">{derivedStats.masteredSkills}</div>
                </Card>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-6">سجل النشاط</h3>
                {activityTimeline.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        <CheckCircle size={42} className="mx-auto mb-3 opacity-20" />
                        <p>ابدأ أول درس أو اختبار لتظهر إنجازاتك هنا.</p>
                    </div>
                ) : (
                    <div className="relative border-r-2 border-gray-100 mr-3 space-y-8">
                        {activityTimeline.map((item) => (
                            <div key={item.id} className="relative pr-8">
                                <div className={`absolute -right-[9px] top-1 w-4 h-4 ${item.color} rounded-full border-2 border-white shadow-sm`}></div>
                                <div>
                                    <h4 className="font-bold text-gray-800">{item.title}</h4>
                                    <p className="text-sm text-gray-500 mt-1">{item.subtitle}</p>
                                    <span className="text-xs text-gray-400 block mt-2">{item.date}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};
