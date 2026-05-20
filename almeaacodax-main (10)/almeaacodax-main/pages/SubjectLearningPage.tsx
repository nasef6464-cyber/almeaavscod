import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Play,
  Lock,
  FileText,
  Download,
  Eye,
  X,
  BookOpen,
  Video,
  HelpCircle,
  FileCheck,
  Target,
  Layers,
  Clock,
  Award,
  ShoppingBag,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Card } from '../components/ui/Card';
import { VideoModal } from '../components/VideoModal';
import { Lesson, PackageContentType, Topic } from '../types';
import { openExternalUrl } from '../utils/openExternalUrl';
import { getYouTubeVideoId, sanitizeVideoUrl } from '../utils/videoLinks';
import { findByEntityId, matchesEntityId } from '../utils/entityIds';
import { isMockQuiz, isTrainingQuiz } from '../utils/quizPlacement';
import { getLearningSlotQuizzes, resolveQuizLearningAccessType } from '../utils/quizLearningPlacement';
import { isMaterialQuizCandidate } from '../utils/mockExam';
import { buildQuizRouteWithContext } from '../utils/quizLinks';
import { resolveCoursePathId, resolveCourseSubjectId } from '../utils/courseScope';

export const SubjectLearningPage: React.FC = () => {
  const { pathId, subjectId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { courses, libraryItems, questions, quizzes, paths, subjects, topics, lessons, user, hasScopedPackageAccess } = useStore();
  const [activeTab, setActiveTab] = useState<'courses' | 'skills' | 'questions' | 'exams' | 'library'>('skills');
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedSubTopic, setSelectedSubTopic] = useState<Topic | null>(null);
  const [topicModalTab, setTopicModalTab] = useState<'lessons' | 'quizzes' | 'support'>('lessons');
  const [videoData, setVideoData] = useState<{ url: string; title: string; interactiveQuestions?: Lesson['interactiveQuestions'] } | null>(null);

  const matchedPath = paths.find((item) => item.id === pathId);
  const matchedSubject = subjects.find((item) => item.id === subjectId);
  const currentPathName = matchedPath?.name || pathId || 'المسار';
  const currentSubjectName = matchedSubject?.name || subjectId || 'المادة';
  const isStaffViewer = ['admin', 'teacher', 'supervisor'].includes(user.role);
  const hasCoursePackageAccess = isStaffViewer || hasScopedPackageAccess('courses', pathId, subjectId);
  const hasFoundationAccess = isStaffViewer || hasScopedPackageAccess('foundation', pathId, subjectId);
  const hasBanksAccess = isStaffViewer || hasScopedPackageAccess('banks', pathId, subjectId);
  const hasLibraryAccess = isStaffViewer || hasScopedPackageAccess('library', pathId, subjectId);
  const canSeeTopic = (topic: Topic) => isStaffViewer || topic.showOnPlatform !== false;
  const canSeeLesson = (lesson: (typeof lessons)[number]) =>
    isStaffViewer || (lesson.showOnPlatform !== false && (!lesson.approvalStatus || lesson.approvalStatus === 'approved'));
  const canSeeQuiz = (quiz: (typeof quizzes)[number]) =>
    isStaffViewer ||
    ((quiz.questionIds?.length || 0) > 0 &&
      quiz.showOnPlatform !== false &&
      quiz.isPublished !== false &&
      (!quiz.approvalStatus || quiz.approvalStatus === 'approved'));
  const canSeeLibraryItem = (item: (typeof libraryItems)[number]) =>
    isStaffViewer || (item.showOnPlatform !== false && (!item.approvalStatus || item.approvalStatus === 'approved'));
  const canSeeCourse = (course: (typeof courses)[number]) =>
    isStaffViewer || (course.showOnPlatform !== false && course.isPublished !== false && (!course.approvalStatus || course.approvalStatus === 'approved'));
  const buildPackagePath = (contentType: PackageContentType) => {
    const params = new URLSearchParams();
    if (subjectId) params.set('subject', subjectId);
    params.set('tab', 'packages');
    params.set('content', contentType);
    return `/category/${pathId || ''}?${params.toString()}`;
  };
  const openPackageTab = (contentType: PackageContentType) => navigate(buildPackagePath(contentType));
  const getQuizAccessType = (quiz: (typeof quizzes)[number], slot?: 'training' | 'tests') =>
    resolveQuizLearningAccessType(quiz, slot && pathId && subjectId ? { pathId, subjectId, slot } : undefined);
  const isQuizLockedForStudent = (quiz: (typeof quizzes)[number], contentType: 'banks' | 'tests', slot?: 'training' | 'tests') => {
    if (isStaffViewer) return false;
    const accessType = getQuizAccessType(quiz, slot);
    if (accessType === 'free') return false;
    if (accessType === 'private') return true;
    return !hasScopedPackageAccess(contentType, quiz.pathId || pathId, quiz.subjectId || subjectId);
  };
  const isTopicLockedForStudent = (topic: Topic | null | undefined) =>
    Boolean(topic?.isLocked && !hasFoundationAccess && !isStaffViewer);
  const isLibraryItemLockedForStudent = (item: (typeof libraryItems)[number]) =>
    Boolean(item.isLocked && !hasLibraryAccess && !isStaffViewer);
  const isTopicSupportLockedForStudent = (topic: Topic | null | undefined) => isTopicLockedForStudent(topic);
  const getTopicSupportAccessLabel = (topic: Topic | null | undefined) =>
    isTopicLockedForStudent(topic) ? 'ضمن باقة' : 'مجاني';

  const renderLockedAccessPanel = (contentType: PackageContentType, title: string, description: string) => (
    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-center">
      <Lock className="mx-auto mb-3 text-amber-600" size={34} />
      <h3 className="text-lg font-black text-gray-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-gray-600">{description}</p>
      <button
        type="button"
        onClick={() => openPackageTab(contentType)}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-amber-600"
      >
        <ShoppingBag size={18} />
        عرض الباقات المناسبة
      </button>
    </div>
  );

  const subjectCourses = useMemo(
    () =>
      courses.filter((course) => {
        const matchesPath = pathId ? resolveCoursePathId(course, subjects) === pathId : true;
        const matchesSubject = subjectId ? resolveCourseSubjectId(course, subjects) === subjectId : true;
        return !course.isPackage && matchesPath && matchesSubject && canSeeCourse(course);
      }),
    [courses, isStaffViewer, matchedSubject?.pathId, pathId, subjectId, subjects],
  );

  const subjectLibrary = useMemo(
    () =>
      libraryItems.filter((item) => {
        const matchesPath = pathId ? item.pathId === pathId : true;
        const matchesSubject = subjectId ? item.subjectId === subjectId : true;
        return matchesPath && matchesSubject && canSeeLibraryItem(item);
      }),
    [isStaffViewer, libraryItems, pathId, subjectId],
  );

  const subjectQuestions = useMemo(
    () =>
      questions.filter((question) => {
        const matchesPath = pathId ? question.pathId === pathId : true;
        const matchesSubject = subjectId ? question.subject === subjectId : true;
        return matchesPath && matchesSubject;
      }),
    [pathId, questions, subjectId],
  );

  const subjectQuizzes = useMemo(
    () =>
      quizzes.filter((quiz) => {
        const matchesPath = pathId ? quiz.pathId === pathId : true;
        const matchesSubject = subjectId ? quiz.subjectId === subjectId : true;
        return matchesPath && matchesSubject;
      }),
    [pathId, quizzes, subjectId],
  );

  const subjectBanks = useMemo(
    () =>
      getLearningSlotQuizzes(
        subjectQuizzes.filter(isMaterialQuizCandidate),
        { pathId, subjectId, slot: 'training' },
        canSeeQuiz,
        isTrainingQuiz,
        true,
      ),
    [pathId, subjectId, subjectQuizzes, isStaffViewer],
  );

  const subjectExams = useMemo(
    () =>
      getLearningSlotQuizzes(
        subjectQuizzes.filter(isMaterialQuizCandidate),
        { pathId, subjectId, slot: 'tests' },
        canSeeQuiz,
        isMockQuiz,
        true,
      ),
    [pathId, subjectId, subjectQuizzes, isStaffViewer],
  );

  const subjectTopics = useMemo(
    () =>
      topics
        .filter((topic) => {
          const matchesPath = pathId ? topic.pathId === pathId : true;
          const matchesSubject = subjectId ? topic.subjectId === subjectId : true;
          return matchesPath && matchesSubject && canSeeTopic(topic);
        })
        .sort((a, b) => a.order - b.order),
    [isStaffViewer, pathId, subjectId, topics],
  );

  const mainTopics = useMemo(() => subjectTopics.filter((topic) => !topic.parentId), [subjectTopics]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['courses', 'skills', 'questions', 'exams', 'library'].includes(tab)) {
      setActiveTab(tab as typeof activeTab);
    }
  }, [searchParams]);

  useEffect(() => {
    const topicId = searchParams.get('topic');
    const content = searchParams.get('content');

    if (content === 'lessons' || content === 'quizzes' || content === 'support') {
      setTopicModalTab(content);
    }

    if (!topicId) {
      setSelectedTopic(null);
      setSelectedSubTopic(null);
      return;
    }

    const directTopic = findByEntityId(subjectTopics as Topic[], topicId);
    if (!directTopic) {
      return;
    }

    if (directTopic.parentId) {
      const parentTopic = findByEntityId(subjectTopics as Topic[], directTopic.parentId);
      setSelectedTopic(parentTopic || directTopic);
      setSelectedSubTopic(parentTopic ? directTopic : null);
    } else {
      setSelectedTopic(directTopic);
      setSelectedSubTopic(null);
    }

  }, [searchParams, subjectTopics]);

  const updateSubjectQuery = (updates: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }
    });
    setSearchParams(nextParams);
  };

  const getTopicQuestionCount = (topic: Topic) => {
    const descendantIds = [topic.id, ...subjectTopics.filter((item) => item.parentId === topic.id).map((item) => item.id)];
    return subjectQuestions.filter((question) => (question.skillIds || []).some((skillId) => descendantIds.includes(skillId))).length;
  };

  const getTopicAttachedBank = (topic: Topic) => {
    const descendantIds = [topic.id, ...subjectTopics.filter((item) => item.parentId === topic.id).map((item) => item.id)];
    return subjectBanks.find((quiz) => {
      if ((quiz.skillIds || []).some((skillId) => descendantIds.includes(skillId))) {
        return true;
      }

      return descendantIds.some((descendantId) => {
        const descendantTopic = findByEntityId(subjectTopics as Topic[], descendantId);
        return (descendantTopic?.quizIds || []).some((quizId) => matchesEntityId(quiz, quizId));
      });
    });
  };

  const handleOpenTopicModal = (mainTopic: Topic) => {
    if (isTopicLockedForStudent(mainTopic)) {
      openPackageTab('foundation');
      return;
    }

    setSelectedTopic(mainTopic);
    const subTopics = subjectTopics.filter((item) => item.parentId === mainTopic.id).sort((a, b) => a.order - b.order);

    if (subTopics.length > 0) {
      setSelectedSubTopic(subTopics[0]);
      updateSubjectQuery({ tab: 'skills', topic: subTopics[0].id, content: 'lessons' });
    } else {
      setSelectedSubTopic(null);
      updateSubjectQuery({ tab: 'skills', topic: mainTopic.id, content: 'lessons' });
    }

    setTopicModalTab('lessons');
  };

  const activeTopic = selectedSubTopic || selectedTopic;
  const buildTopicReturnPath = (contentTab: 'lessons' | 'quizzes' | 'support' = topicModalTab) => {
    const params = new URLSearchParams();
    if (subjectId) params.set('subject', subjectId);
    params.set('tab', 'skills');
    if (activeTopic?.id) params.set('topic', activeTopic.id);
    params.set('content', contentTab);
    return `/category/${pathId || ''}?${params.toString()}`;
  };
  const buildTopicReturnPathFor = (topic: Topic, contentTab: 'lessons' | 'quizzes' | 'support' = 'quizzes') => {
    const params = new URLSearchParams();
    if (subjectId) params.set('subject', subjectId);
    params.set('tab', 'skills');
    params.set('topic', topic.id);
    params.set('content', contentTab);
    return `/category/${pathId || ''}?${params.toString()}`;
  };
  const buildSubjectReturnPath = (tab: 'courses' | 'skills' | 'questions' | 'exams' | 'library' = activeTab) => {
    const params = new URLSearchParams();
    if (subjectId) params.set('subject', subjectId);
    params.set('tab', tab);
    return `/category/${pathId || ''}?${params.toString()}`;
  };
  const buildQuizPathWithReturn = (
    quizId: string,
    returnTo: string,
    source: string,
    returnOnFinish = false,
  ) => {
    return buildQuizRouteWithContext(quizId, { returnTo, source, returnOnFinish });
  };
  const buildTrainingQuizPath = (quiz: (typeof quizzes)[number]) => {
    const returnOnFinish = quiz.settings?.returnToSourceOnFinish === true || quiz.settings?.showResultsReport === false;
    return buildQuizPathWithReturn(quiz.id, buildTopicReturnPath('quizzes'), 'foundation', returnOnFinish);
  };
  const activeTopicLessons = useMemo(
    () =>
      activeTopic
        ? lessons
            .filter((lesson) => (activeTopic.lessonIds || []).some((lessonId) => matchesEntityId(lesson, lessonId)) && canSeeLesson(lesson))
            .sort((a, b) => (a.order || 0) - (b.order || 0))
        : [],
    [activeTopic, isStaffViewer, lessons],
  );
  const activeTopicQuizzes = useMemo(
    () =>
      activeTopic
        ? quizzes
            .filter((quiz) => (activeTopic.quizIds || []).some((quizId) => matchesEntityId(quiz, quizId)) && isTrainingQuiz(quiz) && canSeeQuiz(quiz))
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        : [],
    [activeTopic, isStaffViewer, quizzes],
  );
  const relatedLessonSuggestions = useMemo(
    () =>
      activeTopic
        ? lessons
            .filter((lesson) => {
              const matchesPath = pathId ? lesson.pathId === pathId : true;
              const matchesSubject = subjectId ? lesson.subjectId === subjectId : true;
              const matchesSection = activeTopic.sectionId ? lesson.sectionId === activeTopic.sectionId : true;
              const notAlreadyAttached = !(activeTopic.lessonIds || []).some((lessonId) => matchesEntityId(lesson, lessonId));
              return matchesPath && matchesSubject && matchesSection && notAlreadyAttached && canSeeLesson(lesson);
            })
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .slice(0, 3)
        : [],
    [activeTopic, isStaffViewer, lessons, pathId, subjectId],
  );
  const relatedQuizSuggestions = useMemo(
    () =>
      activeTopic
        ? subjectQuizzes
            .filter((quiz) => {
              const matchesSection = activeTopic.sectionId ? quiz.sectionId === activeTopic.sectionId : true;
              const notAlreadyAttached = !(activeTopic.quizIds || []).some((quizId) => matchesEntityId(quiz, quizId));
              return canSeeQuiz(quiz) && isTrainingQuiz(quiz) && matchesSection && notAlreadyAttached;
            })
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, 3)
        : [],
    [activeTopic, isStaffViewer, subjectQuizzes],
  );
  const relatedLibrarySuggestions = useMemo(
    () =>
      activeTopic
        ? subjectLibrary
            .filter((item) => {
              const explicitLibraryItemIds = new Set(activeTopic.libraryItemIds || []);
              const isAttached = [...explicitLibraryItemIds].some((itemId) => matchesEntityId(item, itemId));
              return isAttached && Boolean(item.url) && canSeeLibraryItem(item);
            })
            .slice(0, 3)
        : [],
    [activeTopic, isStaffViewer, subjectLibrary],
  );

  const openLessonContent = (lesson: (typeof lessons)[number]) => {
    const safeVideoUrl = sanitizeVideoUrl(lesson.videoUrl);
    if (safeVideoUrl) {
      setVideoData({ url: safeVideoUrl, title: lesson.title, interactiveQuestions: lesson.interactiveQuestions || [] });
      return;
    }

    if (lesson.fileUrl) {
      openExternalUrl(lesson.fileUrl);
    }
  };

  const renderTabs = () => (
    <div className="grid grid-cols-1 sm:flex sm:flex-wrap justify-center gap-3 mb-12">
      {[
        { id: 'courses', label: 'الدورات', icon: <BookOpen size={18} /> },
        { id: 'skills', label: 'التأسيس', icon: <Target size={18} /> },
        { id: 'questions', label: 'التدريب', icon: <HelpCircle size={18} /> },
        { id: 'exams', label: 'الاختبارات المحاكية', icon: <FileCheck size={18} /> },
        { id: 'library', label: 'المكتبة', icon: <FileText size={18} /> },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            setActiveTab(tab.id as typeof activeTab);
            updateSubjectQuery({
              tab: tab.id,
              topic: tab.id === 'skills' ? searchParams.get('topic') : null,
              content: tab.id === 'skills' ? searchParams.get('content') : null,
              lesson: tab.id === 'skills' ? searchParams.get('lesson') : null,
            });
          }}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all ${
            activeTab === tab.id
              ? 'bg-[#f59e0b] text-white shadow-md'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-[#f59e0b] hover:text-[#f59e0b]'
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="bg-gray-50 min-h-screen pb-20 font-sans" dir="rtl">
      <div className="bg-[#2e2b70] py-5 sm:py-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 leading-tight">{currentPathName} ({currentSubjectName})</h1>
          <p className="text-indigo-200 max-w-2xl mx-auto text-sm sm:text-base">تأسيس، تدريب، واختبارات في مكان واحد</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8">
        {renderTabs()}

        {activeTab === 'courses' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in">
            {subjectCourses.map((course) => (
              <Card key={course.id} className="flex flex-col h-full hover:shadow-xl transition-shadow duration-300 border border-gray-100 overflow-hidden rounded-2xl">
                <div className="relative h-48 bg-gray-100 group overflow-hidden">
                  <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
                  <div className="absolute top-3 right-3 bg-black/50 backdrop-blur px-3 py-2 rounded-lg text-white text-xs font-black flex items-center gap-1">
                    {hasCoursePackageAccess ? <ShoppingBag size={16} /> : <Lock size={16} />}
                    {hasCoursePackageAccess ? 'ضمن باقتك' : `${course.price || 0} ${course.currency || 'ر.س'}`}
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 leading-snug">{course.title}</h3>
                  <div className="mt-auto">
                    <div className="flex justify-between text-xs text-gray-500 mb-2 font-bold">
                      <span>{course.progress}% مكتمل</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4 overflow-hidden">
                      <div className="bg-[#10b981] h-2.5 rounded-full" style={{ width: `${course.progress}%` }}></div>
                    </div>
                    <button
                      className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-[#f59e0b] text-white hover:bg-amber-600"
                      onClick={() => navigate(`/course/${course.id}`)}
                    >
                      {course.progress > 0 ? 'مواصلة التعلم' : hasCoursePackageAccess ? 'ابدأ من الباقة' : 'عرض الدورة والاشتراك'}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'skills' && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mainTopics.length > 0 ? mainTopics.map((topic) => {
                const subTopics = subjectTopics.filter((item) => item.parentId === topic.id);
                const isLocked = isTopicLockedForStudent(topic);
                let totalLessons = topic.lessonIds?.length || 0;
                let totalQuizzes = topic.quizIds?.length || 0;
                subTopics.forEach((subTopic) => {
                  totalLessons += subTopic.lessonIds?.length || 0;
                  totalQuizzes += subTopic.quizIds?.length || 0;
                });

                return (
                  <div
                    key={topic.id}
                    onClick={() => handleOpenTopicModal(topic)}
                    className={`bg-white p-6 rounded-2xl border hover:shadow-lg cursor-pointer transition-all flex flex-col justify-between h-56 relative overflow-hidden group ${
                      isLocked ? 'border-amber-200' : 'border-gray-200 hover:border-indigo-400'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Target size={28} />
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                          {subTopics.length} موضوعات فرعية
                        </span>
                        <span className={`mt-2 flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
                          isLocked ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50'
                        }`}>
                          {isLocked ? <Lock size={13} /> : <Eye size={13} />}
                          {isLocked ? 'ضمن باقة' : 'مجاني'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 mb-1">{topic.title}</h3>
                    </div>
                    <div className="mt-auto">
                      <div className="flex justify-between text-xs font-bold text-gray-600 mb-2">
                        <span className="text-gray-400">{totalLessons} درس · {totalQuizzes} تدريب قصير</span>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  لا توجد موضوعات تأسيسية مضافة حاليًا.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'library' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {subjectLibrary.length > 0 ? subjectLibrary.map((item) => (
              <div key={item.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col items-start gap-2">
                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold">{item.size}</span>
                    <span className={`rounded-lg px-3 py-1 text-xs font-bold ${
                      isLibraryItemLockedForStudent(item) ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {isLibraryItemLockedForStudent(item) ? '\u0636\u0645\u0646 \u0628\u0627\u0642\u0629' : '\u0645\u062c\u0627\u0646\u064a'}
                    </span>
                  </div>
                  <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
                    <FileText size={24} />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">{item.title}</h3>
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-6">
                  <Download size={14} /> {item.downloads} تحميل
                </div>
                <div className="mt-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    className={`py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                      isLibraryItemLockedForStudent(item)
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}
                    onClick={() => isLibraryItemLockedForStudent(item) ? openPackageTab('library') : openExternalUrl(item.url)}
                  >
                    {isLibraryItemLockedForStudent(item) ? <Lock size={16} /> : <Eye size={16} />} {isLibraryItemLockedForStudent(item) ? '\u0639\u0631\u0636 \u0627\u0644\u0628\u0627\u0642\u0627\u062a' : '\u0645\u0639\u0627\u064a\u0646\u0629'}
                  </button>
                  <button
                    className={`py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                      isLibraryItemLockedForStudent(item)
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                    }`}
                    onClick={() => isLibraryItemLockedForStudent(item) ? openPackageTab('library') : openExternalUrl(item.url)}
                  >
                    <Download size={16} /> {isLibraryItemLockedForStudent(item) ? '\u0636\u0645\u0646 \u0628\u0627\u0642\u0629' : '\u062a\u062d\u0645\u064a\u0644'}
                  </button>
                </div>
              </div>
            )) : (
              <div className="col-span-full text-center py-12 text-gray-500">
                لا توجد ملفات في المكتبة حاليًا.
              </div>
            )}
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-gray-800">بنك الأسئلة الشامل</h3>
                <p className="text-gray-500 mt-1">تدرب على {subjectQuestions.length} سؤال في مختلف المهارات</p>
              </div>
              <button
                onClick={() => hasBanksAccess ? navigate('/quiz') : openPackageTab('banks')}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold transition-colors ${
                  hasBanksAccess ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
              >
                {hasBanksAccess ? 'ابدأ التدريب العشوائي' : 'فتح باقة التدريبات'}
              </button>
            </div>
            {!hasBanksAccess && renderLockedAccessPanel(
              'banks',
              'التدريبات المتقدمة ضمن باقة المادة',
              'يمكن ترك بعض التدريبات مفتوحة من إعداد الاختبار، أما التدريبات المدفوعة فتفتح بعد شراء باقة التدريب أو الباقة الشاملة لهذه المادة.',
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mainTopics.map((topic) => {
                const questionCount = getTopicQuestionCount(topic);
                const relatedBank = getTopicAttachedBank(topic);
                const isBankLocked = relatedBank ? isQuizLockedForStudent(relatedBank, 'banks', 'training') : !hasBanksAccess;

                return (
                  <div key={topic.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                        <Target size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800">{topic.title}</h4>
                        <p className="text-xs text-gray-500">{questionCount} سؤال متاح</p>
                      </div>
                    </div>
                    <button
                      className={`w-full py-2 rounded-lg font-bold text-sm transition-colors ${
                        isBankLocked ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-gray-50 text-indigo-600 hover:bg-indigo-50'
                      }`}
                      onClick={() =>
                        isBankLocked
                          ? openPackageTab('banks')
                          : relatedBank
                          ? navigate(buildQuizPathWithReturn(relatedBank.id, buildTopicReturnPathFor(topic, 'quizzes'), 'foundation'))
                          : handleOpenTopicModal(topic)
                      }
                    >
                      {isBankLocked ? 'فتح باقة التدريب' : 'تدرب على هذه المهارة'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'exams' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            {subjectExams.length > 0 ? subjectExams.map((quiz) => (
              <div key={quiz.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                    <Award size={24} />
                  </div>
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                    <Clock size={14} /> {quiz.settings?.timeLimit || 60} دقيقة
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">{quiz.title}</h3>
                <p className="text-gray-500 text-sm mb-6 line-clamp-2">{quiz.description}</p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-600">{quiz.questionIds?.length || 0} سؤال</span>
                  <button
                    onClick={() => isQuizLockedForStudent(quiz, 'tests', 'tests') ? openPackageTab('tests') : navigate(buildQuizPathWithReturn(quiz.id, buildSubjectReturnPath('exams'), 'tests'))}
                    className={`px-6 py-2 rounded-xl font-bold transition-colors ${
                      isQuizLockedForStudent(quiz, 'tests', 'tests') ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {isQuizLockedForStudent(quiz, 'tests', 'tests') ? 'فتح باقة الاختبارات' : 'ابدأ الاختبار'}
                  </button>
                </div>
              </div>
            )) : (
              <div className="col-span-full text-center py-12 text-gray-500">
                لا توجد اختبارات محاكية حاليًا.
              </div>
            )}
          </div>
        )}
      </div>

      {selectedTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" dir="rtl">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => updateSubjectQuery({ topic: null, content: null })}></div>
          <div className="relative bg-white rounded-3xl w-full max-w-5xl h-[85vh] sm:h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-scale-in">
            <div className="flex-none bg-gradient-to-l from-indigo-900 to-[#2e2b70] p-5 sm:p-6 text-white relative h-24 sm:h-28 flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-bl-full"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-400 opacity-10 rounded-tr-full"></div>

              <button
                onClick={() => updateSubjectQuery({ topic: null, content: null })}
                className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
              >
                <X size={20} />
              </button>
              <div>
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold inline-block mb-3 backdrop-blur-sm">
                  {currentSubjectName}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black">{selectedTopic.title}</h2>
              </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-50">
              <div className="w-full md:w-80 flex-none bg-white border-l border-gray-100 h-1/3 md:h-full overflow-y-auto">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-2">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                  <h3 className="font-bold text-gray-800">الموضوعات الفرعية</h3>
                </div>
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => updateSubjectQuery({ topic: selectedTopic.id, content: topicModalTab })}
                    className={`w-full text-right p-4 rounded-xl transition-all flex items-center justify-between group ${
                      selectedSubTopic === null ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div>
                      <h4 className={`font-bold ${selectedSubTopic === null ? 'text-indigo-700' : 'text-gray-700 group-hover:text-indigo-600'}`}>
                        عام (للموضوع الرئيسي)
                      </h4>
                    </div>
                  </button>

                  {subjectTopics.filter((topic) => topic.parentId === selectedTopic.id).sort((a, b) => a.order - b.order).map((subTopic) => (
                    <button
                      key={subTopic.id}
                      onClick={() => isTopicLockedForStudent(subTopic) ? openPackageTab('foundation') : updateSubjectQuery({ topic: subTopic.id, content: topicModalTab })}
                      className={`w-full text-right p-4 rounded-xl transition-all flex items-center justify-between group ${
                        selectedSubTopic?.id === subTopic.id ? 'bg-indigo-50 border border-indigo-100 shadow-sm' : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div>
                        <h4 className={`font-bold transition-colors ${selectedSubTopic?.id === subTopic.id ? 'text-indigo-700' : 'text-gray-700 group-hover:text-indigo-600'}`}>
                          {subTopic.title}
                        </h4>
                      </div>
                      {isTopicLockedForStudent(subTopic) && <Lock size={16} className="text-amber-600" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 h-2/3 md:h-full flex flex-col overflow-hidden bg-gray-50/50">
                <div className="flex-none p-4 sm:p-6 pb-0">
                  <div className="flex border-b border-gray-200">
                    <button
                      onClick={() => updateSubjectQuery({ topic: selectedSubTopic?.id || selectedTopic.id, content: 'lessons' })}
                      className={`px-6 py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${
                        topicModalTab === 'lessons' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      <Video size={18} /> الشروحات
                    </button>
                    <button
                      onClick={() => updateSubjectQuery({ topic: selectedSubTopic?.id || selectedTopic.id, content: 'quizzes' })}
                      className={`px-6 py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${
                        topicModalTab === 'quizzes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      <Target size={18} /> التدريبات القصيرة
                    </button>
                    <button
                      onClick={() => updateSubjectQuery({ topic: selectedSubTopic?.id || selectedTopic.id, content: 'support' })}
                      className={`px-6 py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${
                        topicModalTab === 'support' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      <FileText size={18} /> ملف الدعم
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  {isTopicLockedForStudent(activeTopic) ? (
                    renderLockedAccessPanel(
                      'foundation',
                      'هذا الموضوع ضمن باقة التأسيس',
                      'يمكن للمدير ترك موضوعات تأسيسية مفتوحة وقفل موضوعات أخرى. الموضوع المقفول يفتح بعد شراء باقة التأسيس أو الباقة الشاملة لهذه المادة.',
                    )
                  ) : (
                    <>
                  {topicModalTab === 'lessons' && (
                    <div className="space-y-4">
                      {activeTopicLessons.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 border-dashed overflow-hidden">
                          <div className="text-center py-10 px-4 border-b border-gray-100">
                            <Video size={48} className="mx-auto text-gray-300 mb-4" />
                            <h3 className="text-lg font-bold text-gray-900 mb-2">لا توجد شروحات مرتبطة مباشرة بهذا الموضوع</h3>
                            <p className="text-gray-500 max-w-md mx-auto">
                              لا يوجد درس مسحوب لهذا الموضوع حاليًا، لكن يمكنك البدء من أقرب شرح أو ملف مراجعة متاح في نفس المادة.
                            </p>
                          </div>

                          <div className="p-4 sm:p-6 space-y-4 bg-gray-50/60">
                            {relatedLessonSuggestions.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3 text-sm font-bold text-gray-700">
                                  <Play size={16} className="text-indigo-600" />
                                  أقرب شروحات متاحة الآن
                                </div>
                                <div className="grid gap-3">
                                  {relatedLessonSuggestions.map((lesson) => (
                                    <button
                                      key={lesson.id}
                                      onClick={() => openLessonContent(lesson)}
                                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-right hover:border-indigo-200 hover:shadow-sm transition-all"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <h4 className="font-bold text-gray-800">{lesson.title}</h4>
                                          <p className="text-xs text-gray-500 mt-1">مدة الدرس: {lesson.duration || 'غير محدد'}</p>
                                        </div>
                                        <span className="shrink-0 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold">
                                          مشاهدة
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {relatedLibrarySuggestions.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3 text-sm font-bold text-gray-700">
                                  <FileText size={16} className="text-emerald-600" />
                                  ملفات مراجعة داعمة
                                </div>
                                <div className="grid gap-3">
                                  {relatedLibrarySuggestions.map((item) => (
                                    <button
                                      key={item.id}
                                      onClick={() => openExternalUrl(item.url)}
                                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-right hover:border-emerald-200 hover:shadow-sm transition-all"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <h4 className="font-bold text-gray-800">{item.title}</h4>
                                          <p className="text-xs text-gray-500 mt-1">{item.size} · ملف مراجعة</p>
                                        </div>
                                        <span className="shrink-0 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold">
                                          فتح الملف
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : activeTopicLessons.map((lesson) => (
                        <div key={lesson.id} className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between hover:shadow-md transition-all group">
                          <div className="flex items-center gap-4">
                            <div
                              className="relative w-28 h-16 sm:w-32 sm:h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0 cursor-pointer"
                               onClick={() => openLessonContent(lesson)}
                            >
                              {getYouTubeVideoId(lesson.videoUrl) ? (
                                <img
                                  src={`https://img.youtube.com/vi/${getYouTubeVideoId(lesson.videoUrl)}/mqdefault.jpg`}
                                  alt={lesson.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                              ) : (
                                <div className="w-full h-full bg-indigo-50 flex items-center justify-center text-indigo-300 group-hover:bg-indigo-100 group-hover:text-indigo-400 transition-colors">
                                  <Video size={24} />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                  <Play size={14} className="text-indigo-600 ml-1" fill="currentColor" />
                                </div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-800 line-clamp-1">{lesson.title}</h4>
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                                <span className="flex items-center gap-1 font-bold"><Clock size={12} /> {lesson.duration || 'غير محدد'}</span>
                                <span className="flex items-center gap-1"><Layers size={12} /> المادة العلمية</span>
                              </div>
                            </div>
                          </div>
                          <div className="hidden sm:block">
                            <button
                               onClick={() => openLessonContent(lesson)}
                              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-sm hover:bg-indigo-100 transition-colors"
                            >
                              مشاهدة الدرس
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {topicModalTab === 'quizzes' && (
                    <div className="space-y-4">
                      {activeTopicQuizzes.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 border-dashed overflow-hidden">
                          <div className="text-center py-10 px-4 border-b border-gray-100">
                            <Target size={48} className="mx-auto text-gray-300 mb-4" />
                            <h3 className="text-lg font-bold text-gray-900 mb-2">لا توجد تدريبات قصيرة مرتبطة مباشرة بهذا الموضوع</h3>
                            <p className="text-gray-500 max-w-md mx-auto">
                              يمكنك البدء من اختبار قريب في نفس المادة، أو مراجعة ملف داعم قبل العودة لهذا الجزء.
                            </p>
                          </div>

                          <div className="p-4 sm:p-6 space-y-4 bg-gray-50/60">
                            {relatedQuizSuggestions.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3 text-sm font-bold text-gray-700">
                                  <HelpCircle size={16} className="text-amber-600" />
                                  اختبارات متاحة من نفس المادة
                                </div>
                                <div className="grid gap-3">
                                  {relatedQuizSuggestions.map((quiz) => (
                                    <Link
                                      key={quiz.id}
                                      to={buildTrainingQuizPath(quiz)}
                                      className="bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-amber-200 hover:shadow-sm transition-all"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <h4 className="font-bold text-gray-800">{quiz.title}</h4>
                                          <p className="text-xs text-gray-500 mt-1">{quiz.questionIds?.length || 0} سؤال</p>
                                        </div>
                                        <span className="shrink-0 px-3 py-2 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold">
                                          ابدأ الآن
                                        </span>
                                      </div>
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            )}

                            {relatedLibrarySuggestions.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3 text-sm font-bold text-gray-700">
                                  <FileText size={16} className="text-emerald-600" />
                                  راجع أولًا ثم ارجع للتدريب
                                </div>
                                <div className="grid gap-3">
                                  {relatedLibrarySuggestions.map((item) => (
                                    <button
                                      key={item.id}
                                      onClick={() => openExternalUrl(item.url)}
                                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-right hover:border-emerald-200 hover:shadow-sm transition-all"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <h4 className="font-bold text-gray-800">{item.title}</h4>
                                          <p className="text-xs text-gray-500 mt-1">{item.size}</p>
                                        </div>
                                        <span className="shrink-0 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold">
                                          فتح الملف
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : activeTopicQuizzes.map((quiz) => (
                        <div key={quiz.id} className="bg-white p-5 rounded-xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-all">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
                              <HelpCircle size={24} />
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-800">{quiz.title}</h4>
                              <div className="flex items-center gap-4 mt-2 text-xs font-bold text-gray-500">
                                <span className="flex items-center gap-1"><Layers size={14} /> {quiz.questionIds?.length || 0} سؤال</span>
                                <span className="flex items-center gap-1"><Target size={14} /> +{(quiz.questionIds?.length || 0) * 10} نقطة إنجاز</span>
                              </div>
                            </div>
                          </div>
                          <Link
                            to={buildTrainingQuizPath(quiz)}
                            className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors shrink-0 text-center"
                          >
                            ابدأ التدريب
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}

                  {topicModalTab === 'support' && (
                    <div className="space-y-4">
                      {relatedLibrarySuggestions.length > 0 ? (
                        relatedLibrarySuggestions.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => isTopicSupportLockedForStudent(activeTopic) ? openPackageTab('foundation') : openExternalUrl(item.url)}
                            className={`w-full rounded-2xl border bg-white p-5 text-right shadow-sm transition-all hover:shadow-md ${
                              isTopicSupportLockedForStudent(activeTopic)
                                ? 'border-amber-100 hover:border-amber-200'
                                : 'border-emerald-100 hover:border-emerald-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4">
                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                                  isTopicSupportLockedForStudent(activeTopic) ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                                }`}>
                                  {isTopicSupportLockedForStudent(activeTopic) ? <Lock size={22} /> : <FileText size={24} />}
                                </div>
                                <div>
                                  <h4 className="font-black text-gray-900">{item.title}</h4>
                                  <p className="mt-1 text-xs font-bold text-gray-500">{item.size || 'ملف دعم'}</p>
                                </div>
                              </div>
                              <span className={`rounded-xl px-4 py-2 text-xs font-black ${
                                isTopicSupportLockedForStudent(activeTopic) ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                              }`}>
                                {getTopicSupportAccessLabel(activeTopic)}
                              </span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-500">
                          لا يوجد ملف دعم لهذا الجزء بعد.
                        </div>
                      )}
                    </div>
                  )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {videoData && (
        <VideoModal
          videoUrl={videoData.url}
          title={videoData.title}
          interactiveQuestions={videoData.interactiveQuestions || []}
          questionBank={questions}
          onClose={() => setVideoData(null)}
        />
      )}
    </div>
  );
};
