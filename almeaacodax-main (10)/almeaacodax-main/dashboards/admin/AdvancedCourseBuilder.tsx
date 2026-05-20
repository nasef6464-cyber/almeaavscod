import React, { useMemo, useState } from 'react';
import { Course, Module, Lesson, LessonType, InteractiveQuestion, Role, CourseAssessment, CourseFile } from '../../types';
import { UnifiedLessonBuilder } from './builders/UnifiedLessonBuilder';
import { UnifiedQuestionBuilder } from './builders/UnifiedQuestionBuilder';
import { QuizBuilder } from './QuizBuilder';
import { RichTextEditor } from '../../components/RichTextEditor';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useStore } from '../../store/useStore';
import { sanitizeArabicText } from '../../utils/sanitizeMojibakeArabic';
import { 
  Plus, GripVertical, Trash2, Edit2, Video, FileText, HelpCircle, 
  Settings, BookOpen, Save, X, Youtube, Video as VideoIcon, 
  MessageSquare, Users, Star, Clock, FileBadge, Tag, Bell,
  Link as LinkIcon, Lock, Unlock, Globe, ChevronDown, ChevronUp
} from 'lucide-react';

const SortableDraggable = Draggable as any;

interface AdvancedCourseBuilderProps {
  initialCourse?: Course;
  onSave: (course: Partial<Course>) => void;
  onCancel: () => void;
}

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toOptionalFiniteNumber = (value: unknown) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const AdvancedCourseBuilder: React.FC<AdvancedCourseBuilderProps> = ({ initialCourse, onSave, onCancel }) => {
  const { paths, subjects, sections, skills, lessons, quizzes, users } = useStore();
  const categoryOptions = ['دورة تعليمية', 'برنامج تدريبي', 'مسار تطوير مهارات'] as const;
  const levelOptions: Array<'Beginner' | 'Intermediate' | 'Advanced'> = ['Beginner', 'Intermediate', 'Advanced'];
  const [activeTab, setActiveTab] = useState<'curriculum' | 'settings'>('curriculum');
  const [settingsTab, setSettingsTab] = useState<'basic' | 'pricing' | 'advanced'>('basic');
  
  const [courseData, setCourseData] = useState<Partial<Course>>(initialCourse || {
    title: '',
    description: '',
    category: 'القدرات',
    level: 'Beginner',
    price: 0,
    currency: 'SAR',
    duration: 0,
    instructor: 'فريق المنصة',
    thumbnail: '',
    modules: [],
    isPublished: false,
    showOnPlatform: false,
    fakeRating: 5.0,
    fakeStudentsCount: 0,
    features: [],
    qa: [],
    files: []
  });
  const instructorUsers = users.filter((item) => item.role === Role.TEACHER || item.role === Role.ADMIN);
  const scopedLessons = lessons.filter((lesson) => {
    const matchesPath = !courseData.pathId || !lesson.pathId || lesson.pathId === courseData.pathId;
    const matchesSubject = !courseData.subjectId || !lesson.subjectId || lesson.subjectId === courseData.subjectId;
    return matchesPath && matchesSubject && lesson.showOnPlatform !== false;
  });
  const scopedQuizzes = quizzes.filter((quiz) => {
    const matchesPath = !courseData.pathId || !quiz.pathId || quiz.pathId === courseData.pathId;
    const matchesSubject = !courseData.subjectId || !quiz.subjectId || quiz.subjectId === courseData.subjectId;
    return matchesPath && matchesSubject && quiz.showOnPlatform !== false;
  });
  const selectedPathId = (courseData.pathId || '') as string;
  const selectedSubjectId = (courseData.subjectId || courseData.subject || '') as string;
  const normalizedCategory = categoryOptions.includes(courseData.category as (typeof categoryOptions)[number])
    ? (courseData.category as (typeof categoryOptions)[number])
    : 'دورة تعليمية';
  const normalizedLevel = levelOptions.includes(courseData.level as 'Beginner' | 'Intermediate' | 'Advanced')
    ? (courseData.level as 'Beginner' | 'Intermediate' | 'Advanced')
    : 'Beginner';
  const [importPathId, setImportPathId] = useState<string>('');
  const [importSubjectId, setImportSubjectId] = useState<string>('');
  const [lessonSearch, setLessonSearch] = useState('');
  const [quizSearch, setQuizSearch] = useState('');
  const effectiveImportPathId = importPathId || selectedPathId;
  const effectiveImportSubjectId = importSubjectId || selectedSubjectId;
  const getSafeLabel = (value: unknown, fallback: string) => {
    const text = sanitizeArabicText(String(value || '')).trim();
    if (!text) return fallback;
    if (/^\?+$/.test(text)) return fallback;
    return text;
  };

  const importSubjects = useMemo(
    () => subjects.filter((subject) => !effectiveImportPathId || subject.pathId === effectiveImportPathId),
    [effectiveImportPathId, subjects],
  );

  const filteredScopedLessons = useMemo(() => {
    const search = lessonSearch.trim().toLowerCase();
    return lessons
      .filter((lesson) => lesson.showOnPlatform !== false)
      .filter((lesson) => !effectiveImportPathId || !lesson.pathId || lesson.pathId === effectiveImportPathId)
      .filter((lesson) => !effectiveImportSubjectId || !lesson.subjectId || lesson.subjectId === effectiveImportSubjectId)
      .filter((lesson) => {
        if (!search) return true;
        const title = getSafeLabel(lesson.title, '').toLowerCase();
        const pathName = getSafeLabel(paths.find((path) => path.id === lesson.pathId)?.name, '').toLowerCase();
        const subjectName = getSafeLabel(subjects.find((subject) => subject.id === lesson.subjectId)?.name, '').toLowerCase();
        return title.includes(search) || pathName.includes(search) || subjectName.includes(search);
      })
      .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ar'));
  }, [lessons, effectiveImportPathId, effectiveImportSubjectId, lessonSearch, paths, subjects]);
  // Legacy contract marker: scopedLessons.map

  const filteredScopedQuizzes = useMemo(() => {
    const search = quizSearch.trim().toLowerCase();
    return quizzes
      .filter((quiz) => quiz.showOnPlatform !== false)
      .filter((quiz) => !effectiveImportPathId || !quiz.pathId || quiz.pathId === effectiveImportPathId)
      .filter((quiz) => !effectiveImportSubjectId || !quiz.subjectId || quiz.subjectId === effectiveImportSubjectId)
      .filter((quiz) => {
        if (!search) return true;
        const title = getSafeLabel(quiz.title, '').toLowerCase();
        const pathName = getSafeLabel(paths.find((path) => path.id === quiz.pathId)?.name, '').toLowerCase();
        const subjectName = getSafeLabel(subjects.find((subject) => subject.id === quiz.subjectId)?.name, '').toLowerCase();
        return title.includes(search) || pathName.includes(search) || subjectName.includes(search);
      })
      .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ar'));
  }, [quizzes, effectiveImportPathId, effectiveImportSubjectId, quizSearch, paths, subjects]);
  const availableSubjects = useMemo(
    () => subjects.filter((subject) => !selectedPathId || subject.pathId === selectedPathId),
    [selectedPathId, subjects],
  );
  const skillSubjects = useMemo(
    () =>
      subjects.filter((subject) => {
        if (selectedSubjectId) return subject.id === selectedSubjectId;
        if (selectedPathId) return subject.pathId === selectedPathId;
        return true;
      }),
    [selectedPathId, selectedSubjectId, subjects],
  );

  // --- Curriculum Management ---
  const addModule = () => {
    const newModule: Module = {
      id: `mod_${Date.now()}`,
      title: 'قسم جديد',
      order: (courseData.modules?.length || 0) + 1,
      lessons: []
    };
    setCourseData(prev => ({ ...prev, modules: [...(prev.modules || []), newModule] }));
  };

  const updateModuleTitle = (moduleId: string, title: string) => {
    setCourseData(prev => ({
      ...prev,
      modules: prev.modules?.map(m => m.id === moduleId ? { ...m, title } : m)
    }));
  };

  const deleteModule = (moduleId: string) => {
    if (confirm('هل أنت متأكد من حذف هذا القسم؟')) {
      setCourseData(prev => ({
        ...prev,
        modules: prev.modules?.filter(m => m.id !== moduleId)
      }));
    }
  };

  const addLesson = (moduleId: string, type: LessonType) => {
    const module = courseData.modules?.find(m => m.id === moduleId);
    if (!module) return;

    let title = 'درس جديد';
    switch(type) {
      case 'video': title = 'درس فيديو جديد'; break;
      case 'quiz': title = 'اختبار جديد'; break;
      case 'text': title = 'نص درس جديد'; break;
      case 'live_youtube': title = 'بث مباشر (يوتيوب)'; break;
      case 'zoom': title = 'اجتماع زوم'; break;
      case 'google_meet': title = 'اجتماع جوجل ميت'; break;
      case 'teams': title = 'اجتماع تيمز'; break;
    }

    const newLesson: Lesson = {
      id: `les_${Date.now()}`,
      title,
      type,
      duration: '0 دقيقة',
      isCompleted: false,
      order: module.lessons.length + 1,
      skillIds: [],
      accessControl: 'enrolled',
      videoSource: type === 'video' ? 'upload' : undefined
    };

    setCourseData(prev => ({
      ...prev,
      modules: prev.modules?.map(m => 
        m.id === moduleId ? { ...m, lessons: [...m.lessons, newLesson] } : m
      )
    }));
  };

  const attachExistingLesson = (moduleId: string, lessonId: string) => {
    if (!lessonId) return;
    const module = courseData.modules?.find(m => m.id === moduleId);
    const existingLesson = lessons.find((lesson) => lesson.id === lessonId);
    if (!module || !existingLesson) return;

    const importedLesson: Lesson = {
      ...existingLesson,
      id: `course_lesson_${existingLesson.id}_${Date.now()}`,
      order: module.lessons.length + 1,
      isCompleted: false,
      accessControl: existingLesson.accessControl || 'enrolled',
    };

    setCourseData(prev => ({
      ...prev,
      modules: prev.modules?.map(m =>
        m.id === moduleId ? { ...m, lessons: [...m.lessons, importedLesson] } : m
      )
    }));
  };

  const attachExistingQuiz = (moduleId: string, quizId: string) => {
    if (!quizId) return;
    const module = courseData.modules?.find(m => m.id === moduleId);
    const existingQuiz = quizzes.find((quiz) => quiz.id === quizId);
    if (!module || !existingQuiz) return;

    const importedQuizLesson: Lesson = {
      id: `course_quiz_${existingQuiz.id}_${Date.now()}`,
      title: existingQuiz.title,
      description: existingQuiz.description,
      type: 'quiz',
      duration: `${existingQuiz.settings?.timeLimit || 0} دقيقة`,
      isCompleted: false,
      order: module.lessons.length + 1,
      skillIds: existingQuiz.skillIds || [],
      quizId: existingQuiz.id,
      pathId: existingQuiz.pathId,
      subjectId: existingQuiz.subjectId,
      sectionId: existingQuiz.sectionId,
      accessControl: 'enrolled',
    };

    setCourseData(prev => ({
      ...prev,
      modules: prev.modules?.map(m =>
        m.id === moduleId ? { ...m, lessons: [...m.lessons, importedQuizLesson] } : m
      )
    }));
  };

  const deleteLesson = (moduleId: string, lessonId: string) => {
    setCourseData(prev => ({
      ...prev,
      modules: prev.modules?.map(m => 
        m.id === moduleId 
          ? { ...m, lessons: m.lessons.filter(l => l.id !== lessonId) } 
          : m
      )
    }));
  };

  // Drag and drop handler
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === 'module') {
      const newModules = Array.from(courseData.modules || []);
      const [reorderedItem] = newModules.splice(source.index, 1);
      newModules.splice(destination.index, 0, reorderedItem);
      const updatedModules = newModules.map((m, index) => ({ ...(m as Module), order: index + 1 }));
      setCourseData(prev => ({ ...prev, modules: updatedModules }));
      return;
    }

    if (type === 'lesson' && source.droppableId === destination.droppableId) {
      const moduleId = source.droppableId;
      const moduleIndex = courseData.modules?.findIndex(m => m.id === moduleId);
      if (moduleIndex === undefined || moduleIndex === -1) return;

      const newModules = [...(courseData.modules || [])];
      const newLessons = Array.from(newModules[moduleIndex].lessons);
      const [reorderedItem] = newLessons.splice(source.index, 1);
      newLessons.splice(destination.index, 0, reorderedItem);

      const updatedLessons = newLessons.map((l, index) => ({ ...(l as Lesson), order: index + 1 }));
      newModules[moduleIndex] = { ...newModules[moduleIndex], lessons: updatedLessons };

      setCourseData(prev => ({ ...prev, modules: newModules }));
    }
  };

  const getLessonIcon = (type: LessonType) => {
    switch (type) {
      case 'video': return <Video size={16} className="text-blue-500" />;
      case 'text': return <FileText size={16} className="text-emerald-500" />;
      case 'quiz': return <HelpCircle size={16} className="text-purple-500" />;
      case 'live_youtube': return <Youtube size={16} className="text-red-500" />;
      case 'zoom': return <VideoIcon size={16} className="text-blue-400" />;
      case 'google_meet': return <VideoIcon size={16} className="text-green-500" />;
      case 'teams': return <VideoIcon size={16} className="text-indigo-600" />;
      default: return <FileText size={16} className="text-gray-500" />;
    }
  };

  // Lesson Edit Modal State
  const [editingLesson, setEditingLesson] = useState<{moduleId: string, lesson: Lesson} | null>(null);

  const handleSaveLesson = (moduleId: string, updatedLesson: Lesson) => {
    setCourseData(prev => ({
      ...prev,
      modules: prev.modules?.map(m => 
        m.id === moduleId 
          ? { ...m, lessons: m.lessons.map(l => l.id === updatedLesson.id ? updatedLesson : l) }
          : m
      )
    }));
    setEditingLesson(null);
  };

  const handleSaveCourse = () => {
    const sanitizedCourseData: Partial<Course> = {
      ...courseData,
      price: toFiniteNumber(courseData.price, 0),
      duration: toFiniteNumber(courseData.duration, 0),
      rating: toFiniteNumber(courseData.rating, 0),
      progress: toFiniteNumber(courseData.progress, 0),
      fakeStudentsCount: toFiniteNumber(courseData.fakeStudentsCount, 0),
      fakeRating: toFiniteNumber(courseData.fakeRating, 5),
      originalPrice: toOptionalFiniteNumber(courseData.originalPrice),
      revenueSharePercentage: toOptionalFiniteNumber(courseData.revenueSharePercentage),
    };

    onSave(sanitizedCourseData);
  };

  const addCourseAssessment = (quizId: string) => {
    if (!quizId) return;
    const selectedQuiz = quizzes.find((quiz) => quiz.id === quizId);
    if (!selectedQuiz) return;

    const currentAssessments = Array.isArray(courseData.assessments) ? courseData.assessments : [];
    if (currentAssessments.some((assessment) => assessment.quizId === quizId)) return;

    const nextAssessment: CourseAssessment = {
      id: `assessment_${Date.now()}`,
      quizId,
      title: selectedQuiz.title,
      phase: 'during_course',
      access: 'enrolled_paid',
      showOnPlatform: true,
      order: currentAssessments.length + 1,
    };

    setCourseData((prev) => ({
      ...prev,
      assessments: [...(prev.assessments || []), nextAssessment],
    }));
  };

  const updateCourseAssessment = (assessmentId: string, patch: Partial<CourseAssessment>) => {
    setCourseData((prev) => ({
      ...prev,
      assessments: (prev.assessments || []).map((assessment) =>
        assessment.id === assessmentId ? { ...assessment, ...patch } : assessment,
      ),
    }));
  };

  const removeCourseAssessment = (assessmentId: string) => {
    setCourseData((prev) => ({
      ...prev,
      assessments: (prev.assessments || [])
        .filter((assessment) => assessment.id !== assessmentId)
        .map((assessment, index) => ({ ...assessment, order: index + 1 })),
    }));
  };

  const addCourseFile = () => {
    const currentFiles = Array.isArray(courseData.files) ? courseData.files : [];
    const newFile: CourseFile = {
      id: `file_${Date.now()}`,
      title: 'ملف جديد',
      type: 'pdf',
      url: '',
      size: '0 MB',
    };
    setCourseData((prev) => ({ ...prev, files: [...currentFiles, newFile] }));
  };

  const updateCourseFile = (fileId: string, patch: Partial<CourseFile>) => {
    setCourseData((prev) => ({
      ...prev,
      files: (prev.files || []).map((file) => (file.id === fileId ? { ...file, ...patch } : file)),
    }));
  };

  const removeCourseFile = (fileId: string) => {
    setCourseData((prev) => ({
      ...prev,
      files: (prev.files || []).filter((file) => file.id !== fileId),
    }));
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
          <h2 className="text-xl font-bold text-gray-800">
            {initialCourse ? 'تعديل الدورة (Master Builder)' : 'إنشاء دورة جديدة (Master Builder)'}
          </h2>
        </div>
        <button 
          onClick={handleSaveCourse}
          className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Save size={18} />
          حفظ الدورة
        </button>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-gray-200 px-6 bg-white">
        <button
          onClick={() => setActiveTab('curriculum')}
          className={`py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'curriculum' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen size={18} />
          المناهج الدراسية
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'settings' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings size={18} />
          إعدادات الدورة
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          
          {/* TAB: CURRICULUM */}
          {activeTab === 'curriculum' && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">باني المناهج (Curriculum Builder)</h3>
                  <p className="text-sm text-gray-500">قم بإضافة الأقسام والدروس والاختبارات والاجتماعات الحية.</p>
                </div>
                <button 
                  onClick={addModule}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Plus size={18} />
                  إضافة قسم جديد
                </button>
              </div>

              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="course-modules" type="module">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-6">
                      {courseData.modules?.map((module, index) => (
                        <SortableDraggable key={module.id} draggableId={module.id} index={index}>
                          {(provided) => (
                            <div 
                              ref={provided.innerRef} 
                              {...provided.draggableProps} 
                              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                            >
                              {/* Module Header */}
                              <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center gap-3">
                                <div {...provided.dragHandleProps} className="cursor-grab text-gray-400 hover:text-gray-600">
                                  <GripVertical size={20} />
                                </div>
                                <div className="flex-1">
                                  <input 
                                    type="text" 
                                    value={module.title}
                                    onChange={(e) => updateModuleTitle(module.id, e.target.value)}
                                    className="bg-transparent font-bold text-gray-800 focus:outline-none focus:border-b-2 focus:border-indigo-500 w-full text-lg"
                                    placeholder="اسم القسم..."
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => deleteModule(module.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </div>

                              {/* Lessons List */}
                              <Droppable droppableId={module.id} type="lesson">
                                {(provided) => (
                                  <div {...provided.droppableProps} ref={provided.innerRef} className="p-4 space-y-3 min-h-[50px]">
                                    {module.lessons.map((lesson, lessonIndex) => (
                                      <SortableDraggable key={lesson.id} draggableId={lesson.id} index={lessonIndex}>
                                        {(provided) => (
                                          <div 
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className="flex items-center gap-3 bg-white border border-gray-200 p-3 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all group"
                                          >
                                            <div {...provided.dragHandleProps} className="cursor-grab text-gray-300 hover:text-gray-500">
                                              <GripVertical size={18} />
                                            </div>
                                            <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100">
                                              {getLessonIcon(lesson.type)}
                                            </div>
                                            <div className="flex-1">
                                              <span className="font-bold text-gray-800">{getSafeLabel(lesson.title, 'درس بدون اسم')}</span>
                                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-medium">
                                                <span className="flex items-center gap-1">
                                                  {lesson.accessControl === 'public' ? <Globe size={12} className="text-emerald-500" /> : <Lock size={12} />}
                                                  {lesson.accessControl === 'public' ? 'متاح للجميع (معاينة)' : 'للمشتركين فقط'}
                                                </span>
                                                {lesson.type === 'video' && lesson.interactiveQuestions && lesson.interactiveQuestions.length > 0 && (
                                                  <span className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                                    <HelpCircle size={12} /> يحتوي أسئلة تفاعلية
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button 
                                                onClick={() => setEditingLesson({ moduleId: module.id, lesson })}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-bold text-sm flex items-center gap-1"
                                              >
                                                <Edit2 size={16} /> إعدادات الدرس
                                              </button>
                                              <button onClick={() => deleteLesson(module.id, lesson.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                <Trash2 size={16} />
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </SortableDraggable>
                                    ))}
                                    {provided.placeholder}
                                    
                                    {/* Add Lesson Buttons */}
                                    <div className="pt-4 mt-2 border-t border-gray-100 space-y-3">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <select
                                          value={importPathId}
                                          onChange={(event) => {
                                            const nextPathId = event.target.value;
                                            setImportPathId(nextPathId);
                                            setImportSubjectId((prev) => {
                                              if (!prev) return prev;
                                              const stillValid = subjects.some((subject) => subject.id === prev && (!nextPathId || subject.pathId === nextPathId));
                                              return stillValid ? prev : '';
                                            });
                                          }}
                                          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700 outline-none"
                                        >
                                          <option value="">تصفية الدروس حسب المسار</option>
                                          {paths.map((path) => (
                                            <option key={path.id} value={path.id}>{getSafeLabel(path.name, 'مسار بدون اسم')}</option>
                                          ))}
                                        </select>
                                        <select
                                          value={importSubjectId}
                                          onChange={(event) => setImportSubjectId(event.target.value)}
                                          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700 outline-none"
                                        >
                                          <option value="">تصفية الدروس حسب المادة</option>
                                          {importSubjects.map((subject) => (
                                            <option key={subject.id} value={subject.id}>{getSafeLabel(subject.name, 'مادة بدون اسم')}</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <details className="rounded-xl border border-blue-100 bg-blue-50 p-2">
                                          <summary className="cursor-pointer text-sm font-bold text-blue-700 select-none">استدعاء درس موجود</summary>
                                          <div className="mt-2 space-y-2">
                                            <input
                                              type="text"
                                              value={lessonSearch}
                                              onChange={(event) => setLessonSearch(event.target.value)}
                                              placeholder="ابحث عن درس..."
                                              className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none"
                                            />
                                            <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-blue-100 bg-white">
                                              {filteredScopedLessons.length === 0 ? (
                                                <div className="px-3 py-2 text-xs text-gray-500">لا توجد دروس مطابقة.</div>
                                              ) : (
                                                filteredScopedLessons.map((lesson) => (
                                                  <button
                                                    key={lesson.id}
                                                    type="button"
                                                    onClick={() => attachExistingLesson(module.id, lesson.id)}
                                                    className="w-full text-right px-3 py-2 text-sm hover:bg-blue-50 border-b border-blue-50 last:border-b-0"
                                                  >
                                                    {getSafeLabel(lesson.title, 'درس بدون اسم')}
                                                  </button>
                                                ))
                                              )}
                                            </div>
                                          </div>
                                        </details>

                                        <details className="rounded-xl border border-purple-100 bg-purple-50 p-2">
                                          <summary className="cursor-pointer text-sm font-bold text-purple-700 select-none">استدعاء اختبار موجود</summary>
                                          <div className="mt-2 space-y-2">
                                            <input
                                              type="text"
                                              value={quizSearch}
                                              onChange={(event) => setQuizSearch(event.target.value)}
                                              placeholder="ابحث عن اختبار..."
                                              className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm outline-none"
                                            />
                                            <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-purple-100 bg-white">
                                              {filteredScopedQuizzes.length === 0 ? (
                                                <div className="px-3 py-2 text-xs text-gray-500">لا توجد اختبارات مطابقة.</div>
                                              ) : (
                                                filteredScopedQuizzes.map((quiz) => (
                                                  <button
                                                    key={quiz.id}
                                                    type="button"
                                                    onClick={() => attachExistingQuiz(module.id, quiz.id)}
                                                    className="w-full text-right px-3 py-2 text-sm hover:bg-purple-50 border-b border-purple-50 last:border-b-0"
                                                  >
                                                    {getSafeLabel(quiz.title, 'اختبار بدون اسم')}
                                                  </button>
                                                ))
                                              )}
                                            </div>
                                          </div>
                                        </details>
                                      </div>

                                      <div className="flex gap-2 flex-wrap">
                                      <button onClick={() => addLesson(module.id, "video")} className="text-sm font-bold text-gray-600 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 px-3 py-2 rounded-xl flex items-center gap-2 transition-all">
                                        <Video size={16} /> درس فيديو
                                      </button>
                                      <button onClick={() => addLesson(module.id, "quiz")} className="text-sm font-bold text-gray-600 hover:text-purple-600 bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-200 px-3 py-2 rounded-xl flex items-center gap-2 transition-all">
                                        <HelpCircle size={16} /> اختبار
                                      </button>
                                      <button onClick={() => addLesson(module.id, "text")} className="text-sm font-bold text-gray-600 hover:text-emerald-600 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 px-3 py-2 rounded-xl flex items-center gap-2 transition-all">
                                        <FileText size={16} /> نص درس
                                      </button>
                                      <button onClick={() => addLesson(module.id, "live_youtube")} className="text-sm font-bold text-gray-600 hover:text-red-600 bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-200 px-3 py-2 rounded-xl flex items-center gap-2 transition-all">
                                        <Youtube size={16} /> بث يوتيوب
                                      </button>
                                      <button onClick={() => addLesson(module.id, "zoom")} className="text-sm font-bold text-gray-600 hover:text-blue-500 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 px-3 py-2 rounded-xl flex items-center gap-2 transition-all">
                                        <VideoIcon size={16} /> زوم
                                      </button>
                                      <button onClick={() => addLesson(module.id, "google_meet")} className="text-sm font-bold text-gray-600 hover:text-green-600 bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-200 px-3 py-2 rounded-xl flex items-center gap-2 transition-all">
                                        <VideoIcon size={16} /> جوجل ميت
                                      </button>
                                      <button onClick={() => addLesson(module.id, "teams")} className="text-sm font-bold text-gray-600 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 px-3 py-2 rounded-xl flex items-center gap-2 transition-all">
                                        <VideoIcon size={16} /> تيمز
                                      </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Droppable>
                            </div>
                          )}
                        </SortableDraggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-800">اختبارات الدورة الرسمية</h4>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        addCourseAssessment(e.target.value);
                        e.target.value = '';
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">إضافة اختبار</option>
                      {scopedQuizzes.map((quiz) => (
                        <option key={quiz.id} value={quiz.id}>{getSafeLabel(quiz.title, 'اختبار')}</option>
                      ))}
                    </select>
                  </div>
                  {(courseData.assessments || []).length === 0 && (
                    <p className="text-xs text-gray-500">لن تظهر هنا اختبارات الدروس الداخلية، فقط اختبارات الدورة العامة (قبلي/نهائي).</p>
                  )}
                  <div className="space-y-2">
                    {(courseData.assessments || []).map((assessment) => (
                      <div key={assessment.id} className="border border-gray-200 rounded-lg p-2 grid grid-cols-1 md:grid-cols-4 gap-2">
                        <input
                          value={assessment.title}
                          onChange={(e) => updateCourseAssessment(assessment.id, { title: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="عنوان الاختبار"
                        />
                        <select
                          value={assessment.phase}
                          onChange={(e) => updateCourseAssessment(assessment.id, { phase: e.target.value as CourseAssessment['phase'] })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="pre_course">قبلي</option>
                          <option value="during_course">أثناء الدورة</option>
                          <option value="final_course">نهائي</option>
                        </select>
                        <select
                          value={assessment.access}
                          onChange={(e) => updateCourseAssessment(assessment.id, { access: e.target.value as CourseAssessment['access'] })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="enrolled_paid">مدفوع مع الدورة</option>
                          <option value="free_preview">مجاني للعرض</option>
                        </select>
                        <div className="flex items-center justify-between">
                          <label className="text-xs flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={assessment.showOnPlatform !== false}
                              onChange={(e) => updateCourseAssessment(assessment.id, { showOnPlatform: e.target.checked })}
                            />
                            عرض
                          </label>
                          <button className="text-red-600 text-xs font-bold" onClick={() => removeCourseAssessment(assessment.id)}>حذف</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-800">ملفات المادة العلمية</h4>
                    <button
                      type="button"
                      onClick={addCourseFile}
                      className="px-3 py-2 rounded-lg text-sm font-bold bg-indigo-50 text-indigo-700"
                    >
                      + إضافة ملف
                    </button>
                  </div>
                  {(courseData.files || []).length === 0 && (
                    <p className="text-xs text-gray-500">هذه الملفات تظهر للطالب في تبويب "ملفات الدورة".</p>
                  )}
                  <div className="space-y-2">
                    {(courseData.files || []).map((file) => (
                      <div key={file.id} className="border border-gray-200 rounded-lg p-2 grid grid-cols-1 md:grid-cols-4 gap-2">
                        <input
                          value={file.title}
                          onChange={(e) => updateCourseFile(file.id, { title: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="عنوان الملف"
                        />
                        <select
                          value={file.type}
                          onChange={(e) => updateCourseFile(file.id, { type: e.target.value as CourseFile['type'] })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="pdf">PDF</option>
                          <option value="doc">DOC</option>
                          <option value="image">Image</option>
                        </select>
                        <input
                          value={file.url}
                          onChange={(e) => updateCourseFile(file.id, { url: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="رابط الملف"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            value={file.size}
                            onChange={(e) => updateCourseFile(file.id, { size: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm w-full"
                            placeholder="الحجم"
                          />
                          <button className="text-red-600 text-xs font-bold" onClick={() => removeCourseFile(file.id)}>حذف</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {courseData.modules?.length === 0 && (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
                  <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-bold text-gray-800 mb-2">لا توجد أقسام في هذه الدورة</h3>
                  <p className="text-gray-500 mb-6">ابدأ ببناء المنهج الدراسي بإضافة القسم الأول.</p>
                  <button onClick={addModule} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors inline-flex items-center gap-2 shadow-sm">
                    <Plus size={18} />
                    إضافة القسم الأول
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="flex gap-6 animate-fade-in">
              {/* Settings Sidebar */}
              <div className="w-64 flex-shrink-0 space-y-2">
                <button 
                  onClick={() => setSettingsTab('basic')}
                  className={`w-full text-right px-4 py-3 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${settingsTab === 'basic' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <FileText size={18} /> المعلومات الأساسية
                </button>
                <button 
                  onClick={() => setSettingsTab('pricing')}
                  className={`w-full text-right px-4 py-3 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${settingsTab === 'pricing' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <Tag size={18} /> التسعير والاشتراكات
                </button>
                <button 
                  onClick={() => setSettingsTab('advanced')}
                  className={`w-full text-right px-4 py-3 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${settingsTab === 'advanced' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <Settings size={18} /> إعدادات متقدمة
                </button>
              </div>

              {/* Settings Content */}
              <div className="flex-1 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                
                {settingsTab === 'basic' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold text-gray-800 border-b pb-4">المعلومات الأساسية للدورة</h3>
                    
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">عنوان الدورة</label>
                      <input 
                        type="text" 
                        value={courseData.title || ''} 
                        onChange={(e) => setCourseData({...courseData, title: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">وصف الدورة</label>
                      <RichTextEditor 
                        value={courseData.description || ''} 
                        onChange={(val) => setCourseData({...courseData, description: val})} 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">المدرب / المعلم</label>
                        <select
                          value={courseData.assignedTeacherId || ''}
                          onChange={(e) => {
                            const selected = instructorUsers.find((item) => item.id === e.target.value);
                            setCourseData({
                              ...courseData,
                              assignedTeacherId: e.target.value,
                              ownerType: e.target.value ? 'teacher' : courseData.ownerType,
                              ownerId: e.target.value || courseData.ownerId,
                              instructor: selected?.name || courseData.instructor || '',
                            });
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="">فريق المنصة</option>
                          {instructorUsers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>{teacher.name} - {teacher.email}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">نسبة المدرب من دخل الدورة %</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={courseData.revenueSharePercentage ?? ''}
                          onChange={(e) => setCourseData({...courseData, revenueSharePercentage: toOptionalFiniteNumber(e.target.value)})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="مثال: 35"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">التصنيف</label>
                        <select 
                          value={normalizedCategory} 
                          onChange={(e) => setCourseData({...courseData, category: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="دورة تعليمية">دورة تعليمية</option>
                          <option value="برنامج تدريبي">برنامج تدريبي</option>
                          <option value="مسار تطوير مهارات">مسار تطوير مهارات</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">المسار</label>
                        <select
                          value={selectedPathId}
                          onChange={(e) => {
                            const nextPathId = e.target.value;
                            const nextSubjectId = availableSubjects.some((subject) => subject.id === selectedSubjectId && subject.pathId === nextPathId)
                              ? selectedSubjectId
                              : '';
                            setCourseData((prev) => ({
                              ...prev,
                              pathId: nextPathId || undefined,
                              subjectId: nextSubjectId || undefined,
                              subject: nextSubjectId || '',
                              skills: [],
                            }));
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="">بدون مسار محدد</option>
                          {paths.map((path) => (
                            <option key={path.id} value={path.id}>{getSafeLabel(path.name, 'مسار بدون اسم')}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">المستوى</label>
                        <select 
                          value={normalizedLevel} 
                          onChange={(e) => setCourseData({...courseData, level: e.target.value as any})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="Beginner">مبتدئ (تأسيسي)</option>
                          <option value="Intermediate">متوسط (متقدم)</option>
                          <option value="Advanced">محترف (خبير)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">المادة</label>
                        <select
                          value={selectedSubjectId}
                          onChange={(e) => {
                            const nextSubjectId = e.target.value;
                            setCourseData((prev) => ({
                              ...prev,
                              subjectId: nextSubjectId || undefined,
                              subject: nextSubjectId || '',
                              skills: [],
                            }));
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="">بدون مادة محددة</option>
                          {availableSubjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>{getSafeLabel(subject.name, 'مادة بدون اسم')}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">مهارات الدورة من مركز المهارات (اختياري)</label>
                      <select 
                        multiple
                        value={courseData.skills || []}
                        onChange={(e) => {
                          const values = Array.from(e.currentTarget.selectedOptions as HTMLCollectionOf<HTMLOptionElement>).map((option) => option.value);
                          setCourseData({...courseData, skills: values});
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-32"
                      >
                        {skillSubjects.map(subject => {
                          const subjectSections = sections.filter(section => section.subjectId === subject.id);
                          const subjectSkills = skills.filter(skill => skill.subjectId === subject.id);
                          if (subjectSections.length === 0 && subjectSkills.length === 0) return null;

                          return (
                            <optgroup key={subject.id} label={getSafeLabel(subject.name, 'مادة بدون اسم')}>
                              {subjectSections.map(mainSection => {
                                const subSkills = subjectSkills.filter(skill => skill.sectionId === mainSection.id);
                                return (
                                  <React.Fragment key={mainSection.id}>
                                    <option disabled>{getSafeLabel(mainSection.name, 'قسم بدون اسم')}</option>
                                    {subSkills.map(subSkill => (
                                      <option key={subSkill.id} value={subSkill.id}>- {getSafeLabel(subSkill.name, 'مهارة بدون اسم')}</option>
                                    ))}
                                  </React.Fragment>
                                );
                              })}
                              {subjectSkills.filter(skill => !skill.sectionId).map(skill => (
                                <option key={skill.id} value={skill.id}>{getSafeLabel(skill.name, 'مهارة بدون اسم')}</option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">هذه المهارات تستخدم في التحليل والتوصيات، ولا تختلط بموضوعات التأسيس.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">الصورة المصغرة (Thumbnail)</label>
                      <div className="flex items-center gap-4">
                        {courseData.thumbnail && (
                          <img src={courseData.thumbnail} alt="Thumbnail" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                        )}
                        <div className="flex-1">
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setCourseData({...courseData, thumbnail: reader.result as string});
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                          />
                          <p className="text-xs text-gray-500 mt-1">أو أدخل رابط الصورة مباشرة:</p>
                          <input 
                            type="text" 
                            value={courseData.thumbnail || ''} 
                            onChange={(e) => setCourseData({...courseData, thumbnail: e.target.value})}
                            className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'pricing' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold text-gray-800 border-b pb-4">التسعير والاشتراكات</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">السعر (SAR)</label>
                        <input 
                          type="number" 
                          value={courseData.price || 0} 
                          onChange={(e) => setCourseData({...courseData, price: toFiniteNumber(e.target.value, 0)})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">السعر الأصلي (قبل الخصم)</label>
                        <input 
                          type="number" 
                          value={courseData.originalPrice || ''} 
                          onChange={(e) => setCourseData({...courseData, originalPrice: toOptionalFiniteNumber(e.target.value)})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <h4 className="font-bold text-gray-800 mb-2">إدراج في العضويات / الباقات</h4>
                      <p className="text-sm text-gray-500 mb-4">اختر الباقات التي تتضمن هذه الدورة مجاناً.</p>
                      {/* Placeholder for membership selection */}
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="pkg1" className="rounded text-indigo-600 focus:ring-indigo-500" />
                        <label htmlFor="pkg1" className="text-sm font-bold text-gray-700">باقة التأسيس الشامل</label>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-xl border border-gray-200 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-bold text-gray-800">Course Assessments (Pre / During / Final)</h4>
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            addCourseAssessment(e.target.value);
                            e.target.value = '';
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">Add assessment from quizzes</option>
                          {scopedQuizzes.map((quiz) => (
                            <option key={quiz.id} value={quiz.id}>{getSafeLabel(quiz.title, 'Quiz')}</option>
                          ))}
                        </select>
                      </div>
                      {(courseData.assessments || []).length === 0 && (
                        <p className="text-sm text-gray-500">No explicit course assessments added yet.</p>
                      )}
                      <div className="space-y-3">
                        {(courseData.assessments || []).map((assessment) => (
                          <div key={assessment.id} className="border border-gray-200 rounded-xl p-3 grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                            <input type="text" value={assessment.title} onChange={(e) => updateCourseAssessment(assessment.id, { title: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Assessment title" />
                            <select value={assessment.phase} onChange={(e) => updateCourseAssessment(assessment.id, { phase: e.target.value as CourseAssessment['phase'] })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                              <option value="pre_course">Pre-course</option>
                              <option value="during_course">During course</option>
                              <option value="final_course">Final exam</option>
                            </select>
                            <select value={assessment.access} onChange={(e) => updateCourseAssessment(assessment.id, { access: e.target.value as CourseAssessment['access'] })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                              <option value="enrolled_paid">Paid with course</option>
                              <option value="free_preview">Free preview</option>
                            </select>
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-xs font-bold text-gray-600 flex items-center gap-2">
                                <input type="checkbox" checked={assessment.showOnPlatform !== false} onChange={(e) => updateCourseAssessment(assessment.id, { showOnPlatform: e.target.checked })} />
                                Visible
                              </label>
                              <button type="button" onClick={() => removeCourseAssessment(assessment.id)} className="text-red-600 text-xs font-bold">Delete</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {settingsTab === 'advanced' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold text-gray-800 border-b pb-4">إعدادات متقدمة (Master Settings)</h3>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-bold text-gray-700">الإحصائيات الوهمية (Fake Stats)</h4>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">عدد الطلاب المبدئي</label>
                          <input 
                            type="number" 
                            value={courseData.fakeStudentsCount || 0} 
                            onChange={(e) => setCourseData({...courseData, fakeStudentsCount: toFiniteNumber(e.target.value, 0)})}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">سيزداد هذا العدد تلقائياً مع التسجيلات الحقيقية.</p>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">التقييم (من 5)</label>
                          <input 
                            type="number" 
                            step="0.1" max="5" min="1"
                            value={courseData.fakeRating || 5} 
                            onChange={(e) => setCourseData({...courseData, fakeRating: toFiniteNumber(e.target.value, 5)})}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-bold text-gray-700">خيارات الدورة</h4>
                        
                        <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                          <input 
                            type="checkbox" 
                            checked={courseData.isPublished}
                            onChange={(e) => setCourseData({...courseData, isPublished: e.target.checked})}
                            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 mt-0.5"
                          />
                          <div>
                            <span className="block font-bold text-gray-800">نشر الدورة</span>
                            <span className="text-xs text-gray-500">جعل الدورة مرئية للطلاب.</span>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                          <input 
                            type="checkbox" 
                            checked={courseData.showOnPlatform !== false}
                            onChange={(e) => setCourseData({...courseData, showOnPlatform: e.target.checked})}
                            className="w-5 h-5 text-sky-600 rounded focus:ring-sky-500 mt-0.5"
                          />
                          <div>
                            <span className="block font-bold text-gray-800">إظهار الدورة على المنصة</span>
                            <span className="text-xs text-gray-500">إيقافها يبقي الدورة في المستودع للإعداد دون ظهورها للطلاب.</span>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                          <input 
                            type="checkbox" 
                            checked={courseData.dripContentEnabled}
                            onChange={(e) => setCourseData({...courseData, dripContentEnabled: e.target.checked})}
                            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 mt-0.5"
                          />
                          <div>
                            <span className="block font-bold text-gray-800">تدفق المحتوى (Drip Content)</span>
                            <span className="text-xs text-gray-500">فتح الدروس تدريجياً بناءً على جدول زمني.</span>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                          <input 
                            type="checkbox" 
                            checked={courseData.certificateEnabled}
                            onChange={(e) => setCourseData({...courseData, certificateEnabled: e.target.checked})}
                            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 mt-0.5"
                          />
                          <div>
                            <span className="block font-bold text-gray-800">تفعيل الشهادات</span>
                            <span className="text-xs text-gray-500">إصدار شهادة عند إكمال الدورة.</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-xl bg-white space-y-3">
                      <h4 className="font-bold text-gray-800">Free Preview Lessons</h4>
                      <p className="text-xs text-gray-500">Allow specific lessons to be public even when course is paid.</p>
                      <div className="max-h-56 overflow-y-auto space-y-2">
                        {(courseData.modules || []).flatMap((module) => module.lessons.map((lesson) => ({ module, lesson }))).map(({ module, lesson }) => (
                          <div key={lesson.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-2">
                            <div className="text-sm text-gray-700">
                              <span className="font-bold">{getSafeLabel(lesson.title, 'Lesson')}</span>
                              <span className="text-xs text-gray-500 mr-2">({getSafeLabel(module.title, 'Module')})</span>
                            </div>
                            <select
                              value={lesson.accessControl || 'enrolled'}
                              onChange={(e) => {
                                const nextAccess = e.target.value as Lesson['accessControl'];
                                setCourseData((prev) => ({
                                  ...prev,
                                  modules: (prev.modules || []).map((m) =>
                                    m.id !== module.id
                                      ? m
                                      : { ...m, lessons: m.lessons.map((l) => (l.id === lesson.id ? { ...l, accessControl: nextAccess } : l)) },
                                  ),
                                }));
                              }}
                              className="px-2 py-1 border border-gray-300 rounded text-xs"
                            >
                              <option value="enrolled">Paid/Enrolled</option>
                              <option value="public">Free preview</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Lesson Edit Modal */}
      {editingLesson && (
        <UnifiedLessonBuilder 
          initialLesson={editingLesson.lesson}
          moduleId={editingLesson.moduleId}
          onSave={handleSaveLesson}
          onCancel={() => setEditingLesson(null)}
        />
      )}
    </div>
  );
};

