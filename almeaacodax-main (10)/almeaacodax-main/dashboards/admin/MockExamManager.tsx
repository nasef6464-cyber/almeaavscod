import React, { useEffect, useMemo, useState } from 'react';
import { Award, Eye, ExternalLink, Filter, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { MockExamSection, Question, Quiz } from '../../types';
import { getMockExamQuestionCount, getMockExamSections, isPathMockExam } from '../../utils/mockExam';
import { normalizeQuestionHtml } from '../../utils/questionHtml';
import { getDefaultQuizSettings } from '../../utils/quizSettings';

type DraftSection = MockExamSection;

const createSection = (title: string, subjectId = '', order = 0): DraftSection => ({
  id: `mock_sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  title,
  subjectId,
  questionIds: [],
  timeLimit: 30,
  order,
});

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)));
const plainQuestionText = (value?: string | null) => normalizeQuestionHtml(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export const MockExamManager: React.FC = () => {
  const { paths, subjects, questions, quizzes, skills, addQuiz, updateQuiz, deleteQuiz } = useStore();
  const [selectedPathId, setSelectedPathId] = useState(paths[0]?.id || '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const [title, setTitle] = useState('اختبار محاكي جديد');
  const [description, setDescription] = useState('تجربة محاكية على مستوى المسار.');
  const [passingScore, setPassingScore] = useState(60);
  const [accessType, setAccessType] = useState<Quiz['access']['type']>('free');
  const [accessPrice, setAccessPrice] = useState(99);
  const [sections, setSections] = useState<DraftSection[]>([]);
  const [questionSearchTerm, setQuestionSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | Question['difficulty']>('all');
  const [skillFilter, setSkillFilter] = useState('');

  useEffect(() => {
    if (!selectedPathId && paths[0]?.id) {
      setSelectedPathId(paths[0].id);
    }
  }, [paths, selectedPathId]);

  const pathSubjects = useMemo(
    () => subjects.filter((subject) => subject.pathId === selectedPathId),
    [selectedPathId, subjects],
  );
  const pathQuestions = useMemo(
    () => questions.filter((question) => question.pathId === selectedPathId || pathSubjects.some((subject) => subject.id === question.subject)),
    [pathSubjects, questions, selectedPathId],
  );
  const pathSkills = useMemo(
    () => skills.filter((skill) => skill.pathId === selectedPathId || pathSubjects.some((subject) => subject.id === skill.subjectId)),
    [pathSubjects, selectedPathId, skills],
  );
  const mockExams = useMemo(
    () => quizzes.filter((quiz) => isPathMockExam(quiz, selectedPathId)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [quizzes, selectedPathId],
  );
  const filterQuestionsForSection = (section: DraftSection) => {
    const search = questionSearchTerm.trim().toLowerCase();
    return pathQuestions.filter((question) => {
      const subjectMatches = !section.subjectId || question.subject === section.subjectId;
      const difficultyMatches = difficultyFilter === 'all' || question.difficulty === difficultyFilter;
      const skillMatches = !skillFilter || (question.skillIds || []).includes(skillFilter);
      const text = `${plainQuestionText(question.text)} ${question.id}`.toLowerCase();
      const searchMatches = !search || text.includes(search);
      return subjectMatches && difficultyMatches && skillMatches && searchMatches;
    });
  };

  const resetDraft = () => {
    setEditingId(null);
    setTitle('اختبار محاكي جديد');
    setDescription('تجربة محاكية على مستوى المسار.');
    setPassingScore(60);
    setAccessType('free');
    setAccessPrice(99);
    setSections(pathSubjects.slice(0, 2).map((subject, index) => createSection(subject.name, subject.id, index)));
  };

  const loadExam = (quiz: Quiz) => {
    setEditingId(quiz.id);
    setSelectedPathId(quiz.mockExam?.pathId || quiz.pathId);
    setTitle(quiz.title);
    setDescription(quiz.description || '');
    setPassingScore(quiz.settings?.passingScore || 60);
    setAccessType(quiz.access?.type || 'free');
    setAccessPrice(quiz.access?.price || 99);
    setSections(getMockExamSections(quiz));
  };

  const toggleQuestion = (sectionId: string, questionId: string) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        const exists = section.questionIds.includes(questionId);
        return {
          ...section,
          questionIds: exists
            ? section.questionIds.filter((id) => id !== questionId)
            : [...section.questionIds, questionId],
        };
      }),
    );
  };

  const fillSectionFromSubject = (sectionId: string) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        const pool = pathQuestions.filter((question) => !section.subjectId || question.subject === section.subjectId);
        return { ...section, questionIds: unique([...section.questionIds, ...pool.slice(0, 20).map((question) => question.id)]) };
      }),
    );
  };

  const saveExam = () => {
    const now = Date.now();
    const cleanSections = sections
      .map((section, index) => ({ ...section, order: index, questionIds: unique(section.questionIds) }))
      .filter((section) => section.title.trim() && section.questionIds.length > 0);
    const allQuestionIds = unique(cleanSections.flatMap((section) => section.questionIds));
    const firstSubjectId = cleanSections[0]?.subjectId || pathSubjects[0]?.id || 'mock_exam';

    const payload: Quiz = {
      id: editingId || `mock_exam_${now}`,
      title: title.trim() || 'اختبار محاكي',
      description,
      pathId: selectedPathId,
      subjectId: firstSubjectId,
      type: 'quiz',
      placement: 'mock',
      showInTraining: false,
      showInMock: false,
      mode: 'saher',
      settings: {
        ...getDefaultQuizSettings({ mode: 'saher', mockExam: true }),
        passingScore,
        timeLimit: cleanSections.reduce((sum, section) => sum + (Number(section.timeLimit) || 0), 0) || 60,
      },
      access: {
        type: accessType,
        price: accessType === 'paid' ? accessPrice : undefined,
        allowedGroupIds: [],
      },
      questionIds: allQuestionIds,
      mockExam: { enabled: true, pathId: selectedPathId, sections: cleanSections },
      createdAt: now,
      isPublished: true,
      showOnPlatform: true,
      approvalStatus: 'approved',
      approvedAt: now,
    };

    if (editingId) {
      updateQuiz(editingId, payload);
    } else {
      addQuiz(payload);
    }
    resetDraft();
  };

  const handlePreviewQuiz = (quiz: Quiz) => {
    setPreviewQuiz(quiz);
  };

  const getPreviewSubjectNames = (quiz: Quiz) =>
    getMockExamSections(quiz)
      .map((section) => subjects.find((subject) => subject.id === section.subjectId)?.name || '')
      .filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
              <Award size={16} />
              مركز مستقل للمحاكيات
            </div>
            <h2 className="mt-3 text-2xl font-black text-gray-900">مركز الاختبارات المحاكية</h2>
            <p className="mt-2 text-sm font-bold leading-7 text-gray-500">
              الاختبار هنا على مستوى المسار، وأقسامه تسحب الأسئلة من مركز الأسئلة فقط. نفس السؤال يمكن استخدامه في أكثر من اختبار.
            </p>
          </div>
          <select
            value={selectedPathId}
            onChange={(event) => {
              setSelectedPathId(event.target.value);
              setEditingId(null);
            }}
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold"
          >
            {paths.map((path) => (
              <option key={path.id} value={path.id}>{path.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-black text-gray-900">{editingId ? 'تعديل محاكاة' : 'إنشاء محاكاة'}</h3>
            <button onClick={resetDraft} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-black text-gray-700">
              جديد
            </button>
          </div>

          <div className="space-y-4">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 font-bold" placeholder="عنوان الاختبار" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-20 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" placeholder="وصف مختصر" />
            <label className="block text-xs font-black text-gray-500">نسبة النجاح</label>
            <input type="number" min={0} max={100} value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value) || 0)} className="w-full rounded-xl border border-gray-200 px-4 py-3 font-bold" />

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-black text-gray-500">نوع الوصول</label>
                <select
                  value={accessType}
                  onChange={(e) => setAccessType(e.target.value as Quiz['access']['type'])}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 font-bold"
                >
                  <option value="free">مجاني للجميع</option>
                  <option value="paid">ضمن باقة الاختبارات</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-black text-gray-500">سعر فردي اختياري</label>
                <input
                  type="number"
                  min={0}
                  value={accessPrice}
                  onChange={(e) => setAccessPrice(Number(e.target.value) || 0)}
                  disabled={accessType !== 'paid'}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 font-bold disabled:cursor-not-allowed disabled:bg-gray-100"
                  placeholder="99"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h4 className="font-black text-gray-900">الأقسام</h4>
              <button
                onClick={() => setSections((prev) => [...prev, createSection(`قسم ${prev.length + 1}`, pathSubjects[prev.length]?.id || '', prev.length)])}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white"
              >
                <Plus size={16} />
                إضافة قسم
              </button>
            </div>

            {sections.length === 0 ? (
              <button onClick={resetDraft} className="w-full rounded-xl border border-dashed border-gray-300 py-8 text-sm font-black text-gray-500">
                تجهيز أقسام من مواد المسار
              </button>
            ) : (
              <div className="space-y-4">
                {sections.map((section, index) => {
                  const sectionQuestions = pathQuestions.filter((question) => !section.subjectId || question.subject === section.subjectId);
                  return (
                    <div key={section.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={section.title}
                          onChange={(e) => setSections((prev) => prev.map((item) => item.id === section.id ? { ...item, title: e.target.value } : item))}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold"
                          placeholder="اسم القسم"
                        />
                        <select
                          value={section.subjectId || ''}
                          onChange={(e) => setSections((prev) => prev.map((item) => item.id === section.id ? { ...item, subjectId: e.target.value, questionIds: [] } : item))}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold"
                        >
                          <option value="">كل مواد المسار</option>
                          {pathSubjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>{subject.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <input
                          type="number"
                          min={5}
                          value={section.timeLimit || 30}
                          onChange={(e) => setSections((prev) => prev.map((item) => item.id === section.id ? { ...item, timeLimit: Number(e.target.value) || 30 } : item))}
                          className="w-28 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold"
                        />
                        <span className="text-xs font-bold text-gray-500">دقيقة</span>
                        <button onClick={() => fillSectionFromSubject(section.id)} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                          اختيار أول 20 سؤال
                        </button>
                        <button onClick={() => setSections((prev) => prev.filter((item) => item.id !== section.id))} className="mr-auto rounded-xl bg-red-50 p-2 text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="mt-3 text-xs font-bold text-gray-500">
                        القسم {index + 1}: {section.questionIds.length} سؤال مختار من {sectionQuestions.length}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={saveExam}
              disabled={!selectedPathId || sections.every((section) => section.questionIds.length === 0)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={18} />
              حفظ الاختبار المحاكي
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black text-gray-900">أسئلة مركز الأسئلة</h3>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                  {pathQuestions.length} سؤال في المسار
                </span>
              </div>
              <div className="grid gap-2 md:grid-cols-[1.2fr_0.8fr_1fr]">
                <label className="relative block">
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={questionSearchTerm}
                    onChange={(event) => setQuestionSearchTerm(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-3 pr-9 text-sm font-bold outline-none focus:border-indigo-300 focus:bg-white"
                    placeholder="ابحث في نص السؤال..."
                  />
                </label>
                <label className="relative block">
                  <Filter size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select
                    value={difficultyFilter}
                    onChange={(event) => setDifficultyFilter(event.target.value as 'all' | Question['difficulty'])}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-3 pr-9 text-sm font-bold outline-none focus:border-indigo-300 focus:bg-white"
                  >
                    <option value="all">كل الصعوبات</option>
                    <option value="Easy">سهل</option>
                    <option value="Medium">متوسط</option>
                    <option value="Hard">صعب</option>
                  </select>
                </label>
                <select
                  value={skillFilter}
                  onChange={(event) => setSkillFilter(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-bold outline-none focus:border-indigo-300 focus:bg-white"
                >
                  <option value="">كل المهارات</option>
                  {pathSkills.map((skill) => (
                    <option key={skill.id} value={skill.id}>{skill.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="max-h-[520px] space-y-4 overflow-y-auto pr-1">
              {sections.map((section) => {
                const pool = filterQuestionsForSection(section);
                return (
                  <div key={section.id} className="rounded-2xl border border-gray-100 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="font-black text-indigo-700">{section.title}</h4>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-black text-gray-600">
                        ظاهر الآن: {pool.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {pool.slice(0, 80).map((question: Question) => (
                        <label key={question.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm hover:bg-white">
                          <input
                            type="checkbox"
                            checked={section.questionIds.includes(question.id)}
                            onChange={() => toggleQuestion(section.id, question.id)}
                            className="mt-1"
                          />
                          <span className="line-clamp-2 flex-1 font-bold text-gray-700">
                            {plainQuestionText(question.text) || question.imageUrl || question.id}
                          </span>
                          <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-black text-gray-500">
                            {question.difficulty}
                          </span>
                        </label>
                      ))}
                      {pool.length === 0 && (
                        <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs font-bold text-gray-400">
                          لا توجد أسئلة لهذه المادة بعد.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-black text-gray-900">المحاكيات الحالية</h3>
            <div className="space-y-3">
              {mockExams.map((quiz) => (
                <div key={quiz.id} className="flex flex-col gap-3 rounded-2xl border border-gray-100 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="font-black text-gray-900">{quiz.title}</h4>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-gray-500">
                      <span className="rounded-full bg-gray-100 px-3 py-1">{getMockExamSections(quiz).length} قسم</span>
                      <span className="rounded-full bg-gray-100 px-3 py-1">{getMockExamQuestionCount(quiz)} سؤال</span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">من مركز الأسئلة</span>
                      <span className={`rounded-full px-3 py-1 ${quiz.access?.type === 'paid' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {quiz.access?.type === 'paid' ? `ضمن باقة الاختبارات${quiz.access?.price ? ` • ${quiz.access.price} ر.س` : ''}` : 'مفتوح مجاني'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handlePreviewQuiz(quiz)} className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-black text-violet-700">
                      معاينة
                    </button>
                    <button onClick={() => loadExam(quiz)} className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">
                      تعديل
                    </button>
                    <button onClick={() => updateQuiz(quiz.id, { showOnPlatform: quiz.showOnPlatform === false })} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-black text-gray-700">
                      {quiz.showOnPlatform === false ? 'إظهار' : 'إخفاء'}
                    </button>
                    <button onClick={() => deleteQuiz(quiz.id)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600">
                      حذف
                    </button>
                  </div>
                </div>
              ))}
              {mockExams.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm font-bold text-gray-400">
                  لا توجد محاكيات لهذا المسار بعد.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {previewQuiz ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 py-6" onClick={() => setPreviewQuiz(null)}>
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[32px] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">
                  <Eye size={14} />
                  معاينة الاختبار المحاكي
                </div>
                <h3 className="mt-3 text-2xl font-black text-gray-900">{previewQuiz.title}</h3>
                <p className="mt-2 text-sm leading-7 text-gray-500">
                  هذه المعاينة تعرض شكل الاختبار المحاكي قبل فتحه للطلاب، وتوضح الأقسام والمواد وعدد الأسئلة والوقت بصورة سريعة وواضحة.
                </p>
              </div>
              <button
                onClick={() => setPreviewQuiz(null)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                aria-label="إغلاق المعاينة"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="text-xs font-black text-slate-500">المسار</div>
                <div className="mt-2 text-sm font-black text-slate-900">{paths.find((path) => path.id === previewQuiz.pathId)?.name || 'غير محدد'}</div>
              </div>
              <div className="rounded-2xl bg-indigo-50 px-4 py-4">
                <div className="text-xs font-black text-indigo-500">عدد الأقسام</div>
                <div className="mt-2 text-sm font-black text-indigo-900">{getMockExamSections(previewQuiz).length} قسم</div>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-4 py-4">
                <div className="text-xs font-black text-emerald-500">عدد الأسئلة</div>
                <div className="mt-2 text-sm font-black text-emerald-900">{getMockExamQuestionCount(previewQuiz)} سؤال</div>
              </div>
              <div className="rounded-2xl bg-amber-50 px-4 py-4">
                <div className="text-xs font-black text-amber-500">الوقت الكلي</div>
                <div className="mt-2 text-sm font-black text-amber-900">
                  {getMockExamSections(previewQuiz).reduce((sum, section) => sum + (Number(section.timeLimit) || 0), 0) || previewQuiz.settings?.timeLimit || 60} دقيقة
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                <div className="flex flex-wrap gap-3 text-xs font-black">
                  <span className="rounded-full bg-white px-3 py-2 text-slate-700">
                    الظهور: {previewQuiz.showOnPlatform === false ? 'مخفي عن المنصة' : 'ظاهر على المنصة'}
                  </span>
                  <span className="rounded-full bg-white px-3 py-2 text-slate-700">
                    الاعتماد: {previewQuiz.approvalStatus === 'approved' ? 'معتمد' : previewQuiz.approvalStatus === 'rejected' ? 'مرفوض' : 'مسودة'}
                  </span>
                  <span className="rounded-full bg-white px-3 py-2 text-slate-700">
                    الوصول: {previewQuiz.access?.type === 'paid' ? `ضمن باقة الاختبارات${previewQuiz.access?.price ? ` • ${previewQuiz.access.price} ر.س` : ''}` : 'مجاني'}
                  </span>
                  <span className="rounded-full bg-white px-3 py-2 text-slate-700">
                    المصدر: من بنك الأسئلة
                  </span>
                </div>

                {previewQuiz.description ? (
                  <p className="mt-4 text-sm leading-7 text-slate-600">{previewQuiz.description}</p>
                ) : null}

                <div className="mt-5">
                  <div className="text-sm font-black text-slate-900">المواد الداخلة في المحاكاة</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Array.from(new Set(getPreviewSubjectNames(previewQuiz))).length > 0 ? (
                      Array.from(new Set(getPreviewSubjectNames(previewQuiz))).map((name) => (
                        <span key={name} className="rounded-full bg-white px-3 py-2 text-xs font-black text-indigo-700 shadow-sm">
                          {name}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500 shadow-sm">لم يتم ربط مواد بعد</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {getMockExamSections(previewQuiz).map((section, index) => {
                  const linkedSubject = subjects.find((subject) => subject.id === section.subjectId);
                  const sectionQuestions = (section.questionIds || [])
                    .map((questionId) => questions.find((question) => question.id === questionId))
                    .filter(Boolean) as Question[];
                  return (
                    <div key={section.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-black text-slate-400">القسم {index + 1}</div>
                          <h4 className="mt-1 text-lg font-black text-slate-900">{section.title}</h4>
                          <p className="mt-2 text-xs font-black text-slate-500">
                            {linkedSubject?.name || 'كل مواد المسار'} • {sectionQuestions.length} سؤال • {Number(section.timeLimit) || 0} دقيقة
                          </p>
                        </div>
                        <span className="rounded-full bg-violet-50 px-3 py-2 text-xs font-black text-violet-700">
                          محاكاة
                        </span>
                      </div>

                      <div className="mt-4 space-y-2">
                        {sectionQuestions.slice(0, 4).map((question, questionIndex) => (
                          <div key={question.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                            <div className="text-[11px] font-black text-slate-400">سؤال {questionIndex + 1}</div>
                            <div className="mt-1 line-clamp-2 text-sm font-bold leading-7 text-slate-700">
                              {plainQuestionText(question.text) || question.imageUrl || question.id}
                            </div>
                          </div>
                        ))}
                        {sectionQuestions.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-xs font-black text-slate-400">
                            هذا القسم ما زال بدون أسئلة فعلية.
                          </div>
                        ) : null}
                        {sectionQuestions.length > 4 ? (
                          <div className="text-xs font-black text-slate-400">
                            + {sectionQuestions.length - 4} سؤال إضافي داخل هذا القسم
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => window.open(`${window.location.origin}/#/quiz/${previewQuiz.id}`, '_blank', 'noopener,noreferrer')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white"
                >
                  <ExternalLink size={16} />
                  فتح نسخة الطالب
                </button>
                <button
                  onClick={() => setPreviewQuiz(null)}
                  className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MockExamManager;
