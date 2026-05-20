import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock, FileText, Layers, Play, Target, Video, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Topic } from '../types';
import { VideoModal } from './VideoModal';
import { openExternalUrl } from '../utils/openExternalUrl';
import { getYouTubeVideoId, sanitizeVideoUrl } from '../utils/videoLinks';
import { matchesEntityId } from '../utils/entityIds';
import { isMaterialQuizCandidate } from '../utils/mockExam';
import { buildQuizRouteWithContext } from '../utils/quizLinks';

interface SkillDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  skill: any;
}

export const SkillDetailsModal: React.FC<SkillDetailsModalProps> = ({ isOpen, onClose, skill }) => {
  const { user, topics, lessons, quizzes, libraryItems, paths, subjects } = useStore();
  const [selectedSubTopic, setSelectedSubTopic] = useState<Topic | null>(null);
  const [topicModalTab, setTopicModalTab] = useState<'lessons' | 'quizzes' | 'support'>('lessons');
  const [videoData, setVideoData] = useState<{ url: string; title: string } | null>(null);
  const [lessonNotice, setLessonNotice] = useState('');
  const [openedInitialLessonId, setOpenedInitialLessonId] = useState<string | null>(null);
  const [watchedLessonIds, setWatchedLessonIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(window.localStorage.getItem('almeaa-watched-foundation-lessons') || '[]');
    } catch {
      return [];
    }
  });
  const subTopicRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isStaffViewer = ['admin', 'teacher', 'supervisor'].includes(user.role);
  const showTrainingSavedNotice = Boolean(skill?.trainingDone);

  const selectedTopic = skill?.originalTopic as Topic | undefined;
  const activeTopic = selectedSubTopic || selectedTopic;
  const pathLabel = paths.find((path) => path.id === selectedTopic?.pathId)?.name || 'غير محدد';
  const subjectLabel = subjects.find((subject) => subject.id === selectedTopic?.subjectId)?.name || 'غير محدد';

  const canStudentSeeLesson = (lesson: (typeof lessons)[number]) =>
    isStaffViewer || (lesson.showOnPlatform !== false && (!lesson.approvalStatus || lesson.approvalStatus === 'approved'));
  const canStudentSeeQuiz = (quiz: (typeof quizzes)[number]) =>
    isStaffViewer || (quiz.showOnPlatform !== false && quiz.isPublished !== false && (!quiz.approvalStatus || quiz.approvalStatus === 'approved'));
  const canStudentSeeLibraryItem = (item: (typeof libraryItems)[number]) =>
    isStaffViewer || (item.showOnPlatform !== false && (!item.approvalStatus || item.approvalStatus === 'approved'));
  const hasPlayableLessonMedia = (lesson: (typeof lessons)[number]) =>
    Boolean(sanitizeVideoUrl(lesson.videoUrl) || lesson.fileUrl);
  const getLessonActionLabel = (lesson: (typeof lessons)[number]) => {
    if (sanitizeVideoUrl(lesson.videoUrl)) return 'مشاهدة الدرس';
    if (lesson.fileUrl) return 'فتح الملف';
    return isStaffViewer ? 'ينقصه رابط' : 'قيد التجهيز';
  };

  useEffect(() => {
    if (isOpen && skill?.originalTopic?.id) {
      const subTopics = topics
        .filter((topic) => topic.parentId === skill.originalTopic.id && (isStaffViewer || topic.showOnPlatform !== false))
        .sort((a, b) => a.order - b.order);

      setSelectedSubTopic(
        skill.initialSubTopicId
          ? subTopics.find((topic) => matchesEntityId(topic, skill.initialSubTopicId)) || subTopics[0] || null
          : subTopics[0] || null,
      );
      setTopicModalTab(skill.initialContentTab === 'quizzes' ? 'quizzes' : skill.initialContentTab === 'support' ? 'support' : 'lessons');
      setOpenedInitialLessonId(null);
    }
  }, [isOpen, isStaffViewer, skill?.initialContentTab, skill?.initialSubTopicId, skill?.originalTopic?.id, topics]);

  useEffect(() => {
    if (!isOpen || !selectedSubTopic?.id) return;
    subTopicRefs.current[selectedSubTopic.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isOpen, selectedSubTopic?.id]);

  const subTopics = useMemo(
    () =>
      selectedTopic
        ? topics
            .filter((topic) => topic.parentId === selectedTopic.id && (isStaffViewer || topic.showOnPlatform !== false))
            .sort((a, b) => a.order - b.order)
        : [],
    [isStaffViewer, selectedTopic?.id, topics],
  );

  const activeTopicLessons = useMemo(
    () => {
      if (!activeTopic || !selectedTopic) return [];

      const explicitLessonIds = new Set(activeTopic.lessonIds || []);
      const initialLessonId = skill?.initialLessonId;

      return lessons
        .filter((lesson) => {
          if (!canStudentSeeLesson(lesson)) return false;
          if (initialLessonId && matchesEntityId(lesson, initialLessonId)) return true;
          return [...explicitLessonIds].some((lessonId) => matchesEntityId(lesson, lessonId));
        })
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    },
    [activeTopic, lessons, selectedTopic?.pathId, selectedTopic?.subjectId, skill?.initialLessonId],
  );

  const activeTopicQuizzes = useMemo(
    () => {
      if (!activeTopic || !selectedTopic) return [];

      const explicitQuizIds = new Set(activeTopic.quizIds || []);

      return quizzes
        .filter((quiz) => {
          if (!canStudentSeeQuiz(quiz)) return false;
          if (!isMaterialQuizCandidate(quiz)) return false;
          if ([...explicitQuizIds].some((quizId) => matchesEntityId(quiz, quizId))) return true;
          return false;
        })
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    },
    [activeTopic, quizzes],
  );

  const relatedLessonSuggestions = useMemo(
    () =>
      lessons
        .filter((lesson) => {
          if (!selectedTopic || !activeTopic) return false;
          const matchesPath = selectedTopic.pathId ? lesson.pathId === selectedTopic.pathId : true;
          const matchesSubject = lesson.subjectId === selectedTopic.subjectId;
          const matchesSection = activeTopic.sectionId ? lesson.sectionId === activeTopic.sectionId : true;
          const notAttached = !(activeTopic.lessonIds || []).some((lessonId) => matchesEntityId(lesson, lessonId));
          return matchesPath && matchesSubject && matchesSection && notAttached && canStudentSeeLesson(lesson);
        })
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .slice(0, 3),
    [activeTopic, lessons, selectedTopic?.pathId, selectedTopic?.subjectId],
  );

  const relatedQuizSuggestions = useMemo(
    () =>
      quizzes
        .filter((quiz) => {
          if (!selectedTopic || !activeTopic) return false;
          const matchesPath = selectedTopic.pathId ? quiz.pathId === selectedTopic.pathId : true;
          const matchesSubject = quiz.subjectId === selectedTopic.subjectId;
          const matchesSection = activeTopic.sectionId ? quiz.sectionId === activeTopic.sectionId : true;
          const notAttached = !(activeTopic.quizIds || []).some((quizId) => matchesEntityId(quiz, quizId));
          return matchesPath && matchesSubject && matchesSection && notAttached && canStudentSeeQuiz(quiz) && isMaterialQuizCandidate(quiz);
        })
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 3),
    [activeTopic, quizzes, selectedTopic?.pathId, selectedTopic?.subjectId],
  );

  const relatedLibrarySuggestions = useMemo(
    () => {
      if (!selectedTopic || !activeTopic) return [];
      const explicitLibraryItemIds = new Set(activeTopic.libraryItemIds || []);
      if (explicitLibraryItemIds.size === 0) return [];

      return libraryItems
        .filter((item) => {
          const matchesPath = selectedTopic.pathId ? item.pathId === selectedTopic.pathId : true;
          const matchesSubject = item.subjectId === selectedTopic.subjectId;
          const isAttached = [...explicitLibraryItemIds].some((itemId) => matchesEntityId(item, itemId));
          return matchesPath && matchesSubject && isAttached && Boolean(item.url) && canStudentSeeLibraryItem(item);
        })
        .slice(0, 3);
    },
    [activeTopic, libraryItems, selectedTopic?.pathId, selectedTopic?.subjectId],
  );
  const learnerTopicLessons = isStaffViewer
    ? activeTopicLessons
    : activeTopicLessons.filter((lesson) => hasPlayableLessonMedia(lesson));
  const hasHiddenUnplayableLessons = !isStaffViewer && activeTopicLessons.length > learnerTopicLessons.length;
  const buildTopicReturnPath = (contentTab: 'lessons' | 'quizzes' | 'support' = topicModalTab) => {
    const params = new URLSearchParams();
    if (selectedTopic?.subjectId) params.set('subject', selectedTopic.subjectId);
    params.set('tab', 'skills');
    if (activeTopic?.id) params.set('topic', activeTopic.id);
    params.set('content', contentTab);
    return `/category/${selectedTopic?.pathId || ''}?${params.toString()}`;
  };
  const buildTrainingQuizPath = (quizId: string) => {
    const sourceQuiz = quizzes.find((quiz) => matchesEntityId(quiz, quizId));
    const returnOnFinish =
      sourceQuiz?.settings?.returnToSourceOnFinish === true ||
      sourceQuiz?.settings?.showResultsReport === false;

    return buildQuizRouteWithContext(quizId, {
      returnTo: buildTopicReturnPath('quizzes'),
      source: 'foundation',
      returnOnFinish,
    });
  };
  const markLessonWatched = (lessonId: string) => {
    setWatchedLessonIds((current) => {
      if (current.includes(lessonId)) return current;
      const next = [...current, lessonId];
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('almeaa-watched-foundation-lessons', JSON.stringify(next));
      }
      return next;
    });
  };

  const openLessonVideo = (lesson: (typeof lessons)[number]) => {
    setLessonNotice('');
    const safeVideoUrl = sanitizeVideoUrl(lesson.videoUrl);
    if (safeVideoUrl) {
      markLessonWatched(lesson.id);
      setVideoData({ url: safeVideoUrl, title: lesson.title });
      return;
    }

    if (lesson.fileUrl) {
      markLessonWatched(lesson.id);
      openExternalUrl(lesson.fileUrl);
      return;
    }

    setLessonNotice('هذا الدرس مربوط بالموضوع، لكنه يحتاج إضافة رابط فيديو أو ملف من الإدارة حتى يظهر للطالب بشكل كامل.');
  };

  useEffect(() => {
    const initialLessonId = skill?.initialLessonId;
    if (!isOpen || !initialLessonId || openedInitialLessonId === initialLessonId || activeTopicLessons.length === 0) {
      return;
    }

    const initialLesson = activeTopicLessons.find((lesson) => matchesEntityId(lesson, initialLessonId));
    if (!initialLesson) {
      return;
    }

    setOpenedInitialLessonId(initialLessonId);
    setTopicModalTab('lessons');
    openLessonVideo(initialLesson);
  }, [activeTopicLessons, isOpen, openedInitialLessonId, skill?.initialLessonId]);

  if (!isOpen || !selectedTopic || !activeTopic) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-5xl h-[85vh] sm:h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-scale-in">
        <div className="flex-none bg-gradient-to-l from-indigo-900 to-[#2e2b70] p-5 sm:p-6 text-white relative h-28 sm:h-32 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-bl-full" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-tr-full" />

          <button onClick={onClose} className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10" aria-label="إغلاق">
            <X size={20} />
          </button>

          <div>
            <p className="mb-1 text-xs font-bold text-indigo-100">مساحة تعلم المهارة</p>
            <h2 className="text-xl sm:text-2xl font-black">{selectedTopic.title}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black">
              {isStaffViewer ? (
                <>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-white/90">المسار: {pathLabel}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-white/90">المادة: {subjectLabel}</span>
                </>
              ) : null}
              <span className="rounded-full bg-white/10 px-3 py-1 text-white/90">
                {selectedSubTopic ? `المفتوح الآن: ${selectedSubTopic.title}` : 'المفتوح الآن: المهارة الرئيسية'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-50">
          <div className="w-full md:w-80 flex-none bg-white border-l border-gray-100 h-1/3 md:h-full overflow-y-auto">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-2">
              <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
              <h3 className="font-bold text-gray-800">الموضوعات الفرعية</h3>
            </div>

            <div className="p-2 space-y-1">
              <button
                onClick={() => setSelectedSubTopic(null)}
                className={`w-full text-right p-4 rounded-xl transition-all border ${
                  selectedSubTopic === null ? 'bg-indigo-50 border-indigo-100' : 'hover:bg-gray-50 border-transparent'
                }`}
              >
                <h4 className={`font-bold ${selectedSubTopic === null ? 'text-indigo-700' : 'text-gray-700'}`}>
                  عام للمهارة الرئيسية
                </h4>
                <p className="mt-1 text-xs text-gray-400">الدروس والتدريبات المرتبطة مباشرة بالمهارة</p>
              </button>

              {subTopics.map((subTopic) => (
                <button
                  key={subTopic.id}
                  ref={(element) => {
                    subTopicRefs.current[subTopic.id] = element;
                  }}
                  onClick={() => setSelectedSubTopic(subTopic)}
                  className={`w-full text-right p-4 rounded-xl transition-all border ${
                    selectedSubTopic?.id === subTopic.id ? 'bg-indigo-50 border-indigo-100 shadow-sm' : 'hover:bg-gray-50 border-transparent'
                  }`}
                >
                  <h4 className={`font-bold ${selectedSubTopic?.id === subTopic.id ? 'text-indigo-700' : 'text-gray-700'}`}>
                    {subTopic.title}
                  </h4>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 h-2/3 md:h-full flex flex-col overflow-hidden bg-gray-50/50">
            <div className="flex-none p-4 sm:p-5 pb-0">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setTopicModalTab('lessons')}
                  className={`px-6 py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${
                    topicModalTab === 'lessons' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Video size={18} /> الشروحات
                </button>
                <button
                  onClick={() => setTopicModalTab('quizzes')}
                  className={`px-6 py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${
                    topicModalTab === 'quizzes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Target size={18} /> التدريبات القصيرة
                </button>
                <button
                  onClick={() => setTopicModalTab('support')}
                  className={`px-6 py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${
                    topicModalTab === 'support' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <FileText size={18} /> ملف الدعم
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {showTrainingSavedNotice ? (
                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
                  <CheckCircle2 size={18} />
                  تم حفظ التدريب. يمكنك إكمال الشرح أو فتح تدريب آخر من نفس الموضوع.
                </div>
              ) : null}
              {topicModalTab === 'lessons' ? (
                <div className="space-y-4">
                  {lessonNotice ? (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold leading-7 text-amber-700">
                      {lessonNotice}
                    </div>
                  ) : null}
                  {learnerTopicLessons.length > 0 ? (
                    learnerTopicLessons.map((lesson) => {
                      const hasVideo = Boolean(sanitizeVideoUrl(lesson.videoUrl));
                      const hasMedia = hasPlayableLessonMedia(lesson);
                      return (
                      <button
                        type="button"
                        key={lesson.id}
                        className={`w-full bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between hover:shadow-md transition-all group text-right ${
                          !hasMedia ? 'opacity-80' : ''
                        }`}
                        onClick={() => openLessonVideo(lesson)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative w-28 h-16 sm:w-32 sm:h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0">
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
                            {hasVideo ? (
                              <>
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                    <Play size={14} className="text-indigo-600 ml-1" fill="currentColor" />
                                  </div>
                                </div>
                              </>
                            ) : null}
                          </div>

                          <div>
                            <h4 className="font-bold text-gray-800 line-clamp-1">{lesson.title}</h4>
                            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-500">
                              <span className="flex items-center gap-1 font-bold">
                                <Clock size={12} /> {lesson.duration || 'غير محدد'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Layers size={12} /> المادة العلمية
                              </span>
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-black ${
                                watchedLessonIds.includes(lesson.id)
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}>
                                {watchedLessonIds.includes(lesson.id) ? <CheckCircle2 size={12} /> : null}
                                {watchedLessonIds.includes(lesson.id) ? 'شوهد' : 'لم يشاهد'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className={`hidden sm:block px-4 py-2 rounded-lg font-bold text-sm ${hasMedia ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                          {getLessonActionLabel(lesson)}
                        </span>
                      </button>
                    );
                  })
                  ) : (
                    <EmptyState
                      icon={<Video size={48} />}
                      title={hasHiddenUnplayableLessons ? 'الشرح قيد التجهيز' : 'لا يوجد شرح هنا بعد'}
                      description={
                        hasHiddenUnplayableLessons
                          ? 'أضف رابط فيديو أو ملفًا ليظهر للطالب.'
                          : isStaffViewer
                            ? 'اربط درسًا مباشرًا من الإدارة.'
                            : 'سيظهر هنا عند إضافة الدرس.'
                      }
                    >
                      {isStaffViewer ? (
                        <SuggestionList
                          lessons={relatedLessonSuggestions}
                          libraryItems={relatedLibrarySuggestions}
                          onOpenLesson={openLessonVideo}
                        />
                      ) : null}
                    </EmptyState>
                  )}
                </div>
              ) : topicModalTab === 'quizzes' ? (
                <div className="space-y-4">
                  {activeTopicQuizzes.length > 0 ? (
                    activeTopicQuizzes.map((quiz) => (
                      <div key={quiz.id} className="bg-white p-5 rounded-xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-all">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
                            <Target size={24} />
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-800">{quiz.title}</h4>
                            <div className="flex items-center gap-4 mt-2 text-xs font-bold text-gray-500">
                              <span className="flex items-center gap-1">
                                <Layers size={14} /> {quiz.questionIds?.length || 0} سؤال
                              </span>
                              <span className="flex items-center gap-1">
                                <Target size={14} /> تدريب على نفس المهارة
                              </span>
                            </div>
                          </div>
                        </div>

                        <Link to={buildTrainingQuizPath(quiz.id)} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors shrink-0 text-center">
                          ابدأ التدريب
                        </Link>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={<Target size={48} />}
                      title="لا يوجد تدريب هنا بعد"
                      description={isStaffViewer ? 'اربط تدريبًا من مركز الاختبارات.' : 'سيظهر هنا عند ربط التدريب.'}
                    >
                      {isStaffViewer ? (
                        <div className="grid gap-3">
                          {relatedQuizSuggestions.map((quiz) => (
                            <Link key={quiz.id} to={buildTrainingQuizPath(quiz.id)} className="bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-amber-200 hover:shadow-sm transition-all">
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
                      ) : null}
                    </EmptyState>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {relatedLibrarySuggestions.length > 0 ? (
                    relatedLibrarySuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openExternalUrl(item.url)}
                        className="w-full rounded-2xl border border-emerald-100 bg-white p-5 text-right shadow-sm transition-all hover:border-emerald-200 hover:shadow-md"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                              <FileText size={24} />
                            </div>
                            <div>
                              <h4 className="font-black text-gray-900">{item.title}</h4>
                              <p className="mt-1 text-xs font-bold text-gray-500">{item.size || 'ملف داعم'}</p>
                            </div>
                          </div>
                          <span className="rounded-xl bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">
                            فتح الملف
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <EmptyState
                      icon={<FileText size={48} />}
                      title="لا يوجد ملف دعم بعد"
                      description={isStaffViewer ? 'اربط ملفًا من المكتبة.' : 'سيظهر هنا عند إضافة الملف.'}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {videoData && <VideoModal videoUrl={videoData.url} title={videoData.title} onClose={() => setVideoData(null)} />}
      </div>
    </div>
  );
};

const EmptyState = ({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) => (
  <div className="bg-white rounded-2xl border border-gray-100 border-dashed overflow-hidden">
    <div className="text-center py-10 px-4 border-b border-gray-100">
      <div className="mx-auto mb-4 flex justify-center text-gray-300">{icon}</div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 max-w-md mx-auto leading-7">{description}</p>
    </div>
    {children ? <div className="p-4 sm:p-6 space-y-4 bg-gray-50/60">{children}</div> : null}
  </div>
);

const SuggestionList = ({
  lessons,
  libraryItems,
  onOpenLesson,
}: {
  lessons: ReturnType<typeof useStore.getState>['lessons'];
  libraryItems: ReturnType<typeof useStore.getState>['libraryItems'];
  onOpenLesson: (lesson: ReturnType<typeof useStore.getState>['lessons'][number]) => void;
}) => (
  <div className="space-y-4">
    {lessons.length > 0 ? (
      <div>
        <div className="flex items-center gap-2 mb-3 text-sm font-bold text-gray-700">
          <Play size={16} className="text-indigo-600" />
          شروحات بديلة متاحة الآن
        </div>
        <div className="grid gap-3">
          {lessons.map((lesson) => (
            <button key={lesson.id} onClick={() => onOpenLesson(lesson)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-right hover:border-indigo-200 hover:shadow-sm transition-all">
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
    ) : null}

    {libraryItems.length > 0 ? (
      <div>
        <div className="flex items-center gap-2 mb-3 text-sm font-bold text-gray-700">
          <FileText size={16} className="text-emerald-600" />
          ملفات مراجعة داعمة
        </div>
        <div className="grid gap-3">
          {libraryItems.map((item) => (
            <button key={item.id} onClick={() => openExternalUrl(item.url)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-right hover:border-emerald-200 hover:shadow-sm transition-all">
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
    ) : null}
  </div>
);
