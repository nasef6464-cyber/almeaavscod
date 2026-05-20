import React, { useEffect, useMemo, useState } from 'react';
import { generateQuizQuestion } from '../services/geminiService';
import { Card } from './ui/Card';
import { Sparkles, Check, RefreshCw, Plus, Trash2, Save, FileText } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Question, Quiz } from '../types';

interface GeneratedQuestion {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    sourceTopic: string;
}

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const QuizGenerator: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [generatedQuestion, setGeneratedQuestion] = useState<GeneratedQuestion | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [quizQuestions, setQuizQuestions] = useState<GeneratedQuestion[]>([]);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);
    const [selectedPathId, setSelectedPathId] = useState('');
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [selectedSectionId, setSelectedSectionId] = useState('');
    const [selectedSkillId, setSelectedSkillId] = useState('');
    const { addQuestion, addQuiz, paths, subjects, sections, skills } = useStore();

    const availableSubjects = useMemo(
        () => subjects.filter((subject) => !selectedPathId || subject.pathId === selectedPathId),
        [selectedPathId, subjects],
    );

    const availableSections = useMemo(
        () => sections.filter((section) => section.subjectId === selectedSubjectId),
        [sections, selectedSubjectId],
    );

    const availableSkills = useMemo(
        () => skills.filter((skill) => skill.subjectId === selectedSubjectId && skill.sectionId === selectedSectionId),
        [selectedSectionId, selectedSubjectId, skills],
    );

    useEffect(() => {
        if (selectedPathId && paths.some((path) => path.id === selectedPathId)) return;

        const firstSkill = skills[0];
        const firstSubject = firstSkill
            ? subjects.find((subject) => subject.id === firstSkill.subjectId)
            : subjects[0];
        const nextPathId = firstSubject?.pathId || paths[0]?.id || '';

        setSelectedPathId(nextPathId);
    }, [paths, selectedPathId, skills, subjects]);

    useEffect(() => {
        const currentSubjectStillValid = availableSubjects.some((subject) => subject.id === selectedSubjectId);
        if (currentSubjectStillValid) return;

        const firstSubjectWithSkill = availableSubjects.find((subject) =>
            skills.some((skill) => skill.subjectId === subject.id),
        );
        setSelectedSubjectId(firstSubjectWithSkill?.id || availableSubjects[0]?.id || '');
    }, [availableSubjects, selectedSubjectId, skills]);

    useEffect(() => {
        const currentSectionStillValid = availableSections.some((section) => section.id === selectedSectionId);
        if (currentSectionStillValid) return;

        const firstSectionWithSkill = availableSections.find((section) =>
            skills.some((skill) => skill.sectionId === section.id),
        );
        setSelectedSectionId(firstSectionWithSkill?.id || availableSections[0]?.id || '');
    }, [availableSections, selectedSectionId, skills]);

    useEffect(() => {
        const currentSkillStillValid = availableSkills.some((skill) => skill.id === selectedSkillId);
        if (currentSkillStillValid) return;

        setSelectedSkillId(availableSkills[0]?.id || '');
    }, [availableSkills, selectedSkillId]);

    const defaultTaxonomy = useMemo(() => {
        const subject = subjects.find((candidate) => candidate.id === selectedSubjectId);
        if (!subject) {
            return null;
        }

        const section = sections.find((candidate) => candidate.id === selectedSectionId && candidate.subjectId === subject.id);
        if (!section) {
            return null;
        }

        const skill = skills.find((candidate) => candidate.id === selectedSkillId && candidate.subjectId === subject.id && candidate.sectionId === section.id);
        if (!skill) {
            return null;
        }

        return { subject, section, skill };
    }, [sections, selectedSectionId, selectedSkillId, selectedSubjectId, skills, subjects]);

    const handleGenerate = async () => {
        if (!topic.trim()) return;
        setLoading(true);
        setStatusMessage(null);
        setStatusType(null);

        try {
            const result = await generateQuizQuestion(topic.trim());
            if (!result) {
                throw new Error('تعذر توليد سؤال جديد الآن.');
            }

            setGeneratedQuestion({
                ...result,
                sourceTopic: topic.trim(),
            });
        } catch (error) {
            setStatusType('error');
            setStatusMessage(error instanceof Error ? error.message : 'تعذر توليد السؤال الآن.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddToQuiz = () => {
        if (!generatedQuestion) {
            return;
        }

        setQuizQuestions((current) => [...current, generatedQuestion]);
        setGeneratedQuestion(null);
        setTopic('');
        setStatusMessage(null);
        setStatusType(null);
    };

    const handleDeleteQuestion = (index: number) => {
        setQuizQuestions((current) => current.filter((_, currentIndex) => currentIndex !== index));
    };

    const handleSaveDraft = async () => {
        if (quizQuestions.length === 0) {
            setStatusType('error');
            setStatusMessage('أضف سؤالًا واحدًا على الأقل قبل حفظ المسودة.');
            return;
        }

        if (!defaultTaxonomy) {
            setStatusType('error');
            setStatusMessage('لا توجد مادة ومهارة صالحة في مركز المهارات لحفظ المسودة عليها الآن.');
            return;
        }

        setSaving(true);
        setStatusMessage(null);
        setStatusType(null);

        try {
            const questionIds = quizQuestions.map(() => createId('ai-question'));

            const questionPayloads = quizQuestions.map((questionItem, index): Question => ({
                id: questionIds[index],
                text: questionItem.question,
                options: questionItem.options.slice(0, 4),
                correctOptionIndex: Math.min(questionItem.correctIndex, Math.max(questionItem.options.length - 1, 0)),
                explanation: questionItem.explanation,
                pathId: defaultTaxonomy.subject.pathId,
                subject: defaultTaxonomy.subject.id,
                sectionId: defaultTaxonomy.section.id,
                skillIds: [defaultTaxonomy.skill.id],
                difficulty: 'Medium',
                type: 'mcq',
            }));

            await Promise.all(questionPayloads.map((questionPayload) => addQuestion(questionPayload)));
            const leadingTopic = quizQuestions[0]?.sourceTopic || topic.trim() || defaultTaxonomy.subject.name;
            const quizPayload: Quiz = {
                id: createId('ai-quiz'),
                title: `مسودة ذكية - ${leadingTopic}`,
                description: `تم إنشاء هذه المسودة من مولد الأسئلة الذكي وربطها مبدئيًا بالمادة ${defaultTaxonomy.subject.name} والمهارة الرئيسة ${defaultTaxonomy.section.name}. راجعها من مركز الاختبارات قبل النشر.`,
                pathId: defaultTaxonomy.subject.pathId,
                subjectId: defaultTaxonomy.subject.id,
                sectionId: defaultTaxonomy.section.id,
                type: 'quiz',
                mode: 'regular',
                settings: {
                    showExplanations: true,
                    showAnswers: true,
                    maxAttempts: 1,
                    passingScore: 70,
                    timeLimit: 30,
                },
                access: {
                    type: 'private',
                },
                questionIds,
                createdAt: Date.now(),
                isPublished: false,
                skillIds: [defaultTaxonomy.skill.id],
                targetGroupIds: [],
                targetUserIds: [],
            };

            addQuiz(quizPayload);

            setQuizQuestions([]);
            setGeneratedQuestion(null);
            setTopic('');
            setStatusType('success');
            setStatusMessage(`تم حفظ المسودة فعليًا داخل مركز الاختبارات على مادة ${defaultTaxonomy.subject.name} والمهارة ${defaultTaxonomy.skill.name}.`);
        } catch (error) {
            setStatusType('error');
            setStatusMessage(error instanceof Error ? error.message : 'تعذر حفظ المسودة الآن.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-8">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-indigo-800 mb-2">مولد الأسئلة الذكي</h1>
                <p className="text-gray-500">ابنِ اختبارك بسرعة باستخدام الذكاء الاصطناعي</p>
            </div>

            {defaultTaxonomy && (
                <div className="bg-white border border-indigo-100 rounded-2xl p-4 text-sm text-gray-600 shadow-sm">
                    سيتم حفظ المسودة مبدئيًا داخل <span className="font-bold text-indigo-700">{defaultTaxonomy.subject.name}</span>
                    {' '}ثم <span className="font-bold text-indigo-700">{defaultTaxonomy.section.name}</span>
                    {' '}ثم <span className="font-bold text-indigo-700">{defaultTaxonomy.skill.name}</span>.
                </div>
            )}

            {statusMessage && (
                <div
                    className={`rounded-2xl p-4 text-sm font-medium border ${
                        statusType === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                >
                    {statusMessage}
                </div>
            )}

            <div className="grid lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <Card className="p-6 border-t-4 border-t-indigo-500">
                        <h2 className="font-bold text-xl text-gray-800 mb-6 flex items-center gap-2">
                            <Sparkles className="text-indigo-600" size={24} />
                            توليد سؤال جديد
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                            <select
                                value={selectedPathId}
                                onChange={(event) => {
                                    setSelectedPathId(event.target.value);
                                    setSelectedSubjectId('');
                                    setSelectedSectionId('');
                                    setSelectedSkillId('');
                                }}
                                className="px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                            >
                                <option value="">اختر المسار</option>
                                {paths.map((path) => (
                                    <option key={path.id} value={path.id}>{path.name}</option>
                                ))}
                            </select>
                            <select
                                value={selectedSubjectId}
                                onChange={(event) => {
                                    setSelectedSubjectId(event.target.value);
                                    setSelectedSectionId('');
                                    setSelectedSkillId('');
                                }}
                                className="px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                            >
                                <option value="">اختر المادة</option>
                                {availableSubjects.map((subject) => (
                                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                                ))}
                            </select>
                            <select
                                value={selectedSectionId}
                                onChange={(event) => {
                                    setSelectedSectionId(event.target.value);
                                    setSelectedSkillId('');
                                }}
                                className="px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                            >
                                <option value="">اختر المهارة الرئيسية</option>
                                {availableSections.map((section) => (
                                    <option key={section.id} value={section.id}>{section.name}</option>
                                ))}
                            </select>
                            <select
                                value={selectedSkillId}
                                onChange={(event) => setSelectedSkillId(event.target.value)}
                                className="px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                            >
                                <option value="">اختر المهارة الفرعية</option>
                                {availableSkills.map((skill) => (
                                    <option key={skill.id} value={skill.id}>{skill.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-3 mb-6">
                            <input
                                type="text"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="الموضوع (مثال: الجاذبية، الأدب الأموي...)"
                                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && void handleGenerate()}
                            />
                            <button
                                onClick={() => void handleGenerate()}
                                disabled={loading || !topic.trim()}
                                className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md"
                            >
                                {loading ? <RefreshCw size={20} className="animate-spin" /> : <Sparkles size={20} />}
                                <span>توليد</span>
                            </button>
                        </div>

                        {generatedQuestion && (
                            <div className="animate-scale-up space-y-4">
                                <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="font-bold text-lg text-gray-800 leading-snug">{generatedQuestion.question}</h3>
                                        <span className="bg-indigo-100 text-indigo-600 text-xs font-bold px-2 py-1 rounded">AI</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {generatedQuestion.options.map((opt: string, idx: number) => (
                                            <div
                                                key={idx}
                                                className={`p-3 rounded-lg border text-sm flex items-center justify-between transition-colors ${
                                                    idx === generatedQuestion.correctIndex
                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold'
                                                        : 'bg-white border-gray-200 text-gray-600'
                                                }`}
                                            >
                                                <span>{opt}</span>
                                                {idx === generatedQuestion.correctIndex && <Check size={18} />}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white border border-gray-200 p-4 rounded-xl text-sm">
                                    <span className="font-bold text-indigo-600 mb-1 block flex items-center gap-1">
                                        <FileText size={14} /> الشرح:
                                    </span>
                                    <p className="text-gray-600 leading-relaxed">{generatedQuestion.explanation}</p>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={handleAddToQuiz}
                                        className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5 transform"
                                    >
                                        <Plus size={20} />
                                        إضافة للاختبار
                                    </button>
                                    <button
                                        onClick={() => setGeneratedQuestion(null)}
                                        className="px-6 py-3 border border-gray-300 rounded-xl text-gray-500 font-bold hover:bg-gray-50 transition-colors"
                                    >
                                        إلغاء
                                    </button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="p-6 h-full bg-gray-50 border-2 border-dashed border-gray-200 min-h-[400px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                                <FileText size={24} className="text-gray-500" />
                                مسودة الاختبار ({quizQuestions.length})
                            </h2>
                            {quizQuestions.length > 0 && (
                                <button
                                    className="bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-50 transition-colors flex items-center gap-2 disabled:opacity-60"
                                    onClick={() => void handleSaveDraft()}
                                    disabled={saving}
                                >
                                    <Save size={16} />
                                    {saving ? 'جارٍ الحفظ...' : 'حفظ المسودة'}
                                </button>
                            )}
                        </div>

                        {quizQuestions.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-12">
                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <Plus size={40} className="opacity-30" />
                                </div>
                                <p className="font-bold">لم تتم إضافة أسئلة بعد</p>
                                <p className="text-sm">استخدم المولد لإضافة أسئلة إلى القائمة</p>
                            </div>
                        ) : (
                            <div className="space-y-4 overflow-y-auto pr-2 max-h-[600px]">
                                {quizQuestions.map((q, idx) => (
                                    <div key={`${q.sourceTopic}-${idx}`} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm group relative hover:border-indigo-200 transition-colors">
                                        <button
                                            onClick={() => handleDeleteQuestion(idx)}
                                            className="absolute top-3 left-3 text-gray-300 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded-full"
                                            title="حذف السؤال"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <div className="flex gap-4">
                                            <span className="bg-indigo-50 text-indigo-600 w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm shrink-0 border border-indigo-100">
                                                {idx + 1}
                                            </span>
                                            <div className="flex-1">
                                                <p className="font-bold text-gray-800 text-base mb-2">{q.question}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 font-medium">
                                                        الإجابة: {q.options[q.correctIndex]}
                                                    </span>
                                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                                                        {q.options.length} خيارات
                                                    </span>
                                                    <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                                        {q.sourceTopic}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};
