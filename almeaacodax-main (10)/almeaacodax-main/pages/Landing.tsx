import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, BookOpen, Target, Zap, Book, Users, Video, BarChart, Star, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { HomepageSettings } from '../types';
import { sanitizeHomepageSettings } from '../utils/sanitizeMojibakeArabic';

const DEFAULT_HERO_BOY_IMAGE =
    '/images/homepage-hero-boy-platform.jpg?v=20260512';

const LEGACY_HERO_IMAGE_HINTS = [
    'saudi-arab-boy-student-wearing-thobe-holding-tablet_1258-122164',
    'girl',
    'woman',
    'female',
    'student-smiling',
    'young-woman',
    'portrait-woman',
    'girl-student',
];

const resolveHomepageHeroImage = (imageUrl?: string) => {
    const trimmed = imageUrl?.trim();
    if (!trimmed) {
        return DEFAULT_HERO_BOY_IMAGE;
    }

    const normalized = trimmed.toLowerCase();
    if (LEGACY_HERO_IMAGE_HINTS.some((hint) => normalized.includes(hint))) {
        return DEFAULT_HERO_BOY_IMAGE;
    }

    return trimmed;
};

const defaultHomepageSettings: HomepageSettings = {
    key: 'default',
    hero: {
        badgeText: 'المنصة الأولى للقدرات والتحصيلي',
        titlePrefix: 'حقق',
        titleHighlight: 'المئة',
        titleSuffix: 'في اختباراتك',
        description: 'رحلة تعليمية ذكية تجمع بين التدريب المكثف، الشروحات التفاعلية، والتحليل الدقيق لنقاط ضعفك لضمان أعلى الدرجات.',
        primaryCtaLabel: 'ابدأ التدريب مجانًا',
        primaryCtaLink: '/dashboard',
        secondaryCtaLabel: 'تصفح الدورات',
        secondaryCtaLink: '/courses',
        imageUrl: DEFAULT_HERO_BOY_IMAGE,
        imageAlt: 'طالب يستخدم منصة المئة',
        floatingCardTitle: 'منصة المئة',
        floatingCardSubtitle: 'مستواك: متقدم',
        floatingCardProgressLabel: 'التقدم',
        floatingCardProgressValue: '75%',
    },
    stats: [
        { id: 'students', label: 'طالب وطالبة', mode: 'dynamic', source: 'students', manualValue: '' },
        { id: 'courses', label: 'دورة تدريبية', mode: 'dynamic', source: 'courses', manualValue: '' },
        { id: 'assets', label: 'مادة تعليمية', mode: 'dynamic', source: 'assets', manualValue: '' },
        { id: 'rating', label: 'تقييم عام', mode: 'dynamic', source: 'rating', manualValue: '' },
    ],
    sections: {
        featuredCoursesTitle: 'الدورات الأكثر طلبًا',
        featuredCoursesSubtitle: 'اختر دورتك وابدأ رحلة التفوق اليوم',
        whyChooseTitle: 'لماذا يختار الطلاب منصة المئة؟',
        whyChooseDescription: 'نحن لا نقدم مجرد دورات، بل نقدم نظامًا تعليميًا متكاملًا يساعدك على الفهم العميق، التدريب المستمر، وتحليل الأداء بطريقة بسيطة وفعالة.',
        testimonialsTitle: 'قصص نجاح نعتز بها',
        testimonialsSubtitle: 'انضم لآلاف الطلاب الذين حققوا أحلامهم معنا',
    },
    typography: {
        headingFont: 'tajawal',
        bodyFont: 'tajawal',
        headingWeight: 'black',
    },
    testimonials: [
        {
            id: 't1',
            name: 'سارة العتيبي',
            degree: '98% قدرات',
            text: 'المنصة غيرت طريقة مذاكرتي تمامًا. تحليل نقاط الضعف ساعدني أركز جهدي في المكان الصح.',
            image: 'https://i.pravatar.cc/100?img=5',
        },
        {
            id: 't2',
            name: 'فهد الشمري',
            degree: '96% تحصيلي',
            text: 'الشروحات والتدريبات كانت مرتبة جدًا وواضحة، وحسيت فعلًا أن عندي خطة كاملة وليست مجرد دروس.',
            image: 'https://i.pravatar.cc/100?img=11',
        },
        {
            id: 't3',
            name: 'نورة السالم',
            degree: '99% قدرات',
            text: 'الاختبارات المحاكية كانت قريبة جدًا من الاختبار الحقيقي، وهذا رفع ثقتي قبل يوم الاختبار.',
            image: 'https://i.pravatar.cc/100?img=9',
        },
    ],
    featuredPathIds: [],
    featuredCourseIds: [],
    featuredArticleLessonIds: [],
};

const colorMap: Record<string, { soft: string; text: string; base: string; border: string }> = {
    indigo: { soft: '#e0e7ff', text: '#4338ca', base: '#4f46e5', border: '#c7d2fe' },
    amber: { soft: '#fef3c7', text: '#b45309', base: '#f59e0b', border: '#fde68a' },
    emerald: { soft: '#d1fae5', text: '#047857', base: '#10b981', border: '#a7f3d0' },
    purple: { soft: '#ede9fe', text: '#6d28d9', base: '#7c3aed', border: '#ddd6fe' },
    rose: { soft: '#ffe4e6', text: '#be123c', base: '#f43f5e', border: '#fecdd3' },
    blue: { soft: '#dbeafe', text: '#1d4ed8', base: '#2563eb', border: '#bfdbfe' },
    gray: { soft: '#f3f4f6', text: '#4b5563', base: '#6b7280', border: '#d1d5db' },
};

const resolveColor = (value?: string) => {
    if (!value) return colorMap.indigo;
    if (value.startsWith('#')) {
        return { soft: `${value}18`, text: value, base: value, border: `${value}33` };
    }
    return colorMap[value] || colorMap.indigo;
};

export const Landing: React.FC = () => {
    const { paths, courses, quizzes, questions, lessons, subjects, user } = useStore();
    const [homepageSettings, setHomepageSettings] = useState<HomepageSettings>(defaultHomepageSettings);
    const canSeeHiddenPaths = ['admin', 'teacher', 'supervisor'].includes(user?.role || '');

    useEffect(() => {
        let cancelled = false;

        const loadHomepageSettings = async () => {
            try {
                const response = await api.getHomepageSettings();
                if (!cancelled && response) {
                    setHomepageSettings(sanitizeHomepageSettings(response as HomepageSettings));
                }
            } catch {
                if (!cancelled) {
                    setHomepageSettings(defaultHomepageSettings);
                }
            }
        };

        void loadHomepageSettings();

        return () => {
            cancelled = true;
        };
    }, []);

    const getPathLink = (pathId: string) => `/category/${pathId}`;

    const getPathColor = (path: any) => path?.color || 'blue';

    const getPathIcon = (path: any) => {
        if (path?.iconUrl) {
            return <img src={path.iconUrl} alt={path.name} className="w-8 h-8 object-contain" />;
        }
        if (!path?.icon) {
            return <Zap size={24} />;
        }
        return <span className="text-xl">{path.icon}</span>;
    };

    const homepagePaths = paths.filter(
        (path) =>
            path.showInHome !== false &&
            (canSeeHiddenPaths || path.isActive !== false) &&
            typeof path.id === 'string' &&
            path.id.trim().length > 0 &&
            typeof path.name === 'string' &&
            path.name.trim().length > 0,
    );
    const visiblePathIds = new Set(homepagePaths.map((path) => path.id));

    const displayedHomepagePaths = useMemo(() => {
        if (homepageSettings.featuredPathIds?.length) {
            const selected = homepagePaths.filter((path) => homepageSettings.featuredPathIds.includes(path.id));
            if (selected.length > 0) {
                return selected;
            }
        }
        return homepagePaths;
    }, [homepagePaths, homepageSettings.featuredPathIds]);

    const publishedCourses = courses.filter(
        (course) =>
            !course.isPackage &&
            course.isPublished !== false &&
            course.showOnPlatform !== false &&
            (!course.pathId || visiblePathIds.has(course.pathId)),
    );
    const sortedPublishedCourses = [...publishedCourses].sort((a, b) => {
        const studentsA = a.fakeStudentsCount || a.studentCount || 0;
        const studentsB = b.fakeStudentsCount || b.studentCount || 0;
        const ratingA = a.fakeRating || a.rating || 0;
        const ratingB = b.fakeRating || b.rating || 0;
        return studentsB + ratingB * 100 - (studentsA + ratingA * 100);
    });

    const featuredCourses = useMemo(() => {
        if (homepageSettings.featuredCourseIds?.length) {
            const selected = sortedPublishedCourses.filter((course) => homepageSettings.featuredCourseIds.includes(course.id));
            if (selected.length > 0) {
                return selected.slice(0, 3);
            }
        }
        return sortedPublishedCourses.slice(0, 3);
    }, [homepageSettings.featuredCourseIds, sortedPublishedCourses]);

    const publishedArticleLessons = useMemo(
        () =>
            lessons
                .filter((lesson) => {
                    const isPublished = lesson.approvalStatus !== 'pending_review' && lesson.approvalStatus !== 'rejected';
                    const hasArticleContent = lesson.type === 'text' || Boolean(lesson.content?.trim());
                    return isPublished && hasArticleContent && lesson.showOnPlatform !== false && (!lesson.pathId || visiblePathIds.has(lesson.pathId));
                })
                .sort((a, b) => (b.approvedAt || 0) - (a.approvedAt || 0)),
        [lessons],
    );

    const featuredArticleLessons = useMemo(() => {
        if (homepageSettings.featuredArticleLessonIds?.length) {
            const selected = homepageSettings.featuredArticleLessonIds
                .map((lessonId) => publishedArticleLessons.find((lesson) => lesson.id === lessonId))
                .filter((lesson): lesson is NonNullable<typeof lesson> => Boolean(lesson));

            if (selected.length > 0) {
                return selected.slice(0, 3);
            }
        }

        return publishedArticleLessons.slice(0, 3);
    }, [homepageSettings.featuredArticleLessonIds, publishedArticleLessons]);

    const totalStudents = publishedCourses.reduce((sum, course) => sum + (course.fakeStudentsCount || course.studentCount || 0), 0);
    const totalQA = publishedCourses.reduce((sum, course) => sum + (course.qa?.length || 0), 0);
    const averageRating = publishedCourses.length > 0
        ? publishedCourses.reduce((sum, course) => sum + (course.fakeRating || course.rating || 0), 0) / publishedCourses.length
        : 0;
    const publishedQuizzes = quizzes.filter(
        (quiz) => quiz.isPublished !== false && quiz.showOnPlatform !== false && (!quiz.pathId || visiblePathIds.has(quiz.pathId)),
    ).length;
    const totalLearningAssets = questions.length + publishedQuizzes;

    const formatCompactNumber = (value: number) => {
        if (value >= 1000) {
            return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
        }
        return value.toString();
    };

    const homepageStats = (homepageSettings.stats?.length ? homepageSettings.stats : defaultHomepageSettings.stats).map((stat) => {
        if (stat.mode === 'manual' && stat.manualValue) {
            return { ...stat, displayValue: stat.manualValue };
        }

        switch (stat.source) {
            case 'courses':
                return { ...stat, displayValue: publishedCourses.length.toString() };
            case 'assets':
                return { ...stat, displayValue: formatCompactNumber(totalQA || totalLearningAssets) };
            case 'rating':
                return { ...stat, displayValue: averageRating.toFixed(1) };
            case 'students':
            default:
                return { ...stat, displayValue: formatCompactNumber(totalStudents) };
        }
    });

    const sectionTexts = {
        featuredCoursesTitle: homepageSettings.sections?.featuredCoursesTitle || defaultHomepageSettings.sections.featuredCoursesTitle,
        featuredCoursesSubtitle: homepageSettings.sections?.featuredCoursesSubtitle || defaultHomepageSettings.sections.featuredCoursesSubtitle,
        featuredArticlesTitle:
            homepageSettings.sections?.featuredArticlesTitle ||
            defaultHomepageSettings.sections.featuredArticlesTitle ||
            'مقالات ومراجعات مهمة',
        featuredArticlesSubtitle:
            homepageSettings.sections?.featuredArticlesSubtitle ||
            defaultHomepageSettings.sections.featuredArticlesSubtitle ||
            'مجموعة مبسطة من الشروحات النصية والمراجعات التي تساعدك على الفهم الأسرع.',
        whyChooseTitle: homepageSettings.sections?.whyChooseTitle || defaultHomepageSettings.sections.whyChooseTitle,
        whyChooseDescription: homepageSettings.sections?.whyChooseDescription || defaultHomepageSettings.sections.whyChooseDescription,
        testimonialsTitle: homepageSettings.sections?.testimonialsTitle || defaultHomepageSettings.sections.testimonialsTitle,
        testimonialsSubtitle: homepageSettings.sections?.testimonialsSubtitle || defaultHomepageSettings.sections.testimonialsSubtitle,
    };

    const testimonials = homepageSettings.testimonials?.length ? homepageSettings.testimonials : defaultHomepageSettings.testimonials;
    const homepageTypography = {
        ...defaultHomepageSettings.typography,
        ...homepageSettings.typography,
    };
    const fontClassByChoice = {
        tajawal: 'font-tajawal',
        system: 'font-sans',
        serif: 'font-serif',
    } as const;
    const headingFontClass = fontClassByChoice[homepageTypography.headingFont || 'tajawal'];
    const bodyFontClass = fontClassByChoice[homepageTypography.bodyFont || 'tajawal'];
    const headingWeightClass = homepageTypography.headingWeight === 'bold' ? 'font-bold' : 'font-black';

    return (
        <div className={`bg-white ${bodyFontClass}`}>
            <section className="relative bg-gradient-to-b from-indigo-50 via-white to-white pt-16 pb-24 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                    <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
                    <div className="absolute top-[20%] left-[-10%] w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
                    <div className="absolute bottom-[-10%] right-[20%] w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-12">
                        <div className="lg:w-1/2 text-center lg:text-right">
                            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-sm font-bold mb-6 border border-blue-100 shadow-sm">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                                </span>
                                {homepageSettings.hero.badgeText || defaultHomepageSettings.hero.badgeText}
                            </div>

                            <h1 className={`text-4xl sm:text-5xl lg:text-7xl ${headingWeightClass} ${headingFontClass} text-gray-900 leading-tight mb-6`}>
                                {homepageSettings.hero.titlePrefix || defaultHomepageSettings.hero.titlePrefix}{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                                    {homepageSettings.hero.titleHighlight || defaultHomepageSettings.hero.titleHighlight}
                                </span>
                                <br />
                                {homepageSettings.hero.titleSuffix || defaultHomepageSettings.hero.titleSuffix}
                            </h1>

                            <p className="text-lg sm:text-xl text-gray-600 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                                {homepageSettings.hero.description || defaultHomepageSettings.hero.description}
                            </p>

                            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                                <Link
                                    to={homepageSettings.hero.primaryCtaLink || defaultHomepageSettings.hero.primaryCtaLink || '/dashboard'}
                                    className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white text-lg font-bold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
                                >
                                    <Zap size={20} fill="currentColor" />
                                    {homepageSettings.hero.primaryCtaLabel || defaultHomepageSettings.hero.primaryCtaLabel}
                                </Link>
                                <Link
                                    to={homepageSettings.hero.secondaryCtaLink || defaultHomepageSettings.hero.secondaryCtaLink || '/courses'}
                                    className="w-full sm:w-auto bg-white text-gray-700 border border-gray-200 text-lg font-bold px-8 py-4 rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <BookOpen size={20} />
                                    {homepageSettings.hero.secondaryCtaLabel || defaultHomepageSettings.hero.secondaryCtaLabel}
                                </Link>
                            </div>

                            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 sm:gap-6 text-sm text-gray-500 font-medium">
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={18} className="text-emerald-500" />
                                    <span>ضمان تحسن المستوى</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={18} className="text-emerald-500" />
                                    <span>مدربون معتمدون</span>
                                </div>
                            </div>
                        </div>

                        <div className="lg:w-1/2 relative w-full">
                            <div className="relative w-full max-w-lg mx-auto">
                                <img
                                    src={resolveHomepageHeroImage(homepageSettings.hero.imageUrl || defaultHomepageSettings.hero.imageUrl)}
                                    alt={homepageSettings.hero.imageAlt || defaultHomepageSettings.hero.imageAlt || 'طالب يستخدم منصة المئة'}
                                    className="w-full h-auto rounded-3xl shadow-2xl border-4 border-white relative z-10 transform transition-transform hover:scale-[1.02]"
                                />

                                <div className="absolute -bottom-4 right-2 sm:-bottom-6 sm:-right-6 z-20 bg-white/90 backdrop-blur-md p-3 sm:p-4 rounded-2xl shadow-xl border border-white/50 max-w-[180px] sm:max-w-[200px] animate-bounce-slow">
                                    <div className="flex items-center gap-2 mb-2 border-b border-gray-100 pb-2">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                            <Target size={16} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-gray-800">{homepageSettings.hero.floatingCardTitle || defaultHomepageSettings.hero.floatingCardTitle}</div>
                                            <div className="text-[10px] text-emerald-500 font-bold">{homepageSettings.hero.floatingCardSubtitle || defaultHomepageSettings.hero.floatingCardSubtitle}</div>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-1.5 bg-gray-100 rounded-full w-full overflow-hidden">
                                            <div className="h-full bg-blue-500 w-3/4" />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-gray-500">
                                            <span>{homepageSettings.hero.floatingCardProgressLabel || defaultHomepageSettings.hero.floatingCardProgressLabel}</span>
                                            <span>{homepageSettings.hero.floatingCardProgressValue || defaultHomepageSettings.hero.floatingCardProgressValue}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="absolute top-6 left-2 sm:top-10 sm:-left-10 z-20 bg-white p-3 rounded-2xl shadow-lg animate-float">
                                    <div className="text-amber-500 font-black text-xl">A+</div>
                                </div>
                                <div className="absolute bottom-16 left-2 sm:bottom-20 sm:-left-4 z-0 bg-indigo-600 text-white p-3 rounded-2xl shadow-lg animate-float animation-delay-2000">
                                    <Book size={24} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-blue-900 text-white py-10 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center divide-x divide-blue-800 divide-x-reverse">
                        {homepageStats.slice(0, 4).map((stat) => (
                            <div key={stat.id}>
                                <div className="text-3xl md:text-4xl font-black text-amber-400 mb-1">{stat.displayValue}</div>
                                <div className="text-blue-200 text-sm font-bold">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fbbf24 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            </section>

            <section className="py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">كل ما تحتاجه للتفوق</h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">نقدم لك أدوات تعليمية متكاملة تغطي كافة جوانب التدريب والتقييم.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {displayedHomepagePaths.map((path, idx) => (
                            <OrganicCard
                                key={`hpath-${path.id}-${idx}`}
                                title={path.name}
                                subtitle={path.description || 'تأسيس وتدريب شامل'}
                                icon={getPathIcon(path)}
                                color={getPathColor(path)}
                                link={getPathLink(path.id)}
                                iconStyle={path.iconStyle}
                            />
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-right">
                            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">{sectionTexts.featuredCoursesTitle}</h2>
                            <p className="text-gray-500">{sectionTexts.featuredCoursesSubtitle}</p>
                        </div>
                        <Link to="/courses" className="self-start sm:self-auto text-indigo-600 font-bold hover:underline flex items-center gap-2">
                            عرض الكل <ArrowDown className="transform rotate-90" size={16} />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {featuredCourses.map((course, idx) => (
                            <Link key={`fcourse-${course.id}-${idx}`} to={`/course/${course.id}`} className="group">
                                <Card className="overflow-hidden border border-gray-100 hover:shadow-2xl transition-all duration-500 rounded-3xl group-hover:-translate-y-2">
                                    <div className="relative aspect-video overflow-hidden">
                                        <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-indigo-600 font-black text-sm shadow-sm">
                                            {course.price} ر.س
                                        </div>
                                    </div>
                                    <div className="p-6 text-right">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-1 text-amber-400">
                                                <Star size={14} fill="currentColor" />
                                                <span className="text-xs font-bold text-gray-600">{course.fakeRating || course.rating || 0}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                                <Users size={12} /> {course.fakeStudentsCount || course.studentCount || 0} طالب
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors line-clamp-1">{course.title}</h3>
                                        <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                                            <Users size={12} /> {course.instructor}
                                        </p>
                                        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                            <span className="text-indigo-600 font-bold text-sm">عرض التفاصيل</span>
                                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                <ArrowDown className="transform rotate-90" size={16} />
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                    {featuredCourses.length === 0 && <div className="text-center py-12 text-gray-500">لا توجد دورات منشورة حاليًا.</div>}
                </div>
            </section>

            <section className="py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-right">
                            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">{sectionTexts.featuredArticlesTitle}</h2>
                            <p className="text-gray-500">{sectionTexts.featuredArticlesSubtitle}</p>
                        </div>
                        <Link to="/blog" className="self-start sm:self-auto text-indigo-600 font-bold hover:underline flex items-center gap-2">
                            استعرض المقالات <ArrowDown className="transform rotate-90" size={16} />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {featuredArticleLessons.map((lesson) => {
                            const subject = subjects.find((item) => item.id === lesson.subjectId);
                            const path = paths.find((item) => item.id === lesson.pathId);
                            const articleLink =
                                lesson.pathId && lesson.subjectId ? `/category/${lesson.pathId}?subject=${lesson.subjectId}&tab=skills` : '/blog';
                            const articleSummary =
                                lesson.description ||
                                lesson.content?.replace(/\s+/g, ' ').slice(0, 150) ||
                                'شرح مبسط ومراجعة سريعة تساعدك على التقدم داخل المسار.';

                            return (
                                <Link key={`farticle-${lesson.id}`} to={articleLink} className="group">
                                    <Card className="h-full border border-gray-100 hover:shadow-xl transition-all duration-300 rounded-3xl group-hover:-translate-y-1">
                                        <div className="p-6 text-right h-full flex flex-col">
                                            <div className="flex items-center justify-between gap-3 mb-4">
                                                <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-xs font-bold">
                                                    <BookOpen size={14} />
                                                    {subject?.name || path?.name || 'شرح عام'}
                                                </span>
                                                <span className="text-[11px] text-gray-400 font-bold">
                                                    {path?.name || 'مسار عام'}
                                                </span>
                                            </div>

                                            <h3 className="font-bold text-gray-900 mb-3 leading-8 group-hover:text-indigo-600 transition-colors line-clamp-2">
                                                {lesson.title}
                                            </h3>

                                            <p className="text-sm text-gray-600 leading-7 line-clamp-4 flex-1">
                                                {articleSummary}
                                            </p>

                                            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                                                <span className="text-xs text-gray-400 font-medium">
                                                    {lesson.type === 'text' ? 'مقالة تعليمية' : 'شرح نصي'}
                                                </span>
                                                <span className="text-indigo-600 font-bold text-sm">اقرأ الآن</span>
                                            </div>
                                        </div>
                                    </Card>
                                </Link>
                            );
                        })}
                    </div>

                    {featuredArticleLessons.length === 0 && (
                        <div className="text-center py-12 text-gray-500">لا توجد مقالات أو شروحات نصية منشورة حاليًا.</div>
                    )}
                </div>
            </section>

            <section className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
                        <div className="lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <FeatureCard icon={<Video className="text-purple-500" size={20} />} title="شرح مباشر وتفاعلي" description="احضر الحصص وتابع الشرح بخطوات منظمة تناسب مستواك." />
                            <FeatureCard icon={<Users className="text-blue-500" size={20} />} title="نخبة المعلمين" description="معلمون ومتخصصون في القدرات والتحصيلي بخبرة عملية وأكاديمية." />
                            <FeatureCard icon={<BarChart className="text-emerald-500" size={20} />} title="تحليل الأداء" description="تقارير دقيقة توضح نقاط قوتك وضعفك لتعرف أين تبدأ." />
                            <FeatureCard icon={<Book className="text-amber-500" size={20} />} title="ملفات ومراجعات" description="ملخصات ومراجعات داعمة تساعدك قبل الاختبار وبعد التدريب." />
                        </div>
                        <div className="lg:w-1/2 text-right">
                            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-6 leading-tight">{sectionTexts.whyChooseTitle}</h2>
                            <p className="text-base sm:text-lg text-gray-600 mb-8 leading-relaxed">{sectionTexts.whyChooseDescription}</p>
                            <ul className="space-y-4 mb-8">
                                <li className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600"><CheckCircle size={14} /></div>
                                    <span className="text-gray-700 font-medium">تحديثات مستمرة للأسئلة والتدريب</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600"><CheckCircle size={14} /></div>
                                    <span className="text-gray-700 font-medium">مسارات تأسيس وتدريب ومراجعة في مكان واحد</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600"><CheckCircle size={14} /></div>
                                    <span className="text-gray-700 font-medium">دعم فني وأكاديمي متواصل</span>
                                </li>
                            </ul>
                            <Link to="/dashboard" className="inline-flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-800 group">
                                اكتشف المزيد
                                <ArrowDown className="transform rotate-90 group-hover:translate-x-[-5px] transition-transform" size={20} />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-20 bg-indigo-900 text-white relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold mb-4">{sectionTexts.testimonialsTitle}</h2>
                        <p className="text-indigo-200">{sectionTexts.testimonialsSubtitle}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {testimonials.slice(0, 3).map((testimonial) => (
                            <TestimonialCard key={testimonial.id} name={testimonial.name} degree={testimonial.degree} text={testimonial.text} image={testimonial.image} />
                        ))}
                    </div>
                </div>
                <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-500 opacity-10 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />
            </section>
        </div>
    );
};

const OrganicCard = ({ title, subtitle, icon, color, link, iconStyle }: any) => {
    const palette = resolveColor(color);

    if (iconStyle === 'modern') {
        return (
            <Link to={link || '#'} className="group block h-full w-full">
                <div
                    className="w-full min-h-44 sm:h-48 bg-white border-2 border-gray-100 flex flex-col items-center justify-center shadow-sm hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-2 rounded-3xl relative overflow-hidden"
                    style={{ borderColor: palette.border || palette.base }}
                >
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="mb-4 p-4 rounded-2xl group-hover:scale-110 transition-transform shadow-sm" style={{ backgroundColor: palette.soft, color: palette.text }}>
                            {icon}
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold tracking-wide text-gray-900 mb-2 text-center px-3 break-words">{title}</h3>
                        <p className="text-gray-500 text-xs font-medium px-6 text-center leading-relaxed">{subtitle}</p>
                    </div>
                </div>
            </Link>
        );
    }

    if (iconStyle === 'minimal') {
        return (
            <Link to={link || '#'} className="group block h-full w-full">
                <div className="w-full min-h-44 sm:h-48 bg-gray-50 flex flex-col items-center justify-center hover:bg-white transition-all duration-300 transform group-hover:-translate-y-1 rounded-2xl relative overflow-hidden">
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="mb-3" style={{ color: palette.text }}>
                            {icon}
                        </div>
                        <h3 className="text-lg sm:text-xl font-extrabold text-gray-800 mb-2 text-center px-3 break-words">{title}</h3>
                        <p className="text-gray-500 text-xs text-center px-4">{subtitle}</p>
                    </div>
                </div>
            </Link>
        );
    }

    if (iconStyle === 'playful') {
        return (
            <Link to={link || '#'} className="group block h-full w-full">
                <div
                    className="w-full min-h-44 sm:h-48 text-white flex flex-col items-center justify-center shadow-[8px_8px_0px_#00000020] hover:shadow-[12px_12px_0px_#00000030] transition-all duration-300 transform group-hover:-translate-y-2 rounded-[2rem] border-4 border-white relative overflow-hidden"
                    style={{ backgroundColor: palette.base }}
                >
                    <div className="absolute top-2 right-2 text-white/30 transform rotate-12 text-6xl">✨</div>
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="mb-4 bg-white text-gray-800 p-4 rounded-full shadow-md group-hover:rotate-12 transition-transform">
                            {icon}
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black drop-shadow-md mb-2 text-center px-3 break-words">{title}</h3>
                    </div>
                </div>
            </Link>
        );
    }

    return (
        <Link to={link || '#'} className="group block h-full w-full">
            <div
                className="w-full min-h-44 sm:h-48 text-white flex flex-col items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-2 rounded-3xl relative overflow-hidden"
                style={{ backgroundColor: palette.base }}
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10 transform group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-black opacity-10 rounded-full -ml-8 -mb-8 transform group-hover:scale-110 transition-transform duration-500" />
                <div className="relative z-10 flex flex-col items-center">
                    <div className="mb-4 bg-white/20 p-4 rounded-2xl backdrop-blur-sm group-hover:bg-white/30 transition-colors shadow-sm">
                        {icon}
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold tracking-wide drop-shadow-md mb-2 text-center px-3 break-words">{title}</h3>
                    <p className="text-white/90 text-xs font-medium px-6 text-center leading-relaxed max-w-[200px]">{subtitle}</p>
                </div>
            </div>
        </Link>
    );
};

const FeatureCard = ({ icon, title, description }: any) => (
    <Card className="p-5 sm:p-6 border border-gray-100 hover:shadow-lg transition-shadow flex flex-col gap-3 h-full">
        <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center mb-2">
            {icon}
        </div>
        <h3 className="font-bold text-gray-900 text-base sm:text-lg">{title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </Card>
);

const TestimonialCard = ({ name, degree, text, image }: any) => (
    <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 sm:p-6 rounded-2xl">
        <div className="mb-4 flex items-center gap-3 sm:gap-4">
            <img src={image} alt={name} className="w-12 h-12 rounded-full border-2 border-amber-400" />
            <div>
                <h4 className="font-bold text-sm sm:text-base">{name}</h4>
                <span className="text-amber-400 text-xs font-bold">{degree}</span>
            </div>
        </div>
        <p className="text-indigo-100 text-sm leading-relaxed italic">"{text}"</p>
        <div className="flex gap-1 text-amber-400 mt-4">
            {[...Array(5)].map((_, i) => <Star key={`star-${name}-${i}`} size={14} fill="currentColor" />)}
        </div>
    </div>
);
