import React, { useEffect, useMemo, useState } from 'react';
import { Question } from '../../../types';
import { RichTextEditor } from '../../../components/RichTextEditor';
import { Save, X, Wand2, Loader2 } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { generateQuizQuestion } from '../../../services/geminiService';

interface UnifiedQuestionBuilderProps {
  initialQuestion?: Partial<Question>;
  onSave: (question: Partial<Question>) => void;
  onCancel: () => void;
  subjectId?: string;
  sectionId?: string;
}

export const UnifiedQuestionBuilder: React.FC<UnifiedQuestionBuilderProps> = ({
  initialQuestion,
  onSave,
  onCancel,
  subjectId,
  sectionId
}) => {
  const { skills, subjects, sections, paths } = useStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [generationError, setGenerationError] = useState('');
  const [question, setQuestion] = useState<Partial<Question>>(initialQuestion || {
    text: '',
    options: ['', '', '', ''],
    correctOptionIndex: 0,
    explanation: '',
    videoUrl: '',
    difficulty: 'Medium',
    type: 'mcq',
    pathId: '',
    subject: subjectId || '',
    sectionId: sectionId || '',
    skillIds: []
  });

  const availableMainSkills = useMemo(
    () => sections.filter((section) => !!question.subject && section.subjectId === question.subject),
    [sections, question.subject]
  );

  const availableSubSkills = useMemo(
    () => skills.filter((skill) => !!question.subject && skill.subjectId === question.subject && (!question.sectionId || skill.sectionId === question.sectionId)),
    [skills, question.subject, question.sectionId]
  );

  const selectedSubSkills = useMemo(
    () => availableSubSkills.filter((skill) => question.skillIds?.includes(skill.id)),
    [availableSubSkills, question.skillIds]
  );

  useEffect(() => {
    if (!question.subject) return;

    const currentSubject = subjects.find((subject) => subject.id === question.subject);
    if (!currentSubject) return;

    const nextPathId = currentSubject.pathId;
    const sectionBelongsToSubject = !question.sectionId || sections.some(
      (section) => section.id === question.sectionId && section.subjectId === question.subject
    );
    const filteredSkillIds = (question.skillIds || []).filter((skillId) =>
      skills.some(
        (skill) =>
          skill.id === skillId &&
          skill.subjectId === question.subject &&
          (!question.sectionId || skill.sectionId === question.sectionId)
      )
    );

    if (
      question.pathId !== nextPathId ||
      !sectionBelongsToSubject ||
      filteredSkillIds.length !== (question.skillIds || []).length
    ) {
      setQuestion((prev) => ({
        ...prev,
        pathId: nextPathId,
        sectionId: sectionBelongsToSubject ? prev.sectionId : '',
        skillIds: filteredSkillIds
      }));
    }
  }, [question.subject, question.sectionId, question.pathId, question.skillIds, subjects, sections, skills]);

  const handleSave = () => {
    handleValidatedSave();
    return;
  };

  const handleGenerate = async () => {
    await handleGenerateWithFeedback();
    return;
  };

  const handleValidatedSave = () => {
    if (!question.text) {
      setValidationError('يرجى إدخال نص السؤال.');
      return;
    }
    if (!question.pathId) {
      setValidationError('يرجى اختيار المسار.');
      return;
    }
    if (!question.subject) {
      setValidationError('يرجى اختيار المادة.');
      return;
    }
    if (!question.sectionId) {
      setValidationError('يرجى اختيار المهارة الرئيسة.');
      return;
    }
    if (!question.skillIds || question.skillIds.length === 0) {
      setValidationError('يرجى ربط السؤال بمهارة فرعية واحدة على الأقل.');
      return;
    }
    if (question.type === 'mcq' && question.options?.some(option => !option)) {
      setValidationError('يرجى تعبئة جميع الخيارات.');
      return;
    }

    setValidationError('');
    onSave(question);
  };

  const handleGenerateWithFeedback = async () => {
    setGenerationError('');
    setIsGenerating(true);

    let topicName = 'القدرات العامة';

    if (question.subject) {
      const subjectName = subjects.find((subject) => subject.id === question.subject)?.name;
      if (subjectName) topicName = subjectName;
    } else if (question.pathId) {
      const pathName = paths.find((path) => path.id === question.pathId)?.name;
      if (pathName) topicName = pathName;
    }

    if (question.sectionId) {
      const mainSkill = sections.find((section) => section.id === question.sectionId)?.name;
      if (mainSkill) topicName += ` - ${mainSkill}`;
    }

    if (question.skillIds && question.skillIds.length > 0) {
      const subSkill = skills.find((item) => item.id === question.skillIds![0])?.name;
      if (subSkill) topicName += ` - ${subSkill}`;
    }

    try {
      const generated = await generateQuizQuestion(topicName);
      if (generated) {
        setQuestion((prev) => ({
          ...prev,
          text: generated.question,
          options: generated.options,
          correctOptionIndex: generated.correctIndex,
          explanation: generated.explanation,
          type: 'mcq'
        }));
      }
    } catch (error) {
      console.error(error);
      setGenerationError('حدث خطأ أثناء التوليد. جرّب مرة أخرى بعد تحديد المادة والمهارة.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            منشئ الأسئلة الموحد
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {validationError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {validationError}
            </div>
          )}
          {generationError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
              {generationError}
            </div>
          )}

          <div className="flex justify-between items-center">
            <label className="block text-sm font-bold text-gray-700">نص السؤال</label>
            <button
              onClick={handleGenerateWithFeedback}
              disabled={isGenerating}
              className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-indigo-100 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {isGenerating ? 'جارٍ التوليد...' : 'توليد بالذكاء الاصطناعي'}
            </button>
          </div>
          <RichTextEditor
            value={question.text || ''}
            onChange={value => setQuestion(prev => ({ ...prev, text: value }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">نوع السؤال</label>
              <select
                value={question.type || 'mcq'}
                onChange={event => setQuestion(prev => ({ ...prev, type: event.target.value as Question['type'] }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="mcq">اختيار من متعدد</option>
                <option value="true_false">صح أم خطأ</option>
                <option value="essay">مقالي / نصي</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">مستوى الصعوبة</label>
              <select
                value={question.difficulty || 'Medium'}
                onChange={event => setQuestion(prev => ({ ...prev, difficulty: event.target.value as Question['difficulty'] }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Easy">سهل</option>
                <option value="Medium">متوسط</option>
                <option value="Hard">صعب</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">المسار</label>
              <select
                value={question.pathId || ''}
                onChange={event => setQuestion({ ...question, pathId: event.target.value, subject: '', sectionId: '', skillIds: [] })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- اختر المسار --</option>
                {paths.map(path => (
                  <option key={path.id} value={path.id}>{path.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">المادة</label>
              <select
                value={question.subject || ''}
                onChange={event => setQuestion({ ...question, subject: event.target.value, sectionId: '', skillIds: [] })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled={!question.pathId || subjects.filter(subject => subject.pathId === question.pathId).length === 0}
              >
                <option value="">{!question.pathId ? '-- اختر المسار أولًا --' : '-- اختر المادة --'}</option>
                {subjects.filter(subject => subject.pathId === question.pathId).map(subject => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">المهارة الرئيسة</label>
              <select
                value={question.sectionId || ''}
                onChange={event => setQuestion({ ...question, sectionId: event.target.value, skillIds: [] })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled={!question.subject}
              >
                <option value="">-- اختر المهارة الرئيسة --</option>
                {availableMainSkills.map(section => (
                  <option key={section.id} value={section.id}>{section.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">ربط بالمهارات الفرعية</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedSubSkills.map(subSkill => (
                  <span key={subSkill.id} className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-lg text-sm flex items-center gap-1">
                    {subSkill.name}
                    <button
                      onClick={() => setQuestion(prev => ({ ...prev, skillIds: prev.skillIds?.filter(id => id !== subSkill.id) }))}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <select
                value=""
                onChange={event => {
                  if (event.target.value && !question.skillIds?.includes(event.target.value)) {
                    setQuestion(prev => ({ ...prev, skillIds: [...(prev.skillIds || []), event.target.value] }));
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled={!question.subject || !question.sectionId || availableSubSkills.length === 0}
              >
                <option value="">
                  {!question.subject
                    ? '-- اختر المادة أولًا --'
                    : !question.sectionId
                      ? '-- اختر المهارة الرئيسة أولًا --'
                      : availableSubSkills.length === 0
                        ? '-- لا توجد مهارات فرعية لهذه المهارة الرئيسة بعد --'
                        : '-- أضف مهارة فرعية --'}
                </option>
                {availableSubSkills.map(subSkill => (
                  <option key={subSkill.id} value={subSkill.id}>{subSkill.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">المهارات هنا تُسحب من مركز المهارات الحقيقي: المهارة الرئيسة ثم المهارات الفرعية التابعة لها.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">رابط فيديو الشرح (اختياري)</label>
              <input
                type="text"
                value={question.videoUrl || ''}
                onChange={event => setQuestion(prev => ({ ...prev, videoUrl: event.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="https://..."
              />
            </div>
          </div>

          {question.type === 'mcq' && (
            <div className="space-y-3">
              <label className="block text-sm font-bold text-gray-700">الخيارات</label>
              {question.options?.map((option, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="correctOption"
                    checked={question.correctOptionIndex === index}
                    onChange={() => setQuestion(prev => ({ ...prev, correctOptionIndex: index }))}
                    className="w-5 h-5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={event => {
                      const newOptions = [...(question.options || [])];
                      newOptions[index] = event.target.value;
                      setQuestion(prev => ({ ...prev, options: newOptions }));
                    }}
                    className={`flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 ${question.correctOptionIndex === index ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300'}`}
                    placeholder={`الخيار ${index + 1}`}
                  />
                </div>
              ))}
              <p className="text-xs text-gray-500 mt-2">اختر الزر الدائري بجانب الإجابة الصحيحة.</p>
            </div>
          )}

          {question.type === 'true_false' && (
            <div className="space-y-3">
              <label className="block text-sm font-bold text-gray-700">الإجابة الصحيحة</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tf"
                    checked={question.correctOptionIndex === 0}
                    onChange={() => setQuestion(prev => ({ ...prev, correctOptionIndex: 0, options: ['صح', 'خطأ'] }))}
                    className="w-5 h-5 text-emerald-600"
                  />
                  <span className="font-bold">صح</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tf"
                    checked={question.correctOptionIndex === 1}
                    onChange={() => setQuestion(prev => ({ ...prev, correctOptionIndex: 1, options: ['صح', 'خطأ'] }))}
                    className="w-5 h-5 text-emerald-600"
                  />
                  <span className="font-bold">خطأ</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">شرح الإجابة (اختياري)</label>
            <RichTextEditor
              value={question.explanation || ''}
              onChange={value => setQuestion(prev => ({ ...prev, explanation: value }))}
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors">
            إلغاء
          </button>
          <button
            onClick={handleValidatedSave}
            className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <Save size={18} /> حفظ السؤال
          </button>
        </div>
      </div>
    </div>
  );
};

