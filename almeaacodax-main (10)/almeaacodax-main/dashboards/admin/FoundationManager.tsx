import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Topic, Lesson, Quiz, LibraryItem } from '../../types';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, BookOpen, FileQuestion, FileText, Link as LinkIcon, X, Lock, LockOpen, Eye, CheckCircle2, AlertTriangle } from 'lucide-react';
import { sanitizeVideoUrl } from '../../utils/videoLinks';
import { isTrainingQuiz } from '../../utils/quizPlacement';

interface FoundationManagerProps {
  subjectId: string;
}

export const FoundationManager: React.FC<FoundationManagerProps> = ({ subjectId }) => {
  const { topics, addTopic, updateTopic, deleteTopic, lessons, updateLesson, quizzes, updateQuiz, libraryItems, updateLibraryItem, subjects } = useStore();
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  
  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Partial<Topic> | null>(null);

  // Attachment state
  const [isAttaching, setIsAttaching] = useState(false);
  const [attachingToTopicId, setAttachingToTopicId] = useState<string | null>(null);
  const [attachType, setAttachType] = useState<'lesson' | 'quiz' | 'support'>('lesson');

  const currentSubject = subjects.find(item => item.id === subjectId);
  const subjectTopics = topics.filter(t => t.subjectId === subjectId).sort((a, b) => a.order - b.order);
  const mainTopics = subjectTopics.filter(t => !t.parentId);
  const availableLessons = lessons
    .filter((lesson) => {
      const matchesSubject = lesson.subjectId === subjectId;
      const matchesPath = currentSubject?.pathId ? lesson.pathId === currentSubject.pathId : true;
      return matchesSubject && matchesPath;
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0) || a.title.localeCompare(b.title, 'ar'));
  const availableQuizzes = quizzes
    .filter((quiz) => {
      const matchesSubject = quiz.subjectId === subjectId;
      const matchesPath = currentSubject?.pathId ? quiz.pathId === currentSubject.pathId : true;
      return matchesSubject && matchesPath && isTrainingQuiz(quiz);
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'ar'));
  const availableLibraryItems = libraryItems
    .filter((item) => {
      const matchesSubject = item.subjectId === subjectId;
      const matchesPath = currentSubject?.pathId ? item.pathId === currentSubject.pathId : true;
      return matchesSubject && matchesPath && Boolean(item.url);
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'ar'));
  const foundationOverview = {
    total: subjectTopics.length,
    visible: subjectTopics.filter((topic) => topic.showOnPlatform !== false).length,
    locked: subjectTopics.filter((topic) => topic.isLocked === true).length,
    linkedResources: subjectTopics.reduce(
      (sum, topic) => sum + (topic.lessonIds?.length || 0) + (topic.quizIds?.length || 0) + (topic.libraryItemIds?.length || 0),
      0,
    ),
  };

  const getTopicReadinessMeta = (topic: Topic, attachedLessons: Lesson[], attachedQuizzes: Quiz[], attachedLibraryItems: LibraryItem[], childCount: number) => {
    const issues: string[] = [];

    if (!topic.title.trim()) issues.push('العنوان غير مكتمل');
    if (!topic.subjectId) issues.push('غير مربوط بمادة');
    if (!topic.pathId && !currentSubject?.pathId) issues.push('غير مربوط بمسار');
    if (topic.showOnPlatform === false) issues.push('مخفي عن المنصة');
    if (attachedLessons.length + attachedQuizzes.length + attachedLibraryItems.length + childCount === 0) issues.push('لا توجد دروس أو تدريبات أو ملفات دعم مرتبطة');

    attachedLessons.forEach((lesson) => {
      if (lesson.type === 'video' && !lesson.videoUrl) issues.push(`الدرس "${lesson.title}" بدون رابط فيديو`);
      if (lesson.showOnPlatform === false || (lesson.approvalStatus && lesson.approvalStatus !== 'approved')) {
        issues.push(`الدرس "${lesson.title}" يحتاج نشرًا أو اعتمادًا`);
      }
    });

    attachedQuizzes.forEach((quiz) => {
      if ((quiz.questionIds || []).length === 0) issues.push(`التدريب "${quiz.title}" بدون أسئلة`);
      if (!isTrainingQuiz(quiz)) issues.push(`التدريب "${quiz.title}" غير مصنف كتدريب`);
      if (quiz.showOnPlatform === false || quiz.isPublished === false || (quiz.approvalStatus && quiz.approvalStatus !== 'approved')) {
        issues.push(`التدريب "${quiz.title}" يحتاج نشرًا أو اعتمادًا`);
      }
    });

    attachedLibraryItems.forEach((item) => {
      if (!item.url) issues.push(`ملف الدعم "${item.title}" بدون رابط`);
      if (item.showOnPlatform === false || (item.approvalStatus && item.approvalStatus !== 'approved')) {
        issues.push(`ملف الدعم "${item.title}" يحتاج نشرًا أو اعتمادًا`);
      }
    });

    if (issues.length === 0) {
      return {
        label: 'جاهز للطالب',
        issues,
        className: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        icon: 'ready' as const,
      };
    }

    return {
      label: 'يحتاج ضبط',
      issues,
      className: 'bg-amber-50 text-amber-700 border-amber-100',
      icon: 'warn' as const,
    };
  };

  const foundationReadinessOverview = subjectTopics.reduce(
    (acc, topic) => {
      const attachedLessons = lessons.filter((lesson) => topic.lessonIds?.includes(lesson.id));
      const attachedQuizzes = quizzes.filter((quiz) => topic.quizIds?.includes(quiz.id));
      const attachedLibraryItems = libraryItems.filter((item) => topic.libraryItemIds?.includes(item.id));
      const childCount = subjectTopics.filter((item) => item.parentId === topic.id).length;
      const readiness = getTopicReadinessMeta(topic, attachedLessons, attachedQuizzes, attachedLibraryItems, childCount);

      if (readiness.issues.length === 0) {
        acc.ready += 1;
      } else {
        acc.needsReview += 1;
      }

      return acc;
    },
    { ready: 0, needsReview: 0 },
  );

  const toggleExpand = (topicId: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  const handleCreateNew = (parentId?: string) => {
    setEditingTopic({
      pathId: currentSubject?.pathId,
      subjectId,
      parentId,
      title: '',
      order: subjectTopics.filter(t => t.parentId === parentId).length,
      showOnPlatform: false,
      lessonIds: [],
      quizIds: [],
      libraryItemIds: []
    });
    setIsEditing(true);
  };

  const handleSaveTopic = () => {
    if (!editingTopic?.title) return;
    const subject = subjects.find(item => item.id === (editingTopic.subjectId || subjectId));

    if (editingTopic.id) {
      const updateData = { ...editingTopic, pathId: editingTopic.pathId || subject?.pathId };
      if (updateData.parentId === undefined) {
        updateData.parentId = null;
      }
      updateTopic(editingTopic.id, updateData);
    } else {
      const newTopic: Topic = {
        ...(editingTopic as Topic),
        pathId: editingTopic.pathId || subject?.pathId,
        id: `topic_${Date.now()}`
      };
      if (newTopic.parentId === undefined) {
        newTopic.parentId = null;
      }
      addTopic(newTopic);
    }
    setIsEditing(false);
    setEditingTopic(null);
  };

  const handleDelete = (topicId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الموضوع؟ سيتم حذف جميع المواضيع الفرعية أيضاً.')) {
      // Delete subtopics first
      const subtopics = topics.filter(t => t.parentId === topicId);
      subtopics.forEach(st => deleteTopic(st.id));
      // Delete main topic
      deleteTopic(topicId);
    }
  };

  const handleAttach = (itemId: string) => {
    if (!attachingToTopicId) return;
    const topic = topics.find(t => t.id === attachingToTopicId);
    if (!topic) return;

    if (attachType === 'lesson') {
      if (!topic.lessonIds.includes(itemId)) {
        updateTopic(topic.id, { lessonIds: [...topic.lessonIds, itemId] });
      }
      const lesson = lessons.find((item) => item.id === itemId);
      if (lesson && topic.showOnPlatform !== false) {
        updateLesson(itemId, {
          pathId: lesson.pathId || topic.pathId || currentSubject?.pathId,
          subjectId: lesson.subjectId || topic.subjectId,
          sectionId: lesson.sectionId || topic.sectionId,
          showOnPlatform: true,
          approvalStatus: 'approved',
          approvedAt: lesson.approvedAt || Date.now(),
          videoUrl: lesson.videoUrl ? sanitizeVideoUrl(lesson.videoUrl) : lesson.videoUrl,
        });
      }
    } else if (attachType === 'quiz') {
      if (!topic.quizIds.includes(itemId)) {
        updateTopic(topic.id, { quizIds: [...topic.quizIds, itemId] });
      }
      const quiz = quizzes.find((item) => item.id === itemId);
      if (quiz && topic.showOnPlatform !== false) {
        updateQuiz(itemId, {
          pathId: quiz.pathId || topic.pathId || currentSubject?.pathId || '',
          subjectId: quiz.subjectId || topic.subjectId,
          sectionId: quiz.sectionId || topic.sectionId,
          showOnPlatform: true,
          isPublished: true,
          type: 'bank',
          placement: 'training',
          showInTraining: true,
          showInMock: false,
          approvalStatus: 'approved',
          approvedAt: quiz.approvedAt || Date.now(),
        });
      }
    } else {
      const currentLibraryItemIds = topic.libraryItemIds || [];
      if (!currentLibraryItemIds.includes(itemId)) {
        updateTopic(topic.id, { libraryItemIds: [...currentLibraryItemIds, itemId] });
      }
      const libraryItem = libraryItems.find((item) => item.id === itemId);
      if (libraryItem && topic.showOnPlatform !== false) {
        updateLibraryItem(itemId, {
          pathId: libraryItem.pathId || topic.pathId || currentSubject?.pathId,
          subjectId: libraryItem.subjectId || topic.subjectId,
          sectionId: libraryItem.sectionId || topic.sectionId,
          showOnPlatform: true,
          approvalStatus: 'approved',
          approvedAt: libraryItem.approvedAt || Date.now(),
        });
      }
    }
    setIsAttaching(false);
  };

  const isLessonReadyForLearner = (lesson: Lesson) =>
    lesson.showOnPlatform !== false && (!lesson.approvalStatus || lesson.approvalStatus === 'approved');
  const isQuizReadyForLearner = (quiz: Quiz) =>
    quiz.showOnPlatform !== false && quiz.isPublished !== false && (!quiz.approvalStatus || quiz.approvalStatus === 'approved');

  const handleRemoveAttachment = (topicId: string, itemId: string, type: 'lesson' | 'quiz' | 'support') => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;

    if (type === 'lesson') {
      updateTopic(topicId, { lessonIds: topic.lessonIds.filter(id => id !== itemId) });
    } else if (type === 'quiz') {
      updateTopic(topicId, { quizIds: topic.quizIds.filter(id => id !== itemId) });
    } else {
      updateTopic(topicId, { libraryItemIds: (topic.libraryItemIds || []).filter(id => id !== itemId) });
    }
  };

  const handleTogglePlatformVisibility = (topic: Topic) => {
    updateTopic(topic.id, { showOnPlatform: topic.showOnPlatform === false });
  };

  const handleToggleTopicLock = (topic: Topic) => {
    updateTopic(topic.id, { isLocked: topic.isLocked !== true });
  };

  const handlePrepareTopicForLearner = (topic: Topic) => {
    const attachedLessons = lessons.filter((lesson) => topic.lessonIds?.includes(lesson.id));
    const attachedQuizzes = quizzes.filter((quiz) => topic.quizIds?.includes(quiz.id));
    const attachedLibraryItems = libraryItems.filter((item) => topic.libraryItemIds?.includes(item.id));

    updateTopic(topic.id, {
      pathId: topic.pathId || currentSubject?.pathId,
      subjectId: topic.subjectId || subjectId,
      showOnPlatform: true,
    });

    attachedLessons.forEach((lesson) => {
      updateLesson(lesson.id, {
        pathId: lesson.pathId || topic.pathId || currentSubject?.pathId,
        subjectId: lesson.subjectId || topic.subjectId || subjectId,
        sectionId: lesson.sectionId || topic.sectionId,
        showOnPlatform: true,
        approvalStatus: 'approved',
        approvedAt: lesson.approvedAt || Date.now(),
        videoUrl: lesson.videoUrl ? sanitizeVideoUrl(lesson.videoUrl) : lesson.videoUrl,
      });
    });

    attachedQuizzes.forEach((quiz) => {
      updateQuiz(quiz.id, {
        pathId: quiz.pathId || topic.pathId || currentSubject?.pathId || '',
        subjectId: quiz.subjectId || topic.subjectId || subjectId,
        sectionId: quiz.sectionId || topic.sectionId,
        showOnPlatform: true,
        isPublished: true,
        type: 'bank',
        placement: 'training',
        showInTraining: true,
        showInMock: false,
        approvalStatus: 'approved',
        approvedAt: quiz.approvedAt || Date.now(),
      });
    });

    attachedLibraryItems.forEach((item) => {
      updateLibraryItem(item.id, {
        pathId: item.pathId || topic.pathId || currentSubject?.pathId,
        subjectId: item.subjectId || topic.subjectId || subjectId,
        sectionId: item.sectionId || topic.sectionId,
        showOnPlatform: true,
        approvalStatus: 'approved',
        approvedAt: item.approvedAt || Date.now(),
      });
    });
  };

  const handlePreviewTopic = (topic: Topic) => {
    const pathId = topic.pathId || currentSubject?.pathId;
    const targetSubjectId = topic.subjectId || subjectId;
    if (!pathId || !targetSubjectId) return;
    const url = `/#/category/${pathId}?subject=${targetSubjectId}&tab=skills&topic=${topic.id}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handlePreviewAttachment = (topic: Topic, item: Lesson | Quiz | LibraryItem, type: 'lesson' | 'quiz' | 'support') => {
    const pathId = item.pathId || topic.pathId || currentSubject?.pathId || '';
    const targetSubjectId = item.subjectId || topic.subjectId || subjectId;
    const url = type === 'lesson'
      ? `/#/category/${pathId}?subject=${targetSubjectId}&tab=skills&topic=${topic.id}&content=lessons&lesson=${item.id}`
      : type === 'quiz'
        ? `/#/quiz/${item.id}`
        : `/#/category/${pathId}?subject=${targetSubjectId}&tab=skills&topic=${topic.id}&content=support`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const renderTopic = (topic: Topic, level: number = 0) => {
    const subtopics = subjectTopics.filter(t => t.parentId === topic.id);
    const isExpanded = expandedTopics.has(topic.id);
    const attachedLessons = lessons.filter(l => topic.lessonIds?.includes(l.id));
    const attachedQuizzes = quizzes.filter(q => topic.quizIds?.includes(q.id));
    const attachedLibraryItems = libraryItems.filter(item => topic.libraryItemIds?.includes(item.id));
    const totalAttachments = attachedLessons.length + attachedQuizzes.length + attachedLibraryItems.length;
    const readinessMeta = getTopicReadinessMeta(topic, attachedLessons, attachedQuizzes, attachedLibraryItems, subtopics.length);

    return (
      <div key={topic.id} className={`border border-gray-100 rounded-xl mb-3 bg-white overflow-hidden shadow-sm ${level > 0 ? 'mr-8 border-r-4 border-r-indigo-200' : ''}`}>
        <div className="flex flex-col gap-4 p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:flex-1">
            {subtopics.length > 0 ? (
              <button onClick={() => toggleExpand(topic.id)} className="text-gray-500 hover:text-indigo-600">
                {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </button>
            ) : (
              <div className="w-5" /> // Spacer
            )}
            <h3 className={`min-w-[180px] font-bold ${level === 0 ? 'text-lg text-gray-800' : 'text-md text-gray-700'}`}>
              {topic.title}
            </h3>
            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
              {subtopics.length} مواضيع فرعية
            </span>
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${topic.showOnPlatform === false ? 'bg-gray-100 text-gray-600' : 'bg-sky-50 text-sky-700'}`}>
              {topic.showOnPlatform === false ? 'مخفي عن المنصة' : 'ظاهر على المنصة'}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${topic.isLocked ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {topic.isLocked ? 'ضمن باقة التأسيس' : 'مفتوح مجاني'}
            </span>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-bold">
              {totalAttachments} عنصر مربوط
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold ${readinessMeta.className}`}
              title={readinessMeta.issues.join('، ') || 'لا توجد ملاحظات'}
            >
              {readinessMeta.icon === 'ready' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              {readinessMeta.label}
            </span>
          </div>
          
          <div className="flex w-full flex-wrap items-center justify-start gap-2 lg:w-auto lg:justify-end">
            {readinessMeta.issues.length > 0 && (
              <button
                onClick={() => handlePrepareTopicForLearner(topic)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                title="فتح الموضوع وتجهيز الدروس والتدريبات المرتبطة للطالب"
              >
                تجهيز للطالب
              </button>
            )}
            <button
              onClick={() => handlePreviewTopic(topic)}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-600 border border-gray-100 hover:bg-slate-100 transition-colors"
              title="معاينة الموضوع كما سيظهر للطالب"
            >
              <Eye size={18} />
              معاينة
            </button>
            <button 
              onClick={() => {
                setAttachingToTopicId(topic.id);
                setIsAttaching(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition-colors"
              title="ربط محتوى"
            >
              <LinkIcon size={18} />
              ربط
            </button>
            <button 
              onClick={() => handleTogglePlatformVisibility(topic)}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${topic.showOnPlatform === false ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-sky-50 text-sky-700 hover:bg-sky-100'}`}
              title={topic.showOnPlatform === false ? 'إظهار الموضوع على المنصة' : 'إخفاء الموضوع عن المنصة'}
            >
              {topic.showOnPlatform === false ? <Lock size={18} /> : <LockOpen size={18} />}
              {topic.showOnPlatform === false ? 'إظهار' : 'إخفاء'}
            </button>
            <button
              onClick={() => handleToggleTopicLock(topic)}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${topic.isLocked ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
              title={topic.isLocked ? 'جعله مجانيًا للطلاب' : 'جعله ضمن باقة التأسيس'}
            >
              {topic.isLocked ? <Lock size={18} /> : <LockOpen size={18} />}
              {topic.isLocked ? 'مجاني' : 'ضمن باقة'}
            </button>
            <button 
              onClick={() => handleCreateNew(topic.id)}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-emerald-600 border border-emerald-100 hover:bg-emerald-50 transition-colors"
              title="إضافة موضوع فرعي"
            >
              <Plus size={18} />
              فرعي
            </button>
            <button 
              onClick={() => {
                setEditingTopic(topic);
                setIsEditing(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-600 border border-blue-100 hover:bg-blue-50 transition-colors"
            >
              <Edit2 size={18} />
              تعديل
            </button>
            <button 
              onClick={() => handleDelete(topic.id)}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-600 border border-red-100 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={18} />
              حذف
            </button>
          </div>
        </div>

        {/* Attachments */}
        {(attachedLessons.length > 0 || attachedQuizzes.length > 0 || attachedLibraryItems.length > 0) && (
          <div className="px-12 py-3 bg-white border-t border-gray-50 flex flex-wrap gap-2">
            {attachedLessons.map(lesson => (
              <div key={lesson.id} className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm border border-blue-100">
                <BookOpen size={14} />
                <span className="truncate max-w-[150px]">{lesson.title}</span>
                <button
                  onClick={() => handlePreviewAttachment(topic, lesson, 'lesson')}
                  className="text-blue-400 hover:text-blue-700"
                  title="معاينة الدرس"
                >
                  <Eye size={14} />
                </button>
                <button onClick={() => handleRemoveAttachment(topic.id, lesson.id, 'lesson')} className="text-blue-400 hover:text-blue-600">
                  <X size={14} />
                </button>
              </div>
            ))}
            {attachedQuizzes.map(quiz => (
              <div key={quiz.id} className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-sm border border-amber-100">
                <FileQuestion size={14} />
                <span className="truncate max-w-[150px]">{quiz.title}</span>
                <button
                  onClick={() => handlePreviewAttachment(topic, quiz, 'quiz')}
                  className="text-amber-400 hover:text-amber-700"
                  title="معاينة التدريب"
                >
                  <Eye size={14} />
                </button>
                <button onClick={() => handleRemoveAttachment(topic.id, quiz.id, 'quiz')} className="text-amber-400 hover:text-amber-600">
                  <X size={14} />
                </button>
              </div>
            ))}
            {attachedLibraryItems.map(item => (
              <div key={item.id} className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-sm border border-emerald-100">
                <FileText size={14} />
                <span className="truncate max-w-[150px]">{item.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${topic.isLocked ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {topic.isLocked ? 'يتبع باقة الموضوع' : 'يتبع مجانية الموضوع'}
                </span>
                <button
                  onClick={() => handlePreviewAttachment(topic, item, 'support')}
                  className="text-emerald-400 hover:text-emerald-700"
                  title="معاينة ملف الدعم"
                >
                  <Eye size={14} />
                </button>
                <button onClick={() => handleRemoveAttachment(topic.id, item.id, 'support')} className="text-emerald-400 hover:text-emerald-600">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Subtopics */}
        {isExpanded && subtopics.length > 0 && (
          <div className="p-4 bg-white border-t border-gray-50">
            {subtopics.map(st => renderTopic(st, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">إدارة التأسيس (الموضوعات)</h2>
          <p className="text-gray-500 text-sm mt-1">قم ببناء شجرة الموضوعات التأسيسية وربطها بالدروس والتدريبات. هذه المساحة خاصة بالتعلّم وليست مصدر مهارات التقييم والتحليل.</p>
        </div>
        <button 
          onClick={() => handleCreateNew()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          إضافة موضوع رئيسي
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الموضوعات', value: foundationOverview.total, tone: 'text-slate-800 bg-slate-50' },
          { label: 'الظاهر على المنصة', value: foundationOverview.visible, tone: 'text-sky-800 bg-sky-50' },
          { label: 'ضمن باقة التأسيس', value: foundationOverview.locked, tone: 'text-amber-800 bg-amber-50' },
          { label: 'الموارد المربوطة', value: foundationOverview.linkedResources, tone: 'text-indigo-800 bg-indigo-50' },
          { label: 'جاهز للطالب', value: foundationReadinessOverview.ready, tone: 'text-emerald-800 bg-emerald-50' },
          { label: 'يحتاج ضبط', value: foundationReadinessOverview.needsReview, tone: 'text-rose-800 bg-rose-50' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="text-sm font-bold text-gray-500">{item.label}</div>
            <div className={`mt-3 inline-flex rounded-2xl px-4 py-3 text-2xl font-black ${item.tone}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        {mainTopics.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            لا توجد مواضيع تأسيسية بعد. ابدأ بإضافة موضوع رئيسي.
          </div>
        ) : (
          <div>
            {mainTopics.map(topic => renderTopic(topic))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isEditing && editingTopic && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">
              {editingTopic.id ? 'تعديل الموضوع' : 'إضافة موضوع جديد'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">عنوان الموضوع</label>
                <input 
                  type="text" 
                  value={editingTopic.title || ''}
                  onChange={(e) => setEditingTopic({...editingTopic, title: e.target.value})}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="مثال: الكسور العشرية"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الترتيب</label>
                <input 
                  type="number" 
                  value={editingTopic.order || 0}
                  onChange={(e) => setEditingTopic({...editingTopic, order: parseInt(e.target.value)})}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <label className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingTopic.showOnPlatform !== false}
                  onChange={(e) => setEditingTopic({ ...editingTopic, showOnPlatform: e.target.checked })}
                  className="w-5 h-5 text-indigo-600 rounded"
                />
                <span className="font-medium text-gray-700">إظهار هذا الموضوع على المنصة</span>
              </label>
              <label className="flex items-center gap-3 bg-amber-50 p-3 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingTopic.isLocked === true}
                  onChange={(e) => setEditingTopic({ ...editingTopic, isLocked: e.target.checked })}
                  className="w-5 h-5 text-amber-600 rounded"
                />
                <span className="font-medium text-gray-700">جعل هذا الموضوع ضمن باقة التأسيس بدل الفتح المجاني</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button 
                onClick={handleSaveTopic}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
              >
                حفظ
              </button>
              <button 
                onClick={() => setIsEditing(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attach Modal */}
      {isAttaching && attachingToTopicId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <h3 className="text-xl font-bold mb-4">ربط محتوى بالموضوع</h3>
            
            <div className="flex gap-2 mb-4">
              <button 
                onClick={() => setAttachType('lesson')}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${attachType === 'lesson' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                ربط درس (من المكتبة)
              </button>
              <button 
                onClick={() => setAttachType('quiz')}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${attachType === 'quiz' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                ربط تدريب (من مركز الاختبارات)
              </button>
              <button
                onClick={() => setAttachType('support')}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${attachType === 'support' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                ربط ملف دعم (من المكتبة)
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border border-gray-100 rounded-xl p-2">
              {attachType === 'lesson' ? (
                  <div className="space-y-2">
                  {availableLessons.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">لا توجد دروس في المكتبة المركزية.</p>
                  ) : (
                    availableLessons
                      .filter((lesson) => !topics.find((topic) => topic.id === attachingToTopicId)?.lessonIds.includes(lesson.id))
                      .map(lesson => (
                      <div key={lesson.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-3">
                          <BookOpen size={18} className="text-blue-500" />
                          <div>
                            <span className="font-medium text-gray-800">{lesson.title}</span>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                              {isLessonReadyForLearner(lesson) ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                  <CheckCircle2 size={12} />
                                  جاهز للطالب
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                                  <AlertTriangle size={12} />
                                  سيتم نشره عند الربط
                                </span>
                              )}
                              {lesson.type === 'video' ? (
                                <span className={`rounded-full px-2 py-0.5 ${lesson.videoUrl ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                                  {lesson.videoUrl ? 'به رابط فيديو' : 'بدون رابط فيديو'}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleAttach(lesson.id)}
                          className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg font-bold hover:bg-indigo-100"
                        >
                          اختيار
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : attachType === 'quiz' ? (
                  <div className="space-y-2">
                  {availableQuizzes.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">لا توجد اختبارات في المركز المركزي.</p>
                  ) : (
                    availableQuizzes
                      .filter((quiz) => !topics.find((topic) => topic.id === attachingToTopicId)?.quizIds.includes(quiz.id))
                      .map(quiz => (
                      <div key={quiz.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-3">
                          <FileQuestion size={18} className="text-amber-500" />
                          <div>
                            <span className="font-medium text-gray-800">{quiz.title}</span>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                              {isQuizReadyForLearner(quiz) ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                  <CheckCircle2 size={12} />
                                  جاهز للطالب
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                                  <AlertTriangle size={12} />
                                  سيتم نشره عند الربط
                                </span>
                              )}
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                                {quiz.questionIds?.length || 0} سؤال
                              </span>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleAttach(quiz.id)}
                          className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg font-bold hover:bg-indigo-100"
                        >
                          اختيار
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                  <div className="space-y-2">
                  {availableLibraryItems.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">لا توجد ملفات دعم في المكتبة لهذه المادة.</p>
                  ) : (
                    availableLibraryItems
                      .filter((item) => !topics.find((topic) => topic.id === attachingToTopicId)?.libraryItemIds?.includes(item.id))
                      .map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-3">
                          <FileText size={18} className="text-emerald-500" />
                          <div>
                            <span className="font-medium text-gray-800">{item.title}</span>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                              {item.showOnPlatform !== false && (!item.approvalStatus || item.approvalStatus === 'approved') ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                  <CheckCircle2 size={12} />
                                  جاهز للطالب
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                                  <AlertTriangle size={12} />
                                  سيتم نشره عند الربط
                                </span>
                              )}
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                                {item.size || 'ملف دعم'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAttach(item.id)}
                          className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg font-bold hover:bg-indigo-100"
                        >
                          اختيار
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <button 
              onClick={() => setIsAttaching(false)}
              className="mt-4 w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
