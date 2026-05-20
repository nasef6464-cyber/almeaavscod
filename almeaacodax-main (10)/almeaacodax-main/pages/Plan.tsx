import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  Circle,
  Clock,
  FileText,
  PlayCircle,
  RotateCcw,
  Target,
  TimerReset,
  BookOpen,
  Sparkles,
  Archive,
  Copy,
  Share2,
  Download,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useStore } from '../store/useStore';
import { StudyPlan, StudyPlanDay } from '../types';
import { sanitizeArabicText } from '../utils/sanitizeMojibakeArabic';
import { shareTextSummary } from '../utils/shareText';
import { printElementAsPdf } from '../utils/printPdf';

type GeneratedTask = {
  id: string;
  title: string;
  type: 'lesson' | 'quiz' | 'resource';
  phase: 'foundation' | 'practice' | 'review';
  phaseLabel: string;
  durationMinutes: number;
  durationLabel: string;
  link?: string;
  external?: boolean;
  scheduledDate: string;
  scheduledTime: string;
  scheduledEndTime: string;
  subjectId?: string;
  completed: boolean;
};

type WeeklyGoal = {
  id: string;
  title: string;
  progress: number;
  total: number;
  completed: number;
};

type PlannedTaskTemplate = Omit<GeneratedTask, 'scheduledDate' | 'scheduledTime' | 'scheduledEndTime'>;

type PlanPhaseSummary = {
  id: 'foundation' | 'practice' | 'review';
  title: string;
  description: string;
  days: number;
};

type DailySessionSlice = {
  id: string;
  title: string;
  minutes: number;
  startTime: string;
  endTime: string;
  colorClass: string;
};

type SmartSkillPlanItem = {
  skillId?: string;
  skillName: string;
  pathId?: string;
  subjectId?: string;
  mastery: number;
  attempts: number;
  lesson?: { title: string; link: string };
  quiz?: { title: string; link: string };
  resource?: { title: string; link?: string };
};

const displayText = (value?: string | null, fallback = '') => sanitizeArabicText(value || fallback) || fallback;

const DAYS: { id: StudyPlanDay; label: string; short: string; weekday: number }[] = [
  { id: 'saturday', label: 'السبت', short: 'Sat', weekday: 6 },
  { id: 'sunday', label: 'الأحد', short: 'Sun', weekday: 0 },
  { id: 'monday', label: 'الإثنين', short: 'Mon', weekday: 1 },
  { id: 'tuesday', label: 'الثلاثاء', short: 'Tue', weekday: 2 },
  { id: 'wednesday', label: 'الأربعاء', short: 'Wed', weekday: 3 },
  { id: 'thursday', label: 'الخميس', short: 'Thu', weekday: 4 },
  { id: 'friday', label: 'الجمعة', short: 'Fri', weekday: 5 },
];

const createDefaultDraft = (pathId = '') => ({
  name: '',
  pathId,
  subjectIds: [] as string[],
  courseIds: [] as string[],
  startDate: '',
  endDate: '',
  skipCompletedQuizzes: true,
  offDays: [] as StudyPlanDay[],
  dailyMinutes: 90,
  preferredStartTime: '17:00',
});

const formatTodayLabel = () =>
  new Date().toLocaleDateString('ar-SA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

const formatDateForPlan = (value: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ar-SA', {
    day: 'numeric',
    month: 'long',
  });
};

const addDaysToToday = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const parseDurationToMinutes = (value?: string) => {
  if (!value) return 20;
  const normalized = value.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  const hourMatch = normalized.match(/(\d+)\s*(hour|hours|ساعة|ساعات)/i);
  const minuteMatch = normalized.match(/(\d+)\s*(minute|minutes|دقيقة|دقائق|min)/i);
  if (hourMatch) return Math.max(Number(hourMatch[1]) * 60, 30);
  if (minuteMatch) return Math.max(Number(minuteMatch[1]), 10);
  const fallbackNumber = normalized.match(/\d+/);
  return fallbackNumber ? Math.max(Number(fallbackNumber[0]), 10) : 20;
};

const addMinutesToTime = (time: string, delta: number) => {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = ((hours || 0) * 60 + (minutes || 0) + delta) % (24 * 60);
  const nextHours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, '0');
  const nextMinutes = (totalMinutes % 60).toString().padStart(2, '0');
  return `${nextHours}:${nextMinutes}`;
};

const createDailySessionSlices = (startTime: string, totalMinutes: number): DailySessionSlice[] => {
  const safeMinutes = Math.max(totalMinutes, 30);
  const warmupMinutes = Math.max(10, Math.round(safeMinutes * 0.15));
  const reviewMinutes = Math.max(10, Math.round(safeMinutes * 0.2));
  const remainingMinutes = Math.max(safeMinutes - warmupMinutes - reviewMinutes, 10);
  const focusMinutes = Math.max(Math.round(remainingMinutes * 0.6), 10);
  const practiceMinutes = Math.max(remainingMinutes - focusMinutes, 10);

  const segments = [
    { id: 'warmup', title: 'تهيئة سريعة', minutes: warmupMinutes, colorClass: 'bg-emerald-50 text-emerald-700' },
    { id: 'focus', title: 'شرح وتركيز', minutes: focusMinutes, colorClass: 'bg-indigo-50 text-indigo-700' },
    { id: 'practice', title: 'تدريب وتطبيق', minutes: practiceMinutes, colorClass: 'bg-amber-50 text-amber-700' },
    { id: 'review', title: 'مراجعة خفيفة', minutes: reviewMinutes, colorClass: 'bg-rose-50 text-rose-700' },
  ];

  let cursor = startTime;
  return segments.map((segment) => {
    const slice = {
      ...segment,
      startTime: cursor,
      endTime: addMinutesToTime(cursor, segment.minutes),
    };
    cursor = slice.endTime;
    return slice;
  });
};

const enumerateDates = (startDate: string, endDate: string, offDays: StudyPlanDay[]) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const excludedWeekdays = new Set(
    offDays.map((dayId) => DAYS.find((day) => day.id === dayId)?.weekday).filter((day): day is number => day !== undefined),
  );

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (!excludedWeekdays.has(cursor.getDay())) {
      dates.push(cursor.toISOString().split('T')[0]);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const getPlanPhaseMeta = (phase: GeneratedTask['phase']) => {
  switch (phase) {
    case 'foundation':
      return { label: 'مرحلة التأسيس', accent: 'text-emerald-700', bg: 'bg-emerald-50' };
    case 'practice':
      return { label: 'مرحلة التدريب', accent: 'text-indigo-700', bg: 'bg-indigo-50' };
    case 'review':
      return { label: 'مرحلة المراجعة', accent: 'text-amber-700', bg: 'bg-amber-50' };
    default:
      return { label: 'مرحلة الخطة', accent: 'text-gray-700', bg: 'bg-gray-50' };
  }
};

const getPhaseForDayIndex = (dayIndex: number, totalDays: number): GeneratedTask['phase'] => {
  if (totalDays <= 2) return dayIndex === totalDays - 1 ? 'review' : 'practice';
  if (totalDays <= 4) {
    if (dayIndex === totalDays - 1) return 'review';
    return dayIndex <= 1 ? 'foundation' : 'practice';
  }

  const progressRatio = (dayIndex + 1) / totalDays;
  if (progressRatio <= 0.55) return 'foundation';
  if (progressRatio <= 0.85) return 'practice';
  return 'review';
};

const Plan: React.FC = () => {
  const {
    user,
    paths,
    subjects,
    skills,
    topics,
    courses,
    lessons,
    quizzes,
    examResults,
    completedLessons,
    libraryItems,
    enrolledCourses,
    hasScopedPackageAccess,
    studyPlans,
    createStudyPlan,
    updateStudyPlan,
    deleteStudyPlan,
    archiveStudyPlan,
  } = useStore();

  const accessibleCourseIds = useMemo(
    () =>
      new Set(
        courses
          .filter(
            (course) =>
              enrolledCourses.includes(course.id) ||
              (user.subscription?.purchasedCourses || []).includes(course.id) ||
              hasScopedPackageAccess('courses', course.pathId || course.category, course.subjectId || course.subject),
          )
          .map((course) => course.id),
      ),
    [courses, enrolledCourses, hasScopedPackageAccess, user.subscription?.purchasedCourses],
  );

  const canUseCourseInStudentPlan = (course: (typeof courses)[number]) =>
    course.showOnPlatform !== false && course.isPublished !== false && (!course.approvalStatus || course.approvalStatus === 'approved');
  const canUseLessonInStudentPlan = (lesson: (typeof lessons)[number]) =>
    lesson.showOnPlatform !== false && (!lesson.approvalStatus || lesson.approvalStatus === 'approved');
  const canUseQuizInStudentPlan = (quiz: (typeof quizzes)[number]) =>
    quiz.showOnPlatform !== false && quiz.isPublished !== false && (!quiz.approvalStatus || quiz.approvalStatus === 'approved');
  const canUseLibraryItemInStudentPlan = (item: (typeof libraryItems)[number]) =>
    item.showOnPlatform !== false && (!item.approvalStatus || item.approvalStatus === 'approved');

  const availablePaths = useMemo(
    () =>
      paths.filter((path) => {
        const hasSubjects = subjects.some((subject) => subject.pathId === path.id);
        const hasCourses = courses.some((course) => (course.pathId || course.category) === path.id);
        return path.isActive !== false && (hasSubjects || hasCourses);
      }),
    [courses, paths, subjects],
  );

  const [activePathId, setActivePathId] = useState('');
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [draft, setDraft] = useState(createDefaultDraft());
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [copiedSmartPlan, setCopiedSmartPlan] = useState(false);
  const [sharedSmartPlan, setSharedSmartPlan] = useState(false);

  useEffect(() => {
    if (!activePathId && availablePaths.length > 0) {
      setActivePathId(availablePaths[0].id);
    }
  }, [activePathId, availablePaths]);

  const pathPlans = useMemo(
    () =>
      studyPlans
        .filter((plan) => plan.userId === user.id && plan.pathId === activePathId)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [activePathId, studyPlans, user.id],
  );

  const activePlan = useMemo(
    () => pathPlans.find((plan) => plan.status === 'active') || pathPlans[0] || null,
    [pathPlans],
  );

  useEffect(() => {
    if (!activePathId) return;
    if (activePlan) {
      setEditingPlanId(activePlan.id);
      setDraft({
        name: activePlan.name,
        pathId: activePlan.pathId,
        subjectIds: activePlan.subjectIds,
        courseIds: activePlan.courseIds,
        startDate: activePlan.startDate,
        endDate: activePlan.endDate,
        skipCompletedQuizzes: activePlan.skipCompletedQuizzes,
        offDays: activePlan.offDays,
        dailyMinutes: activePlan.dailyMinutes,
        preferredStartTime: activePlan.preferredStartTime || '17:00',
      });
      setFormError('');
      setFormSuccess('');
      return;
    }

    setEditingPlanId(null);
    setDraft(createDefaultDraft(activePathId));
    setFormError('');
    setFormSuccess('');
  }, [activePathId, activePlan]);

  const selectedPath = useMemo(
    () => availablePaths.find((path) => path.id === activePathId) || null,
    [activePathId, availablePaths],
  );

  const pathSubjects = useMemo(
    () => subjects.filter((subject) => subject.pathId === activePathId),
    [activePathId, subjects],
  );

  const pathCourses = useMemo(
    () =>
      courses.filter(
        (course) =>
          accessibleCourseIds.has(course.id) &&
          canUseCourseInStudentPlan(course) &&
          (course.pathId || course.category) === activePathId &&
          (!draft.subjectIds.length || !course.subjectId || draft.subjectIds.includes(course.subjectId)),
      ),
    [accessibleCourseIds, activePathId, courses, draft.subjectIds],
  );

  const smartSkillPlan = useMemo<SmartSkillPlanItem[]>(() => {
    const stats = new Map<
      string,
      {
        skillId?: string;
        skillName: string;
        pathId?: string;
        subjectId?: string;
        total: number;
        attempts: number;
      }
    >();

    examResults.forEach((result) => {
      (result.skillsAnalysis || []).forEach((gap) => {
        const resolvedSkill = gap.skillId ? skills.find((skill) => skill.id === gap.skillId) : undefined;
        const pathId = resolvedSkill?.pathId || gap.pathId;
        if (activePathId && pathId && pathId !== activePathId) return;

        const subjectId = resolvedSkill?.subjectId || gap.subjectId;
        const skillName = displayText(resolvedSkill?.name || gap.skill, 'مهارة غير مسماة');
        const key = gap.skillId || `${pathId || 'path'}-${subjectId || 'subject'}-${skillName}`;
        const current = stats.get(key) || {
          skillId: gap.skillId,
          skillName,
          pathId,
          subjectId,
          total: 0,
          attempts: 0,
        };

        current.total += Number.isFinite(gap.mastery) ? gap.mastery : 0;
        current.attempts += 1;
        stats.set(key, current);
      });
    });

    return Array.from(stats.values())
      .map((item) => {
        const mastery = item.attempts ? Math.round(item.total / item.attempts) : 100;
        const relatedLesson = lessons.find((lesson) => {
          const matchesSkill = item.skillId ? lesson.skillIds?.includes(item.skillId) : false;
          const matchesSubject = !item.skillId && item.subjectId ? lesson.subjectId === item.subjectId : false;
          return (matchesSkill || matchesSubject) && canUseLessonInStudentPlan(lesson);
        });
        const relatedQuiz = quizzes.find((quiz) => {
          const matchesSkill = item.skillId ? quiz.skillIds?.includes(item.skillId) : false;
          const matchesSubject = !item.skillId && item.subjectId ? quiz.subjectId === item.subjectId : false;
          return (matchesSkill || matchesSubject) && canUseQuizInStudentPlan(quiz);
        });
        const relatedResource = libraryItems.find((resource) => {
          const matchesSkill = item.skillId ? resource.skillIds?.includes(item.skillId) : false;
          const matchesSubject = !item.skillId && item.subjectId ? resource.subjectId === item.subjectId : false;
          return (matchesSkill || matchesSubject) && canUseLibraryItemInStudentPlan(resource);
        });
        const relatedLessonTopic = relatedLesson
          ? topics.find((topic) => topic.lessonIds?.includes(relatedLesson.id)) ||
            topics.find(
              (topic) =>
                topic.pathId === relatedLesson.pathId &&
                topic.subjectId === relatedLesson.subjectId &&
                (!relatedLesson.sectionId || topic.sectionId === relatedLesson.sectionId),
            )
          : undefined;
        const lessonLearningLink =
          relatedLesson?.pathId && relatedLesson?.subjectId
            ? `/category/${relatedLesson.pathId}?subject=${relatedLesson.subjectId}&tab=skills${
                relatedLessonTopic ? `&topic=${relatedLessonTopic.id}&content=lessons&lesson=${relatedLesson.id}` : ''
              }`
            : '/reports';

        return {
          skillId: item.skillId,
          skillName: item.skillName,
          pathId: item.pathId,
          subjectId: item.subjectId,
          mastery,
          attempts: item.attempts,
          lesson: relatedLesson
            ? { title: displayText(relatedLesson.title, 'درس مقترح'), link: lessonLearningLink }
            : undefined,
          quiz: relatedQuiz
            ? { title: displayText(relatedQuiz.title, 'اختبار مقترح'), link: `/quiz/${relatedQuiz.id}` }
            : undefined,
          resource: relatedResource
            ? { title: displayText(relatedResource.title, 'ملف مراجعة'), link: relatedResource.url }
            : undefined,
        };
      })
      .filter((item) => item.mastery < 85)
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 4);
  }, [activePathId, examResults, libraryItems, lessons, quizzes, skills, topics]);

  const smartPlanSummary = useMemo(() => {
    if (!smartSkillPlan.length) {
      return 'لا توجد فجوات مهارية واضحة في آخر الاختبارات لهذا المسار. ابدأ بخطة مراجعة خفيفة أو جرّب اختبارًا تشخيصيًا جديدًا.';
    }

    return [
      'خطة مذاكرة ذكية مقترحة:',
      ...smartSkillPlan.map((item, index) => {
        const actions = [
          item.lesson ? `درس: ${item.lesson.title}` : '',
          item.quiz ? `اختبار: ${item.quiz.title}` : '',
          item.resource ? `ملف: ${item.resource.title}` : '',
        ]
          .filter(Boolean)
          .join(' - ');
        return `${index + 1}. ${item.skillName} (${item.mastery}%): ${actions || 'مراجعة مركزة ثم اختبار قصير'}`;
      }),
    ].join('\n');
  }, [smartSkillPlan]);
  const latestResult = examResults[0] || null;
  const primarySmartSkill = smartSkillPlan[0] || null;
  const weeklyRemediationJourney = useMemo(() => {
    const skillTitle = primarySmartSkill?.skillName || 'أضعف مهارة ظهرت في آخر اختبار';

    return [
      {
        title: 'اليوم',
        label: 'راجع النتيجة',
        body: latestResult
          ? `ابدأ من نتيجة ${displayText(latestResult.quizTitle, 'آخر اختبار')} وحدد موضع الخطأ.`
          : 'حل اختبارًا تشخيصيًا أولًا حتى تظهر لك نقطة البداية.',
        to: latestResult ? '/results' : '/dashboard?tab=saher',
        tone: 'border-emerald-100 bg-emerald-50 text-emerald-800',
      },
      {
        title: 'اليوم 1-2',
        label: 'افهم المهارة',
        body: primarySmartSkill?.lesson
          ? `راجع شرح ${primarySmartSkill.lesson.title}.`
          : `ابدأ بشرح قصير عن ${skillTitle}.`,
        to: primarySmartSkill?.lesson?.link || '/reports',
        tone: 'border-indigo-100 bg-indigo-50 text-indigo-800',
      },
      {
        title: 'اليوم 3-4',
        label: 'تدرب وقِس',
        body: primarySmartSkill?.quiz
          ? `حل ${primarySmartSkill.quiz.title} ثم راجع الأخطاء.`
          : 'حل تدريبًا قصيرًا ثم أعد القياس على نفس المهارة.',
        to: primarySmartSkill?.quiz?.link || '/dashboard?tab=saher',
        tone: 'border-amber-100 bg-amber-50 text-amber-800',
      },
      {
        title: 'نهاية الأسبوع',
        label: 'تابع التحسن',
        body: 'افتح التقرير وشاهد هل ارتفعت المهارة بعد الشرح والتدريب.',
        to: '/reports',
        tone: 'border-slate-200 bg-slate-50 text-slate-800',
      },
    ];
  }, [latestResult, primarySmartSkill]);

  const currentPlan = activePlan;

  const weakSubjectFocus = useMemo(() => {
    if (!currentPlan) return [];

    const subjectStats = new Map<string, { total: number; count: number }>();

    examResults.forEach((result) => {
      (result.skillsAnalysis || []).forEach((skillGap) => {
        const subjectId = skillGap.subjectId;
        if (!subjectId || !currentPlan.subjectIds.includes(subjectId)) return;

        const current = subjectStats.get(subjectId) || { total: 0, count: 0 };
        current.total += skillGap.mastery;
        current.count += 1;
        subjectStats.set(subjectId, current);
      });
    });

    return currentPlan.subjectIds
      .map((subjectId) => {
        const subject = subjects.find((item) => item.id === subjectId);
        const stat = subjectStats.get(subjectId);
        const mastery = stat && stat.count > 0 ? Math.round(stat.total / stat.count) : 100;

        return {
          subjectId,
          title: subject?.name || 'مادة',
          mastery,
        };
      })
      .sort((a, b) => a.mastery - b.mastery);
  }, [currentPlan, examResults, subjects]);

  const phaseSummaries = useMemo<PlanPhaseSummary[]>(() => {
    if (!currentPlan) return [];

    const eligibleDates = enumerateDates(currentPlan.startDate, currentPlan.endDate, currentPlan.offDays);
    const phaseCounts: Record<GeneratedTask['phase'], number> = {
      foundation: 0,
      practice: 0,
      review: 0,
    };

    eligibleDates.forEach((_, index) => {
      phaseCounts[getPhaseForDayIndex(index, eligibleDates.length)] += 1;
    });

    return [
      {
        id: 'foundation' as const,
        title: 'مرحلة التأسيس',
        description: 'بناء المفاهيم أولًا من المواد الأضعف حتى تكون البداية ثابتة.',
        days: phaseCounts.foundation,
      },
      {
        id: 'practice' as const,
        title: 'مرحلة التدريب',
        description: 'الانتقال إلى التدريب المنظم والاختبارات داخل نفس المواد.',
        days: phaseCounts.practice,
      },
      {
        id: 'review' as const,
        title: 'مرحلة المراجعة النهائية',
        description: 'تكثيف المراجعة والاختبارات قرب نهاية الخطة الزمنية.',
        days: phaseCounts.review,
      },
    ].filter((item) => item.days > 0);
  }, [currentPlan]);

  const generatedTasks = useMemo<GeneratedTask[]>(() => {
    if (!currentPlan) return [];

    const eligibleDates = enumerateDates(currentPlan.startDate, currentPlan.endDate, currentPlan.offDays);
    if (!eligibleDates.length) return [];

    const selectedSubjectIds = new Set(currentPlan.subjectIds);
    const selectedCourseIds = new Set(currentPlan.courseIds);
    const completedQuizIds = new Set(examResults.map((result) => result.quizId));

    const coursePool = courses.filter((course) => {
      const matchesPath = (course.pathId || course.category) === currentPlan.pathId;
      const matchesSubject =
        !selectedSubjectIds.size || !course.subjectId || selectedSubjectIds.has(course.subjectId);
      const matchesSelection = !selectedCourseIds.size || selectedCourseIds.has(course.id);
      const hasAccess =
        accessibleCourseIds.has(course.id) ||
        hasScopedPackageAccess('courses', course.pathId || course.category, course.subjectId || course.subject);
      return matchesPath && matchesSubject && matchesSelection && hasAccess && canUseCourseInStudentPlan(course);
    });

    const lessonTasks = coursePool.flatMap((course) =>
      (course.modules || []).flatMap((module) =>
        module.lessons.filter(canUseLessonInStudentPlan).map((lesson) => ({
          id: `lesson-${lesson.id}`,
          title: lesson.title,
          type: 'lesson' as const,
          phase: 'foundation' as const,
          phaseLabel: 'مرحلة التأسيس',
          durationMinutes: parseDurationToMinutes(lesson.duration),
          durationLabel: lesson.duration || '20 دقيقة',
          link: `/course/${course.id}`,
          subjectId: lesson.subjectId || course.subjectId,
          completed: completedLessons.includes(lesson.id),
        })),
      ),
    );

    const quizTasks = quizzes
      .filter((quiz) => {
        const matchesPath = quiz.pathId === currentPlan.pathId;
        const matchesSubject = !selectedSubjectIds.size || selectedSubjectIds.has(quiz.subjectId);
        const shouldSkip = currentPlan.skipCompletedQuizzes && completedQuizIds.has(quiz.id);
        return matchesPath && matchesSubject && canUseQuizInStudentPlan(quiz) && !shouldSkip;
      })
      .map((quiz) => ({
        id: `quiz-${quiz.id}`,
        title: quiz.title,
        type: 'quiz' as const,
        phase: 'practice' as const,
        phaseLabel: 'مرحلة التدريب',
        durationMinutes: quiz.settings?.timeLimit || 25,
        durationLabel: `${quiz.settings?.timeLimit || 25} دقيقة`,
        link: `/quiz/${quiz.id}`,
        subjectId: quiz.subjectId,
        completed: completedQuizIds.has(quiz.id),
      }));

    const resourceTasks = libraryItems
      .filter(
        (item) =>
          item.pathId === currentPlan.pathId &&
          (!selectedSubjectIds.size || selectedSubjectIds.has(item.subjectId)) &&
          canUseLibraryItemInStudentPlan(item),
      )
      .slice(0, 8)
      .map((item) => ({
        id: `resource-${item.id}`,
        title: item.title,
        type: 'resource' as const,
        phase: 'review' as const,
        phaseLabel: 'مرحلة المراجعة',
        durationMinutes: 15,
        durationLabel: '15 دقيقة',
        link: item.url,
        external: true,
        subjectId: item.subjectId,
        completed: false,
      }));

    const subjectPriority = new Map(
      weakSubjectFocus.map((item, index) => [item.subjectId, index]),
    );

    const rankedSubjectIds = Array.from(
      new Set<string>(
        currentPlan.subjectIds
          .map(String)
          .sort(
            (a, b) =>
              (subjectPriority.get(a) ?? Number.MAX_SAFE_INTEGER) -
              (subjectPriority.get(b) ?? Number.MAX_SAFE_INTEGER),
          ),
      ),
    );

    const taskPools = new Map<
      string,
      {
        lesson: PlannedTaskTemplate[];
        quiz: PlannedTaskTemplate[];
        resource: PlannedTaskTemplate[];
      }
    >();

    [...lessonTasks, ...quizTasks, ...resourceTasks]
      .sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }

        const priorityA = subjectPriority.get(a.subjectId || '') ?? Number.MAX_SAFE_INTEGER;
        const priorityB = subjectPriority.get(b.subjectId || '') ?? Number.MAX_SAFE_INTEGER;
        return priorityA - priorityB;
      })
      .forEach((task) => {
        const subjectKey = task.subjectId || '__general__';
        if (!taskPools.has(subjectKey)) {
          taskPools.set(subjectKey, { lesson: [], quiz: [], resource: [] });
        }
        taskPools.get(subjectKey)![task.type].push(task);
      });

    const subjectOrder: string[] = [
      ...rankedSubjectIds,
      ...Array.from(taskPools.keys()).filter((key) => key === '__general__' || !rankedSubjectIds.includes(key)),
    ];

    const hasRemainingTasks = () =>
      Array.from(taskPools.values()).some(
        (bucket) => bucket.lesson.length || bucket.quiz.length || bucket.resource.length,
      );

    const takeNextTask = (phase: GeneratedTask['phase']) => {
      const phasePreferences: Record<GeneratedTask['phase'], GeneratedTask['type'][]> = {
        foundation: ['lesson', 'resource', 'quiz'],
        practice: ['quiz', 'lesson', 'resource'],
        review: ['quiz', 'resource', 'lesson'],
      };

      for (const type of phasePreferences[phase]) {
        for (const subjectId of subjectOrder) {
          const bucket = taskPools.get(subjectId);
          if (bucket && bucket[type].length) {
            return bucket[type].shift() || null;
          }
        }
      }

      for (const subjectId of subjectOrder) {
        const bucket = taskPools.get(subjectId);
        if (!bucket) continue;
        for (const type of ['lesson', 'quiz', 'resource'] as const) {
          if (bucket[type].length) {
            return bucket[type].shift() || null;
          }
        }
      }

      return null;
    };

    const scheduledTasks: GeneratedTask[] = [];

    eligibleDates.forEach((date, dayIndex) => {
      const dayPhase = getPhaseForDayIndex(dayIndex, eligibleDates.length);
      let consumedMinutes = 0;
      let safety = 0;

      while (hasRemainingTasks() && safety < 50) {
        const nextTask = takeNextTask(dayPhase);
        if (!nextTask) break;
        safety += 1;

        const effectiveDuration = Math.max(nextTask.durationMinutes, 10);
        if (consumedMinutes > 0 && consumedMinutes + effectiveDuration > currentPlan.dailyMinutes) {
          const subjectKey = nextTask.subjectId || '__general__';
          if (!taskPools.has(subjectKey)) {
            taskPools.set(subjectKey, { lesson: [], quiz: [], resource: [] });
          }
          taskPools.get(subjectKey)![nextTask.type].unshift(nextTask);
          break;
        }

        const phaseMeta = getPlanPhaseMeta(dayPhase);
        scheduledTasks.push({
          ...nextTask,
          phase: dayPhase,
          phaseLabel: phaseMeta.label,
          scheduledDate: date,
          scheduledTime: addMinutesToTime(currentPlan.preferredStartTime || '17:00', consumedMinutes),
          scheduledEndTime: addMinutesToTime(
            currentPlan.preferredStartTime || '17:00',
            consumedMinutes + effectiveDuration,
          ),
        });
        consumedMinutes += effectiveDuration;
      }
    });

    if (hasRemainingTasks()) {
      const lastDate = eligibleDates[eligibleDates.length - 1];
      const lastDayTasks = scheduledTasks.filter((task) => task.scheduledDate === lastDate);
      let consumedMinutes = lastDayTasks.reduce((sum, task) => sum + Math.max(task.durationMinutes, 10), 0);

      while (hasRemainingTasks()) {
        const nextTask = takeNextTask('review');
        if (!nextTask) break;
        const phaseMeta = getPlanPhaseMeta('review');
        scheduledTasks.push({
          ...nextTask,
          phase: 'review',
          phaseLabel: phaseMeta.label,
          scheduledDate: lastDate,
          scheduledTime: addMinutesToTime(currentPlan.preferredStartTime || '17:00', consumedMinutes),
          scheduledEndTime: addMinutesToTime(
            currentPlan.preferredStartTime || '17:00',
            consumedMinutes + Math.max(nextTask.durationMinutes, 10),
          ),
        });
        consumedMinutes += Math.max(nextTask.durationMinutes, 10);
      }
    }

    return scheduledTasks;
  }, [
    accessibleCourseIds,
    completedLessons,
    courses,
    currentPlan,
    examResults,
    hasScopedPackageAccess,
    libraryItems,
    quizzes,
    weakSubjectFocus,
  ]);

  const todayKey = new Date().toISOString().split('T')[0];
  const selectedDayTasks = useMemo(() => {
    if (!generatedTasks.length) return [];
    const todaysTasks = generatedTasks.filter((task) => task.scheduledDate === todayKey);
    if (todaysTasks.length) return todaysTasks;
    return generatedTasks.filter((task) => task.scheduledDate >= todayKey).slice(0, 4);
  }, [generatedTasks, todayKey]);

  const weeklyGoals = useMemo<WeeklyGoal[]>(() => {
    if (!currentPlan) return [];

    return currentPlan.subjectIds
      .map((subjectId) => {
        const subject = subjects.find((item) => item.id === subjectId);
        const subjectTasks = generatedTasks.filter((task) => task.subjectId === subjectId);
        const completed = subjectTasks.filter((task) => task.completed).length;
        const total = subjectTasks.length || 1;

        return {
          id: subjectId,
          title: subject?.name || 'مادة',
          progress: Math.round((completed / total) * 100),
          total,
          completed,
        };
      })
      .slice(0, 4);
  }, [currentPlan, generatedTasks, subjects]);

  const overallProgress = useMemo(() => {
    if (!generatedTasks.length) return 0;
    return Math.round((generatedTasks.filter((task) => task.completed).length / generatedTasks.length) * 100);
  }, [generatedTasks]);

  const selectedDaySummary = useMemo(() => {
    if (!selectedDayTasks.length) {
      return {
        totalMinutes: 0,
        startTime: draft.preferredStartTime,
        endTime: draft.preferredStartTime,
      };
    }

    const totalMinutes = selectedDayTasks.reduce((sum, task) => sum + Math.max(task.durationMinutes, 10), 0);
    return {
      totalMinutes,
      startTime: selectedDayTasks[0].scheduledTime,
      endTime: selectedDayTasks[selectedDayTasks.length - 1].scheduledEndTime,
    };
  }, [draft.preferredStartTime, selectedDayTasks]);

  const draftSessionSlices = useMemo(
    () => createDailySessionSlices(draft.preferredStartTime, draft.dailyMinutes),
    [draft.dailyMinutes, draft.preferredStartTime],
  );
  const draftEligibleDates = useMemo(
    () => enumerateDates(draft.startDate, draft.endDate, draft.offDays),
    [draft.endDate, draft.offDays, draft.startDate],
  );
  const draftStudyWeeks = draftEligibleDates.length ? Math.max(1, Math.ceil(draftEligibleDates.length / 6)) : 0;

  const activePlanStudyDays = useMemo(
    () =>
      currentPlan
        ? enumerateDates(currentPlan.startDate, currentPlan.endDate, currentPlan.offDays).length
        : 0,
    [currentPlan],
  );

  const activePlanCalendarDays = useMemo(() => {
    if (!currentPlan) return 0;
    const start = new Date(currentPlan.startDate);
    const end = new Date(currentPlan.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;
    return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  }, [currentPlan]);

  const weeklyCadence = useMemo(() => {
    if (!currentPlan) {
      return {
        activeDaysPerWeek: Math.max(7 - draft.offDays.length, 1),
        minutesPerWeek: Math.max(7 - draft.offDays.length, 1) * draft.dailyMinutes,
      };
    }

    const activeDaysPerWeek = Math.max(7 - currentPlan.offDays.length, 1);
    return {
      activeDaysPerWeek,
      minutesPerWeek: activeDaysPerWeek * currentPlan.dailyMinutes,
    };
  }, [currentPlan, draft.dailyMinutes, draft.offDays.length]);

  const offDayLabels = useMemo(() => {
    const source = currentPlan?.offDays || draft.offDays;
    if (!source.length) return 'لا يوجد';
    return source
      .map((dayId) => DAYS.find((day) => day.id === dayId)?.label)
      .filter(Boolean)
      .join(' • ');
  }, [currentPlan?.offDays, draft.offDays]);

  const resetDraft = () => {
    setEditingPlanId(null);
    setDraft(createDefaultDraft(activePathId));
    setFormError('');
    setFormSuccess('');
  };

  const applySmartPlanDraft = () => {
    const focus = smartSkillPlan[0];
    const suggestedSubjectId =
      focus?.subjectId && pathSubjects.some((subject) => subject.id === focus.subjectId)
        ? focus.subjectId
        : pathSubjects[0]?.id;

    setDraft((current) => ({
      ...current,
      name: focus ? `خطة علاج مهارة ${focus.skillName}` : current.name || 'خطة مذاكرة ذكية',
      pathId: activePathId || current.pathId,
      subjectIds: suggestedSubjectId ? [suggestedSubjectId] : current.subjectIds,
      courseIds: [],
      startDate: todayKey,
      endDate: addDaysToToday(13),
      skipCompletedQuizzes: true,
      dailyMinutes: Math.max(current.dailyMinutes, 90),
    }));
    setFormError('');
    setFormSuccess('تم تجهيز النموذج بخطة ذكية مبنية على أضعف المهارات. راجعها ثم اضغط إنشاء/تحديث الخطة.');
  };

  const copySmartPlanSummary = async () => {
    if (!smartPlanSummary) return;
    await navigator.clipboard.writeText(smartPlanSummary);
    setCopiedSmartPlan(true);
    setTimeout(() => setCopiedSmartPlan(false), 1800);
  };

  const shareSmartPlanSummary = async () => {
    if (!smartPlanSummary) return;
    await shareTextSummary('خطة مذاكرة ذكية', smartPlanSummary);
    setSharedSmartPlan(true);
    setTimeout(() => setSharedSmartPlan(false), 1800);
  };

  const handleSubjectToggle = (subjectId: string) => {
    setDraft((current) => {
      const subjectIds = current.subjectIds.includes(subjectId)
        ? current.subjectIds.filter((id) => id !== subjectId)
        : [...current.subjectIds, subjectId];

      return {
        ...current,
        subjectIds,
        courseIds: current.courseIds.filter((courseId) => {
          const course = courses.find((item) => item.id === courseId);
          return course?.subjectId ? subjectIds.includes(course.subjectId) : true;
        }),
      };
    });
  };

  const handleCourseToggle = (courseId: string) => {
    setDraft((current) => ({
      ...current,
      courseIds: current.courseIds.includes(courseId)
        ? current.courseIds.filter((id) => id !== courseId)
        : [...current.courseIds, courseId],
    }));
  };

  const handleOffDayToggle = (dayId: StudyPlanDay) => {
    setDraft((current) => {
      const exists = current.offDays.includes(dayId);
      if (exists) {
        return { ...current, offDays: current.offDays.filter((day) => day !== dayId) };
      }
      if (current.offDays.length >= 3) {
        setFormError('يمكنك اختيار 3 أيام إجازة فقط في الخطة الوقتية.');
        return current;
      }
      setFormError('');
      return { ...current, offDays: [...current.offDays, dayId] };
    });
  };

  const handleSubmit = () => {
    if (!draft.pathId) {
      setFormError('اختر المسار أولًا.');
      return;
    }
    if (!draft.name.trim()) {
      setFormError('اكتب اسمًا واضحًا للخطة الدراسية.');
      return;
    }
    if (!draft.subjectIds.length) {
      setFormError('اختر مادة واحدة على الأقل.');
      return;
    }
    if (!draft.startDate || !draft.endDate) {
      setFormError('حدد تاريخ البداية والنهاية.');
      return;
    }
    if (draft.startDate > draft.endDate) {
      setFormError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية.');
      return;
    }
    if (draft.startDate < todayKey) {
      setFormError('تاريخ البداية يجب أن يكون اليوم أو تاريخًا قادمًا.');
      return;
    }

    const payload: StudyPlan = {
      id: editingPlanId || `plan_${Date.now()}`,
      userId: user.id,
      name: draft.name.trim(),
      pathId: draft.pathId,
      subjectIds: draft.subjectIds,
      courseIds: draft.courseIds,
      startDate: draft.startDate,
      endDate: draft.endDate,
      skipCompletedQuizzes: draft.skipCompletedQuizzes,
      offDays: draft.offDays,
      dailyMinutes: draft.dailyMinutes,
      preferredStartTime: draft.preferredStartTime,
      status: 'active',
      createdAt: currentPlan?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    if (editingPlanId) {
      updateStudyPlan(editingPlanId, payload);
      setFormSuccess('تم تحديث الخطة الدراسية الوقتية بنجاح.');
    } else {
      createStudyPlan(payload);
      setEditingPlanId(payload.id);
      setFormSuccess('تم إنشاء الخطة الدراسية الوقتية بنجاح.');
    }

    setFormError('');
  };

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center gap-3 sm:gap-4">
        <Link to="/" className="text-gray-500 hover:text-gray-700">
          <ArrowRight size={24} />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-indigo-800 leading-tight">إدارة الخطط الدراسية</h1>
          <p className="text-sm text-gray-500">أنشئ خطة مذاكرة وقتية تناسب مسارك ووقتك بشكل مرن ومنظم.</p>
        </div>
      </header>

      <Card className="border border-blue-100 bg-blue-50/70 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-white p-2 text-blue-600 shadow-sm">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="font-bold text-blue-900 mb-1">يرجى الملاحظة</h2>
            <p className="text-sm leading-7 text-blue-800">
              هذه الخطة وقتية للمذاكرة بين تاريخ بداية ونهاية محددين. تختار فيها المسار والمواد والدورات
              وأيام الإجازة وعدد دقائق المذاكرة اليومية، ثم يقوم النظام بتوزيع المهام عليك تلقائيًا.
            </p>
          </div>
        </div>
      </Card>

      <Card className="border border-emerald-100 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
              <Sparkles size={14} />
              مساعد الخطة الذكية
            </div>
            <h2 className="text-xl font-black text-gray-900">ابدأ من المهارات التي تحتاج علاجًا أولًا</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-500">
              يقرأ النظام آخر محاولات الاختبارات لهذا المسار، ثم يقترح بداية مذاكرة بسيطة: مهارة ضعيفة، درس مناسب، اختبار قصير، وملف مراجعة إن وجد.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applySmartPlanDraft}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-600"
            >
              <Target size={16} />
              طبّقها على النموذج
            </button>
            <button
              type="button"
              onClick={copySmartPlanSummary}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-200"
            >
              <Copy size={16} />
              {copiedSmartPlan ? 'تم النسخ' : 'نسخ الخطة'}
            </button>
            <button
              type="button"
              onClick={shareSmartPlanSummary}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
            >
              <Share2 size={16} />
              {sharedSmartPlan ? 'تمت المشاركة' : 'مشاركة'}
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-black text-gray-900">متابعة أسبوعية بعد آخر نتيجة</h3>
              <p className="text-xs font-bold leading-6 text-gray-500">
                هذه ليست تفاصيل كثيرة؛ هي ترتيب عملي حتى يعرف الطالب ماذا يفعل بعد الاختبار.
              </p>
            </div>
            <span className="self-start rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-700">
              نتيجة ثم شرح ثم تدريب ثم تقرير
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            {weeklyRemediationJourney.map((step, index) => (
              <Link
                key={step.title}
                to={step.to}
                className={`min-h-[126px] rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm ${step.tone}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-slate-800">
                    {index + 1}
                  </span>
                  <span className="text-[11px] font-black opacity-75">{step.title}</span>
                </div>
                <div className="mt-3 text-sm font-black">{step.label}</div>
                <p className="mt-1 text-xs font-bold leading-6 opacity-80">{step.body}</p>
              </Link>
            ))}
          </div>
        </div>

        {smartSkillPlan.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {smartSkillPlan.map((item) => (
              <div key={`${item.skillId || item.skillName}-${item.subjectId || 'general'}`} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-gray-900">{item.skillName}</h3>
                    <p className="mt-1 text-xs text-gray-500">ظهرت في {item.attempts} محاولة اختبار</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${item.mastery < 50 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                    {item.mastery}% إتقان
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Link
                    to={item.lesson?.link || '/reports'}
                    className="cta-attention rounded-xl bg-emerald-500 px-3 py-2.5 text-center text-sm font-black text-white shadow-sm transition hover:bg-emerald-600"
                  >
                    {item.lesson ? `درس: ${item.lesson.title}` : 'درس مقترح لاحقًا'}
                  </Link>
                  <Link
                    to={item.quiz?.link || '/dashboard?tab=saher'}
                    className="cta-attention rounded-xl bg-indigo-600 px-3 py-2.5 text-center text-sm font-black text-white shadow-sm transition hover:bg-indigo-700"
                  >
                    {item.quiz ? `اختبار: ${item.quiz.title}` : 'اختبار قصير'}
                  </Link>
                  {item.resource?.link ? (
                    <a
                      href={item.resource.link}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-white px-3 py-3 text-sm font-bold text-amber-700 shadow-sm transition hover:bg-amber-50"
                    >
                      ملف: {item.resource.title}
                    </a>
                  ) : (
                    <span className="rounded-xl bg-white px-3 py-3 text-sm font-bold text-gray-500 shadow-sm">
                      ملف مراجعة لاحقًا
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-5 text-sm leading-7 text-emerald-800">
            لا توجد مهارة ضعيفة واضحة لهذا المسار حتى الآن. بعد حل اختبار تشخيصي أو محاكي، ستظهر هنا خطة ذكية تلقائيًا مبنية على الأسئلة والمهارات.
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 sm:flex gap-2 rounded-2xl bg-gray-100 p-1">
        {availablePaths.map((path) => (
          <button
            key={path.id}
            onClick={() => setActivePathId(path.id)}
            className={`rounded-xl px-5 py-3 text-sm font-bold transition-all ${
              activePathId === path.id
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {path.name}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden border border-gray-100 bg-white">
        <div className="border-b border-gray-100 bg-gray-50 p-5 text-center sm:p-8">
          <h2 className="text-2xl font-black text-emerald-600">
            {editingPlanId ? `تعديل خطة ${selectedPath?.name || ''}` : `إضافة خطة ${selectedPath?.name || ''}`}
          </h2>
          <p className="mt-2 text-sm text-gray-500">املأ البيانات التالية لإنشاء أو تعديل الخطة الدراسية الوقتية.</p>
        </div>

        <div className="space-y-6 p-4 sm:p-8">
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-700">اسم الخطة الدراسية</label>
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="مثال: الخطة المكثفة لشهر مارس"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-right outline-none transition focus:border-emerald-400 focus:bg-white"
            />
          </div>

          <Card className="border border-amber-200 bg-amber-50/60 p-4">
            <p className="text-sm leading-7 text-amber-800">
              يمكنك اختيار مواد من نفس المسار، ويمكنك أيضًا تخصيص الخطة على دورات محددة داخل هذا المسار.
              إذا لم تختر دورات بعينها، سيعتمد النظام على كل الدورات المتاحة في المواد المختارة.
            </p>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <label className="mb-3 block text-sm font-bold text-gray-700">اختر المواد</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {pathSubjects.map((subject) => {
                  const selected = draft.subjectIds.includes(subject.id);
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => handleSubjectToggle(subject.id)}
                      className={`rounded-2xl border px-4 py-4 text-right transition ${
                        selected
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-bold">{subject.name}</div>
                      <div className="mt-1 text-xs text-gray-400">مادة داخل {selectedPath?.name || 'المسار'}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-3 block text-sm font-bold text-gray-700">اختر الدورات</label>
              <div className="grid grid-cols-1 gap-3 max-h-72 overflow-y-auto sm:grid-cols-2">
                {pathCourses.length > 0 ? (
                  pathCourses.map((course) => {
                    const selected = draft.courseIds.includes(course.id);
                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => handleCourseToggle(course.id)}
                        className={`rounded-2xl border px-4 py-4 text-right transition ${
                          selected
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-bold break-words">{course.title}</div>
                        <div className="mt-1 text-xs text-gray-400">{course.instructor}</div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 sm:col-span-2">
                    لا توجد دورات متاحة حاليًا وفق المواد المختارة.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">تاريخ البداية</label>
              <input
                type="date"
                value={draft.startDate}
                min={todayKey}
                onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-right outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">تاريخ النهاية</label>
              <input
                type="date"
                value={draft.endDate}
                min={draft.startDate || todayKey}
                onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-right outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">عدد دقائق المذاكرة اليومية</label>
              <input
                type="number"
                min={30}
                max={480}
                step={15}
                value={draft.dailyMinutes}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    dailyMinutes: Math.max(30, Number(event.target.value) || 30),
                  }))
                }
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-right outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">وقت بدء جلسة المذاكرة</label>
              <input
                type="time"
                value={draft.preferredStartTime}
                onChange={(event) => setDraft((current) => ({ ...current, preferredStartTime: event.target.value }))}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-right outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </div>
          </div>

          <Card className="border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white/70 p-4">
                <div className="text-xs font-bold text-emerald-700">النافذة الوقتية اليومية</div>
                <div className="mt-1 text-lg font-black text-emerald-800">
                  {draft.preferredStartTime} - {addMinutesToTime(draft.preferredStartTime, draft.dailyMinutes)}
                </div>
              </div>
              <div className="rounded-2xl bg-white/70 p-4">
                <div className="text-xs font-bold text-emerald-700">مدة الخطة</div>
                <div className="mt-1 text-lg font-black text-emerald-800">
                  {formatDateForPlan(draft.startDate)} - {formatDateForPlan(draft.endDate)}
                </div>
              </div>
              <div className="rounded-2xl bg-white/70 p-4">
                <div className="text-xs font-bold text-emerald-700">أيام الإجازة</div>
                <div className="mt-1 text-lg font-black text-emerald-800">{draft.offDays.length} / 3</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                <div className="text-xs font-black text-gray-500">أيام دراسة فعلية</div>
                <div className="mt-1 text-2xl font-black text-gray-900">{draftEligibleDates.length}</div>
                <div className="mt-1 text-xs font-bold text-gray-400">بعد استبعاد أيام الإجازة</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                <div className="text-xs font-black text-gray-500">تقدير الأسابيع</div>
                <div className="mt-1 text-2xl font-black text-gray-900">{draftStudyWeeks || '—'}</div>
                <div className="mt-1 text-xs font-bold text-gray-400">لمتابعة الطالب بدون ضغط</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                <div className="text-xs font-black text-gray-500">مواد داخل الخطة</div>
                <div className="mt-1 text-2xl font-black text-gray-900">{draft.subjectIds.length}</div>
                <div className="mt-1 text-xs font-bold text-gray-400">يمكن اختيار مادة أو أكثر</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                <div className="text-xs font-black text-gray-500">دورات مخصصة</div>
                <div className="mt-1 text-2xl font-black text-gray-900">{draft.courseIds.length || 'كل المتاح'}</div>
                <div className="mt-1 text-xs font-bold text-gray-400">فارغة يعني يعتمد على كل المحتوى المفتوح</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/70 bg-white/80 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-emerald-700">شكل الجلسة اليومية</div>
                  <div className="mt-1 text-sm text-gray-500">تقسيم وقتي بسيط يساعد الطالب على الالتزام دون ضغط.</div>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                  {draft.dailyMinutes} دقيقة
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                {draftSessionSlices.map((slice) => (
                  <div key={slice.id} className={`rounded-2xl p-4 ${slice.colorClass}`}>
                    <div className="text-xs font-black">{slice.title}</div>
                    <div className="mt-1 text-lg font-black">{slice.minutes} دقيقة</div>
                    <div className="mt-2 text-xs opacity-80">
                      {slice.startTime} - {slice.endTime}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="border border-blue-100 bg-blue-50/50 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={draft.skipCompletedQuizzes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, skipCompletedQuizzes: event.target.checked }))
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-500"
              />
              <div>
                <div className="font-bold text-gray-800">تخطي الاختبارات المنجزة</div>
                <p className="text-sm text-gray-500">
                  إذا كان عندك اختبارات أنهيتها سابقًا، فلن تدخل ضمن الخطة الجديدة.
                </p>
              </div>
            </label>
          </Card>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-800">أيام الإجازة في الأسبوع</h3>
                <p className="text-sm text-gray-500">يمكنك اختيار حتى 3 أيام راحة داخل الخطة الوقتية.</p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                {draft.offDays.length}/3
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {DAYS.map((day) => {
                const selected = draft.offDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => handleOffDayToggle(day.id)}
                    className={`rounded-2xl border px-3 py-4 text-center transition ${
                      selected
                        ? 'border-amber-300 bg-amber-50 text-amber-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold">{day.label}</div>
                    <div className="mt-1 text-xs text-gray-400">{day.short}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {(formError || formSuccess) && (
            <Card className={`p-4 ${formError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              <p className="text-sm font-bold">{formError || formSuccess}</p>
            </Card>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleSubmit}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 font-bold text-white transition hover:bg-emerald-600"
            >
              <BookOpen size={18} />
              {editingPlanId ? 'تحديث الخطة الدراسية' : 'إنشاء الخطة الدراسية'}
            </button>
            <button
              onClick={resetDraft}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-100 px-6 py-4 font-bold text-gray-700 transition hover:bg-gray-200"
            >
              <RotateCcw size={18} />
              إعادة تعيين / إلغاء
            </button>
            {editingPlanId && (
              <>
                <button
                  onClick={() => archiveStudyPlan(editingPlanId)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-6 py-4 font-bold text-amber-700 transition hover:bg-amber-100"
                >
                  <Archive size={18} />
                  أرشفة الخطة
                </button>
                <button
                  onClick={() => {
                    deleteStudyPlan(editingPlanId);
                    resetDraft();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-6 py-4 font-bold text-red-700 transition hover:bg-red-100"
                >
                  حذف الخطة
                </button>
              </>
            )}
          </div>
        </div>
      </Card>

      {currentPlan && (
        <div id="study-plan-print-area" className="space-y-6">
          <Card className="border-0 bg-gradient-to-r from-indigo-500 to-purple-600 p-4 text-white shadow-lg sm:p-6">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">{currentPlan.name}</h2>
                <p className="mt-2 text-sm text-indigo-100">
                  خطة وقتية من {currentPlan.startDate} إلى {currentPlan.endDate} بمتوسط {currentPlan.dailyMinutes} دقيقة يوميًا.
                </p>
              </div>
              <div className="print-hide flex flex-wrap gap-2 self-start">
                <button
                  type="button"
                  onClick={() => printElementAsPdf('study-plan-print-area', currentPlan.name || 'الخطة الدراسية')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                >
                  <Download size={16} />
                  تحميل PDF
                </button>
                <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
                  <Target size={24} />
                </div>
              </div>
            </div>

            <div className="mb-2 flex flex-wrap items-end gap-2">
              <span className="text-4xl font-black">{overallProgress}%</span>
              <span className="mb-1 text-indigo-100">من الخطة المنجزة</span>
            </div>
            <div className="h-2 w-full rounded-full bg-black/20">
              <div className="h-2 rounded-full bg-white" style={{ width: `${overallProgress}%` }} />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="text-sm text-indigo-100">عدد المهام</div>
                <div className="mt-1 text-2xl font-black">{generatedTasks.length}</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="text-sm text-indigo-100">أيام المذاكرة</div>
                <div className="mt-1 text-2xl font-black">{activePlanStudyDays}</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="text-sm text-indigo-100">وقت الجلسة</div>
                <div className="mt-1 text-2xl font-black">{currentPlan.preferredStartTime || '17:00'}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="text-sm text-indigo-100">أيام الراحة</div>
                <div className="mt-1 text-sm font-black">{offDayLabels}</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="text-sm text-indigo-100">وقت أسبوعي تقريبي</div>
                <div className="mt-1 text-2xl font-black">{weeklyCadence.minutesPerWeek} دقيقة</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="text-sm text-indigo-100">نوع الخطة</div>
                <div className="mt-1 text-sm font-black">زمنية ذكية قابلة للتعديل</div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.95fr]">
            <Card className="p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-2 text-gray-800">
                <Calendar size={20} className="text-indigo-500" />
                <h3 className="text-lg font-bold">
                  مهام الخطة {selectedDayTasks.some((task) => task.scheduledDate === todayKey) ? `(${formatTodayLabel()})` : 'القادمة'}
                </h3>
              </div>

              {selectedDayTasks.length > 0 && (
                <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white/80 p-3">
                      <div className="text-xs font-bold text-indigo-600">بداية الجلسة</div>
                      <div className="mt-1 text-lg font-black text-indigo-900">{selectedDaySummary.startTime}</div>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-3">
                      <div className="text-xs font-bold text-indigo-600">النهاية التقريبية</div>
                      <div className="mt-1 text-lg font-black text-indigo-900">{selectedDaySummary.endTime}</div>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-3">
                      <div className="text-xs font-bold text-indigo-600">إجمالي وقت اليوم</div>
                      <div className="mt-1 text-lg font-black text-indigo-900">{selectedDaySummary.totalMinutes} دقيقة</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
                    {selectedDayTasks.map((task, index) => {
                      const phaseMeta = getPlanPhaseMeta(task.phase);
                      return (
                        <React.Fragment key={`${task.id}-timeline`}>
                          <div className="min-w-[130px] rounded-2xl border border-white/80 bg-white px-3 py-2 shadow-sm">
                            <div className={`text-[11px] font-black ${phaseMeta.accent}`}>{task.phaseLabel}</div>
                            <div className="mt-1 line-clamp-1 text-sm font-bold text-gray-800">{task.title}</div>
                            <div className="mt-1 text-[11px] text-gray-500">
                              {task.scheduledTime} - {task.scheduledEndTime}
                            </div>
                          </div>
                          {index < selectedDayTasks.length - 1 && (
                            <div className="h-[2px] min-w-8 rounded-full bg-indigo-200" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="relative mr-3 space-y-5 border-r-2 border-indigo-100">
                {selectedDayTasks.length > 0 ? (
                  selectedDayTasks.map((task) => (
                    <div key={task.id} className="relative pr-8">
                      <div className={`absolute -right-[9px] top-4 h-4 w-4 rounded-full border-2 border-white shadow-sm ${task.completed ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                      <Card className={`p-4 transition-all hover:shadow-md ${task.completed ? 'bg-gray-50 opacity-75' : 'bg-white'}`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="rounded bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-600">
                                {task.scheduledTime} - {task.scheduledEndTime}
                              </span>
                              <span className="rounded bg-gray-100 px-2 py-1 text-xs font-bold text-gray-500">
                                {task.scheduledDate}
                              </span>
                              <span
                                className={`rounded px-2 py-1 text-xs font-bold ${getPlanPhaseMeta(task.phase).bg} ${getPlanPhaseMeta(task.phase).accent}`}
                              >
                                {task.phaseLabel}
                              </span>
                            </div>
                            <h4 className={`text-lg font-bold ${task.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                              {task.title}
                            </h4>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                              <Clock size={14} />
                              <span>{task.durationLabel}</span>
                              <span className="mx-1">•</span>
                              <span>
                                {task.type === 'lesson'
                                  ? 'درس'
                                  : task.type === 'quiz'
                                    ? 'اختبار'
                                    : 'ملف مراجعة'}
                              </span>
                            </div>

                            {task.link ? (
                              task.external ? (
                                <a
                                  href={task.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700"
                                >
                                  <FileText size={14} />
                                  فتح المهمة
                                </a>
                              ) : (
                                <Link
                                  to={task.link}
                                  className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700"
                                >
                                  {task.type === 'quiz' ? <FileText size={14} /> : <PlayCircle size={14} />}
                                  فتح المهمة
                                </Link>
                              )
                            ) : null}
                          </div>

                          <div className={`rounded-full p-2 ${task.completed ? 'bg-emerald-50 text-emerald-500' : 'bg-gray-50 text-gray-300'}`}>
                            {task.completed ? <CheckCircle size={24} /> : <Circle size={24} />}
                          </div>
                        </div>
                      </Card>
                    </div>
                  ))
                ) : (
                  <Card className="p-6 sm:p-8 text-center text-gray-500">
                    لا توجد مهام مجدولة بعد لهذه الخطة. جرّب توسيع المدة أو إضافة مواد ودورات أكثر.
                  </Card>
                )}
              </div>
            </Card>

            <div className="space-y-6">
              {weakSubjectFocus.length > 0 && (
                <Card className="p-4 sm:p-6">
                  <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
                    <div className="mb-2 flex items-center gap-2 text-red-700">
                      <Sparkles size={16} />
                      <span className="text-sm font-bold">تركيز الخطة الآن</span>
                    </div>
                    <p className="text-sm leading-7 text-red-700">
                      بدأنا ترتيب المهام من المواد الأضعف لديك، وأول أولوية حاليًا:
                      <span className="mx-1 font-black">{weakSubjectFocus[0].title}</span>
                      بنسبة إتقان
                      <span className="mx-1 font-black">{weakSubjectFocus[0].mastery}%</span>
                    </p>
                  </div>
                </Card>
              )}

              {phaseSummaries.length > 0 && (
                <Card className="p-4 sm:p-6">
                  <div className="mb-4 flex items-center gap-2 text-gray-800">
                    <Target size={20} className="text-indigo-500" />
                    <h3 className="text-lg font-bold">خط سير الخطة الوقتية</h3>
                  </div>

                  <div className="space-y-3">
                    {phaseSummaries.map((phase) => {
                      const phaseMeta = getPlanPhaseMeta(phase.id);
                      return (
                        <div key={phase.id} className="rounded-2xl border border-gray-100 p-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-black ${phaseMeta.bg} ${phaseMeta.accent}`}>
                              {phase.title}
                            </span>
                            <span className="text-sm font-bold text-gray-500">{phase.days} يوم</span>
                          </div>
                          <p className="text-sm leading-7 text-gray-600">{phase.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              <Card className="p-4 sm:p-6">
                <div className="mb-4 flex items-center gap-2 text-gray-800">
                  <Clock size={20} className="text-emerald-500" />
                  <h3 className="text-lg font-bold">إيقاع الخطة الأسبوعي</h3>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-xs font-bold text-gray-500">أيام الدراسة في الأسبوع</div>
                    <div className="mt-1 text-2xl font-black text-gray-800">{weeklyCadence.activeDaysPerWeek} أيام</div>
                    <div className="mt-1 text-xs text-gray-500">مع {currentPlan.offDays.length} يوم راحة داخل الأسبوع.</div>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-xs font-bold text-gray-500">وقت المذاكرة الأسبوعي</div>
                    <div className="mt-1 text-2xl font-black text-gray-800">{weeklyCadence.minutesPerWeek} دقيقة</div>
                    <div className="mt-1 text-xs text-gray-500">أي حوالي {Math.round(weeklyCadence.minutesPerWeek / 60)} ساعة أسبوعيًا.</div>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 sm:col-span-2">
                    <div className="text-xs font-bold text-gray-500">أيام الراحة المختارة</div>
                    <div className="mt-1 text-sm font-bold text-gray-800">{offDayLabels}</div>
                  </div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6">
                <div className="mb-4 flex items-center gap-2 text-gray-800">
                  <BookOpen size={20} className="text-indigo-500" />
                  <h3 className="text-lg font-bold">صورة سريعة عن مدة الخطة</h3>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-gray-100 p-4">
                    <div className="text-xs font-bold text-gray-500">مدة الخطة الكاملة</div>
                    <div className="mt-1 text-2xl font-black text-gray-800">{activePlanCalendarDays} يوم</div>
                  </div>
                  <div className="rounded-2xl border border-gray-100 p-4">
                    <div className="text-xs font-bold text-gray-500">المهام المجدولة</div>
                    <div className="mt-1 text-2xl font-black text-gray-800">{generatedTasks.length}</div>
                  </div>
                  <div className="rounded-2xl border border-gray-100 p-4">
                    <div className="text-xs font-bold text-gray-500">المتوسط اليومي</div>
                    <div className="mt-1 text-2xl font-black text-gray-800">{currentPlan.dailyMinutes} دقيقة</div>
                  </div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6">
                <div className="mb-4 flex items-center gap-2 text-gray-800">
                  <TimerReset size={20} className="text-emerald-500" />
                  <h3 className="text-lg font-bold">الأهداف الأسبوعية</h3>
                </div>

                <div className="space-y-4">
                  {weeklyGoals.length > 0 ? (
                    weeklyGoals.map((goal) => (
                      <div key={goal.id} className="rounded-2xl border border-gray-100 p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-bold text-gray-800">{goal.title}</h4>
                            <p className="text-xs text-gray-500">
                              {goal.completed} من {goal.total} منجز
                            </p>
                          </div>
                          <span className="font-bold text-indigo-600">{goal.progress}%</span>
                        </div>
                        <ProgressBar percentage={goal.progress} showPercentage={false} color="primary" />
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                      ستظهر الأهداف الأسبوعية هنا بعد حفظ خطة فعلية تحتوي على مهام قابلة للتوزيع.
                    </div>
                  )}
                </div>
              </Card>

              <Card className="border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
                <h3 className="mb-2 font-bold text-amber-800">ملاحظات الخطة الوقتية</h3>
                <ul className="space-y-2 text-sm leading-7 text-amber-800">
                  <li>يعيد النظام توزيع المهام تلقائيًا حسب الأيام المتاحة بين تاريخ البداية والنهاية.</li>
                  <li>إذا اخترت مواد فقط بدون دورات، فسيبني الخطة من كل الدورات المتاحة في هذه المواد.</li>
                  <li>يمكنك تعديل الخطة في أي وقت أو أرشفتها وإنشاء خطة جديدة لمسار آخر.</li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Plan;
