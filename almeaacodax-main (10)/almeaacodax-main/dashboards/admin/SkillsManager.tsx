import React, { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { Skill, CategoryPath, CategorySubject, CategorySection } from '../../types';
import { Target, Search, Filter, Plus, BookOpen, HelpCircle, Edit2, Trash2, Link as LinkIcon, Unlink, FolderTree, BarChart3, TrendingUp, TrendingDown, AlertCircle, FileText } from 'lucide-react';

export const SkillsManager: React.FC = () => {
    const { 
        skills, paths, subjects, sections, lessons, libraryItems, quizzes, questionAttempts, questions,
        createSkill, updateSkill, deleteSkill, 
        linkSkillToLesson, unlinkSkillFromLesson,
        addPath, addSubject, addSection 
    } = useStore();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [pathFilter, setPathFilter] = useState<string>('all');
    const [subjectFilter, setSubjectFilter] = useState<string>('all');
    const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
    const [activeTab, setActiveTab] = useState<'skills' | 'taxonomy' | 'reports'>('skills');
    const [taxonomyError, setTaxonomyError] = useState('');

    // Taxonomy form states
    const [newPathName, setNewPathName] = useState('');
    const [newSubjectName, setNewSubjectName] = useState('');
    const [selectedPathForSubject, setSelectedPathForSubject] = useState('');
    const [newSectionName, setNewSectionName] = useState('');
    const [selectedSubjectForSection, setSelectedSubjectForSection] = useState('');

    const filteredSkills = skills.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesPath = pathFilter === 'all' || s.pathId === pathFilter;
        const matchesSubject = subjectFilter === 'all' || s.subjectId === subjectFilter;
        return matchesSearch && matchesPath && matchesSubject;
    });

    const getPathName = (pathId: string) => paths?.find(p => p.id === pathId)?.name || 'غير محدد';
    const getSubjectName = (subjectId: string) => subjects?.find(s => s.id === subjectId)?.name || 'غير محدد';
    const getSectionName = (sectionId: string) => sections?.find(s => s.id === sectionId)?.name || 'غير محدد';

    const handleCreateSkill = () => {
        if (!paths?.length || !subjects?.length || !sections?.length) {
            return;
        }
        const newSkill: Skill = {
            id: `sk_${Date.now()}`,
            name: 'مهارة جديدة',
            pathId: (pathFilter !== 'all' ? paths.find(p => p.id === pathFilter) || paths[0] : paths[0]).id,
            subjectId: (
                subjectFilter !== 'all'
                    ? subjects.find(s => s.id === subjectFilter)
                    : subjects.find(s => s.pathId === ((pathFilter !== 'all' ? paths.find(p => p.id === pathFilter) || paths[0] : paths[0]).id)) || subjects[0]
            )!.id,
            sectionId: sections.find(section => section.subjectId === (
                subjectFilter !== 'all'
                    ? subjects.find(s => s.id === subjectFilter)
                    : subjects.find(s => s.pathId === ((pathFilter !== 'all' ? paths.find(p => p.id === pathFilter) || paths[0] : paths[0]).id)) || subjects[0]
            )!.id)?.id || sections[0].id,
            description: 'وصف المهارة هنا...',
            lessonIds: [],
            questionIds: [],
            createdAt: Date.now()
        };
        createSkill(newSkill);
        setSelectedSkill(newSkill);
    };

    const handleCreateSkillWithFeedback = () => {
        if (!paths?.length || !subjects?.length || !sections?.length) {
            setTaxonomyError('يجب إضافة مسار ومادة ومهارة رئيسة واحدة على الأقل قبل إنشاء مهارة.');
            return;
        }

        setTaxonomyError('');
        handleCreateSkill();
    };

    const handleAddPath = () => {
        if (!newPathName.trim()) return;
        addPath({ id: `p_${Date.now()}`, name: newPathName });
        setNewPathName('');
    };

    const handleAddSubject = () => {
        if (!newSubjectName.trim() || !selectedPathForSubject) return;
        addSubject({ id: `sub_${Date.now()}`, pathId: selectedPathForSubject, name: newSubjectName });
        setNewSubjectName('');
    };

    const handleAddSection = () => {
        if (!newSectionName.trim() || !selectedSubjectForSection) return;
        addSection({ id: `sec_${Date.now()}`, subjectId: selectedSubjectForSection, name: newSectionName });
        setNewSectionName('');
    };

    // Calculate skill reports
    const skillReports = useMemo(() => {
        return skills.map(skill => {
            // Find all questions linked to this skill
            const skillQuestions = questions.filter(q => q.skillIds?.includes(skill.id));
            const questionIds = skillQuestions.map(q => q.id);
            const lessonCount = lessons.filter(lesson => lesson.skillIds?.includes(skill.id)).length;
            const libraryCount = libraryItems.filter(item => item.skillIds?.includes(skill.id)).length;
            const quizCount = quizzes.filter(quiz => {
                const directSkillMatch = quiz.skillIds?.includes(skill.id);
                const measuredByQuestion = (quiz.questionIds || []).some(questionId => {
                    const question = questions.find(q => q.id === questionId);
                    return question?.skillIds?.includes(skill.id);
                });
                return directSkillMatch || measuredByQuestion;
            }).length;
            
            // Find all attempts for these questions
            const attempts = questionAttempts.filter(a => questionIds.includes(a.questionId));
            
            const totalAttempts = attempts.length;
            const correctAttempts = attempts.filter(a => a.isCorrect).length;
            const successRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
            
            let status: 'weak' | 'average' | 'strong' | 'no_data' = 'no_data';
            if (totalAttempts > 0) {
                if (successRate < 50) status = 'weak';
                else if (successRate >= 80) status = 'strong';
                else status = 'average';
            }

            let recommendation = 'المستوى جيد';
            if (status === 'no_data') {
                recommendation = questionIds.length === 0
                    ? 'ابدأ بربط أسئلة تقيس هذه المهارة'
                    : 'انتظر محاولات طلابية لبدء التحليل';
            } else if (status === 'weak') {
                if (lessonCount === 0) {
                    recommendation = 'أضف شرحًا أو درسًا جديدًا لهذه المهارة';
                } else if (questionIds.length < 3) {
                    recommendation = 'زِد عدد الأسئلة المرتبطة بهذه المهارة';
                } else if (quizCount === 0) {
                    recommendation = 'أنشئ اختبار ساهر أو اختبارًا مركزيًا لهذه المهارة';
                } else if (libraryCount === 0) {
                    recommendation = 'أضف ملف مراجعة أو ملخصًا داعمًا لهذه المهارة';
                } else {
                    recommendation = 'راجع الشرح الحالي وكثّف التدريب العلاجي';
                }
            } else if (status === 'average') {
                recommendation = 'يمكن رفع الإتقان بإضافة تدريب موجه أو مراجعة قصيرة';
            }

            return {
                ...skill,
                totalAttempts,
                correctAttempts,
                successRate,
                status,
                questionCount: questionIds.length,
                lessonCount,
                libraryCount,
                quizCount,
                recommendation,
            };
        }).sort((a, b) => a.successRate - b.successRate); // Sort by weakest first
    }, [skills, questions, lessons, libraryItems, quizzes, questionAttempts]);

    const skillsNeedingContent = useMemo(
        () => skillReports.filter(report => report.lessonCount === 0 || report.quizCount === 0 || report.libraryCount === 0).length,
        [skillReports]
    );

    const weakSkillsWithoutQuizzes = useMemo(
        () => skillReports.filter(report => report.status === 'weak' && report.quizCount === 0).length,
        [skillReports]
    );

    const weakestPathSummaries = useMemo(() => {
        const pathMap = new Map<string, {
            pathId: string;
            skillsCount: number;
            weakCount: number;
            attempts: number;
            masterySum: number;
        }>();

        skillReports.forEach(report => {
            const current = pathMap.get(report.pathId) || {
                pathId: report.pathId,
                skillsCount: 0,
                weakCount: 0,
                attempts: 0,
                masterySum: 0,
            };

            current.skillsCount += 1;
            current.attempts += report.totalAttempts;
            current.masterySum += report.totalAttempts > 0 ? report.successRate : 0;
            if (report.status === 'weak') current.weakCount += 1;
            pathMap.set(report.pathId, current);
        });

        return Array.from(pathMap.values())
            .map(item => ({
                ...item,
                pathName: getPathName(item.pathId),
                averageMastery: item.skillsCount > 0 ? Math.round(item.masterySum / item.skillsCount) : 0,
                actionHint:
                    item.weakCount === 0
                        ? 'المسار مستقر حاليًا، استمر في المتابعة الدورية.'
                        : (item.skillsCount > 0 ? Math.round(item.masterySum / item.skillsCount) : 0) < 50
                            ? 'راجع المواد الأضعف داخل هذا المسار وزِد الشرح العلاجي والاختبارات الموجهة.'
                            : 'ركّز على المهارات الضعيفة داخل هذا المسار واربطها بتدريب إضافي سريع.',
            }))
            .sort((a, b) => a.averageMastery - b.averageMastery || b.weakCount - a.weakCount)
            .slice(0, 3);
    }, [skillReports]);

    const weakestSubjectSummaries = useMemo(() => {
        const subjectMap = new Map<string, {
            subjectId: string;
            weakCount: number;
            skillsCount: number;
            masterySum: number;
        }>();

        skillReports.forEach(report => {
            const current = subjectMap.get(report.subjectId) || {
                subjectId: report.subjectId,
                weakCount: 0,
                skillsCount: 0,
                masterySum: 0,
            };

            current.skillsCount += 1;
            current.masterySum += report.totalAttempts > 0 ? report.successRate : 0;
            if (report.status === 'weak') current.weakCount += 1;
            subjectMap.set(report.subjectId, current);
        });

        return Array.from(subjectMap.values())
            .map(item => ({
                ...item,
                subjectName: getSubjectName(item.subjectId),
                averageMastery: item.skillsCount > 0 ? Math.round(item.masterySum / item.skillsCount) : 0,
                actionHint:
                    item.weakCount === 0
                        ? 'المادة متوازنة حاليًا، ويمكن الاكتفاء بالمتابعة.'
                        : (item.skillsCount > 0 ? Math.round(item.masterySum / item.skillsCount) : 0) < 50
                            ? 'هذه المادة تحتاج شرحًا إضافيًا واختبارًا علاجيًا على المهارات الأضعف.'
                            : 'أضف تدريبًا قصيرًا أو ملف مراجعة للمهارات المتوسطة داخل هذه المادة.',
            }))
            .sort((a, b) => a.averageMastery - b.averageMastery || b.weakCount - a.weakCount)
            .slice(0, 4);
    }, [skillReports]);

    const weakestSectionSummaries = useMemo(() => {
        const sectionMap = new Map<string, {
            sectionId: string;
            weakCount: number;
            skillsCount: number;
            masterySum: number;
            lessonGaps: number;
            quizGaps: number;
        }>();

        skillReports.forEach(report => {
            const current = sectionMap.get(report.sectionId) || {
                sectionId: report.sectionId,
                weakCount: 0,
                skillsCount: 0,
                masterySum: 0,
                lessonGaps: 0,
                quizGaps: 0,
            };

            current.skillsCount += 1;
            current.masterySum += report.totalAttempts > 0 ? report.successRate : 0;
            if (report.status === 'weak') current.weakCount += 1;
            if (report.lessonCount === 0) current.lessonGaps += 1;
            if (report.quizCount === 0) current.quizGaps += 1;
            sectionMap.set(report.sectionId, current);
        });

        return Array.from(sectionMap.values())
            .map(item => ({
                ...item,
                sectionName: getSectionName(item.sectionId),
                averageMastery: item.skillsCount > 0 ? Math.round(item.masterySum / item.skillsCount) : 0,
                actionHint:
                    item.lessonGaps > 0
                        ? 'ابدأ بإضافة شرح مباشر لهذه المهارة الرئيسة قبل توسيع بنك الأسئلة.'
                        : item.quizGaps > 0
                            ? 'أضف اختبارًا موجّهًا لهذه المهارة الرئيسة لتفعيل القياس العلاجي.'
                            : item.weakCount > 0
                                ? 'المحتوى موجود، والأولوية الآن لتكثيف التدريب والمتابعة.'
                                : 'التغطية الحالية جيدة، استمر في المراقبة والتحسين التدريجي.',
            }))
            .sort((a, b) => a.averageMastery - b.averageMastery || b.weakCount - a.weakCount)
            .slice(0, 4);
    }, [skillReports]);

    const availableSubjectsForSelectedSkill = useMemo(
        () => selectedSkill ? subjects.filter(subject => subject.pathId === selectedSkill.pathId) : [],
        [selectedSkill, subjects]
    );

    const availableSectionsForSelectedSkill = useMemo(
        () => selectedSkill ? sections.filter(section => section.subjectId === selectedSkill.subjectId) : [],
        [selectedSkill, sections]
    );

    const linkedLessons = useMemo(() => {
        if (!selectedSkill) return [];
        return lessons.filter(lesson =>
            lesson.subjectId === selectedSkill.subjectId &&
            (!lesson.sectionId || lesson.sectionId === selectedSkill.sectionId) &&
            (lesson.skillIds || []).includes(selectedSkill.id)
        );
    }, [lessons, selectedSkill]);

    const linkedQuestions = useMemo(() => {
        if (!selectedSkill) return [];
        return questions.filter(question =>
            question.subject === selectedSkill.subjectId &&
            (!question.sectionId || question.sectionId === selectedSkill.sectionId) &&
            (question.skillIds || []).includes(selectedSkill.id)
        );
    }, [questions, selectedSkill]);

    const linkableLessons = useMemo(() => {
        if (!selectedSkill) return [];
        return lessons.filter(lesson =>
            lesson.pathId === selectedSkill.pathId &&
            lesson.subjectId === selectedSkill.subjectId &&
            (!lesson.sectionId || lesson.sectionId === selectedSkill.sectionId)
        );
    }, [lessons, selectedSkill]);

    const linkedQuizzes = useMemo(() => {
        if (!selectedSkill) return [];
        return quizzes.filter(quiz =>
            quiz.subjectId === selectedSkill.subjectId &&
            (!quiz.sectionId || quiz.sectionId === selectedSkill.sectionId) &&
            (
                (quiz.skillIds || []).includes(selectedSkill.id) ||
                (quiz.questionIds || []).some(questionId => {
                    const question = questions.find(item => item.id === questionId);
                    return question?.skillIds?.includes(selectedSkill.id);
                })
            )
        );
    }, [quizzes, questions, selectedSkill]);

    const linkedLibraryItems = useMemo(() => {
        if (!selectedSkill) return [];
        return libraryItems.filter(item =>
            item.subjectId === selectedSkill.subjectId &&
            (!item.sectionId || item.sectionId === selectedSkill.sectionId) &&
            (item.skillIds || []).includes(selectedSkill.id)
        );
    }, [libraryItems, selectedSkill]);

    const selectedSkillChecklist = useMemo(() => {
        if (!selectedSkill) return [];

        const actions: string[] = [];
        if (linkedLessons.length === 0) {
            actions.push('هذه المهارة تحتاج شرحًا أو درس فيديو مرتبطًا بها.');
        }
        if (linkedQuestions.length < 3) {
            actions.push('زد عدد الأسئلة المرتبطة حتى يصبح القياس أدق داخل الاختبارات.');
        }
        if (linkedQuizzes.length === 0) {
            actions.push('أنشئ اختبارًا ساهرًا أو اختبارًا مركزيًا لهذه المهارة لبدء القياس العلاجي.');
        }
        if (linkedLibraryItems.length === 0) {
            actions.push('أضف ملف مراجعة أو ملخصًا داعمًا ليستفيد الطالب في الخطة العلاجية.');
        }
        if (actions.length === 0) {
            actions.push('تغطية المهارة جيدة حاليًا، والأولوية الآن للمتابعة والتحسين التدريجي.');
        }

        return actions;
    }, [linkedLessons.length, linkedLibraryItems.length, linkedQuestions.length, linkedQuizzes.length, selectedSkill]);

    if (selectedSkill) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedSkill(null)} className="text-gray-500 hover:text-gray-900">
                        &rarr; عودة للقائمة
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">تفاصيل المهارة</h1>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex-1 space-y-4">
                            <input 
                                type="text" 
                                value={selectedSkill.name || ''}
                                onChange={(e) => {
                                    updateSkill(selectedSkill.id, { name: e.target.value });
                                    setSelectedSkill({ ...selectedSkill, name: e.target.value });
                                }}
                                className="text-2xl font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-amber-500 focus:outline-none px-1 py-1 w-full max-w-md"
                            />
                            
                            <div className="flex flex-wrap gap-3">
                                <select
                                    value={selectedSkill.pathId || ''}
                                    onChange={(e) => {
                                        const nextPathId = e.target.value;
                                        const nextSubject = subjects.find(subject => subject.pathId === nextPathId);
                                        const nextSection = sections.find(section => section.subjectId === nextSubject?.id);
                                        updateSkill(selectedSkill.id, {
                                            pathId: nextPathId,
                                            subjectId: nextSubject?.id || selectedSkill.subjectId,
                                            sectionId: nextSection?.id || selectedSkill.sectionId
                                        });
                                        setSelectedSkill({
                                            ...selectedSkill,
                                            pathId: nextPathId,
                                            subjectId: nextSubject?.id || selectedSkill.subjectId,
                                            sectionId: nextSection?.id || selectedSkill.sectionId
                                        });
                                    }}
                                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-gray-50"
                                >
                                    {paths?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <select
                                    value={selectedSkill.subjectId || ''}
                                    onChange={(e) => {
                                        const nextSubjectId = e.target.value;
                                        const nextSection = sections.find(section => section.subjectId === nextSubjectId);
                                        updateSkill(selectedSkill.id, {
                                            subjectId: nextSubjectId,
                                            sectionId: nextSection?.id || selectedSkill.sectionId
                                        });
                                        setSelectedSkill({
                                            ...selectedSkill,
                                            subjectId: nextSubjectId,
                                            sectionId: nextSection?.id || selectedSkill.sectionId
                                        });
                                    }}
                                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-gray-50"
                                >
                                    {availableSubjectsForSelectedSkill.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <select
                                    value={selectedSkill.sectionId || ''}
                                    onChange={(e) => {
                                        updateSkill(selectedSkill.id, { sectionId: e.target.value });
                                        setSelectedSkill({ ...selectedSkill, sectionId: e.target.value });
                                    }}
                                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-gray-50"
                                >
                                    {availableSectionsForSelectedSkill.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            <textarea 
                                value={selectedSkill.description || ''}
                                onChange={(e) => {
                                    updateSkill(selectedSkill.id, { description: e.target.value });
                                    setSelectedSkill({ ...selectedSkill, description: e.target.value });
                                }}
                                placeholder="وصف المهارة..."
                                className="w-full text-sm text-gray-600 bg-transparent border border-gray-200 focus:border-amber-500 focus:outline-none rounded-lg p-3 resize-none h-24"
                            />
                        </div>
                        <div className="flex gap-2 mr-4">
                            <button 
                                onClick={() => {
                                    if(window.confirm('هل أنت متأكد من حذف هذه المهارة؟')) {
                                        deleteSkill(selectedSkill.id);
                                        setSelectedSkill(null);
                                    }
                                }}
                                className="p-2 text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                        <div className="bg-amber-50 p-4 rounded-lg flex items-center gap-4">
                            <BarChart3 className="text-amber-500" size={24} />
                            <div>
                                <p className="text-sm text-gray-500">الاختبارات المرتبطة</p>
                                <p className="text-xl font-bold text-gray-900">{linkedQuizzes.length}</p>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg flex items-center gap-4">
                            <FileText className="text-gray-600" size={24} />
                            <div>
                                <p className="text-sm text-gray-500">ملفات المراجعة</p>
                                <p className="text-xl font-bold text-gray-900">{linkedLibraryItems.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-blue-50 p-4 rounded-lg flex items-center gap-4">
                            <BookOpen className="text-blue-500" size={24} />
                            <div>
                                <p className="text-sm text-gray-500">الدروس المرتبطة</p>
                                <p className="text-xl font-bold text-gray-900">{linkedLessons.length}</p>
                            </div>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-lg flex items-center gap-4">
                            <HelpCircle className="text-emerald-500" size={24} />
                            <div>
                                <p className="text-sm text-gray-500">الأسئلة المرتبطة</p>
                                <p className="text-xl font-bold text-gray-900">{linkedQuestions.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="mb-8 rounded-xl border border-amber-100 bg-amber-50 p-4">
                        <h3 className="font-bold text-gray-900 mb-3">أولوية التطوير لهذه المهارة</h3>
                        <div className="space-y-2">
                            {selectedSkillChecklist.map((item, index) => (
                                <div key={`${selectedSkill.id}-check-${index}`} className="text-sm text-gray-700 flex items-start gap-2">
                                    <span className="mt-1 w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></span>
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Linking Section */}
                    <div className="border-t border-gray-100 pt-6">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <LinkIcon size={18} className="text-gray-400" />
                            ربط المهارة بالدروس
                        </h3>
                        <div className="space-y-3">
                            {linkableLessons.map(lesson => {
                                const isLinked = linkedLessons.some(item => item.id === lesson.id);
                                return (
                                    <div key={lesson.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <span className="text-sm font-medium text-gray-800">{lesson.title}</span>
                                        <button
                                            onClick={() => {
                                                if (isLinked) {
                                                    unlinkSkillFromLesson(selectedSkill.id, lesson.id);
                                                    setSelectedSkill({ ...selectedSkill, lessonIds: (selectedSkill.lessonIds || []).filter(id => id !== lesson.id) });
                                                } else {
                                                    linkSkillToLesson(selectedSkill.id, lesson.id);
                                                    setSelectedSkill({ ...selectedSkill, lessonIds: [...(selectedSkill.lessonIds || []), lesson.id] });
                                                }
                                            }}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                                isLinked 
                                                ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100' 
                                                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                                            }`}
                                        >
                                            {isLinked ? <Unlink size={14} /> : <LinkIcon size={14} />}
                                            {isLinked ? 'إلغاء الربط' : 'ربط'}
                                        </button>
                                    </div>
                                );
                            })}
                            {linkableLessons.length === 0 && (
                                <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4">
                                    لا توجد دروس متاحة حاليًا لنفس المسار والمادة والمهارة الرئيسة. أضف درسًا من مركز الدروس ثم اربطه بهذه المهارة.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-6 mt-6">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <BarChart3 size={18} className="text-gray-400" />
                            الاختبارات المرتبطة بهذه المهارة
                        </h3>
                        <div className="space-y-3">
                            {linkedQuizzes.map(quiz => (
                                <div key={quiz.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="text-right">
                                        <div className="text-sm font-medium text-gray-800">{quiz.title}</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {quiz.mode === 'saher' ? 'ساهر' : quiz.mode === 'central' ? 'مركزي' : 'عادي'} - {quiz.questionIds.length} سؤال
                                        </div>
                                    </div>
                                    <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700">
                                        مرتبط فعليًا
                                    </span>
                                </div>
                            ))}
                            {linkedQuizzes.length === 0 && (
                                <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4">
                                    لا يوجد اختبار مرتبط بهذه المهارة بعد. إذا كانت المهارة ضعيفة فالأفضل إنشاء اختبار ساهر أو اختبار مركزي لها.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-6 mt-6">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <FileText size={18} className="text-gray-400" />
                            ملفات المراجعة المرتبطة بهذه المهارة
                        </h3>
                        <div className="space-y-3">
                            {linkedLibraryItems.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="text-right">
                                        <div className="text-sm font-medium text-gray-800">{item.title}</div>
                                        <div className="text-xs text-gray-500 mt-1">{item.type === 'pdf' ? 'PDF' : item.type === 'video' ? 'فيديو' : 'ملف'}</div>
                                    </div>
                                    <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-700">
                                        مورد داعم
                                    </span>
                                </div>
                            ))}
                            {linkedLibraryItems.length === 0 && (
                                <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4">
                                    لا يوجد ملف مراجعة مرتبط بهذه المهارة بعد. إضافة ملخص أو ملف مراجعة هنا ستقوي مسار العلاج والتوصيات.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">إدارة المهارات والتصنيفات</h1>
                    <p className="text-gray-500 text-sm mt-1">بناء شجرة المعرفة وربطها بالمحتوى التعليمي</p>
                </div>
                <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                    <button 
                        onClick={() => {
                            setTaxonomyError('');
                            setActiveTab('skills');
                        }}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'skills' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        المهارات
                    </button>
                    <button 
                        onClick={() => {
                            setTaxonomyError('');
                            setActiveTab('taxonomy');
                        }}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'taxonomy' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        التصنيفات (المسارات والمواد والمهارات الرئيسة)
                    </button>
                    <button 
                        onClick={() => {
                            setTaxonomyError('');
                            setActiveTab('reports');
                        }}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'reports' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        تقارير المهارات
                    </button>
                </div>
            </div>

            {activeTab === 'skills' ? (
                <>
                    {/* Filters */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="ابحث باسم المهارة..." 
                                className="w-full pl-4 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter size={18} className="text-gray-400" />
                            <select 
                                className="border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                                value={pathFilter}
                                onChange={(e) => {
                                    setPathFilter(e.target.value);
                                    setSubjectFilter('all'); // Reset subject when path changes
                                }}
                            >
                                <option value="all">جميع المسارات</option>
                                {paths?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <select 
                                className="border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                                value={subjectFilter}
                                onChange={(e) => setSubjectFilter(e.target.value)}
                                disabled={pathFilter === 'all'}
                            >
                                <option value="all">جميع المواد</option>
                                {subjects?.filter(s => pathFilter === 'all' || s.pathId === pathFilter).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        {taxonomyError && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 md:min-w-[320px]">
                                {taxonomyError}
                            </div>
                        )}
                        <button 
                            onClick={handleCreateSkillWithFeedback}
                            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm whitespace-nowrap"
                        >
                            <Plus size={18} />
                            <span>إضافة مهارة</span>
                        </button>
                    </div>

                    {/* Skills Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredSkills?.map(skill => (
                            <div 
                                key={skill.id} 
                                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden flex flex-col"
                                onClick={() => setSelectedSkill(skill)}
                            >
                                {/* Status Indicator */}
                                <div className={`absolute top-0 right-0 w-1 h-full ${(skill.questionIds?.length || 0) === 0 ? 'bg-red-400' : 'bg-emerald-400'}`} />

                                <div className="flex items-start gap-3 mb-3">
                                    <Target size={20} className="text-amber-500 shrink-0 mt-1" />
                                    <div>
                                        <h3 className="font-bold text-gray-900 group-hover:text-amber-600 transition-colors">{skill.name}</h3>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">{getPathName(skill.pathId)}</span>
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px]">{getSubjectName(skill.subjectId)}</span>
                                            <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px]">{getSectionName(skill.sectionId)}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <p className="text-sm text-gray-500 mb-6 line-clamp-2 flex-1">
                                    {skill.description || 'لا يوجد وصف'}
                                </p>
                                
                                <div className="flex items-center gap-4 pt-4 border-t border-gray-50 mt-auto">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                        <BookOpen size={14} className={(skill.lessonIds?.length || 0) > 0 ? 'text-blue-500' : ''} />
                                        <span>{skill.lessonIds?.length || 0} درس</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                        <HelpCircle size={14} className={(skill.questionIds?.length || 0) > 0 ? 'text-emerald-500' : 'text-red-400'} />
                                        <span className={(skill.questionIds?.length || 0) === 0 ? 'text-red-500 font-medium' : ''}>
                                            {skill.questionIds?.length || 0} سؤال
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(!filteredSkills || filteredSkills.length === 0) && (
                            <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-100">
                                لا توجد مهارات تطابق بحثك.
                            </div>
                        )}
                    </div>
                </>
            ) : activeTab === 'taxonomy' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Paths */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-6">
                            <FolderTree className="text-amber-500" size={20} />
                            <h2 className="text-lg font-bold text-gray-900">المسارات</h2>
                        </div>
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="text" 
                                placeholder="اسم المسار الجديد..." 
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                                value={newPathName}
                                onChange={(e) => setNewPathName(e.target.value)}
                            />
                            <button onClick={handleAddPath} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors">
                                <Plus size={18} />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {paths?.map(p => (
                                <div key={p.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm font-medium text-gray-800">
                                    {p.name}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Subjects */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-6">
                            <BookOpen className="text-blue-500" size={20} />
                            <h2 className="text-lg font-bold text-gray-900">المواد الرئيسية</h2>
                        </div>
                        <div className="space-y-3 mb-4">
                            <select 
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                                value={selectedPathForSubject}
                                onChange={(e) => setSelectedPathForSubject(e.target.value)}
                            >
                                <option value="">اختر المسار...</option>
                                {paths?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="اسم المادة..." 
                                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    value={newSubjectName}
                                    onChange={(e) => setNewSubjectName(e.target.value)}
                                    disabled={!selectedPathForSubject}
                                />
                                <button onClick={handleAddSubject} disabled={!selectedPathForSubject} className="bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-3 py-2 rounded-lg transition-colors">
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {subjects?.map(s => (
                                <div key={s.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm flex flex-col gap-1">
                                    <span className="font-medium text-gray-800">{s.name}</span>
                                    <span className="text-xs text-gray-500">{getPathName(s.pathId)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Main Skills */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-6">
                            <Target className="text-purple-500" size={20} />
                            <h2 className="text-lg font-bold text-gray-900">المهارات الرئيسة</h2>
                        </div>
                        <div className="space-y-3 mb-4">
                            <select 
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                                value={selectedSubjectForSection}
                                onChange={(e) => setSelectedSubjectForSection(e.target.value)}
                            >
                                <option value="">اختر المادة...</option>
                                {subjects?.map(s => <option key={s.id} value={s.id}>{s.name} ({getPathName(s.pathId)})</option>)}
                            </select>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="اسم المهارة الرئيسة..."
                                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    value={newSectionName}
                                    onChange={(e) => setNewSectionName(e.target.value)}
                                    disabled={!selectedSubjectForSection}
                                />
                                <button onClick={handleAddSection} disabled={!selectedSubjectForSection} className="bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-3 py-2 rounded-lg transition-colors">
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {sections?.map(s => (
                                <div key={s.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm flex flex-col gap-1">
                                    <span className="font-medium text-gray-800">{s.name}</span>
                                    <span className="text-xs text-gray-500">{getSubjectName(s.subjectId)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : activeTab === 'reports' ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-red-50 text-red-500 rounded-lg">
                                <TrendingDown size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">مهارات تحتاج تطوير</p>
                                <p className="text-2xl font-bold text-gray-900">{skillReports.filter(s => s.status === 'weak').length}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 text-emerald-500 rounded-lg">
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">مهارات قوية</p>
                                <p className="text-2xl font-bold text-gray-900">{skillReports.filter(s => s.status === 'strong').length}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-500 rounded-lg">
                                <BarChart3 size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">إجمالي المحاولات</p>
                                <p className="text-2xl font-bold text-gray-900">{skillReports.reduce((acc, curr) => acc + curr.totalAttempts, 0)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-amber-50 text-amber-500 rounded-lg">
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">مهارات تحتاج استكمال محتوى</p>
                                <p className="text-2xl font-bold text-gray-900">{skillsNeedingContent}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="p-3 bg-purple-50 text-purple-500 rounded-lg">
                                <BarChart3 size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">مهارات ضعيفة بلا اختبار موجّه</p>
                                <p className="text-2xl font-bold text-gray-900">{weakSkillsWithoutQuizzes}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-900 mb-4">أضعف المسارات</h3>
                            <div className="space-y-3">
                                {weakestPathSummaries.map(item => (
                                    <div key={item.pathId} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                                        <div className="font-bold text-gray-800">{item.pathName}</div>
                                        <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-2">
                                            <span>متوسط الإتقان: {item.averageMastery}%</span>
                                            <span>مهارات ضعيفة: {item.weakCount}</span>
                                            <span>إجمالي المهارات: {item.skillsCount}</span>
                                        </div>
                                        <p className="text-xs text-amber-700 mt-3 leading-6">{item.actionHint}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-900 mb-4">أضعف المواد</h3>
                            <div className="space-y-3">
                                {weakestSubjectSummaries.map(item => (
                                    <div key={item.subjectId} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                                        <div className="font-bold text-gray-800">{item.subjectName}</div>
                                        <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-2">
                                            <span>متوسط الإتقان: {item.averageMastery}%</span>
                                            <span>مهارات ضعيفة: {item.weakCount}</span>
                                            <span>إجمالي المهارات: {item.skillsCount}</span>
                                        </div>
                                        <p className="text-xs text-amber-700 mt-3 leading-6">{item.actionHint}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-900 mb-4">أضعف المهارات الرئيسة</h3>
                            <div className="space-y-3">
                                {weakestSectionSummaries.map(item => (
                                    <div key={item.sectionId} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                                        <div className="font-bold text-gray-800">{item.sectionName}</div>
                                        <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-2">
                                            <span>متوسط الإتقان: {item.averageMastery}%</span>
                                            <span>مهارات ضعيفة: {item.weakCount}</span>
                                            <span>بلا دروس: {item.lessonGaps}</span>
                                            <span>بلا اختبارات: {item.quizGaps}</span>
                                        </div>
                                        <p className="text-xs text-amber-700 mt-3 leading-6">{item.actionHint}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">أداء الطلاب حسب المهارة</h2>
                            <p className="text-sm text-gray-500 mt-1">ترتيب المهارات من الأضعف للأقوى بناءً على نسب الإجابات الصحيحة</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-gray-50 text-gray-500 text-sm">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">المهارة</th>
                                        <th className="px-6 py-4 font-medium">التصنيف</th>
                                        <th className="px-6 py-4 font-medium">الأسئلة</th>
                                        <th className="px-6 py-4 font-medium">المحاولات</th>
                                        <th className="px-6 py-4 font-medium">نسبة النجاح</th>
                                        <th className="px-6 py-4 font-medium">الحالة</th>
                                        <th className="px-6 py-4 font-medium">إجراء مقترح</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {skillReports.map(report => (
                                        <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{report.name}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs text-gray-500">
                                                    {getPathName(report.pathId)} &gt; {getSubjectName(report.subjectId)}
                                                </div>
                                                <div className="text-xs text-purple-600 mt-1">
                                                    {getSectionName(report.sectionId)}
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
                                                    <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded">دروس {report.lessonCount}</span>
                                                    <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded">اختبارات {report.quizCount}</span>
                                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">ملفات {report.libraryCount}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{report.questionCount}</td>
                                            <td className="px-6 py-4 text-gray-600">{report.totalAttempts}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-full bg-gray-100 rounded-full h-2 max-w-[100px]">
                                                        <div 
                                                            className={`h-2 rounded-full ${
                                                                report.status === 'weak' ? 'bg-red-500' : 
                                                                report.status === 'strong' ? 'bg-emerald-500' : 
                                                                report.status === 'average' ? 'bg-amber-500' : 'bg-gray-300'
                                                            }`} 
                                                            style={{ width: `${report.totalAttempts > 0 ? report.successRate : 0}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-700">
                                                        {report.totalAttempts > 0 ? `${report.successRate}%` : '-'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {report.status === 'weak' && <span className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-bold flex items-center gap-1 w-max"><TrendingDown size={12}/> ضعف</span>}
                                                {report.status === 'strong' && <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-xs font-bold flex items-center gap-1 w-max"><TrendingUp size={12}/> قوة</span>}
                                                {report.status === 'average' && <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded text-xs font-bold flex items-center gap-1 w-max"><BarChart3 size={12}/> متوسط</span>}
                                                {report.status === 'no_data' && <span className="px-2 py-1 bg-gray-50 text-gray-500 rounded text-xs font-bold flex items-center gap-1 w-max"><AlertCircle size={12}/> لا بيانات</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-2">
                                                    <div className={`text-xs px-3 py-1.5 rounded-lg w-max ${
                                                        report.status === 'weak'
                                                            ? 'bg-red-500 text-white'
                                                            : report.status === 'no_data'
                                                                ? 'bg-gray-100 text-gray-700'
                                                                : report.status === 'average'
                                                                    ? 'bg-amber-50 text-amber-700'
                                                                    : 'bg-emerald-50 text-emerald-700'
                                                    }`}>
                                                        {report.recommendation}
                                                    </div>
                                                    <div className="text-[11px] text-gray-400">
                                                        {report.lessonCount} درس • {report.questionCount} سؤال • {report.quizCount} اختبار • {report.libraryCount} ملف
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 text-[11px]">
                                                        <span className={`px-2 py-1 rounded ${report.lessonCount === 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                                                            {report.lessonCount === 0 ? 'ينقصها شرح' : 'الشرح موجود'}
                                                        </span>
                                                        <span className={`px-2 py-1 rounded ${report.quizCount === 0 ? 'bg-amber-50 text-amber-700' : 'bg-purple-50 text-purple-700'}`}>
                                                            {report.quizCount === 0 ? 'ينقصها اختبار' : 'الاختبار موجود'}
                                                        </span>
                                                        <span className={`px-2 py-1 rounded ${report.libraryCount === 0 ? 'bg-gray-100 text-gray-600' : 'bg-slate-100 text-slate-700'}`}>
                                                            {report.libraryCount === 0 ? 'ينقصها ملف مراجعة' : 'الملف موجود'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {skillReports.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                                لا توجد مهارات لعرض تقاريرها.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

