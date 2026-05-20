import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { Quiz, Question } from '../../types';
import { AlertTriangle, Plus, Search, Edit2, Trash2, Save, X, Settings, Link as LinkIcon, Users, FileQuestion, Filter, CheckCircle2, Lock, LockOpen } from 'lucide-react';
import { UnifiedQuestionBuilder } from './builders/UnifiedQuestionBuilder';
import { getPlacementFromFlags, getQuizPlacementDefaults, normalizeQuizPlacement } from '../../utils/quizPlacement';
import { getDefaultQuizSettings } from '../../utils/quizSettings';
import { normalizeQuestionHtml } from '../../utils/questionHtml';

interface QuizBuilderProps {
  onClose?: () => void;
  initialSubjectId?: string;
  initialQuizId?: string;
  initialType?: 'quiz' | 'bank';
}

const getAccessTypeLabel = (type?: Quiz['access']['type']) => {
  if (type === 'paid') return 'ضمن باقة / يحتاج تفعيل';
  if (type === 'private') return 'خاص بمجموعات محددة';
  if (type === 'course_only') return 'داخل الدورات فقط';
  return 'مجاني';
};

export const QuizBuilder: React.FC<QuizBuilderProps> = ({ onClose, initialSubjectId, initialQuizId, initialType = 'quiz' }) => {
  const { quizzes, addQuiz, updateQuiz, deleteQuiz, questions, subjects, paths, groups, users, addQuestion, sections, skills } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [questionSearchTerm, setQuestionSearchTerm] = useState('');
  const [questionDifficultyFilter, setQuestionDifficultyFilter] = useState<'all' | Question['difficulty']>('all');
  const [questionSkillFilter, setQuestionSkillFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'questions' | 'settings' | 'access'>('info');
  const initialSubject = initialSubjectId ? useStore.getState().subjects.find(subject => subject.id === initialSubjectId) : undefined;
  const builderType: 'quiz' | 'bank' = initialType === 'bank' ? 'bank' : 'quiz';
  
  const [currentQuiz, setCurrentQuiz] = useState<Partial<Quiz>>(() => {
    if (initialQuizId) {
      const existingQuiz = useStore.getState().quizzes.find(q => q.id === initialQuizId);
      if (existingQuiz) return existingQuiz;
    }
    return {
      title: '',
      description: '',
      pathId: initialSubject?.pathId || '',
      subjectId: initialSubjectId || '',
      ...getQuizPlacementDefaults(builderType),
      mode: 'regular',
      settings: getDefaultQuizSettings({ type: builderType }),
      access: {
        type: 'free',
        allowedGroupIds: [],
      },
      questionIds: [],
      targetGroupIds: [],
      targetUserIds: [],
      dueDate: '',
      isPublished: false,
      showOnPlatform: false,
    };
  });

  const [isAutoGenerateModalOpen, setIsAutoGenerateModalOpen] = useState(false);
  const [isAddQuestionModalOpen, setIsAddQuestionModalOpen] = useState(false);
  const [operationError, setOperationError] = useState('');
  const [operationMessage, setOperationMessage] = useState('');
  const [autoGenConfig, setAutoGenConfig] = useState({
    difficulty: { Easy: 3, Medium: 5, Hard: 2 },
    skillIds: [] as string[]
  });

  const [newQuestion, setNewQuestion] = useState<Partial<Question>>({
    text: '',
    options: ['', '', '', ''],
    correctOptionIndex: 0,
    explanation: '',
    difficulty: 'Medium',
    type: 'mcq',
    pathId: currentQuiz.pathId,
    subject: currentQuiz.subjectId,
    skillIds: []
  });
  const availableQuizMainSkills = useMemo(
    () => sections.filter(section => !!currentQuiz.subjectId && section.subjectId === currentQuiz.subjectId),
    [sections, currentQuiz.subjectId]
  );
  const availableQuizSubSkills = useMemo(
    () =>
      skills
        .filter(skill =>
          !!currentQuiz.subjectId &&
          skill.subjectId === currentQuiz.subjectId &&
          (!currentQuiz.sectionId || skill.sectionId === currentQuiz.sectionId)
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [skills, currentQuiz.sectionId, currentQuiz.subjectId]
  );

  useEffect(() => {
    if (!currentQuiz.subjectId) return;

    const currentSubject = subjects.find(subject => subject.id === currentQuiz.subjectId);
    if (!currentSubject) return;

    const nextPathId = currentSubject.pathId;
    const sectionBelongsToSubject = !currentQuiz.sectionId || sections.some(
      section => section.id === currentQuiz.sectionId && section.subjectId === currentQuiz.subjectId
    );
    const filteredAutoGenSkillIds = (autoGenConfig.skillIds || []).filter(skillId =>
      skills.some(
        skill =>
          skill.id === skillId &&
          skill.subjectId === currentQuiz.subjectId &&
          (!currentQuiz.sectionId || skill.sectionId === currentQuiz.sectionId)
      )
    );

    if (currentQuiz.pathId !== nextPathId || !sectionBelongsToSubject) {
      setCurrentQuiz(prev => ({
        ...prev,
        pathId: nextPathId,
        sectionId: sectionBelongsToSubject ? prev.sectionId : '',
      }));
    }

    if (filteredAutoGenSkillIds.length !== (autoGenConfig.skillIds || []).length) {
      setAutoGenConfig(prev => ({ ...prev, skillIds: filteredAutoGenSkillIds }));
    }
  }, [currentQuiz.subjectId, currentQuiz.sectionId, currentQuiz.pathId, autoGenConfig.skillIds, subjects, sections, skills]);

  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const handleCopyLinkWithFeedback = async (text: string) => {
    setOperationError('');
    setOperationMessage('');

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        setOperationMessage('تم نسخ الرابط بنجاح.');
      } catch (error) {
        setOperationError('تعذر نسخ الرابط الآن. جرّب مرة أخرى.');
      }
      return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'absolute';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand('copy');
      setOperationMessage('تم نسخ الرابط بنجاح.');
    } catch (error) {
      setOperationError('تعذر نسخ الرابط الآن. جرّب مرة أخرى.');
    } finally {
      textArea.remove();
    }
  };

  const handleCopyLink = (text: string) => {
    void handleCopyLinkWithFeedback(text);
    return;
  };

  const handleAutoGenerate = async () => {
    await handleAutoGenerateWithFeedback();
    return;
  };

  const handleAutoGenerateWithFeedback = async () => {
    setOperationError('');
    setOperationMessage('');

    let pool = questions;

    if (currentQuiz.pathId) {
      pool = pool.filter(q => q.pathId === currentQuiz.pathId || q.subject === currentQuiz.subjectId);
    }

    if (currentQuiz.subjectId) {
      pool = pool.filter(q => q.subject === currentQuiz.subjectId);
    }

    if (currentQuiz.sectionId) {
      pool = pool.filter(q => q.sectionId === currentQuiz.sectionId);
    }

    if (autoGenConfig.skillIds && autoGenConfig.skillIds.length > 0) {
      pool = pool.filter(q => q.skillIds?.some(id => autoGenConfig.skillIds.includes(id)));
    }

    const selectedIds: string[] = [];
    const pickRandom = (arr: Question[], count: number) => {
      const shuffled = [...arr].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count).map(q => q.id);
    };

    const easyQuestions = pool.filter(q => q.difficulty === 'Easy');
    const mediumQuestions = pool.filter(q => q.difficulty === 'Medium');
    const hardQuestions = pool.filter(q => q.difficulty === 'Hard');

    const easyCount = Math.min(easyQuestions.length, autoGenConfig.difficulty.Easy || 0);
    const mediumCount = Math.min(mediumQuestions.length, autoGenConfig.difficulty.Medium || 0);
    const hardCount = Math.min(hardQuestions.length, autoGenConfig.difficulty.Hard || 0);

    selectedIds.push(...pickRandom(easyQuestions, easyCount));
    selectedIds.push(...pickRandom(mediumQuestions, mediumCount));
    selectedIds.push(...pickRandom(hardQuestions, hardCount));

    const totalRequested = (autoGenConfig.difficulty.Easy || 0) + (autoGenConfig.difficulty.Medium || 0) + (autoGenConfig.difficulty.Hard || 0);
    const missingCount = totalRequested - selectedIds.length;

    if (missingCount > 0) {
      const useAi = window.confirm(`لم يتم العثور على عدد كافٍ من الأسئلة في المنصة (مطلوب: ${totalRequested}، متوفر: ${selectedIds.length}). هل تريد توليد الباقي (${missingCount}) باستخدام الذكاء الاصطناعي؟`);
      if (useAi) {
        setIsAiGenerating(true);
        try {
          const { generateQuizQuestion } = await import('../../services/geminiService');
          let topicName = 'القدرات العامة';
          if (currentQuiz.subjectId) {
            topicName = subjects.find(s => s.id === currentQuiz.subjectId)?.name || topicName;
          }
          if (autoGenConfig.skillIds.length > 0) {
            const skillNames = autoGenConfig.skillIds.map(id => skills.find(skill => skill.id === id)?.name).filter(Boolean);
            if (skillNames.length > 0) {
              topicName += ` - ${skillNames.join(', ')}`;
            }
          }

          for (let i = 0; i < missingCount; i += 1) {
            const generated = await generateQuizQuestion(topicName);
            if (generated) {
              const newQ: Question = {
                id: `q_ai_${Date.now()}_${i}`,
                text: generated.question,
                options: generated.options,
                correctOptionIndex: generated.correctIndex,
                explanation: generated.explanation,
                type: 'mcq',
                difficulty: 'Medium',
                pathId: currentQuiz.pathId || '',
                subject: currentQuiz.subjectId || '',
                sectionId: currentQuiz.sectionId,
                skillIds: autoGenConfig.skillIds
              };
              await addQuestion(newQ);
              selectedIds.push(newQ.id);
            }
          }
        } catch (e) {
          console.error('AI Generation failed', e);
          setOperationError('تعذر إكمال التوليد بالذكاء الاصطناعي الآن.');
        } finally {
          setIsAiGenerating(false);
        }
      }
    }

    setCurrentQuiz(prev => ({
      ...prev,
      questionIds: [...new Set([...(prev.questionIds || []), ...selectedIds])]
    }));

    setIsAutoGenerateModalOpen(false);
    setOperationMessage(`تمت إضافة ${selectedIds.length} سؤال بنجاح.`);
  };

  const handleSaveNewQuestion = async (savedQuestion: Partial<Question>) => {
    const q: Question = {
      ...savedQuestion,
      id: `q_${Date.now()}`,
      pathId: savedQuestion.pathId || currentQuiz.pathId || '',
      subject: currentQuiz.subjectId || '',
    } as Question;
    
    try {
      await addQuestion(q);
      setCurrentQuiz(prev => ({
        ...prev,
        questionIds: [...(prev.questionIds || []), q.id]
      }));
      setIsAddQuestionModalOpen(false);
    } catch (error) {
      console.error('Unable to save question', error);
      setOperationError('تعذر حفظ السؤال الآن. تحقق من الاتصال ثم حاول مرة أخرى.');
    }
  };

  const handleCreateNew = () => {
    setOperationError('');
    setOperationMessage('');
    setCurrentQuiz({
      title: '',
      description: '',
      pathId: initialSubject?.pathId || '',
      subjectId: initialSubjectId || '',
      ...getQuizPlacementDefaults(builderType),
      mode: 'regular',
      settings: getDefaultQuizSettings({ type: builderType }),
      access: {
        type: 'free',
        allowedGroupIds: [],
      },
      questionIds: [],
      targetGroupIds: [],
      targetUserIds: [],
      dueDate: '',
      isPublished: false,
      showOnPlatform: false,
    });
    setIsEditing(true);
    setActiveTab('info');
  };

  const handleEdit = (quiz: Quiz) => {
    setOperationError('');
    setOperationMessage('');
    setCurrentQuiz(quiz);
    setIsEditing(true);
    setActiveTab('info');
  };

  const handleDelete = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الاختبار نهائياً؟')) {
      deleteQuiz(id);
    }
  };

  const handleTogglePlatformVisibility = (quiz: Quiz) => {
    updateQuiz(quiz.id, { showOnPlatform: quiz.showOnPlatform === false });
  };

  const handleSave = () => {
    handleSaveWithFeedback();
    return;
  };

  const handleSaveWithFeedback = () => {
    if (!currentQuiz.title || !currentQuiz.subjectId) {
      setOperationError('يرجى إدخال عنوان الاختبار وتحديد المادة.');
      return;
    }

    setOperationError('');
    setOperationMessage('');

    const quizPayload = normalizeQuizPlacement({ ...currentQuiz }, builderType);
    delete (quizPayload as any).skillIds;

    if (currentQuiz.id) {
      updateQuiz(currentQuiz.id, quizPayload as Quiz);
    } else {
      const newQuiz: Quiz = {
        ...(quizPayload as Quiz),
        id: `quiz_${Date.now()}`,
        createdAt: Date.now(),
      } as Quiz;
      addQuiz(newQuiz);
    }

    setOperationMessage('تم حفظ الاختبار بنجاح.');
    setIsEditing(false);
  };

  const toggleQuestionSelection = (questionId: string) => {
    setCurrentQuiz(prev => {
      const currentIds = prev.questionIds || [];
      if (currentIds.includes(questionId)) {
        return { ...prev, questionIds: currentIds.filter(id => id !== questionId) };
      } else {
        return { ...prev, questionIds: [...currentIds, questionId] };
      }
    });
  };

  const filteredQuizzes = quizzes.filter(q => 
    q.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (!initialSubjectId || q.subjectId === initialSubjectId)
  );

  const availableQuestions = questions.filter(q =>
    q.subject === currentQuiz.subjectId &&
    (!currentQuiz.sectionId || q.sectionId === currentQuiz.sectionId) &&
    (questionDifficultyFilter === 'all' || q.difficulty === questionDifficultyFilter) &&
    (!questionSkillFilter || (q.skillIds || []).includes(questionSkillFilter)) &&
    (!questionSearchTerm.trim() || q.text.toLowerCase().includes(questionSearchTerm.trim().toLowerCase()))
  );
  const selectedQuestions = useMemo(
    () => questions.filter(q => currentQuiz.questionIds?.includes(q.id)),
    [questions, currentQuiz.questionIds]
  );
  const derivedQuizSkills = useMemo(() => {
    const skillQuestionCounts = new Map<string, number>();

    selectedQuestions.forEach(question => {
      const uniqueSkillIds = Array.from(new Set((question.skillIds || []) as string[]));
      uniqueSkillIds.forEach(skillId => {
        skillQuestionCounts.set(skillId, (skillQuestionCounts.get(skillId) || 0) + 1);
      });
    });

    return Array.from(skillQuestionCounts.entries())
      .map(([skillId, questionCount]) => {
        const subSkill = skills.find(item => item.id === skillId);
        if (!subSkill) return null;

        return {
          id: skillId,
          title: subSkill.name,
          questionCount,
        };
      })
      .filter((item): item is { id: string; title: string; questionCount: number } => !!item)
      .sort((a, b) => b.questionCount - a.questionCount || a.title.localeCompare(b.title, 'ar'));
  }, [selectedQuestions, skills]);
  const totalSelectedQuestions = selectedQuestions.length;
  const publishChecklist = useMemo(() => {
    const issues: string[] = [];
    const isDirected =
      (currentQuiz.targetGroupIds || []).length > 0 ||
      (currentQuiz.targetUserIds || []).length > 0 ||
      (currentQuiz.access?.allowedGroupIds || []).length > 0;

    if (!currentQuiz.pathId) issues.push('اختر المسار حتى يظهر الاختبار في مكانه الصحيح.');
    if (!currentQuiz.subjectId) issues.push('اختر المادة المرتبطة بالاختبار.');
    if (totalSelectedQuestions === 0) issues.push('أضف أسئلة قبل النشر.');
    if (derivedQuizSkills.length === 0) issues.push('اربط الأسئلة بمهارات من مركز المهارات حتى يعمل التحليل.');
    if ((currentQuiz.mode || 'regular') === 'central' && !isDirected) issues.push('حدد مجموعة أو طلابًا للاختبار الموجّه.');

    return issues;
  }, [
    currentQuiz.access?.allowedGroupIds,
    currentQuiz.mode,
    currentQuiz.pathId,
    currentQuiz.subjectId,
    currentQuiz.targetGroupIds,
    currentQuiz.targetUserIds,
    derivedQuizSkills.length,
    totalSelectedQuestions,
  ]);
  const isPublishReady = publishChecklist.length === 0;
  const previewOptionLayout = currentQuiz.settings?.optionLayout || 'auto';
  const previewOptionGridClass =
    previewOptionLayout === 'two_columns'
      ? 'grid-cols-1 sm:grid-cols-2'
      : previewOptionLayout === 'horizontal'
        ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
        : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4';

  if (isEditing) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-120px)] animate-fade-in">
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
              <X size={20} className="text-gray-500" />
            </button>
            <h2 className="text-xl font-bold text-gray-800">
              {currentQuiz.id ? 'تعديل الاختبار' : 'إنشاء اختبار جديد'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleSaveWithFeedback}
              className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <Save size={18} />
              حفظ الاختبار
            </button>
          </div>
        </div>

        {(operationError || operationMessage) && (
          <div className={`mx-6 mt-6 rounded-xl border px-4 py-3 text-sm font-medium ${operationError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {operationError || operationMessage}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white px-6">
          {[
            { id: 'info', label: 'المعلومات الأساسية', icon: <FileQuestion size={18} /> },
            { id: 'questions', label: 'الأسئلة', icon: <Filter size={18} /> },
            { id: 'settings', label: 'الإعدادات', icon: <Settings size={18} /> },
            { id: 'access', label: 'الصلاحيات والنشر', icon: <Users size={18} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 font-bold text-sm border-b-2 transition-colors ${
                activeTab === tab.id 
                  ? 'border-indigo-600 text-indigo-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Tab: Info */}
            {activeTab === 'info' && (
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-4 border-b border-gray-100 mb-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">{'\u0627\u0644\u0645\u0633\u0627\u0631 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a / \u0644\u062a\u0635\u0646\u064a\u0641 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631)'}</label>
                    <select
                      value={currentQuiz.pathId || ''}
                      onChange={(e) =>
                        setCurrentQuiz(prev => ({
                          ...prev,
                          pathId: e.target.value,
                          subjectId: '',
                          sectionId: '',
                          skillIds: [],
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                    >
                      <option value="">{'-- \u0643\u0644 \u0627\u0644\u0645\u0633\u0627\u0631\u0627\u062a --'}</option>
                      {paths.map(path => (
                        <option key={path.id} value={path.id}>{path.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">{'\u0627\u0644\u0645\u0627\u062f\u0629 \u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629'}</label>
                    <select
                      value={currentQuiz.subjectId || ''}
                      onChange={(e) =>
                        setCurrentQuiz(prev => ({
                          ...prev,
                          subjectId: e.target.value,
                          sectionId: '',
                          skillIds: [],
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                      disabled={!currentQuiz.pathId || subjects.filter(subject => subject.pathId === currentQuiz.pathId).length === 0}
                    >
                      <option value="">
                        {!currentQuiz.pathId ? '-- اختر المسار أولًا --' : '-- اختر المادة --'}
                      </option>
                      {subjects
                        .filter(subject => subject.pathId === currentQuiz.pathId)
                        .map(subject => (
                          <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">{'\u0627\u0644\u0645\u0647\u0627\u0631\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u0629'}</label>
                    <select
                      value={currentQuiz.sectionId || ''}
                      onChange={(e) =>
                        setCurrentQuiz(prev => ({
                          ...prev,
                          sectionId: e.target.value,
                          skillIds: [],
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                      disabled={!currentQuiz.subjectId}
                    >
                      <option value="">{'\u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u0647\u0627\u0631\u0627\u062a \u0627\u0644\u0631\u0626\u064a\u0633\u0629'}</option>
                      {availableQuizMainSkills.map(section => (
                        <option key={section.id} value={section.id}>{section.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">تصنيف الاختبار</label>
                    <select
                      value={currentQuiz.mode || 'regular'}
                      onChange={(e) => {
                        const mode = e.target.value as Quiz['mode'];
                        setCurrentQuiz(prev => ({
                          ...prev,
                          mode,
                          access: mode === 'central'
                            ? { ...prev.access!, type: 'private' }
                            : prev.access
                        }));
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                    >
                      <option value="regular">اختبار عادي</option>
                      <option value="saher">اختبار ساهر</option>
                      <option value="central">اختبار مركزي موجّه</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">مكان الظهور للطالب</label>
                    <select
                      value={getPlacementFromFlags(currentQuiz)}
                      onChange={(e) => {
                        const placement = e.target.value as Quiz['placement'];
                        const showInTraining = placement === 'training' || placement === 'both';
                        const showInMock = placement === 'mock' || placement === 'both';
                        setCurrentQuiz(prev => ({
                          ...prev,
                          placement,
                          showInTraining,
                          showInMock,
                          type: showInTraining && !showInMock ? 'bank' : 'quiz',
                        }));
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                    >
                      <option value="training">التدريب فقط</option>
                      <option value="mock">الاختبارات فقط</option>
                      <option value="both">التدريب والاختبارات</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">هذا هو الفصل الحقيقي بين تبويب التدريب وتبويب الاختبارات داخل صفحة المادة.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{'\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631'}</label>
                  <input
                    type="text"
                    value={currentQuiz.title || ''}
                    onChange={(e) => setCurrentQuiz(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder={'\u0645\u062b\u0627\u0644: \u0627\u062e\u062a\u0628\u0627\u0631 \u0634\u0627\u0645\u0644 - \u0643\u0645\u064a'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{'\u0648\u0635\u0641 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)'}</label>
                  <textarea
                    value={currentQuiz.description || ''}
                    onChange={(e) => setCurrentQuiz(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 h-24"
                    placeholder={'\u0648\u0635\u0641 \u0642\u0635\u064a\u0631 \u064a\u0638\u0647\u0631 \u0644\u0644\u0637\u0644\u0627\u0628 \u0642\u0628\u0644 \u0628\u062f\u0621 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631...'}
                  />
                </div>

                {currentQuiz.mode === 'central' && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 space-y-4">
                    <h4 className="text-sm font-bold text-gray-800">توجيه الاختبار المركزي</h4>
                    <p className="text-xs text-gray-600">يمكنك تحديد مجموعات أو طلاب بعينهم ليظهر لهم هذا الاختبار بشكل مباشر.</p>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">المجموعات المستهدفة</label>
                      <select
                        multiple
                        value={currentQuiz.targetGroupIds || []}
                        onChange={(e) => {
                          const values = Array.from(e.currentTarget.selectedOptions as HTMLCollectionOf<HTMLOptionElement>).map((option) => option.value);
                          setCurrentQuiz(prev => ({ ...prev, targetGroupIds: values }));
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 h-28 bg-white"
                      >
                        {groups.map(group => (
                          <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">الطلاب المستهدفون (اختياري)</label>
                      <select
                        multiple
                        value={currentQuiz.targetUserIds || []}
                        onChange={(e) => {
                          const values = Array.from(e.currentTarget.selectedOptions as HTMLCollectionOf<HTMLOptionElement>).map((option) => option.value);
                          setCurrentQuiz(prev => ({ ...prev, targetUserIds: values }));
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 h-28 bg-white"
                      >
                        {users
                          .filter(u => u.role === 'student')
                          .map(student => (
                            <option key={student.id} value={student.id}>
                              {student.name} ({student.email || student.id})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">موعد الاستحقاق (اختياري)</label>
                      <input
                        type="date"
                        value={currentQuiz.dueDate || ''}
                        onChange={(e) => setCurrentQuiz(prev => ({ ...prev, dueDate: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">{'\u0627\u0644\u0645\u0647\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u0642\u0627\u0633\u0629 \u0641\u0639\u0644\u064a\u064b\u0627'}</h4>
                      <p className="text-xs text-gray-600 mt-1">
                        {'\u0647\u0630\u0647 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u062a\u064f\u0628\u0646\u0649 \u062a\u0644\u0642\u0627\u0626\u064a\u064b\u0627 \u0645\u0646 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629 \u0625\u0644\u0649 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631\u060c \u062d\u062a\u0649 \u062a\u0639\u0631\u0641 \u0645\u0628\u0627\u0634\u0631\u0629 \u0645\u0627 \u0627\u0644\u0630\u064a \u064a\u0642\u064a\u0633\u0647 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631.'}
                      </p>
                    </div>
                    <div className="text-xs font-bold text-indigo-700 bg-white border border-indigo-200 rounded-lg px-3 py-2">
                      {totalSelectedQuestions} {'\u0633\u0624\u0627\u0644'}
                    </div>
                  </div>

                  {derivedQuizSkills.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {derivedQuizSkills.map(skill => (
                          <span
                            key={skill.id}
                            className="bg-white text-indigo-800 border border-indigo-200 px-3 py-2 rounded-lg text-sm font-medium"
                          >
                            {skill.title}
                            <span className="text-xs text-indigo-600 mr-2">
                              ({skill.questionCount} {'\u0633\u0624\u0627\u0644'} - {Math.round((skill.questionCount / totalSelectedQuestions) * 100)}%)
                            </span>
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-gray-600">
                        {'\u0625\u0630\u0627 \u0623\u0631\u062f\u062a \u0623\u0646 \u064a\u0642\u064a\u0633 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0645\u0647\u0627\u0631\u0629 \u0625\u0636\u0627\u0641\u064a\u0629\u060c \u0623\u0636\u0641 \u0633\u0624\u0627\u0644\u064b\u0627 \u062c\u062f\u064a\u062f\u064b\u0627 \u0645\u0631\u062a\u0628\u0637\u064b\u0627 \u0628\u0647\u0630\u0647 \u0627\u0644\u0645\u0647\u0627\u0631\u0629 \u0645\u0646 \u0628\u0646\u0643 \u0627\u0644\u0623\u0633\u0626\u0644\u0629.'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 bg-white border border-dashed border-indigo-200 rounded-lg p-4">
                      {'\u0644\u0645 \u062a\u064f\u0633\u062a\u062e\u0631\u062c \u0645\u0647\u0627\u0631\u0627\u062a \u0628\u0639\u062f. \u0628\u0639\u062f \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0623\u0633\u0626\u0644\u0629\u060c \u0633\u064a\u0638\u0647\u0631 \u0647\u0646\u0627 \u062a\u0644\u0642\u0627\u0626\u064a\u064b\u0627 \u062a\u062d\u0644\u064a\u0644 \u0627\u0644\u0645\u0647\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u0648\u062c\u0648\u062f\u0629 \u062f\u0627\u062e\u0644 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631.'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Questions */}
            {activeTab === 'questions' && (
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-gray-800">الأسئلة المحددة ({currentQuiz.questionIds?.length || 0})</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsAutoGenerateModalOpen(true)}
                      className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-100 transition-colors"
                    >
                      توليد تلقائي (نظام ساهر)
                    </button>
                    <button 
                      onClick={() => setIsAddQuestionModalOpen(true)}
                      className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-100 transition-colors"
                    >
                      إضافة سؤال جديد
                    </button>
                  </div>
                </div>

                {/* Question Selection List */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-600">اختر من بنك الأسئلة</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={questionDifficultyFilter}
                        onChange={(e) => setQuestionDifficultyFilter(e.target.value as typeof questionDifficultyFilter)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="all">كل الصعوبات</option>
                        <option value="Easy">سهل</option>
                        <option value="Medium">متوسط</option>
                        <option value="Hard">صعب</option>
                      </select>
                      <select
                        value={questionSkillFilter}
                        onChange={(e) => setQuestionSkillFilter(e.target.value)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">كل المهارات</option>
                        {availableQuizSubSkills.map(skill => (
                          <option key={skill.id} value={skill.id}>{skill.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="بحث في الأسئلة..."
                        value={questionSearchTerm}
                        onChange={(e) => setQuestionSearchTerm(e.target.value)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                    {availableQuestions.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        لا توجد أسئلة متاحة لهذه المادة في بنك الأسئلة.
                      </div>
                    ) : (
                      availableQuestions.map(q => {
                        const isSelected = currentQuiz.questionIds?.includes(q.id);
                        return (
                          <div 
                            key={q.id} 
                            onClick={() => toggleQuestionSelection(q.id)}
                            className={`p-4 flex items-start gap-4 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}`}
                          >
                            <div className={`w-5 h-5 rounded border mt-1 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'}`}>
                              {isSelected && <CheckCircle2 size={14} />}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm text-gray-800 line-clamp-2 mb-2" dangerouslySetInnerHTML={{ __html: normalizeQuestionHtml(q.text) }} />
                              <div className="flex gap-2 text-xs">
                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                  {q.difficulty === 'Easy' ? 'سهل' : q.difficulty === 'Medium' ? 'متوسط' : 'صعب'}
                                </span>
                                {q.skillIds?.map(skillId => {
                                  const subSkill = skills.find(skill => skill.id === skillId);
                                  return subSkill ? (
                                    <span key={skillId} className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                      {subSkill.name}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Settings */}
            {activeTab === 'settings' && (
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">درجة النجاح (%)</label>
                    <input 
                      type="number" 
                      value={currentQuiz.settings?.passingScore || 60}
                      onChange={(e) => setCurrentQuiz(prev => ({ ...prev, settings: { ...prev.settings!, passingScore: Number(e.target.value) } }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      min="0" max="100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">الوقت المحدد (بالدقائق)</label>
                    <input 
                      type="number" 
                      value={currentQuiz.settings?.timeLimit || 60}
                      onChange={(e) => setCurrentQuiz(prev => ({ ...prev, settings: { ...prev.settings!, timeLimit: Number(e.target.value) } }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">اتركه 0 لاختبار بدون وقت محدد.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">عدد المحاولات المسموحة</label>
                    <input 
                      type="number" 
                      value={currentQuiz.settings?.maxAttempts || 3}
                      onChange={(e) => setCurrentQuiz(prev => ({ ...prev, settings: { ...prev.settings!, maxAttempts: Number(e.target.value) } }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">طريقة عرض الاختيارات</label>
                    <select
                      value={currentQuiz.settings?.optionLayout || 'auto'}
                      onChange={(e) => setCurrentQuiz(prev => ({ ...prev, settings: { ...prev.settings!, optionLayout: e.target.value as any } }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="auto">تلقائي حسب مساحة الشاشة</option>
                      <option value="two_columns">اختياران في كل صف</option>
                      <option value="horizontal">أفقي على الشاشات الواسعة</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">على الجوال ستظهر الاختيارات تحت بعض للحفاظ على وضوح السؤال.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-sm font-black text-gray-800">معاينة شكل السؤال للطالب</h4>
                      <p className="mt-1 text-xs text-gray-500">هذه المعاينة تساعدك تختار شكل الاختيارات قبل نشر الاختبار، والجوال يظل عمودًا واحدًا للوضوح.</p>
                    </div>
                    <span className="self-start rounded-full bg-white px-3 py-1 text-[11px] font-black text-indigo-700">
                      {previewOptionLayout === 'two_columns' ? 'اختياران في الصف' : previewOptionLayout === 'horizontal' ? 'أفقي واسع' : 'تلقائي'}
                    </span>
                  </div>
                  <div className="mt-4 rounded-2xl border border-white bg-white p-4 shadow-sm">
                    <div className="mb-4 text-sm font-bold text-gray-800">مثال: ما أول خطوة صحيحة عند حل المسألة؟</div>
                    <div className={`grid ${previewOptionGridClass} gap-3`}>
                      {['فهم المطلوب', 'تجاهل المعطيات', 'اختيار عشوائي', 'ترك السؤال'].map((label) => (
                        <div key={label} className="flex min-h-[64px] items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                          <span className="text-sm font-black text-gray-800">{label}</span>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 bg-white text-lg font-black text-gray-700">
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentQuiz.settings?.randomizeQuestions !== false}
                      onChange={(e) => setCurrentQuiz(prev => ({ ...prev, settings: { ...prev.settings!, randomizeQuestions: e.target.checked } }))}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <div>
                      <span className="block font-bold text-gray-800">خلط ترتيب الأسئلة للطالب</span>
                      <span className="block text-xs text-gray-500">يقلل تكرار نفس ترتيب الاختبار بين الطلاب.</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentQuiz.settings?.showProgressBar !== false}
                      onChange={(e) => setCurrentQuiz(prev => ({ ...prev, settings: { ...prev.settings!, showProgressBar: e.target.checked } }))}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <div>
                      <span className="block font-bold text-gray-800">إظهار شريط تقدم الاختبار</span>
                      <span className="block text-xs text-gray-500">يبقي الطالب عارف هو فين داخل الرحلة بدون تشتيت.</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentQuiz.settings?.requireAnswerBeforeNext === true}
                      onChange={(e) => setCurrentQuiz(prev => ({ ...prev, settings: { ...prev.settings!, requireAnswerBeforeNext: e.target.checked } }))}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <div>
                      <span className="block font-bold text-gray-800">منع الانتقال قبل اختيار إجابة</span>
                      <span className="block text-xs text-gray-500">مفيد للتدريبات القصيرة، ويمكن تركه مغلقًا للاختبارات المحاكية.</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentQuiz.settings?.allowQuestionReview !== false}
                      onChange={(e) => setCurrentQuiz(prev => ({ ...prev, settings: { ...prev.settings!, allowQuestionReview: e.target.checked } }))}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <div>
                      <span className="block font-bold text-gray-800">تفعيل زر المراجعة للطالب</span>
                      <span className="block text-xs text-gray-500">يسمح للطالب بتعليم السؤال للمراجعة لاحقًا.</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={currentQuiz.settings?.showAnswers}
                      onChange={(e) => setCurrentQuiz(prev => ({ ...prev, settings: { ...prev.settings!, showAnswers: e.target.checked } }))}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <div>
                      <span className="block font-bold text-gray-800">إظهار الإجابات الصحيحة</span>
                      <span className="block text-xs text-gray-500">للطالب بعد انتهاء الاختبار</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentQuiz.settings?.showResultsReport !== false}
                      onChange={(e) => setCurrentQuiz(prev => ({ ...prev, settings: { ...prev.settings!, showResultsReport: e.target.checked } }))}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <div>
                      <span className="block font-bold text-gray-800">إظهار تقرير بعد الانتهاء</span>
                      <span className="block text-xs text-gray-500">أغلقه للتدريبات القصيرة المرتبطة بموضوع التأسيس.</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentQuiz.settings?.returnToSourceOnFinish === true}
                      onChange={(e) => setCurrentQuiz(prev => ({ ...prev, settings: { ...prev.settings!, returnToSourceOnFinish: e.target.checked } }))}
                      className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <div>
                      <span className="block font-bold text-gray-800">الرجوع لمكان الطالب بعد الحفظ</span>
                      <span className="block text-xs text-gray-500">مفيد عندما يكون الاختبار مستخدمًا كتدريب داخل موضوع.</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={currentQuiz.settings?.showExplanations}
                      onChange={(e) => setCurrentQuiz(prev => ({ ...prev, settings: { ...prev.settings!, showExplanations: e.target.checked } }))}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <div>
                      <span className="block font-bold text-gray-800">إظهار شرح الإجابات (الفيديو/النص)</span>
                      <span className="block text-xs text-gray-500">للطالب بعد انتهاء الاختبار</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Tab: Access */}
            {activeTab === 'access' && (
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                <div
                  className={`rounded-2xl border p-4 ${
                    isPublishReady
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                      : 'border-amber-100 bg-amber-50 text-amber-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {isPublishReady ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                    </div>
                    <div>
                      <h4 className="font-black text-sm">
                        {isPublishReady ? 'الاختبار جاهز للنشر الآمن' : 'مراجعة سريعة قبل إظهار الاختبار'}
                      </h4>
                      <p className="mt-1 text-xs leading-6">
                        {isPublishReady
                          ? 'تم ربط المسار والمادة والأسئلة والمهارات، ويمكنك الآن نشره أو إظهاره للطلاب بثقة.'
                          : 'هذه الملاحظات لا تمنع الحفظ داخل المستودع، لكنها مهمة قبل عرض الاختبار للطالب.'}
                      </p>
                      {!isPublishReady ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {publishChecklist.map((issue) => (
                            <span key={issue} className="rounded-full bg-white px-3 py-1 text-[11px] font-bold">
                              {issue}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">نوع الوصول</label>
                  <select 
                    value={currentQuiz.access?.type || 'free'}
                    onChange={(e) => setCurrentQuiz(prev => ({ ...prev, access: { ...prev.access!, type: e.target.value as any } }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="free">مجاني للجميع</option>
                    <option value="paid">ضمن باقة / يحتاج تفعيل</option>
                    <option value="private">مخصص لمجموعات محددة</option>
                    <option value="course_only">متاح فقط داخل الدورات</option>
                  </select>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-800">
                      <span className="font-black">مجاني:</span> يظهر ويفتح مباشرة للطالب.
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-amber-800">
                      <span className="font-black">ضمن باقة:</span> يظهر مقفولًا حتى تفعيل باقة التدريب أو الاختبارات.
                    </div>
                    <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-rose-800">
                      <span className="font-black">خاص:</span> لا يظهر إلا للمجموعات أو الطلاب المحددين.
                    </div>
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-indigo-800">
                      <span className="font-black">داخل الدورات:</span> يستخدم عند ربطه بمحتوى دورة فقط.
                    </div>
                  </div>
                </div>

                {currentQuiz.access?.type === 'paid' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">سعر اختياري للعرض الفردي لاحقًا (ريال)</label>
                    <input 
                      type="number" 
                      value={currentQuiz.access?.price || 0}
                      onChange={(e) => setCurrentQuiz(prev => ({ ...prev, access: { ...prev.access!, price: Number(e.target.value) } }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      min="0"
                    />
                    <p className="mt-2 text-xs leading-6 text-gray-500">
                      في الوضع الحالي فتح هذا النوع يكون عبر الباقات المرتبطة بالمادة، والسعر هنا معلومة مستقبلية إذا أردت بيع الاختبار منفردًا.
                    </p>
                  </div>
                )}

                {currentQuiz.access?.type === 'private' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">المجموعات المسموح لها</label>
                    <select 
                      multiple
                      value={currentQuiz.access?.allowedGroupIds || []}
                      onChange={(e) => {
                        const values = Array.from(e.currentTarget.selectedOptions as HTMLCollectionOf<HTMLOptionElement>).map((option) => option.value);
                        setCurrentQuiz(prev => ({ ...prev, access: { ...prev.access!, allowedGroupIds: values } }));
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 h-32"
                    >
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">اضغط Ctrl (أو Cmd) لاختيار أكثر من مجموعة.</p>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={currentQuiz.isPublished || false}
                      onChange={(e) => setCurrentQuiz(prev => ({ ...prev, isPublished: e.target.checked }))}
                      className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <div>
                      <span className="block font-bold text-gray-800">نشر الاختبار</span>
                      <span className="block text-xs text-gray-500">الاختبار يصبح جاهزًا ومعتمدًا داخل المستودع.</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer mt-4">
                    <input 
                      type="checkbox" 
                      checked={currentQuiz.showOnPlatform !== false}
                      onChange={(e) => setCurrentQuiz(prev => ({ ...prev, showOnPlatform: e.target.checked }))}
                      className="w-5 h-5 text-sky-600 rounded focus:ring-sky-500"
                    />
                    <div>
                      <span className="block font-bold text-gray-800">إظهار الاختبار على المنصة</span>
                      <span className="block text-xs text-gray-500">يمكن إبقاء الاختبار في مركز الاختبارات فقط دون عرضه للطلاب الآن.</span>
                    </div>
                  </label>
                </div>

                {currentQuiz.id && (
                  <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex items-center justify-between mt-6">
                    <div>
                      <h4 className="font-bold text-indigo-900 text-sm">رابط مباشر للاختبار</h4>
                      <p className="text-xs text-indigo-600 mt-1">يمكنك استخدام هذا الرابط للتسويق أو إرساله للطلاب مباشرة.</p>
                    </div>
                    <button 
                      onClick={() => void handleCopyLinkWithFeedback(`${window.location.origin}/quiz/${currentQuiz.id}`)}
                      className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm border border-indigo-200 hover:bg-indigo-50 transition-colors flex items-center gap-2"
                    >
                      <LinkIcon size={16} />
                      نسخ الرابط
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
        {/* Modals */}
        {isAutoGenerateModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">توليد تلقائي (نظام ساهر)</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">عدد الأسئلة السهلة</label>
                  <input type="number" value={autoGenConfig.difficulty.Easy} onChange={e => setAutoGenConfig(prev => ({ ...prev, difficulty: { ...prev.difficulty, Easy: Number(e.target.value) } }))} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">عدد الأسئلة المتوسطة</label>
                  <input type="number" value={autoGenConfig.difficulty.Medium} onChange={e => setAutoGenConfig(prev => ({ ...prev, difficulty: { ...prev.difficulty, Medium: Number(e.target.value) } }))} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">عدد الأسئلة الصعبة</label>
                  <input type="number" value={autoGenConfig.difficulty.Hard} onChange={e => setAutoGenConfig(prev => ({ ...prev, difficulty: { ...prev.difficulty, Hard: Number(e.target.value) } }))} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-bold text-gray-700 mb-2">المهارات المشمولة (اختياري)</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {autoGenConfig.skillIds?.map(skillId => {
                      const subSkill = skills.find(skill => skill.id === skillId);
                      return subSkill ? (
                        <span key={skillId} className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-lg text-sm flex items-center gap-1">
                          {subSkill.name}
                          <button onClick={() => setAutoGenConfig(prev => ({ ...prev, skillIds: prev.skillIds.filter(id => id !== skillId) }))} className="text-indigo-600 hover:text-indigo-900">
                            <X size={14} />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                  <select 
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !autoGenConfig.skillIds.includes(e.target.value)) {
                        setAutoGenConfig(prev => ({ ...prev, skillIds: [...prev.skillIds, e.target.value] }));
                      }
                    }}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">-- أضف مهارة فرعية للتوليد --</option>
                    {availableQuizMainSkills.map(mainSkill => (
                      <optgroup key={mainSkill.id} label={mainSkill.name}>
                        {availableQuizSubSkills.filter(subSkill => subSkill.sectionId === mainSkill.id).map(subSkill => (
                          <option key={subSkill.id} value={subSkill.id}>{subSkill.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 mt-6 md:col-span-3">
                  <button onClick={() => setIsAutoGenerateModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">إلغاء</button>
                  <button disabled={isAiGenerating} onClick={handleAutoGenerateWithFeedback} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isAiGenerating ? 'جاري التوليد بالذكاء الاصطناعي...' : 'توليد'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isAddQuestionModalOpen && (
            <UnifiedQuestionBuilder 
              initialQuestion={{ pathId: currentQuiz.pathId || '', subject: currentQuiz.subjectId || '', sectionId: currentQuiz.sectionId, skillIds: [] }}
              subjectId={currentQuiz.subjectId}
              onSave={handleSaveNewQuestion}
              onCancel={() => setIsAddQuestionModalOpen(false)}
            />
          )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">منشئ الاختبارات الموحد</h2>
          <p className="text-gray-500 text-sm mt-1">إنشاء وإدارة الاختبارات المحاكية والتجريبية على مستوى المنصة.</p>
        </div>
        <button 
          onClick={handleCreateNew}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          إنشاء اختبار جديد
        </button>
      </div>

      {(operationError || operationMessage) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${operationError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {operationError || operationMessage}
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="ابحث عن اختبار..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Quizzes List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">عنوان الاختبار</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">المادة</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">عدد الأسئلة</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">الحالة</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredQuizzes.map(quiz => {
                const subject = subjects.find(s => s.id === quiz.subjectId);
                return (
                  <tr key={quiz.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-800">{quiz.title}</div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                        <span>{getAccessTypeLabel(quiz.access?.type)}</span>
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {quiz.mode === 'saher' ? 'ساهر' : quiz.mode === 'central' ? 'مركزي' : 'عادي'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md text-xs font-bold">
                        {subject?.name || quiz.subjectId}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-700">{quiz.questionIds.length} سؤال</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          quiz.isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {quiz.isPublished ? 'جاهز في المستودع' : 'مسودة'}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          quiz.showOnPlatform === false ? 'bg-gray-100 text-gray-600' : 'bg-sky-50 text-sky-700'
                        }`}>
                          {quiz.showOnPlatform === false ? 'مخفي عن المنصة' : 'معروض على المنصة'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEdit(quiz)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="تعديل">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(quiz.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="حذف">
                          <Trash2 size={18} />
                        </button>
                        <button 
                          onClick={() => void handleCopyLinkWithFeedback(`${window.location.origin}/quiz/${quiz.id}`)}
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="نسخ الرابط"
                        >
                          <LinkIcon size={18} />
                        </button>
                        <button
                          onClick={() => handleTogglePlatformVisibility(quiz)}
                          className={`p-2 rounded-lg transition-colors ${
                            quiz.showOnPlatform === false
                              ? 'text-gray-500 hover:bg-gray-100'
                              : 'text-sky-600 hover:bg-sky-50'
                          }`}
                          title={quiz.showOnPlatform === false ? 'إظهار الاختبار على المنصة' : 'إخفاء الاختبار عن المنصة'}
                        >
                          {quiz.showOnPlatform === false ? <Lock size={18} /> : <LockOpen size={18} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredQuizzes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    لا توجد اختبارات مطابقة للبحث.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

