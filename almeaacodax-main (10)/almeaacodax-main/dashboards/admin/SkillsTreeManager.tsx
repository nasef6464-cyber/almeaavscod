import React, { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Video, Lock, Unlock, ChevronDown, ChevronUp, GripVertical, Save, X, Target, Layers, CornerDownLeft, HelpCircle, Link2, FileText, BarChart3 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Lesson, Skill, CategorySection } from '../../types';
import { UnifiedLessonBuilder } from './builders/UnifiedLessonBuilder';
import { normalizeQuestionHtml } from '../../utils/questionHtml';

interface SkillsTreeManagerProps {
  subjectId?: string;
}

export const SkillsTreeManager: React.FC<SkillsTreeManagerProps> = ({ subjectId }) => {
  const {
    paths,
    subjects,
    sections,
    skills,
    lessons,
    questions,
    quizzes,
    libraryItems,
    addSection,
    updateSection,
    deleteSection,
    createSkill,
    updateSkill,
    deleteSkill,
    addLesson,
    updateLesson
  } = useStore();

  const [selectedPathId, setSelectedPathId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjectId || '');
  const [expandedMainSkillId, setExpandedMainSkillId] = useState<string | null>(null);
  const [expandedSubSkillId, setExpandedSubSkillId] = useState<string | null>(null);

  const [isMainSkillModalOpen, setIsMainSkillModalOpen] = useState(false);
  const [editingMainSkill, setEditingMainSkill] = useState<Partial<CategorySection> | null>(null);

  const [isSubSkillModalOpen, setIsSubSkillModalOpen] = useState(false);
  const [editingSubSkill, setEditingSubSkill] = useState<Partial<Skill> | null>(null);
  const [activeMainSkillId, setActiveMainSkillId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState('');

  const [editingLesson, setEditingLesson] = useState<{ mainSkillId: string; subSkillId: string; lesson: Lesson } | null>(null);
  const [isLinkLessonModalOpen, setIsLinkLessonModalOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<{ mainSkillId: string; subSkillId: string } | null>(null);
  const [selectedLessonIdToLink, setSelectedLessonIdToLink] = useState('');

  const filteredSubjects = useMemo(
    () => subjects.filter((subject) => !selectedPathId || subject.pathId === selectedPathId),
    [selectedPathId, subjects]
  );

  const mainSkills = useMemo(
    () => sections.filter((section) => {
      if (subjectId) return section.subjectId === subjectId;
      if (selectedSubjectId) return section.subjectId === selectedSubjectId;
      if (selectedPathId) {
        return filteredSubjects.some((subject) => subject.id === section.subjectId);
      }
      return true;
    }),
    [filteredSubjects, sections, selectedPathId, selectedSubjectId, subjectId]
  );

  const relatedSubSkills = useMemo(
    () => skills.filter((skill) => mainSkills.some((section) => section.id === skill.sectionId)).sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [mainSkills, skills]
  );

  const subSkillsByMainSkill = useMemo(() => {
    const map = new Map<string, Skill[]>();
    mainSkills.forEach((section) => {
      map.set(
        section.id,
        relatedSubSkills.filter((skill) => skill.sectionId === section.id)
      );
    });
    return map;
  }, [mainSkills, relatedSubSkills]);

  const totalLinkedLessons = useMemo(
    () => lessons.filter((lesson) => (lesson.skillIds || []).some((skillId) => relatedSubSkills.some((skill) => skill.id === skillId))).length,
    [lessons, relatedSubSkills]
  );

  const totalLinkedQuestions = useMemo(
    () => questions.filter((question) => (question.skillIds || []).some((skillId) => relatedSubSkills.some((skill) => skill.id === skillId))).length,
    [questions, relatedSubSkills]
  );

  const totalLinkedQuizzes = useMemo(
    () =>
      quizzes.filter((quiz) => {
        const directSkillIds = quiz.skillIds || [];
        const measuredQuestionSkillIds = (quiz.questionIds || []).flatMap((questionId) => {
          const question = questions.find((item) => item.id === questionId);
          return question?.skillIds || [];
        });
        return [...directSkillIds, ...measuredQuestionSkillIds].some((skillId) =>
          relatedSubSkills.some((skill) => skill.id === skillId)
        );
      }).length,
    [quizzes, questions, relatedSubSkills]
  );

  const totalLinkedLibraryItems = useMemo(
    () => libraryItems.filter((item) => (item.skillIds || []).some((skillId) => relatedSubSkills.some((skill) => skill.id === skillId))).length,
    [libraryItems, relatedSubSkills]
  );

  const getSubjectName = (subjectIdValue: string) => subjects.find((subject) => subject.id === subjectIdValue)?.name || 'غير محدد';
  const getPathNameBySubject = (subjectIdValue: string) => {
    const subject = subjects.find((item) => item.id === subjectIdValue);
    return subject ? paths.find((path) => path.id === subject.pathId)?.name || 'غير محدد' : 'غير محدد';
  };

  const getLessonsForSubSkill = (subSkillId: string) => lessons.filter((lesson) => lesson.skillIds?.includes(subSkillId));
  const getQuestionsForSubSkill = (subSkillId: string) => questions.filter((question) => question.skillIds?.includes(subSkillId));
  const getQuizzesForSubSkill = (subSkillId: string) =>
    quizzes.filter((quiz) => {
      if ((quiz.skillIds || []).includes(subSkillId)) return true;
      return (quiz.questionIds || []).some((questionId) => {
        const question = questions.find((item) => item.id === questionId);
        return question?.skillIds?.includes(subSkillId);
      });
    });
  const getLibraryItemsForSubSkill = (subSkillId: string) =>
    libraryItems.filter((item) => item.skillIds?.includes(subSkillId));

  const openAddMainSkillModal = () => {
    setValidationError('');
    setEditingMainSkill({ name: '', subjectId: subjectId || selectedSubjectId });
    setIsMainSkillModalOpen(true);
  };

  const openEditMainSkillModal = (mainSkill: CategorySection) => {
    setValidationError('');
    setEditingMainSkill(mainSkill);
    setIsMainSkillModalOpen(true);
  };

  const handleSaveMainSkill = () => {
    if (!editingMainSkill?.name?.trim()) {
      return;
    }
    const resolvedSubjectId = editingMainSkill.subjectId || subjectId || selectedSubjectId;
    if (!resolvedSubjectId) {
      return;
    }

    if (editingMainSkill.id) {
      updateSection(editingMainSkill.id, { name: editingMainSkill.name, subjectId: resolvedSubjectId });
    } else {
      addSection({
        id: `sec_${Date.now()}`,
        subjectId: resolvedSubjectId,
        name: editingMainSkill.name
      });
    }

    setIsMainSkillModalOpen(false);
    setEditingMainSkill(null);
  };

  const handleDeleteMainSkill = (mainSkillId: string) => {
    if (confirm('هل أنت متأكد من حذف هذه المهارة الرئيسة؟ سيتم حذف المهارات الفرعية التابعة لها أيضًا.')) {
      deleteSection(mainSkillId);
    }
  };

  const openAddSubSkillModal = (mainSkillId: string) => {
    const mainSkill = mainSkills.find((item) => item.id === mainSkillId);
    const subjectIdValue = mainSkill?.subjectId || subjectId || selectedSubjectId;
    const subject = subjects.find((item) => item.id === subjectIdValue);

    setValidationError('');
    setActiveMainSkillId(mainSkillId);
    setEditingSubSkill({
      name: '',
      description: '',
      sectionId: mainSkillId,
      subjectId: subjectIdValue,
      pathId: subject?.pathId || selectedPathId,
      lessonIds: [],
      questionIds: []
    });
    setIsSubSkillModalOpen(true);
  };

  const openEditSubSkillModal = (subSkill: Skill) => {
    setValidationError('');
    setActiveMainSkillId(subSkill.sectionId);
    setEditingSubSkill(subSkill);
    setIsSubSkillModalOpen(true);
  };

  const handleSaveSubSkill = () => {
    if (!editingSubSkill?.name?.trim()) {
      return;
    }
    if (!editingSubSkill.sectionId || !editingSubSkill.subjectId || !editingSubSkill.pathId) {
      return;
    }

    if (editingSubSkill.id) {
      updateSkill(editingSubSkill.id, {
        name: editingSubSkill.name,
        description: editingSubSkill.description,
        sectionId: editingSubSkill.sectionId,
        subjectId: editingSubSkill.subjectId,
        pathId: editingSubSkill.pathId
      });
    } else {
      createSkill({
        id: `sk_${Date.now()}`,
        name: editingSubSkill.name,
        description: editingSubSkill.description,
        sectionId: editingSubSkill.sectionId,
        subjectId: editingSubSkill.subjectId,
        pathId: editingSubSkill.pathId,
        lessonIds: [],
        questionIds: [],
        createdAt: Date.now()
      });
    }

    setIsSubSkillModalOpen(false);
    setEditingSubSkill(null);
    setActiveMainSkillId(null);
  };

  const handleSaveMainSkillWithFeedback = () => {
    if (!editingMainSkill?.name?.trim()) {
      setValidationError('يرجى إدخال اسم المهارة الرئيسة.');
      return;
    }

    const resolvedSubjectId = editingMainSkill.subjectId || subjectId || selectedSubjectId;
    if (!resolvedSubjectId) {
      setValidationError('يرجى اختيار المادة أولًا.');
      return;
    }

    setValidationError('');
    handleSaveMainSkill();
  };

  const handleSaveSubSkillWithFeedback = () => {
    if (!editingSubSkill?.name?.trim()) {
      setValidationError('يرجى إدخال اسم المهارة الفرعية.');
      return;
    }

    if (!editingSubSkill.sectionId || !editingSubSkill.subjectId || !editingSubSkill.pathId) {
      setValidationError('بيانات المهارة غير مكتملة.');
      return;
    }

    setValidationError('');
    handleSaveSubSkill();
  };

  const handleDeleteSubSkill = (subSkillId: string) => {
    if (confirm('هل أنت متأكد من حذف هذه المهارة الفرعية؟')) {
      deleteSkill(subSkillId);
    }
  };

  const openAddLessonModal = (mainSkillId: string, subSkillId: string) => {
    const mainSkill = mainSkills.find((item) => item.id === mainSkillId);
    const subSkill = relatedSubSkills.find((item) => item.id === subSkillId);
    const subject = subjects.find((item) => item.id === mainSkill?.subjectId);

    setEditingLesson({
      mainSkillId,
      subSkillId,
      lesson: {
        id: `lesson_${Date.now()}`,
        title: '',
        pathId: subject?.pathId || subSkill?.pathId || selectedPathId,
        subjectId: mainSkill?.subjectId || subjectId || selectedSubjectId,
        sectionId: mainSkillId,
        type: 'video',
        duration: '0',
        isCompleted: false,
        order: 1,
        skillIds: [subSkillId]
      }
    });
  };

  const openEditLessonModal = (mainSkillId: string, subSkillId: string, lesson: Lesson) => {
    setEditingLesson({ mainSkillId, subSkillId, lesson });
  };

  const handleSaveLesson = (_moduleId: string | undefined, lesson: Lesson) => {
    if (lessons.some((item) => item.id === lesson.id)) {
      updateLesson(lesson.id, lesson);
    } else {
      addLesson(lesson);
    }
    setEditingLesson(null);
  };

  const handleDetachLesson = (subSkillId: string, lesson: Lesson) => {
    updateLesson(lesson.id, {
      skillIds: (lesson.skillIds || []).filter((skillId) => skillId !== subSkillId)
    });
  };

  const openLinkLessonModal = (mainSkillId: string, subSkillId: string) => {
    setLinkTarget({ mainSkillId, subSkillId });
    setSelectedLessonIdToLink('');
    setIsLinkLessonModalOpen(true);
  };

  const linkableLessons = useMemo(() => {
    if (!linkTarget) return [];
    const mainSkill = mainSkills.find((item) => item.id === linkTarget.mainSkillId);
    return lessons.filter((lesson) => {
      if (mainSkill?.subjectId && lesson.subjectId !== mainSkill.subjectId) return false;
      if (mainSkill && lesson.sectionId && lesson.sectionId !== mainSkill.id) return false;
      return !(lesson.skillIds || []).includes(linkTarget.subSkillId);
    });
  }, [lessons, linkTarget, mainSkills]);

  const handleLinkLesson = () => {
    if (!linkTarget || !selectedLessonIdToLink) {
      return;
    }

    const lesson = lessons.find((item) => item.id === selectedLessonIdToLink);
    if (!lesson) {
      return;
    }

    updateLesson(lesson.id, {
      pathId: lesson.pathId || subjects.find((subject) => subject.id === lesson.subjectId)?.pathId,
      sectionId: lesson.sectionId || linkTarget.mainSkillId,
      skillIds: [...new Set([...(lesson.skillIds || []), linkTarget.subSkillId])]
    });

    setIsLinkLessonModalOpen(false);
    setSelectedLessonIdToLink('');
    setLinkTarget(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">مركز المهارات</h2>
          <p className="text-gray-500 text-sm mt-1">المصدر الحقيقي للمهارات في المنصة: المهارات الرئيسة والمهارات الفرعية وربطها بالدروس والأسئلة.</p>
        </div>
        <button
          onClick={openAddMainSkillModal}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus size={18} />
          إضافة مهارة رئيسة
        </button>
      </div>

      {!subjectId && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
          <select
            value={selectedPathId}
            onChange={(e) => {
              setSelectedPathId(e.target.value);
              setSelectedSubjectId('');
            }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1"
          >
            <option value="">كل المسارات</option>
            {paths.map((path) => (
              <option key={path.id} value={path.id}>{path.name}</option>
            ))}
          </select>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1"
            disabled={!selectedPathId}
          >
            <option value="">كل المواد</option>
            {filteredSubjects.map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="text-gray-500 text-sm mb-1">المهارات الرئيسة</div>
          <div className="text-2xl font-bold text-indigo-600">{mainSkills.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="text-gray-500 text-sm mb-1">المهارات الفرعية</div>
          <div className="text-2xl font-bold text-emerald-600">{relatedSubSkills.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="text-gray-500 text-sm mb-1">الدروس المرتبطة</div>
          <div className="text-2xl font-bold text-blue-600">{totalLinkedLessons}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="text-gray-500 text-sm mb-1">الأسئلة المرتبطة</div>
          <div className="text-2xl font-bold text-amber-600">{totalLinkedQuestions}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="text-gray-500 text-sm mb-1">الاختبارات المرتبطة</div>
          <div className="text-2xl font-bold text-purple-600">{totalLinkedQuizzes}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="text-gray-500 text-sm mb-1">ملفات المراجعة</div>
          <div className="text-2xl font-bold text-gray-700">{totalLinkedLibraryItems}</div>
        </div>
      </div>

      <div className="space-y-4">
        {mainSkills.map((mainSkill) => {
          const mainSubSkills = subSkillsByMainSkill.get(mainSkill.id) || [];
          return (
            <div key={mainSkill.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className={`p-4 flex items-center justify-between transition-colors ${expandedMainSkillId === mainSkill.id ? 'bg-indigo-50/50 border-b border-indigo-100' : 'bg-gray-50 hover:bg-gray-100'}`}>
                <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => {
                  setExpandedMainSkillId(expandedMainSkillId === mainSkill.id ? null : mainSkill.id);
                  setExpandedSubSkillId(null);
                }}>
                  <div className="cursor-grab text-gray-400 hover:text-gray-600">
                    <GripVertical size={20} />
                  </div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm bg-indigo-600 text-white">
                    <Target size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{mainSkill.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {mainSubSkills.length} مهارات فرعية · {getSubjectName(mainSkill.subjectId)} · {getPathNameBySubject(mainSkill.subjectId)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => openEditMainSkillModal(mainSkill)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="تعديل">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDeleteMainSkill(mainSkill.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="حذف">
                    <Trash2 size={18} />
                  </button>
                  <button onClick={() => {
                    setExpandedMainSkillId(expandedMainSkillId === mainSkill.id ? null : mainSkill.id);
                    setExpandedSubSkillId(null);
                  }} className={`p-2 rounded-lg transition-colors ml-2 ${expandedMainSkillId === mainSkill.id ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:bg-gray-200'}`}>
                    {expandedMainSkillId === mainSkill.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>
              </div>

              {expandedMainSkillId === mainSkill.id && (
                <div className="p-6 bg-white animate-fade-in">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                      <Layers size={20} className="text-indigo-500" />
                      المهارات الفرعية ({mainSkill.name})
                    </h4>
                    <button
                      onClick={() => openAddSubSkillModal(mainSkill.id)}
                      className="text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors flex items-center gap-2"
                    >
                      <Plus size={16} /> إضافة مهارة فرعية
                    </button>
                  </div>

                  <div className="space-y-4 pl-4 border-r-2 border-indigo-100 mr-2 pr-6">
                    {mainSubSkills.map((subSkill) => {
                      const subSkillLessons = getLessonsForSubSkill(subSkill.id);
                      const subSkillQuestions = getQuestionsForSubSkill(subSkill.id);
                      const subSkillQuizzes = getQuizzesForSubSkill(subSkill.id);
                      const subSkillLibraryItems = getLibraryItemsForSubSkill(subSkill.id);

                      return (
                        <div key={subSkill.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                          <div className="p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setExpandedSubSkillId(expandedSubSkillId === subSkill.id ? null : subSkill.id)}>
                              <CornerDownLeft size={18} className="text-gray-400" />
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-100 text-indigo-600">
                                <Target size={16} />
                              </div>
                              <div>
                                <h5 className="font-bold text-gray-800">{subSkill.name}</h5>
                                <p className="text-xs text-gray-500">
                                  {subSkillLessons.length} درس · {subSkillQuestions.length} سؤال · {subSkillQuizzes.length} اختبار · {subSkillLibraryItems.length} ملف
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEditSubSkillModal(subSkill)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => handleDeleteSubSkill(subSkill.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={16} />
                              </button>
                              <button onClick={() => setExpandedSubSkillId(expandedSubSkillId === subSkill.id ? null : subSkill.id)} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors">
                                {expandedSubSkillId === subSkill.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </div>
                          </div>

                          {expandedSubSkillId === subSkill.id && (
                            <div className="p-4 md:p-5 space-y-5 bg-white border-t border-gray-100">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="border border-gray-100 rounded-xl p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h6 className="font-bold text-gray-800 flex items-center gap-2">
                                      <Video size={16} className="text-indigo-500" />
                                      الدروس المرتبطة
                                    </h6>
                                    <div className="flex gap-2">
                                      <button onClick={() => openLinkLessonModal(mainSkill.id, subSkill.id)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                                        <Link2 size={14} /> ربط درس موجود
                                      </button>
                                      <button onClick={() => openAddLessonModal(mainSkill.id, subSkill.id)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
                                        + إضافة درس جديد
                                      </button>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    {subSkillLessons.length > 0 ? subSkillLessons.map((lesson) => (
                                      <div key={lesson.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="min-w-0">
                                          <div className="text-sm font-bold text-gray-800 truncate">{lesson.title}</div>
                                          <div className="text-xs text-gray-500">{lesson.type === 'video' ? 'فيديو' : lesson.type === 'text' ? 'مقال' : 'اختبار'} · {lesson.duration}</div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button onClick={() => openEditLessonModal(mainSkill.id, subSkill.id, lesson)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                            <Edit2 size={14} />
                                          </button>
                                          <button onClick={() => handleDetachLesson(subSkill.id, lesson)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    )) : (
                                      <div className="text-center py-6 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">لا توجد دروس مرتبطة.</div>
                                    )}
                                  </div>
                                </div>

                                <div className="border border-gray-100 rounded-xl p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h6 className="font-bold text-gray-800 flex items-center gap-2">
                                      <HelpCircle size={16} className="text-amber-500" />
                                      الأسئلة المرتبطة
                                    </h6>
                                    <div className="text-xs font-bold text-amber-600">{subSkillQuestions.length} سؤال</div>
                                  </div>
                                  <div className="space-y-2">
                                    {subSkillQuestions.length > 0 ? subSkillQuestions.slice(0, 8).map((question) => (
                                      <div key={question.id} className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="text-sm text-gray-800 line-clamp-2" dangerouslySetInnerHTML={{ __html: normalizeQuestionHtml(question.text) }} />
                                      </div>
                                    )) : (
                                      <div className="text-center py-6 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">لا توجد أسئلة مرتبطة.</div>
                                    )}
                                    {subSkillQuestions.length > 8 && (
                                      <div className="text-xs text-gray-500 text-center">+ {subSkillQuestions.length - 8} سؤال إضافي</div>
                                    )}
                                  </div>
                                </div>

                                <div className="border border-gray-100 rounded-xl p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h6 className="font-bold text-gray-800 flex items-center gap-2">
                                      <BarChart3 size={16} className="text-purple-500" />
                                      الاختبارات المرتبطة
                                    </h6>
                                    <div className="text-xs font-bold text-purple-600">{subSkillQuizzes.length} اختبار</div>
                                  </div>
                                  <div className="space-y-2">
                                    {subSkillQuizzes.length > 0 ? subSkillQuizzes.slice(0, 6).map((quiz) => (
                                      <div key={quiz.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="min-w-0">
                                          <div className="text-sm font-bold text-gray-800 truncate">{quiz.title}</div>
                                          <div className="text-xs text-gray-500">
                                            {quiz.mode === 'saher' ? 'ساهر' : quiz.mode === 'central' ? 'مركزي' : 'عادي'} · {quiz.questionIds.length} سؤال
                                          </div>
                                        </div>
                                        <span className="px-2 py-1 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-700">
                                          مقاسة
                                        </span>
                                      </div>
                                    )) : (
                                      <div className="text-center py-6 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">لا توجد اختبارات مرتبطة.</div>
                                    )}
                                    {subSkillQuizzes.length > 6 && (
                                      <div className="text-xs text-gray-500 text-center">+ {subSkillQuizzes.length - 6} اختبار إضافي</div>
                                    )}
                                  </div>
                                </div>

                                <div className="border border-gray-100 rounded-xl p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h6 className="font-bold text-gray-800 flex items-center gap-2">
                                      <FileText size={16} className="text-gray-600" />
                                      ملفات المراجعة
                                    </h6>
                                    <div className="text-xs font-bold text-gray-600">{subSkillLibraryItems.length} ملف</div>
                                  </div>
                                  <div className="space-y-2">
                                    {subSkillLibraryItems.length > 0 ? subSkillLibraryItems.slice(0, 6).map((item) => (
                                      <div key={item.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="min-w-0">
                                          <div className="text-sm font-bold text-gray-800 truncate">{item.title}</div>
                                          <div className="text-xs text-gray-500">
                                            {item.type === 'pdf' ? 'PDF' : item.type === 'video' ? 'فيديو' : 'ملف'}
                                          </div>
                                        </div>
                                        <span className="px-2 py-1 rounded-lg text-[11px] font-bold bg-gray-100 text-gray-700">
                                          داعم
                                        </span>
                                      </div>
                                    )) : (
                                      <div className="text-center py-6 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">لا توجد ملفات مراجعة مرتبطة.</div>
                                    )}
                                    {subSkillLibraryItems.length > 6 && (
                                      <div className="text-xs text-gray-500 text-center">+ {subSkillLibraryItems.length - 6} ملف إضافي</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {mainSubSkills.length === 0 && (
                      <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                        لا توجد مهارات فرعية مضافة لهذه المهارة الرئيسة بعد.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {mainSkills.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center text-gray-400">
            لا توجد مهارات رئيسة مطابقة للفلاتر الحالية.
          </div>
        )}
      </div>

      {isMainSkillModalOpen && editingMainSkill && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">{editingMainSkill.id ? 'تعديل المهارة الرئيسة' : 'إضافة مهارة رئيسة'}</h3>
              <button onClick={() => { setValidationError(''); setIsMainSkillModalOpen(false); }} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            {validationError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {validationError}
              </div>
            )}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">اسم المهارة الرئيسة</label>
              <input
                type="text"
                value={editingMainSkill.name || ''}
                onChange={(e) => setEditingMainSkill(prev => prev ? { ...prev, name: e.target.value } : prev)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {!subjectId && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">المادة</label>
                <select
                  value={editingMainSkill.subjectId || selectedSubjectId}
                  onChange={(e) => setEditingMainSkill(prev => prev ? { ...prev, subjectId: e.target.value } : prev)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- اختر المادة --</option>
                  {filteredSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setValidationError(''); setIsMainSkillModalOpen(false); }} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">إلغاء</button>
              <button onClick={handleSaveMainSkillWithFeedback} className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2">
                <Save size={16} /> حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {isSubSkillModalOpen && editingSubSkill && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">{editingSubSkill.id ? 'تعديل المهارة الفرعية' : 'إضافة مهارة فرعية'}</h3>
              <button onClick={() => { setValidationError(''); setIsSubSkillModalOpen(false); }} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            {validationError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {validationError}
              </div>
            )}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">اسم المهارة الفرعية</label>
              <input
                type="text"
                value={editingSubSkill.name || ''}
                onChange={(e) => setEditingSubSkill(prev => prev ? { ...prev, name: e.target.value } : prev)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">وصف مختصر</label>
              <textarea
                value={editingSubSkill.description || ''}
                onChange={(e) => setEditingSubSkill(prev => prev ? { ...prev, description: e.target.value } : prev)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setValidationError(''); setIsSubSkillModalOpen(false); }} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">إلغاء</button>
              <button onClick={handleSaveSubSkillWithFeedback} className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2">
                <Save size={16} /> حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {editingLesson && (
        <UnifiedLessonBuilder
          initialLesson={editingLesson.lesson}
          onSave={handleSaveLesson}
          onCancel={() => setEditingLesson(null)}
        />
      )}

      {isLinkLessonModalOpen && linkTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">ربط درس موجود</h3>
              <button onClick={() => setIsLinkLessonModalOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">اختر الدرس</label>
              <select
                value={selectedLessonIdToLink}
                onChange={(e) => setSelectedLessonIdToLink(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- اختر درسًا --</option>
                {linkableLessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsLinkLessonModalOpen(false)} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">إلغاء</button>
              <button onClick={handleLinkLesson} className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2">
                <Save size={16} /> ربط
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

