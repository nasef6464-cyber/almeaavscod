
import React, { useMemo, useState } from 'react';
import { Course } from '../types';
import { 
    PlayCircle, BookOpen, Clock, Star, User, 
    ChevronRight, Share2, Heart, BarChart, 
    CheckCircle, List, Info, FileText, Download,
    Eye, MessageSquare, Send, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SimulatedTestExperience } from './SimulatedTestExperience';
import { PaymentModal } from './PaymentModal';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { openExternalUrl } from '../utils/openExternalUrl';
import { isMockQuiz } from '../utils/quizPlacement';
import { buildQuizRouteWithContext } from '../utils/quizLinks';

interface CourseOverviewProps {
    course: Course;
    onContinue: () => void;
}

type TabType = 'description' | 'syllabus' | 'tests' | 'qa' | 'files';

export const CourseOverview: React.FC<CourseOverviewProps> = ({ course, onContinue }) => {
    const [activeTab, setActiveTab] = useState<TabType>('syllabus');
    const [newQuestion, setNewQuestion] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const { user, enrolledCourses, enrollCourse, completedLessons, quizzes, libraryItems, hasScopedPackageAccess, getMatchingPackage } = useStore();
    const navigate = useNavigate();
    const matchedCoursePackage = getMatchingPackage('courses', course.pathId || course.category, course.subjectId || course.subject);
    const isStaffViewer = ['admin', 'teacher', 'supervisor'].includes(user.role);
    const canShowQuizInCourse = (quiz: (typeof quizzes)[number]) =>
        isStaffViewer || (quiz.isPublished !== false && quiz.showOnPlatform !== false && (!quiz.approvalStatus || quiz.approvalStatus === 'approved'));

    const isEnrolled =
        enrolledCourses.includes(course.id) ||
        (user.subscription?.purchasedCourses || []).includes(course.id) ||
        hasScopedPackageAccess('courses', course.pathId || course.category, course.subjectId || course.subject);
    
    // Calculate real progress
    const totalLessons = course.modules?.reduce((acc, mod) => acc + mod.lessons.length, 0) || 1;
    const completedCount = course.modules?.reduce((acc, mod) => 
        acc + mod.lessons.filter(l => completedLessons.includes(l.id)).length, 0) || 0;
    const progress = Math.round((completedCount / totalLessons) * 100);

    const relatedTests = useMemo(() => {
        const courseSkillIds = new Set(course.skills || []);

        return quizzes
            .filter((quiz) => {
                if (!canShowQuizInCourse(quiz) || !isMockQuiz(quiz)) {
                    return false;
                }

                const sameSubject = quiz.subjectId && course.subjectId && quiz.subjectId === course.subjectId;
                const samePath = quiz.pathId && course.pathId && quiz.pathId === course.pathId;
                const hasSharedSkill = (quiz.skillIds || []).some((skillId) => courseSkillIds.has(skillId));

                return Boolean((sameSubject && samePath) || hasSharedSkill);
            })
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 6)
            .map((quiz) => ({
                id: quiz.id,
                title: quiz.title,
                duration: `${quiz.settings.timeLimit || 30} دقيقة`,
                questions: quiz.questionIds.length,
                type: quiz.mode === 'central' ? 'comprehensive' : quiz.mode === 'saher' ? 'simulated' : 'trial',
                level: quiz.mode === 'central' ? 'مركزي' : quiz.mode === 'saher' ? 'ساهر' : 'تدريبي',
                isLocked: !isEnrolled,
            }));
    }, [canShowQuizInCourse, course.pathId, course.skills, course.subjectId, isEnrolled, quizzes]);
    const explicitCourseTests = useMemo(() => {
        const assessments = Array.isArray(course.assessments) ? course.assessments : [];
        if (assessments.length === 0) return [];

        const quizById = new Map(quizzes.map((quiz) => [String(quiz.id), quiz]));
        const phaseLabel: Record<string, string> = {
            pre_course: 'اختبار قبل الدورة',
            during_course: 'اختبار أثناء الدورة',
            final_course: 'اختبار نهاية الدورة',
        };

        return assessments
            .filter((assessment) => assessment.showOnPlatform !== false)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((assessment) => {
                const quiz = quizById.get(String(assessment.quizId));
                if (!quiz || !canShowQuizInCourse(quiz)) return null;

                const isLocked = assessment.access === 'enrolled_paid' && !isEnrolled;
                return {
                    id: quiz.id,
                    title: `${phaseLabel[assessment.phase] || 'اختبار الدورة'} - ${assessment.title || quiz.title}`,
                    duration: `${quiz.settings.timeLimit || 30} دقيقة`,
                    questions: quiz.questionIds.length,
                    type: assessment.phase === 'final_course' ? 'comprehensive' : 'trial',
                    level: assessment.access === 'free_preview' ? 'مجاني' : 'مدفوع',
                    isLocked,
                };
            })
            .filter(Boolean) as Array<{
                id: string;
                title: string;
                duration: string;
                questions: number;
                type: string;
                level: string;
                isLocked: boolean;
            }>;
    }, [canShowQuizInCourse, course.assessments, isEnrolled, quizzes]);
    const fallbackTests = useMemo(() => {
        const relatedIds = new Set(relatedTests.map((test) => test.id));

        return quizzes
            .filter((quiz) => {
                if (!canShowQuizInCourse(quiz) || !isMockQuiz(quiz) || relatedIds.has(quiz.id)) {
                    return false;
                }

                const sameSubject = quiz.subjectId && course.subjectId && quiz.subjectId === course.subjectId;
                const samePath = quiz.pathId && course.pathId && quiz.pathId === course.pathId;

                return Boolean(sameSubject && samePath);
            })
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 3)
            .map((quiz) => ({
                id: quiz.id,
                title: quiz.title,
                duration: `${quiz.settings.timeLimit || 30} دقيقة`,
                questions: quiz.questionIds.length,
                type: quiz.mode === 'central' ? 'comprehensive' : quiz.mode === 'saher' ? 'simulated' : 'trial',
                level: quiz.mode === 'central' ? 'مركزي' : quiz.mode === 'saher' ? 'ساهر' : 'تدريبي',
                isLocked: !isEnrolled,
            }));
    }, [canShowQuizInCourse, course.pathId, course.subjectId, isEnrolled, quizzes, relatedTests]);
    const relatedFiles = useMemo(() => {
        const courseSkillIds = new Set(course.skills || []);

        return libraryItems
            .filter((item) => {
                const sameSubject = item.subjectId && course.subjectId && item.subjectId === course.subjectId;
                const samePath = item.pathId && course.pathId && item.pathId === course.pathId;
                const hasSharedSkill = (item.skillIds || []).some((skillId) => courseSkillIds.has(skillId));

                return Boolean(item.url && ((sameSubject && samePath) || hasSharedSkill));
            })
            .slice(0, 4);
    }, [course.pathId, course.skills, course.subjectId, libraryItems]);

    const handleEnroll = () => {
        enrollCourse(course.id);
        // Optionally show a success message or redirect
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'description':
                return (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        <h3 className="text-lg sm:text-xl font-black text-gray-900">حول هذه الدورة</h3>
                        <p className="text-gray-600 leading-relaxed">
                            {course.description}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                            {course.features.map((feature, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm text-gray-700">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                    {feature}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                );
            case 'syllabus':
                return (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {course.modules?.map((module, mIdx) => (
                            <div key={module.id} className="space-y-3">
                                <div className="flex items-center gap-2 text-gray-800 font-black">
                                    <ChevronRight size={18} className="text-gray-400" />
                                    <span>{module.title}</span>
                                </div>
                                <div className="space-y-2">
                                    {module.lessons.map((lesson, lIdx) => {
                                        const isCompleted = completedLessons.includes(lesson.id);
                                        return (
                                        <div 
                                            key={lesson.id} 
                                            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group cursor-pointer"
                                            onClick={onContinue}
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs font-bold text-gray-400 w-4">{lIdx + 1}</span>
                                                <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm ${lesson.type === 'quiz' ? 'text-rose-500' : 'text-amber-500'}`}>
                                                    {lesson.type === 'quiz' ? <BarChart size={16} /> : <PlayCircle size={16} />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-700">{lesson.title}</p>
                                                    <p className="text-[10px] text-gray-400">{lesson.type === 'quiz' ? 'اختبار محاكي' : 'درس فيديو'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] text-gray-400">{lesson.duration}</span>
                                                {isCompleted ? (
                                                    <CheckCircle size={16} className="text-emerald-500" />
                                                ) : (
                                                    <div className="w-4 h-4 rounded-full border-2 border-gray-200"></div>
                                                )}
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                        ))}
                    </motion.div>
                );
            case 'tests':
                return (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {explicitCourseTests.length > 0 ? (
                            <SimulatedTestExperience
                                tests={explicitCourseTests}
                                onLockedClick={() => setShowPaymentModal(true)}
                                onStartTest={(test) => navigate(buildQuizRouteWithContext(String(test.id), { returnTo: `/course/${course.id}`, source: 'course' }))}
                            />
                        ) : relatedTests.length > 0 ? (
                            <SimulatedTestExperience
                                tests={relatedTests}
                                onLockedClick={() => setShowPaymentModal(true)}
                                onStartTest={(test) => navigate(buildQuizRouteWithContext(String(test.id), { returnTo: `/course/${course.id}`, source: 'course' }))}
                            />
                        ) : (
                            <div className="bg-gray-50 rounded-3xl border border-dashed border-gray-200 overflow-hidden">
                                <div className="text-center py-10 px-4 border-b border-gray-100 bg-white">
                                    <BarChart size={48} className="mx-auto text-gray-200 mb-4" />
                                    <p className="text-gray-700 font-bold mb-2">لا توجد اختبارات مربوطة مباشرة بهذه الدورة بعد</p>
                                    <p className="text-sm text-gray-500 max-w-md mx-auto">
                                        لكن يوجد اختبارات من نفس المادة يمكنك البدء بها الآن حتى تكتمل رحلة التدريب.
                                    </p>
                                </div>

                                <div className="p-4 sm:p-6">
                                    {fallbackTests.length > 0 ? (
                                        <SimulatedTestExperience
                                            tests={fallbackTests}
                                            onLockedClick={() => setShowPaymentModal(true)}
                                            onStartTest={(test) => navigate(buildQuizRouteWithContext(String(test.id), { returnTo: `/course/${course.id}`, source: 'course' }))}
                                        />
                                    ) : (
                                        <div className="text-center py-8 text-sm text-gray-500">
                                            لا توجد اختبارات بديلة من نفس المادة حاليًا.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                );
            case 'qa':
                return (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        <div className="flex flex-col sm:flex-row gap-4 mb-8">
                            <input 
                                type="text" 
                                placeholder="اسأل سؤالاً..." 
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={newQuestion}
                                onChange={(e) => setNewQuestion(e.target.value)}
                            />
                            <button className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors w-full sm:w-auto flex items-center justify-center">
                                <Send size={20} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {course.qa?.map((item) => (
                                <div key={item.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                            <HelpCircle size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center mb-2">
                                                <span className="font-bold text-gray-900 text-sm">{item.user}</span>
                                                <span className="text-[10px] text-gray-400">{item.date}</span>
                                            </div>
                                            <p className="text-sm text-gray-700 font-bold mb-4">{item.question}</p>
                                            
                                            {item.answer && (
                                                <div className="bg-white p-4 rounded-xl border border-gray-100 flex gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                                        <MessageSquare size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-400 mb-1">رد المدرس</p>
                                                        <p className="text-xs text-gray-600 leading-relaxed">{item.answer}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(!course.qa || course.qa.length === 0) && (
                                <div className="text-center py-12">
                                    <MessageSquare size={48} className="mx-auto text-gray-200 mb-4" />
                                    <p className="text-gray-400">لا توجد أسئلة بعد. كن أول من يسأل!</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                );
            case 'files':
                return (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                        {course.files?.map((file) => (
                            <div key={file.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between group hover:bg-indigo-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-rose-500 shadow-sm">
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{file.title}</p>
                                        <p className="text-[10px] text-gray-400">{file.size} • PDF</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                                        <Eye size={18} />
                                    </button>
                                    <button className="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                                        <Download size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {(!course.files || course.files.length === 0) && (
                            <div className="col-span-2 bg-gray-50 rounded-3xl border border-dashed border-gray-200 overflow-hidden">
                                <div className="text-center py-10 px-4 border-b border-gray-100 bg-white">
                                    <FileText size={48} className="mx-auto text-gray-200 mb-4" />
                                    <p className="text-gray-700 font-bold mb-2">لا توجد ملفات مرفوعة مباشرة لهذه الدورة حاليًا</p>
                                    <p className="text-sm text-gray-500 max-w-md mx-auto">
                                        هذه أقرب ملفات مراجعة من نفس المادة أو المهارات المرتبطة بالدورة.
                                    </p>
                                </div>

                                <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {relatedFiles.length > 0 ? relatedFiles.map((file) => (
                                        <div key={file.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between group hover:bg-indigo-50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-rose-500 shadow-sm">
                                                    <FileText size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{file.title}</p>
                                                    <p className="text-[10px] text-gray-400">{file.size}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                          onClick={() => openExternalUrl(file.url)}
                                                    className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button
                          onClick={() => openExternalUrl(file.url)}
                                                    className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                                >
                                                    <Download size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="col-span-2 text-center py-8 text-sm text-gray-500">
                                            لا توجد ملفات بديلة من نفس المادة حاليًا.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen pb-20" dir="rtl">
            {/* Hero Background Strip */}
            <div className="absolute top-0 left-0 right-0 h-[300px] md:h-[380px] bg-[#0f172a] z-0 overflow-hidden">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-indigo-600/10 blur-3xl rounded-full -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-1/4 h-1/2 bg-blue-600/5 blur-3xl rounded-full -ml-10 -mb-10"></div>
            </div>

            {/* Main Layout Grid */}
            <div className="max-w-7xl mx-auto px-4 relative z-10 pt-8 md:pt-16">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 items-start">
                    
                    {/* Left Column: Info & Content */}
                    <div className="lg:col-span-2 space-y-8 md:space-y-12">
                        {/* Hero Info */}
                        <div className="text-white">
                            <div className="flex flex-wrap gap-2 mb-4">
                                <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">جديد</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black mb-6 leading-tight text-right break-words">
                                {course.title}
                            </h1>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                        <User size={20} className="text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-[10px]">مدرس</p>
                                        <p className="font-bold">{course.instructor}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 sm:border-r sm:border-white/10 sm:pr-6">
                                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                                        <BookOpen size={20} className="text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-[10px]">فئة</p>
                                        <p className="font-bold">{course.category}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 sm:border-r sm:border-white/10 sm:pr-6">
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                        <BarChart size={20} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-[10px]">طلاب مسجل</p>
                                        <p className="font-bold">{course.studentCount || 455}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Content Tabs */}
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="flex overflow-x-auto border-b border-gray-100">
                                <button 
                                    onClick={() => setActiveTab('description')}
                                    className={`shrink-0 px-6 md:px-8 py-4 font-bold text-xs md:text-sm transition-all ${activeTab === 'description' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
                                >
                                    وصف
                                </button>
                                <button 
                                    onClick={() => setActiveTab('syllabus')}
                                    className={`shrink-0 px-6 md:px-8 py-4 font-bold text-xs md:text-sm transition-all ${activeTab === 'syllabus' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
                                >
                                    المحتوى
                                </button>
                                <button 
                                    onClick={() => setActiveTab('tests')}
                                    className={`shrink-0 px-6 md:px-8 py-4 font-bold text-xs md:text-sm transition-all ${activeTab === 'tests' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
                                >
                                    الاختبارات
                                </button>
                                <button 
                                    onClick={() => setActiveTab('qa')}
                                    className={`shrink-0 px-6 md:px-8 py-4 font-bold text-xs md:text-sm transition-all ${activeTab === 'qa' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
                                >
                                    سؤال وجواب
                                </button>
                                <button 
                                    onClick={() => setActiveTab('files')}
                                    className={`shrink-0 px-6 md:px-8 py-4 font-bold text-xs md:text-sm transition-all ${activeTab === 'files' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
                                >
                                    ملفات الدورة
                                </button>
                            </div>

                            <div className="p-4 sm:p-6 md:p-8">
                                <AnimatePresence mode="wait">
                                    {renderTabContent()}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Progress Card */}
                    <div className="lg:sticky lg:top-24 z-30">
                        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden text-gray-900 border border-gray-100">
                            <div className="relative aspect-video">
                                <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/20"></div>
                            </div>
                            <div className="p-5 sm:p-6">
                                <div className="mb-6">
                                    <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
                                        <span>الدرجة: {progress}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-indigo-600 transition-all duration-1000" 
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                                
                                {isEnrolled ? (
                                    <button 
                                        onClick={onContinue}
                                        className="w-full bg-[#1e293b] text-white py-4 rounded-2xl font-black text-lg hover:bg-slate-800 transition-all shadow-lg mb-4 flex items-center justify-center gap-2"
                                    >
                                        استمر
                                    </button>
                                ) : (
                                    <button 
                                        onClick={handleEnroll}
                                        className="w-full bg-amber-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-amber-600 transition-all shadow-lg mb-4 flex items-center justify-center gap-2"
                                    >
                                        انضم للدورة الآن
                                    </button>
                                )}

                                <div className="flex flex-col sm:flex-row gap-4">
                                    <button className="flex-1 flex items-center justify-center gap-2 py-2 border border-gray-200 rounded-xl text-[10px] font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                                        <Heart size={14} /> المفضلة
                                    </button>
                                    <button className="flex items-center justify-center gap-2 py-2 px-4 border border-gray-200 rounded-xl text-[10px] font-bold text-gray-600 hover:bg-gray-50 transition-colors w-full sm:w-auto">
                                        <Share2 size={14} /> مشاركة
                                    </button>
                                </div>
                            </div>

                            <div className="p-5 sm:p-6 border-t border-gray-50 bg-gray-50/50">
                                <h4 className="font-bold text-gray-800 mb-4 text-sm">تفاصيل الدورة</h4>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 text-gray-500">
                                            <Clock size={14} />
                                            <span>المدة</span>
                                        </div>
                                        <span className="font-bold text-gray-800">{course.weeksCount || 6} اشهر</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 text-gray-500">
                                            <BarChart size={14} />
                                            <span>محاضرات</span>
                                        </div>
                                        <span className="font-bold text-gray-800">{course.modules?.reduce((acc, m) => acc + m.lessons.length, 0) || 42}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 text-gray-500">
                                            <PlayCircle size={14} />
                                            <span>فيديو</span>
                                        </div>
                                        <span className="font-bold text-gray-800">{course.duration} ساعات</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <PaymentModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                item={
                    matchedCoursePackage
                        ? {
                            id: matchedCoursePackage.id,
                            packageId: matchedCoursePackage.id,
                            purchaseType: 'package',
                            title: matchedCoursePackage.name,
                            description: `هذه الباقة تفتح الدورات والاختبارات المرتبطة بـ ${course.subject || course.category}.`,
                            contentTypes: matchedCoursePackage.contentTypes,
                            pathIds: matchedCoursePackage.pathIds,
                            subjectIds: matchedCoursePackage.subjectIds,
                            includedCourseIds: matchedCoursePackage.courseIds,
                            courseIds: matchedCoursePackage.courseIds,
                            price: course.price,
                            currency: course.currency,
                        }
                        : course
                }
                type={matchedCoursePackage ? 'package' : 'course'}
            />
        </div>
    );
};
