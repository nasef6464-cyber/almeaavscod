import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Card } from './ui/Card';
import { Video, BookOpen, FileText, PlayCircle, MonitorPlay, Star, User, Library, Eye, Lock, Package, CreditCard } from 'lucide-react';
import { ProgressBar } from './ui/ProgressBar';
import { useStore } from '../store/useStore';
import { PackageContentType } from '../types';
import { openExternalUrl } from '../utils/openExternalUrl';
import { findByEntityId, matchesEntityId } from '../utils/entityIds';
import { isMockQuiz, isTrainingQuiz } from '../utils/quizPlacement';
import { getLearningSlotQuizzes, resolveQuizLearningAccessType } from '../utils/quizLearningPlacement';
import { isMaterialQuizCandidate } from '../utils/mockExam';
import { buildQuizRouteWithContext } from '../utils/quizLinks';
import { resolveCoursePathId, resolveCourseSubjectId } from '../utils/courseScope';

const SkillDetailsModal = React.lazy(() => import('./SkillDetailsModal').then((module) => ({ default: module.SkillDetailsModal })));
const SimulatedTestExperience = React.lazy(() => import('./SimulatedTestExperience').then((module) => ({ default: module.SimulatedTestExperience })));
const FileModal = React.lazy(() => import('./FileModal').then((module) => ({ default: module.FileModal })));
const PaymentModal = React.lazy(() => import('./PaymentModal').then((module) => ({ default: module.PaymentModal })));
const LightweightModalFallback = () => null;

interface LearningSectionProps {
    category: string;
    subject: string;
    grade?: string;
    title?: string;
    colorTheme?: 'indigo' | 'amber' | 'emerald' | 'purple' | 'rose';
}

type LearningTab = 'courses' | 'skills' | 'banks' | 'tests' | 'library';

const learningTabAliases: Record<string, LearningTab> = {
    courses: 'courses',
    course: 'courses',
    skills: 'skills',
    foundation: 'skills',
    topics: 'skills',
    banks: 'banks',
    bank: 'banks',
    training: 'banks',
    trainings: 'banks',
    tests: 'tests',
    test: 'tests',
    quizzes: 'tests',
    quiz: 'tests',
    library: 'library',
    files: 'library',
    support: 'library',
};

const normalizeLearningTab = (value?: string | null): LearningTab | null => {
    if (!value) return null;
    return learningTabAliases[value.toLowerCase()] || null;
};

const themePaletteMap: Record<string, { base: string; soft: string; border: string; text: string }> = {
    indigo: { base: '#4f46e5', soft: '#e0e7ff', border: '#c7d2fe', text: '#4338ca' },
    amber: { base: '#f59e0b', soft: '#fef3c7', border: '#fde68a', text: '#b45309' },
    emerald: { base: '#10b981', soft: '#d1fae5', border: '#a7f3d0', text: '#047857' },
    purple: { base: '#7c3aed', soft: '#ede9fe', border: '#ddd6fe', text: '#6d28d9' },
    rose: { base: '#f43f5e', soft: '#ffe4e6', border: '#fecdd3', text: '#be123c' },
};

const resolveThemePalette = (value?: string) => {
    if (!value) return themePaletteMap.indigo;
    if (value.startsWith('#')) {
        return { base: value, soft: `${value}18`, border: `${value}33`, text: value };
    }
    return themePaletteMap[value] || themePaletteMap.indigo;
};

export const LearningSection: React.FC<LearningSectionProps> = ({ category, subject, grade, title, colorTheme = 'indigo' }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, enrolledCourses, subjects, paths, courses, lessons, libraryItems, quizzes, hasScopedPackageAccess, getMatchingPackage } = useStore();
    const [activeTab, setActiveTab] = useState<LearningTab>(() => normalizeLearningTab(searchParams.get('tab')) || 'courses');
    const safeColorTheme = colorTheme.startsWith('#') ? 'indigo' : colorTheme;
    const theme = resolveThemePalette(colorTheme);
    
    // Get Subject Settings
    const currentSubjectData = subjects.find(s => s.id === subject);
    const settings = currentSubjectData?.settings || {};
    const enabledTabs = {
        courses: settings.showCourses ?? true,
        skills: settings.showSkills ?? true,
        banks: settings.showBanks ?? true,
        tests: settings.showTests ?? true,
        library: settings.showLibrary ?? true,
    };
    const isTabEnabled = (tab: LearningTab) => enabledTabs[tab];
    const firstEnabledTab = (Object.entries(enabledTabs).find(([, enabled]) => enabled)?.[0] || 'courses') as typeof activeTab;

    
    useEffect(() => {
        const rawTab = searchParams.get('tab');
        const tab = normalizeLearningTab(rawTab);
        if (tab) {
            setActiveTab(tab);
            if (rawTab !== tab) {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.set('tab', tab);
                setSearchParams(nextParams, { replace: true });
            }
        }
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        if (!isTabEnabled(activeTab)) {
            setActiveTab(firstEnabledTab);
            const nextParams = new URLSearchParams(searchParams);
            nextParams.set('tab', firstEnabledTab);
            nextParams.delete('topic');
            nextParams.delete('content');
            nextParams.delete('lesson');
            setSearchParams(nextParams, { replace: true });
        }
    }, [activeTab, firstEnabledTab, searchParams, setSearchParams, settings.showBanks, settings.showCourses, settings.showLibrary, settings.showSkills, settings.showTests]);

    const handleTabChange = (tab: LearningTab) => {
        setActiveTab(tab);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('tab', tab);
        if (tab !== 'skills') {
            nextParams.delete('topic');
            nextParams.delete('content');
            nextParams.delete('lesson');
        }
        setSearchParams(nextParams);
    };
    const buildSectionReturnPath = (tab: LearningTab = activeTab) => {
        const params = new URLSearchParams();
        if (subject) params.set('subject', subject);
        params.set('tab', tab);
        return `/category/${category}?${params.toString()}`;
    };
    const buildPackagesPagePath = (contentType?: PackageContentType, packageId?: string) => {
        const params = new URLSearchParams();
        params.set('tab', 'packages');
        if (subject) params.set('subject', subject);
        if (contentType) params.set('contentType', contentType);
        if (packageId) params.set('package', packageId);
        return `/category/${category}?${params.toString()}`;
    };
    const shouldTrainingReturnOnFinish = (quizId: string | number) => {
        const sourceQuiz = quizList.find((quiz) => matchesEntityId(quiz, String(quizId)));
        return sourceQuiz?.settings?.returnToSourceOnFinish === true || sourceQuiz?.settings?.showResultsReport === false;
    };
    const hasReturnedFromFoundationTraining = searchParams.get('trainingDone') === '1';
    const hasReturnedFromLearningTest = searchParams.get('testDone') === '1';
    const handleDismissJourneyNotice = () => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('trainingDone');
        nextParams.delete('testDone');
        setSearchParams(nextParams, { replace: true });
    };

    const [selectedSkill, setSelectedSkill] = useState<any>(null);
    const [viewingFile, setViewingFile] = useState<any>(null);
    const [paymentModalData, setPaymentModalData] = useState<{ isOpen: boolean, item: any, type: string }>({ isOpen: false, item: null, type: '' });
    const isStaffViewer = ['admin', 'teacher', 'supervisor'].includes(user.role);
    const isAdminViewer = user.role === 'admin';
    const accessibleCourseIds = new Set([
        ...enrolledCourses,
        ...(user.subscription?.purchasedCourses || []),
    ]);
    const packageContentLabels: Record<PackageContentType, string> = {
        courses: 'الدورات',
        foundation: 'التأسيس',
        banks: 'التدريب',
        tests: 'الاختبارات',
        library: 'المكتبة',
        all: 'الباقة الشاملة',
    };
    const isPublicPackageAvailable = (course: (typeof courses)[number]) =>
        course.isPackage &&
        course.showOnPlatform !== false &&
        course.isPublished !== false &&
        (!course.approvalStatus || course.approvalStatus === 'approved');
    const getPublicPackagesForScope = (contentType: PackageContentType) =>
        courses
            .filter((course) => {
                if (!isPublicPackageAvailable(course)) return false;
                const contentTypes = course.packageContentTypes?.length ? course.packageContentTypes : ['all'];
                const packagePathId = course.pathId || course.category;
                const packageSubjectId = course.subjectId || course.subject;
                const matchesType = contentTypes.includes('all') || contentTypes.includes(contentType);
                const matchesPath = !packagePathId || packagePathId === category;
                const matchesSubject = !packageSubjectId || packageSubjectId === subject;
                return matchesType && matchesPath && matchesSubject;
            })
            .sort((a, b) => {
                const scorePackage = (course: (typeof courses)[number]) => {
                    const contentTypes = course.packageContentTypes?.length ? course.packageContentTypes : ['all'];
                    const packagePathId = course.pathId || course.category;
                    const packageSubjectId = course.subjectId || course.subject;
                    return (
                        (packageSubjectId === subject ? 8 : 0) +
                        (packagePathId === category ? 4 : 0) +
                        (contentTypes.includes(contentType) ? 2 : 0) +
                        (contentTypes.includes('all') ? 1 : 0)
                    );
                };
                return scorePackage(b) - scorePackage(a);
            });
    const buildScopedPackageItem = (contentType: PackageContentType, fallbackTitle: string, fallbackDescription: string) => {
        const matchedPackage = getMatchingPackage(contentType, category, subject);
        const publicPackageOptions = matchedPackage ? [] : getPublicPackagesForScope(contentType);
        const publicPackage = matchedPackage ? null : publicPackageOptions[0];
        if (!matchedPackage && !publicPackage) {
            return null;
        }
        const contentTypeLabels: Record<PackageContentType, string> = {
            courses: 'الدورات',
            foundation: 'التأسيس',
            banks: 'التدريبات',
            tests: 'الاختبارات',
            library: 'المكتبة',
            all: 'الباقة الشاملة',
        };

        return {
            id: matchedPackage?.id || publicPackage?.id,
            packageId: matchedPackage?.id || publicPackage?.id,
            purchaseType: 'package',
            title: matchedPackage?.name || publicPackage?.title || fallbackTitle,
            price: publicPackage?.price || 99,
            currency: 'ر.س',
            description: matchedPackage
                ? `هذه الباقة تفتح ${contentTypeLabels[contentType]} في ${currentSubjectData?.name || subject}.`
                : publicPackage?.description || fallbackDescription,
            contentTypes: matchedPackage?.contentTypes || publicPackage?.packageContentTypes || [contentType],
            pathIds: matchedPackage?.pathIds || [publicPackage?.pathId || publicPackage?.category || category],
            subjectIds: matchedPackage?.subjectIds || [publicPackage?.subjectId || publicPackage?.subject || subject],
            includedCourseIds: matchedPackage?.courseIds || publicPackage?.includedCourses || [],
            courseIds: matchedPackage?.courseIds || publicPackage?.includedCourses || [],
            thumbnail: publicPackage?.thumbnail,
            features: publicPackage?.features,
            packageOptions: matchedPackage
                ? []
                : publicPackageOptions.slice(0, 8).map((option) => ({
                    id: option.id,
                    packageId: option.id,
                    purchaseType: 'package',
                    title: option.title,
                    price: option.price || 0,
                    currency: option.currency || 'ر.س',
                    description: option.description,
                    contentTypes: option.packageContentTypes?.length ? option.packageContentTypes : ['all'],
                    packageContentTypes: option.packageContentTypes?.length ? option.packageContentTypes : ['all'],
                    pathIds: [option.pathId || option.category || category].filter(Boolean),
                    subjectIds: [option.subjectId || option.subject || subject].filter(Boolean),
                    includedCourseIds: option.includedCourses || [],
                    courseIds: option.includedCourses || [],
                    accessContext: 'اختر هذه الباقة إذا كانت تناسب الجزء الذي تريد فتحه، وسيتم تفعيل الوصول بعد اعتماد الدفع من الإدارة.',
                })),
            accessContext: matchedPackage
                ? 'قد يكون هذا النطاق متاحًا لك عبر المدرسة أو عبر تفعيل إداري سابق. إذا كان ما زال مغلقًا على حسابك، فهذه هي الباقة المرتبطة بهذه المادة.'
                : 'هذه باقة عامة مخصصة للطالب المستقل داخل المنصة، وتفتح هذا الجزء من المادة عند اعتماد الدفع.',
        };
    };

    const hasCourseAccess = isStaffViewer || hasScopedPackageAccess('courses', category, subject);
    const hasFoundationAccess = isStaffViewer || hasScopedPackageAccess('foundation', category, subject);
    const hasBanksAccess = isStaffViewer || hasScopedPackageAccess('banks', category, subject);
    const hasTestsAccess = isStaffViewer || hasScopedPackageAccess('tests', category, subject);
    const hasLibraryAccess = isStaffViewer || hasScopedPackageAccess('library', category, subject);
    const tabAccessMap: Record<typeof activeTab, { hasAccess: boolean; contentType: PackageContentType; title: string; description: string; action: string }> = {
        courses: {
            hasAccess: hasCourseAccess,
            contentType: 'courses',
            title: 'الدورات تحتاج اشتراكًا أو باقة مفعلة',
            description: 'يمكنك فتح دورات هذه المادة عبر باقة الدورات أو الباقة الشاملة التي يحددها المدير.',
            action: 'فتح باقة الدورات',
        },
        skills: {
            hasAccess: hasFoundationAccess,
            contentType: 'foundation',
            title: 'موضوعات التأسيس تحتاج باقة مناسبة',
            description: 'التأسيس منفصل عن مركز المهارات، لكنه يستخدم نفس المسار والمادة حتى يتدرج الطالب في التعلم.',
            action: 'فتح باقة التأسيس',
        },
        banks: {
            hasAccess: hasBanksAccess,
            contentType: 'banks',
            title: 'التدريبات وبنوك الأسئلة تحتاج اشتراكًا',
            description: 'افتح باقة التدريب ليصل الطالب إلى الأسئلة القصيرة المرتبطة بالمهارات.',
            action: 'فتح باقة التدريبات',
        },
        tests: {
            hasAccess: hasTestsAccess,
            contentType: 'tests',
            title: 'الاختبارات تحتاج باقة مناسبة',
            description: 'باقة الاختبارات تفتح الاختبارات المنشورة داخل هذه المادة.',
            action: 'فتح باقة الاختبارات',
        },
        library: {
            hasAccess: hasLibraryAccess,
            contentType: 'library',
            title: 'المكتبة تحتاج باقة مكتبة أو باقة شاملة',
            description: 'افتح ملفات المراجعة والملخصات والمرفقات العلمية الخاصة بهذه المادة.',
            action: 'فتح باقة المكتبة',
        },
    };
    const activeTabAccess = tabAccessMap[activeTab];
    const activeTabPackage = activeTabAccess
        ? buildScopedPackageItem(activeTabAccess.contentType, activeTabAccess.action, activeTabAccess.description)
        : null;
    const showActiveTabAccessNotice = !isStaffViewer && activeTabAccess && !activeTabAccess.hasAccess && Boolean(activeTabPackage);
    const isCourseTabNotice = activeTab === 'courses';

    const isPremiumLocked = (shouldLock?: boolean, accessGranted = false) => Boolean(!isStaffViewer && shouldLock && !accessGranted);
    const getLockedContentMessage = (contentType: PackageContentType) => {
        if (contentType === 'courses') {
            return {
                title: 'هذه دورة مدفوعة',
                description: 'يمكنك طلب شراء الدورة من زر البطاقة نفسها، أو الانتقال إلى صفحة الباقات إذا كنت تريد فتح أكثر من جزء في هذا المسار.',
                coverageSummary: '',
            };
        }

        const packageItem = buildScopedPackageItem(
            contentType,
            `باقة ${packageContentLabels[contentType] || 'المحتوى'}`,
            `اشترك الآن لفتح ${packageContentLabels[contentType] || 'هذا المحتوى'} في هذه المادة.`,
        );
        const coverageSummary = packageItem
            ? [
                packageItem.includedCourseIds?.length ? `${packageItem.includedCourseIds.length} دورة` : null,
                packageItem.subjectIds?.length ? `${packageItem.subjectIds.length} مادة` : null,
                packageItem.pathIds?.length ? `${packageItem.pathIds.length} مسار` : null,
            ].filter(Boolean).join(' • ')
            : '';

        return {
            title: packageItem?.title || `يتطلب فتح ${packageContentLabels[contentType] || 'هذا المحتوى'}`,
            description: packageItem?.description || 'هذا الجزء غير مفتوح على حسابك حاليًا.',
            coverageSummary,
        };
    };
    const openScopedPackageForType = (contentType: PackageContentType, fallbackItem?: any, fallbackType = '') => {
        const packageItem = buildScopedPackageItem(
            contentType,
            `باقة ${packageContentLabels[contentType] || 'المحتوى'}`,
            `اشترك الآن لفتح ${packageContentLabels[contentType] || 'هذا المحتوى'} في هذه المادة.`,
        );
        if (packageItem) {
            navigate(buildPackagesPagePath(contentType, packageItem.packageId || packageItem.id));
            return;
        }
        setPaymentModalData({
            isOpen: true,
            item: packageItem || fallbackItem,
            type: packageItem ? 'package' : fallbackType,
        });
    };
    const canStudentSeeCourse = (course: (typeof courses)[number]) =>
        isStaffViewer || (course.showOnPlatform !== false && course.isPublished !== false && (!course.approvalStatus || course.approvalStatus === 'approved'));
    const canStudentSeeLesson = (lesson: (typeof lessons)[number]) =>
        isStaffViewer || (lesson.showOnPlatform !== false && (!lesson.approvalStatus || lesson.approvalStatus === 'approved'));
    const isQuizAudienceAllowed = (quiz: (typeof quizzes)[number]) => {
        if (isStaffViewer) return true;

        const targetUserIds = quiz.targetUserIds || [];
        const targetGroupIds = [
            ...(quiz.targetGroupIds || []),
            ...(quiz.access?.allowedGroupIds || []),
        ];
        const hasExplicitAudience = targetUserIds.length > 0 || targetGroupIds.length > 0;

        if ((quiz.access?.type || 'free') !== 'private' && !hasExplicitAudience) {
            return true;
        }

        const userGroupIds = user.groupIds || [];
        return targetUserIds.includes(user.id) || targetGroupIds.some(groupId => userGroupIds.includes(groupId));
    };
    const canStudentSeeQuiz = (quiz: (typeof quizzes)[number]) =>
        isStaffViewer ||
        ((quiz.questionIds?.length || 0) > 0 &&
            quiz.showOnPlatform !== false &&
            quiz.isPublished !== false &&
            (!quiz.approvalStatus || quiz.approvalStatus === 'approved') &&
            isQuizAudienceAllowed(quiz));
    const canStudentSeeLibraryItem = (item: (typeof libraryItems)[number]) =>
        isStaffViewer || (item.showOnPlatform !== false && (!item.approvalStatus || item.approvalStatus === 'approved'));
    const getQuizAccessType = (quiz: (typeof quizzes)[number], slot?: 'training' | 'tests') =>
        resolveQuizLearningAccessType(quiz, slot ? { pathId: category, subjectId: subject, slot } : undefined);
    const isQuizLockedForStudent = (
        quiz: (typeof quizzes)[number],
        hasPackageAccess: boolean,
        slot?: 'training' | 'tests',
    ) => {
        if (isStaffViewer) return false;

        const accessType = getQuizAccessType(quiz, slot);
        if (accessType === 'free') return false;
        if (accessType === 'private') return !isQuizAudienceAllowed(quiz);

        return !hasPackageAccess;
    };
    const formatQuizUpdatedAt = (createdAt?: unknown) => {
        const date = createdAt ? new Date(createdAt as string | number | Date) : new Date();
        return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    };
    const matchesScopedContent = (pathId?: string | null, subjectId?: string | null) => {
        const normalizedPathId = pathId || null;
        const normalizedSubjectId = subjectId || null;
        const pathMatches = !normalizedPathId || normalizedPathId === category;
        const subjectMatches = !normalizedSubjectId || normalizedSubjectId === subject || normalizedSubjectId === `${category}_${subject}`;
        return pathMatches && subjectMatches;
    };

    const showPublicAdminDiagnostics = isAdminViewer && searchParams.get('adminDebug') === '1';

    useEffect(() => {
        const previewPackageId = searchParams.get('package');
        if (!previewPackageId || searchParams.get('tab') === 'packages') {
            return;
        }
        navigate(buildPackagesPagePath(undefined, previewPackageId), { replace: true });
    }, [navigate, searchParams]);

    // Data Retrieval from Store
    let sectionCourses = courses.filter((course) => {
        const coursePathId = resolveCoursePathId(course, subjects);
        const courseSubjectId = resolveCourseSubjectId(course, subjects);
        if (course.isPackage) return false;
        if (!canStudentSeeCourse(course)) return false;
        return matchesScopedContent(coursePathId, courseSubjectId);
    });

    const topicList = useStore(state => state.topics);
    const quizList = useStore(state => state.quizzes);
    const previewTopicId = searchParams.get('topic');
    const previewTopic = previewTopicId ? findByEntityId(topicList, previewTopicId) || null : null;
    const previewParentTopic = previewTopic?.parentId
        ? findByEntityId(topicList, previewTopic.parentId) || previewTopic
        : previewTopic;

    const canStudentSeeTopic = (topic: (typeof topicList)[number]) => isStaffViewer || topic.showOnPlatform !== false;

    let mappedSkills = topicList
        .filter(t => !t.parentId && (isStaffViewer || t.showOnPlatform !== false) && matchesScopedContent(t.pathId, t.subjectId))
        .sort((a, b) => a.order - b.order)
        .map(topic => {
            const subTopics = topicList.filter(t => t.parentId === topic.id && canStudentSeeTopic(t) && matchesScopedContent(t.pathId, t.subjectId));
            const visibleLessonCount = (lessonIds?: string[]) =>
                (lessonIds || []).filter(lessonId => {
                    const lesson = findByEntityId(lessons, lessonId);
                    return lesson ? canStudentSeeLesson(lesson) : false;
                }).length;
            const visibleQuizCount = (quizIds?: string[]) =>
                (quizIds || []).filter(quizId => {
                    const quiz = findByEntityId(quizList, quizId);
                    return quiz ? canStudentSeeQuiz(quiz) : false;
                }).length;
            let totalLessons = visibleLessonCount(topic.lessonIds);
            let totalQuizzes = visibleQuizCount(topic.quizIds);
            subTopics.forEach(sub => {
                totalLessons += visibleLessonCount(sub.lessonIds);
                totalQuizzes += visibleQuizCount(sub.quizIds);
            });
            
            // Dummy progress for demo purposes until user progress is tracked properly
            const progress = 0; 
            
            return {
                id: topic.id,
                title: topic.title,
                totalLessons: totalLessons || 1,
                completed: Math.floor((progress / 100) * (totalLessons || 1)),
                totalQuizzes: totalQuizzes,
                isLocked: !isStaffViewer && topic.isLocked === true && !hasFoundationAccess,
                progress: progress,
                originalTopic: topic // Keep a reference to the real topic
            };
        });

    useEffect(() => {
        const requestedTab = searchParams.get('tab');
        if (requestedTab && requestedTab !== 'skills') return;

        const previewTopicId = searchParams.get('topic');
        if (!previewTopicId) return;

        const requestedTopic = findByEntityId(topicList, previewTopicId);
        if (!requestedTopic) return;

        const parentTopic = requestedTopic.parentId
            ? findByEntityId(topicList, requestedTopic.parentId)
            : requestedTopic;
        if (!parentTopic || !matchesScopedContent(parentTopic.pathId, parentTopic.subjectId)) return;

        const topicIsLocked =
            !isStaffViewer &&
            !hasFoundationAccess &&
            (parentTopic.isLocked === true || requestedTopic.isLocked === true);
        if (topicIsLocked) {
            const packageItem = buildScopedPackageItem(
                'foundation',
                'باقة التأسيس',
                'اشترك الآن لفتح موضوعات التأسيس المرتبطة بهذه المادة.',
            );

            setActiveTab('skills');
            setPaymentModalData({
                isOpen: true,
                item: packageItem || {
                    id: parentTopic.id,
                    title: parentTopic.title,
                    purchaseType: 'skill',
                    price: 99,
                    currency: 'ر.س',
                },
                type: packageItem ? 'package' : 'skill',
            });
            return;
        }

        const subTopics = topicList.filter((topic) => topic.parentId === parentTopic.id && (isStaffViewer || topic.showOnPlatform !== false));
        const countVisibleLessons = (lessonIds?: string[]) =>
            (lessonIds || []).filter((lessonId) => {
                const lesson = findByEntityId(lessons, lessonId);
                return lesson ? canStudentSeeLesson(lesson) : false;
            }).length;
        const countVisibleQuizzes = (quizIds?: string[]) =>
            (quizIds || []).filter((quizId) => {
                const quiz = findByEntityId(quizList, quizId);
                return quiz ? canStudentSeeQuiz(quiz) : false;
            }).length;

        const totalLessons = countVisibleLessons(parentTopic.lessonIds) + subTopics.reduce((sum, topic) => sum + countVisibleLessons(topic.lessonIds), 0);
        const totalQuizzes = countVisibleQuizzes(parentTopic.quizIds) + subTopics.reduce((sum, topic) => sum + countVisibleQuizzes(topic.quizIds), 0);

        setActiveTab('skills');
        const requestedContentTab = searchParams.get('content') === 'quizzes' ? 'quizzes' : 'lessons';
        const requestedLessonId = searchParams.get('lesson');

        setSelectedSkill({
            id: parentTopic.id,
            title: parentTopic.title,
            totalLessons: totalLessons || 1,
            completed: 0,
            totalQuizzes,
            isLocked: false,
            progress: 0,
            originalTopic: parentTopic,
            initialSubTopicId: requestedTopic.parentId ? requestedTopic.id : null,
            initialContentTab: requestedContentTab,
            initialLessonId: requestedLessonId || null,
            trainingDone: hasReturnedFromFoundationTraining,
        });
    }, [category, hasFoundationAccess, hasReturnedFromFoundationTraining, isStaffViewer, lessons, quizList, searchParams, subject, topicList]);

    let banks = getLearningSlotQuizzes(
        quizzes.filter(isMaterialQuizCandidate),
        { pathId: category, subjectId: subject, slot: 'training' },
        canStudentSeeQuiz,
        isTrainingQuiz,
        true,
    ).map(q => ({
        id: q.id,
        title: q.title,
        questions: q.questionIds?.length || 0,
        updated: formatQuizUpdatedAt(q.createdAt),
        type: 'bank',
        level: 'متعدد',
        isLocked: isQuizLockedForStudent(q, hasBanksAccess, 'training'),
        duration: 'غير محدد'
    }));

    let tests = getLearningSlotQuizzes(
        quizzes.filter(isMaterialQuizCandidate),
        { pathId: category, subjectId: subject, slot: 'tests' },
        canStudentSeeQuiz,
        isMockQuiz,
        true,
    ).map(q => ({
        id: q.id,
        title: q.title,
        duration: `${q.settings?.timeLimit || 60} دقيقة`,
        questions: q.questionIds?.length || 0,
        type: 'simulated',
        level: 'متوسط',
        isLocked: isQuizLockedForStudent(q, hasTestsAccess, 'tests')
    }));

    let sectionLibraryItems = libraryItems.filter(item => canStudentSeeLibraryItem(item) && matchesScopedContent(item.pathId, item.subjectId)).map(item => ({
        ...item,
        isLocked: isPremiumLocked(settings.lockLibraryForNonSubscribers, hasLibraryAccess) || (!isStaffViewer && item.isLocked === true && !hasLibraryAccess)
    }));
    banks = banks.filter((bank) => {
        const sourceQuiz = quizList.find((quiz) => matchesEntityId(quiz, bank.id));
        return !!sourceQuiz && (sourceQuiz.questionIds?.length || 0) > 0 && sourceQuiz.pathId === category && (!subject || sourceQuiz.subjectId === subject);
    });
    tests = tests.filter((test) => {
        const sourceQuiz = quizList.find((quiz) => matchesEntityId(quiz, test.id));
        if (!sourceQuiz) return false;
        if ((sourceQuiz.questionIds?.length || 0) === 0) return false;
        if (sourceQuiz.pathId !== category || (subject && sourceQuiz.subjectId !== subject)) return false;
        if (!isStaffViewer) {
            const mode = sourceQuiz.mode || 'regular';
            const hasExplicitTargets = (sourceQuiz.targetUserIds || []).length > 0 || (sourceQuiz.targetGroupIds || []).length > 0;
            if (mode === 'central' || mode === 'saher' || hasExplicitTargets) return false;
        }
        return true;
    });
    sectionLibraryItems = sectionLibraryItems.filter((item) => {
        const pathMatches = !item.pathId || item.pathId === category;
        const subjectMatches = !subject || item.subjectId === subject;
        return pathMatches && subjectMatches;
    });
    const learningInventory = {
        courses: {
            total: sectionCourses.length,
            locked: sectionCourses.filter((course) => !(accessibleCourseIds.has(course.id) || hasCourseAccess || course.isPurchased)).length,
            label: 'الدورات',
        },
        skills: {
            total: mappedSkills.length,
            locked: mappedSkills.filter((skill) => skill.isLocked).length,
            label: 'التأسيس',
        },
        banks: {
            total: banks.length,
            locked: banks.filter((bank) => bank.isLocked).length,
            label: 'التدريب',
        },
        tests: {
            total: tests.length,
            locked: tests.filter((test) => test.isLocked).length,
            label: 'الاختبارات',
        },
        library: {
            total: sectionLibraryItems.length,
            locked: sectionLibraryItems.filter((item) => item.isLocked).length,
            label: 'المكتبة',
        },
    };
    const activeInventory = learningInventory[activeTab];
    const activeTabSummary = {
        total: activeInventory.total,
        locked: activeInventory.locked,
        open: Math.max(activeInventory.total - activeInventory.locked, 0),
        label: activeInventory.label,
    };
    const shouldShowActiveTabAccessNotice = Boolean(showActiveTabAccessNotice && activeTabSummary.locked > 0);
    const showStaffInventory = showPublicAdminDiagnostics;

    const handleItemClick = (item: any, type: string) => {
        if (item.isLocked) {
            const packageTypeMap: Record<string, PackageContentType> = {
                skill: 'foundation',
                bank: 'banks',
                test: 'tests',
                library: 'library',
            };
            const matchedType = packageTypeMap[type];
            if (matchedType) {
                openScopedPackageForType(matchedType, item, type);
            } else {
                setPaymentModalData({
                    isOpen: true,
                    item,
                    type,
                });
            }
        } else {
            if (type === 'skill') {
                setSelectedSkill({
                    ...item,
                    trainingDone: hasReturnedFromFoundationTraining,
                });
            }
            // Tests and Banks are handled by SimulatedTestExperience directly
        }
    };

    return (
        <div className="w-full">
            {/* Tabs */}
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap justify-center gap-2 md:gap-4 mb-12">
                {(settings.showCourses ?? true) && <TabButton active={activeTab === 'courses'} onClick={() => handleTabChange('courses')} icon={<MonitorPlay size={20} />} label="الدورات" colorTheme={colorTheme} />}
                {(settings.showSkills ?? true) && <TabButton active={activeTab === 'skills'} onClick={() => handleTabChange('skills')} icon={<Video size={20} />} label="التأسيس" colorTheme={colorTheme} />}
                {(settings.showBanks ?? true) && <TabButton active={activeTab === 'banks'} onClick={() => handleTabChange('banks')} icon={<BookOpen size={20} />} label="التدريب" colorTheme={colorTheme} />}
                {(settings.showTests ?? true) && <TabButton active={activeTab === 'tests'} onClick={() => handleTabChange('tests')} icon={<FileText size={20} />} label="الاختبارات" colorTheme={colorTheme} />}
                {(settings.showLibrary ?? true) && <TabButton active={activeTab === 'library'} onClick={() => handleTabChange('library')} icon={<Library size={20} />} label="المكتبة" colorTheme={colorTheme} />}
            </div>
            {showStaffInventory ? (
                <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
                    {Object.entries(learningInventory).map(([key, item]) => {
                        const isActive = activeTab === key;
                        return (
                            <div
                                key={key}
                                className={`rounded-3xl border p-4 shadow-sm transition-all ${
                                    isActive ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 bg-white'
                                }`}
                            >
                                <div className={`text-xs font-black ${isActive ? 'text-indigo-700' : 'text-gray-500'}`}>{item.label}</div>
                                <div className="mt-2 text-2xl font-black text-gray-900">{item.total}</div>
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">مفتوح {Math.max(item.total - item.locked, 0)}</span>
                                    <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">مغلق {item.locked}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : null}

            {/* Content */}
            <div className="animate-fade-in">
                {showStaffInventory ? (
                    <div className="mb-6 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <div className="text-xs font-black text-gray-500">حالة المساحة الحالية</div>
                                <h3 className="mt-2 text-xl font-black text-gray-900">{activeTabSummary.label}</h3>
                                <p className="mt-1 text-sm leading-7 text-gray-500">
                                    يوجد الآن {activeTabSummary.total} عنصرًا في هذا القسم، المفتوح منها {activeTabSummary.open} والمغلق {activeTabSummary.locked}.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-sm font-black">
                                <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">متاح الآن: {activeTabSummary.open}</span>
                                <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">{isCourseTabNotice ? 'يحتاج تفعيل' : 'يحتاج باقة'}: {activeTabSummary.locked}</span>
                                {activeTabAccess?.hasAccess ? (
                                    <span className="rounded-full bg-indigo-50 px-3 py-2 text-indigo-700">وصولك لهذا القسم مفعل</span>
                                ) : (
                                    <span className="rounded-full bg-gray-100 px-3 py-2 text-gray-700">{isCourseTabNotice ? 'يمكن تفعيله من شراء الدورة أو الباقة المناسبة' : 'يمكن فتحه من الباقة المناسبة'}</span>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}
                {shouldShowActiveTabAccessNotice && activeTabPackage && activeTabAccess && (
                    <div className="mb-6 rounded-3xl border border-amber-100 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                                    <Lock size={20} />
                                </div>
                                <div>
                                    <div className="text-sm font-black text-gray-900">{isCourseTabNotice ? 'هذا القسم فيه دورات مدفوعة' : 'هذا القسم فيه محتوى يحتاج باقة'}</div>
                                    <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold">
                                        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">مفتوح {activeTabSummary.open}</span>
                                        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">يحتاج تفعيل {activeTabSummary.locked}</span>
                                        <span className="rounded-full bg-gray-50 px-3 py-1.5 text-gray-600">{currentSubjectData?.name || 'المادة الحالية'}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => navigate(buildPackagesPagePath(activeTabAccess.contentType, activeTabPackage.packageId || activeTabPackage.id))}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-amber-600"
                            >
                                {isCourseTabNotice ? <CreditCard size={18} /> : <Package size={18} />}
                                {isCourseTabNotice ? 'عرض الباقات المناسبة' : 'فتح الباقة'}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'courses' && enabledTabs.courses && (
                    <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sectionCourses.map((baseCourse) => {
                            const course = {
                                ...baseCourse,
                                isPurchased: accessibleCourseIds.has(baseCourse.id) || hasCourseAccess || baseCourse.isPurchased,
                            };
                            const isPurchased = course.isPurchased;
                            const lockedCourseMessage = !isPurchased ? getLockedContentMessage('courses') : null;

                            return (
                            <Card
                                key={course.id}
                                className="flex flex-col overflow-hidden border-2 border-transparent hover:shadow-xl transition-all duration-300 cursor-pointer rounded-3xl"
                                style={{ borderColor: theme.border }}
                            >
                                <div className="relative h-48 bg-gray-900 group">
                                    <img 
                                        src={course.thumbnail} 
                                        alt={course.title} 
                                        className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                                    />
                                    {!isPurchased && (
                                        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white p-2 rounded-full">
                                            <Lock size={16} />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                                    
                                    <div className="absolute bottom-0 left-0 right-0 p-5">
                                        <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full mb-2 inline-block">{course.category}</span>
                                        <div className="mb-2 flex flex-wrap gap-2">
                                            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${isPurchased ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'}`}>
                                                {isPurchased ? 'مفتوح لك الآن' : 'مدفوع أو يحتاج تفعيل'}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-xl text-white mb-1">{course.title}</h3>
                                    </div>
                                </div>
                                <div className="p-5 flex-1 flex flex-col bg-white">
                                    <div className="mb-4">
                                        <div className="flex justify-between text-xs text-gray-500 mb-2 font-bold">
                                            <span>{course.progress}% مكتمل</span>
                                        </div>
                                        <ProgressBar percentage={course.progress} showPercentage={false} color={safeColorTheme as any} />
                                    </div>
                                    {!isPurchased && lockedCourseMessage && (
                                        <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-right">
                                            <div className="text-xs font-black text-amber-700">لماذا هذا المحتوى مغلق؟</div>
                                            <div className="mt-1 text-sm font-bold text-gray-900">{lockedCourseMessage.title}</div>
                                            <div className="mt-1 text-xs leading-6 text-gray-600">{lockedCourseMessage.description}</div>
                                            {showPublicAdminDiagnostics && lockedCourseMessage.coverageSummary ? (
                                                <div className="mt-2 text-[11px] font-black text-amber-700">{lockedCourseMessage.coverageSummary}</div>
                                            ) : null}
                                        </div>
                                    )}
                                    <div className="mt-auto">
                                        {!isPurchased && (
                                            <button
                                                onClick={() => setPaymentModalData({
                                                    isOpen: true,
                                                    item: course,
                                                    type: 'course',
                                                })}
                                                className="w-full py-3 rounded-xl font-bold text-white shadow-md transition-transform hover:-translate-y-1 flex items-center justify-center mb-0"
                                                style={{ backgroundColor: theme.base }}
                                            >
                                                طلب شراء الدورة
                                            </button>
                                        )}
                                        <Link
                                            to={`/course/${course.id}`}
                                            className={`w-full py-3 rounded-xl font-bold text-white shadow-md transition-transform hover:-translate-y-1 flex items-center justify-center ${!isPurchased ? 'hidden' : ''}`}
                                            style={{ backgroundColor: theme.base }}
                                        >
                                            {course.isPurchased ? (course.progress > 0 ? 'مواصلة التعلم' : 'ابدأ التعلم') : 'اشترك الآن'}
                                        </Link>
                                    </div>
                                </div>
                            </Card>
                            );
                        })}
                        {sectionCourses.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-400">
                                <MonitorPlay size={48} className="mx-auto mb-4 opacity-20" />
                                <p>لا توجد دورات متاحة حالياً في هذا القسم.</p>
                            </div>
                        )}
                    </div>
                    </div>
                )}

                {activeTab === 'skills' && enabledTabs.skills && (
                    <div className="space-y-5">
                        {previewTopic && showPublicAdminDiagnostics && (
                            <div className="rounded-3xl border border-indigo-100 bg-indigo-50/50 p-5 shadow-sm">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <div className="text-xs font-black text-indigo-700">معاينة الموضوع المفتوح</div>
                                        <h3 className="mt-2 text-lg font-black text-gray-900">{previewParentTopic?.title || previewTopic.title}</h3>
                                        {previewTopic?.parentId ? (
                                            <p className="mt-1 text-sm text-gray-600">
                                                الموضوع الفرعي الحالي: <span className="font-black text-gray-900">{previewTopic.title}</span>
                                            </p>
                                        ) : (
                                            <p className="mt-1 text-sm text-gray-600">
                                                هذا هو الموضوع الرئيسي المفتوح مباشرة من لوحة الإدارة.
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs font-black">
                                        <span className="rounded-full bg-white px-3 py-2 text-indigo-700">المسار: {paths.find((path) => path.id === category)?.name || 'غير محدد'}</span>
                                        <span className="rounded-full bg-white px-3 py-2 text-emerald-700">المادة: {currentSubjectData?.name || 'غير محددة'}</span>
                                        <span className="rounded-full bg-white px-3 py-2 text-gray-700">الغرض: اختبار الربط والمعاينة</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {mappedSkills.map((skill) => {
                            const lockedFoundationMessage = skill.isLocked ? getLockedContentMessage('foundation') : null;

                            return (
                                <button
                                    type="button"
                                    key={skill.id}
                                    className="p-5 border-2 border-gray-100 hover:shadow-lg transition-all cursor-pointer group rounded-3xl relative overflow-hidden bg-white text-right"
                                    style={{ borderColor: theme.border }}
                                    onClick={() => handleItemClick(skill, 'skill')}
                                >
                                    {skill.isLocked && (
                                        <div className="absolute top-3 left-3 text-gray-400">
                                            <Lock size={20} />
                                        </div>
                                    )}
                                    <div className="flex items-center gap-4 mb-4">
                                        <div
                                            className="w-14 h-14 rounded-2xl flex items-center justify-center transition-colors group-hover:text-white"
                                            style={{ backgroundColor: theme.soft, color: theme.text }}
                                        >
                                            <PlayCircle size={28} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg">{skill.title}</h3>
                                            {showPublicAdminDiagnostics ? (
                                                <span className="text-xs text-gray-500 font-medium">
                                                    {skill.totalLessons} درس • {skill.totalQuizzes || 0} تدريب قصير
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400 font-medium">ابدأ من هنا</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mb-4 flex flex-wrap gap-2">
                                        <span className={`rounded-full px-3 py-1 text-[11px] font-black ${skill.isLocked ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                            {skill.isLocked ? 'مدفوع / ضمن باقة' : 'مجاني ومفتوح الآن'}
                                        </span>
                                    </div>
                                    {skill.isLocked && lockedFoundationMessage && (
                                        <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-right">
                                            <div className="text-xs font-black text-amber-700">خطوة الفتح</div>
                                            <div className="mt-1 text-sm font-bold text-gray-900">{lockedFoundationMessage.title}</div>
                                            <div className="mt-1 text-xs leading-6 text-gray-600">{lockedFoundationMessage.description}</div>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        {showPublicAdminDiagnostics ? (
                                            <>
                                                <div className="flex justify-between text-xs font-bold text-gray-600">
                                                    <span>التقدم</span>
                                                    <span>{Math.round((skill.completed / skill.totalLessons) * 100)}%</span>
                                                </div>
                                                <ProgressBar percentage={(skill.completed / skill.totalLessons) * 100} showPercentage={false} color={safeColorTheme as any} />
                                            </>
                                        ) : (
                                            <div className="text-xs font-bold text-gray-400">اضغط لفتح هذا المسار التعليمي</div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                        </div>
                    </div>
                )}

                {activeTab === 'banks' && enabledTabs.banks && (
                    <>
                    {hasReturnedFromFoundationTraining && (
                        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-right shadow-sm sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="text-sm font-black text-emerald-800">تم حفظ التدريب</div>
                                <p className="mt-1 text-xs font-bold text-emerald-700">تقدر تكمل من نفس المكان أو تبدأ تدريبًا آخر.</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleDismissJourneyNotice}
                                className="inline-flex w-fit items-center justify-center rounded-xl bg-white px-3 py-1.5 text-xs font-black text-emerald-700 ring-1 ring-emerald-100 transition hover:bg-emerald-100"
                            >
                                تم
                            </button>
                        </div>
                    )}
                    {showPublicAdminDiagnostics && (
                        <div className="mb-4 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-black">
                                <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">متاح الآن: {learningInventory.banks.total - learningInventory.banks.locked}</span>
                                <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">يحتاج تفعيل: {learningInventory.banks.locked}</span>
                            </div>
                        </div>
                    )}
                    {showPublicAdminDiagnostics && !hasBanksAccess && learningInventory.banks.locked > 0 && (
                        <div className="mb-4 rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-amber-700">
                                        قبل بدء التدريب
                                    </div>
                                    <h3 className="mt-2 text-lg font-black text-gray-900">{getLockedContentMessage('banks').title}</h3>
                                    <p className="mt-1 text-sm leading-7 text-gray-600">{getLockedContentMessage('banks').description}</p>
                                    {showPublicAdminDiagnostics && getLockedContentMessage('banks').coverageSummary ? (
                                        <div className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-amber-700">
                                            {getLockedContentMessage('banks').coverageSummary}
                                        </div>
                                    ) : null}
                                </div>
                                <button
                                    onClick={() => openScopedPackageForType('banks')}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-amber-100 transition hover:bg-amber-600"
                                >
                                    <Package size={18} />
                                    فتح باقة التدريبات
                                </button>
                            </div>
                        </div>
                    )}
                    <React.Suspense fallback={<LightweightModalFallback />}>
                        <SimulatedTestExperience 
                            mode="bank"
                            tests={banks.map(bank => ({
                                id: bank.id,
                                title: bank.title,
                                questions: bank.questions,
                                duration: 'غير محدد',
                                type: 'bank',
                                level: 'متعدد',
                                isLocked: bank.isLocked
                            }))} 
                            onStartTest={(test) => navigate(buildQuizRouteWithContext(String(test.id), {
                                returnTo: buildSectionReturnPath('banks'),
                                source: 'training',
                                returnOnFinish: shouldTrainingReturnOnFinish(test.id),
                            }))}
                            onLockedClick={(test) => handleItemClick(test, 'bank')}
                        />
                    </React.Suspense>
                    </>
                )}

                {activeTab === 'tests' && enabledTabs.tests && (
                    <>
                    {hasReturnedFromLearningTest && (
                        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-right shadow-sm sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="text-sm font-black text-indigo-800">تم حفظ نتيجة الاختبار</div>
                                <p className="mt-1 text-xs font-bold text-indigo-700">يمكنك مراجعة المحاولة من اختباراتي أو بدء اختبار آخر.</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleDismissJourneyNotice}
                                className="inline-flex w-fit items-center justify-center rounded-xl bg-white px-3 py-1.5 text-xs font-black text-indigo-700 ring-1 ring-indigo-100 transition hover:bg-indigo-100"
                            >
                                تم
                            </button>
                        </div>
                    )}
                    {showPublicAdminDiagnostics && (
                        <div className="mb-4 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-black">
                                <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">متاح الآن: {learningInventory.tests.total - learningInventory.tests.locked}</span>
                                <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">يحتاج تفعيل: {learningInventory.tests.locked}</span>
                            </div>
                        </div>
                    )}
                    {showPublicAdminDiagnostics && !hasTestsAccess && learningInventory.tests.locked > 0 && (
                        <div className="mb-4 rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-amber-700">
                                        قبل بدء الاختبار
                                    </div>
                                    <h3 className="mt-2 text-lg font-black text-gray-900">{getLockedContentMessage('tests').title}</h3>
                                    <p className="mt-1 text-sm leading-7 text-gray-600">{getLockedContentMessage('tests').description}</p>
                                    {showPublicAdminDiagnostics && getLockedContentMessage('tests').coverageSummary ? (
                                        <div className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-amber-700">
                                            {getLockedContentMessage('tests').coverageSummary}
                                        </div>
                                    ) : null}
                                </div>
                                <button
                                    onClick={() => openScopedPackageForType('tests')}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-amber-100 transition hover:bg-amber-600"
                                >
                                    <Package size={18} />
                                    فتح باقة الاختبارات
                                </button>
                            </div>
                        </div>
                    )}
                    <React.Suspense fallback={<LightweightModalFallback />}>
                        <SimulatedTestExperience 
                            tests={tests} 
                            onStartTest={(test) => navigate(buildQuizRouteWithContext(String(test.id), { returnTo: buildSectionReturnPath('tests'), source: 'tests' }))}
                            onLockedClick={(test) => handleItemClick(test, 'test')}
                        />
                    </React.Suspense>
                    </>
                )}

                {activeTab === 'library' && enabledTabs.library && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sectionLibraryItems.map((item: any) => {
                            const lockedLibraryMessage = item.isLocked ? getLockedContentMessage('library') : null;

                            return (
                                <Card
                                    key={item.id}
                                    className="p-6 border-2 border-gray-100 hover:shadow-lg transition-all flex flex-col rounded-3xl relative"
                                    style={{ borderColor: theme.border }}
                                >
                                    {item.isLocked && (
                                        <div className="absolute top-4 left-4 text-gray-400">
                                            <Lock size={20} />
                                        </div>
                                    )}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${item.type === 'pdf' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                            <FileText size={28} />
                                        </div>
                                        {showPublicAdminDiagnostics ? (
                                            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">{item.size}</span>
                                        ) : (
                                            <span className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">ملف</span>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-xl text-gray-900 mb-2">{item.title}</h3>
                                    {showPublicAdminDiagnostics ? (
                                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6 font-medium">
                                            <User size={16} />
                                            <span>{item.downloads} تحميل</span>
                                        </div>
                                    ) : (
                                        <div className="mb-6 text-center text-xs text-gray-400">ملف متاح للعرض أو التحميل</div>
                                    )}
                                    <div className="mb-4 flex flex-wrap gap-2">
                                        <span className={`rounded-full px-3 py-1 text-[11px] font-black ${item.isLocked ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                            {item.isLocked ? 'مغلقة حتى التفعيل' : 'متاحة للعرض والتحميل'}
                                        </span>
                                    </div>
                                    {showPublicAdminDiagnostics && item.isLocked && lockedLibraryMessage && (
                                        <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-right">
                                            <div className="text-xs font-black text-amber-700">سبب الإغلاق</div>
                                            <div className="mt-1 text-sm font-bold text-gray-900">{lockedLibraryMessage.title}</div>
                                            <div className="mt-1 text-xs leading-6 text-gray-600">{lockedLibraryMessage.description}</div>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-auto">
                                        <button
                                            onClick={() => {
                                                if (item.isLocked) {
                                                    handleItemClick(item, 'library');
                                                } else if (item.url) {
                                                    openExternalUrl(item.url);
                                                }
                                            }}
                                            className={`bg-indigo-50 text-indigo-700 py-3 rounded-xl font-bold hover:bg-indigo-600 hover:text-white transition-colors shadow-sm ${item.isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {item.isLocked ? 'تفعيل ثم تحميل' : 'تحميل'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (item.isLocked) {
                                                    handleItemClick(item, 'library');
                                                } else if (item.url && item.url.includes('drive.google.com')) {
                                                    openExternalUrl(item.url);
                                                } else {
                                                    setViewingFile(item);
                                                }
                                            }}
                                            className="bg-emerald-50 text-emerald-700 py-3 rounded-xl font-bold hover:bg-emerald-600 hover:text-white transition-colors flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <Eye size={18} />
                                            {item.isLocked ? 'اعرف طريقة الفتح' : 'عرض'}
                                        </button>
                                    </div>
                                </Card>
                            );
                        })}
                        {sectionLibraryItems.length === 0 && (
                            <div className="col-span-full text-center py-16 text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                                <Library size={64} className="mx-auto mb-4 opacity-20" />
                                <p className="text-lg font-medium">لا توجد ملفات متاحة حالياً في المكتبة.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {selectedSkill && (
                <React.Suspense fallback={<LightweightModalFallback />}>
                    <SkillDetailsModal 
                        isOpen={!!selectedSkill} 
                        onClose={() => setSelectedSkill(null)} 
                        skill={selectedSkill} 
                    />
                </React.Suspense>
            )}

            {viewingFile && (
                <React.Suspense fallback={<LightweightModalFallback />}>
                    <FileModal 
                        fileUrl={viewingFile.url || (viewingFile.type === 'pdf' ? "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" : "https://picsum.photos/seed/library/800/1200")}
                        title={viewingFile.title}
                        type={viewingFile.type}
                        onClose={() => setViewingFile(null)}
                    />
                </React.Suspense>
            )}

            {paymentModalData.isOpen && (
                <React.Suspense fallback={<LightweightModalFallback />}>
                    <PaymentModal 
                        isOpen={paymentModalData.isOpen} 
                        onClose={() => setPaymentModalData({ isOpen: false, item: null, type: '' })} 
                        item={{
                            ...paymentModalData.item,
                            id: paymentModalData.item?.id,
                            packageId: paymentModalData.item?.packageId,
                            purchaseType: paymentModalData.item?.purchaseType || (paymentModalData.type === 'course' ? 'course' : 'package'),
                            title: paymentModalData.item?.title || `باقة ${paymentModalData.type === 'skill' ? 'التأسيس' : paymentModalData.type === 'bank' ? 'بنك الأسئلة' : paymentModalData.type === 'test' ? 'الاختبارات' : 'شاملة'}`,
                            price: paymentModalData.item?.price || 99,
                            currency: paymentModalData.item?.currency || 'ر.س',
                            description: paymentModalData.item?.description || `اشترك الآن للوصول إلى ${paymentModalData.item?.title || 'المحتوى'} والمزيد من المحتوى الحصري.`,
                            thumbnail: 'https://picsum.photos/seed/package/800/600',
                            features: ['وصول كامل للمحتوى', 'تحديثات مستمرة', 'دعم فني'],
                            category: 'باقة اشتراك',
                            includedCourseIds: paymentModalData.item?.includedCourseIds || paymentModalData.item?.courseIds || [],
                            contentTypes: paymentModalData.item?.contentTypes || ['all'],
                            pathIds: paymentModalData.item?.pathIds || [category],
                            subjectIds: paymentModalData.item?.subjectIds || [subject],
                            accessContext: paymentModalData.item?.accessContext || 'إذا كان هذا الجزء تابعًا لوصول مدرسي أو باقة مفعلة من الإدارة فلن تحتاج شراءه. أما إذا بقي مغلقًا على حسابك فهذه هي وسيلة التفعيل المناسبة.',
                        }}
                        type={paymentModalData.type as any}
                    />
                </React.Suspense>
            )}
        </div>
    );
};

const TabButton = ({ active, onClick, icon, label, colorTheme }: any) => {
    const palette = resolveThemePalette(colorTheme);
    return (
        <button 
            onClick={onClick}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${
                active ? 'text-white shadow-lg transform -translate-y-1' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
            style={active ? { backgroundColor: palette.base } : undefined}
        >
            {icon}
            {label}
        </button>
    );
};
