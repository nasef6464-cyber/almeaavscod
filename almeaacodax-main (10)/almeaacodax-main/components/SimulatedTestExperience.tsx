import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, ChevronRight, Lock, Unlock, PlayCircle, AlertTriangle, ArrowRight, ArrowLeft, Star, FileText, Eye, Trash2, CheckCircle2, ChevronRight as ChevronRightIcon, Moon, Sun } from 'lucide-react';
import { Card } from './ui/Card';
import { ProgressBar } from './ui/ProgressBar';
import { VideoModal } from './VideoModal';
import { PaymentModal } from './PaymentModal';

interface Test {
    id: string | number;
    title: string;
    duration: string;
    questions: number;
    type: string;
    level: string;
    isLocked: boolean;
    pathId?: string;
    subjectId?: string;
}

interface SimulatedTestExperienceProps {
    tests: Test[];
    mode?: 'test' | 'bank';
    onLockedClick?: (test: Test) => void;
    onStartTest?: (test: Test) => void;
}

const stripOptionLabel = (value: string) =>
    value.replace(/^\s*[أابجدهـA-D]\s*[\)\-\.]\s*/i, '').trim();

export const SimulatedTestExperience: React.FC<SimulatedTestExperienceProps> = ({ tests, mode = 'test', onLockedClick, onStartTest }) => {
    const [selectedTest, setSelectedTest] = useState<Test | null>(null);
    const [testState, setTestState] = useState<'list' | 'popup' | 'pre-test' | 'in-progress' | 'confirm-submit' | 'result'>('list');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});
    const [timeLeft, setTimeLeft] = useState(0);
    const [resultViewMode, setResultViewMode] = useState<'summary' | 'review'>('summary');
    const [currentReviewIdx, setCurrentReviewIdx] = useState(0);
    const [showExplanation, setShowExplanation] = useState(false);
    const [videoData, setVideoData] = useState<{ url: string; title: string } | null>(null);
    const [favorites, setFavorites] = useState<Record<number, boolean>>({});
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [isNightMode, setIsNightMode] = useState(false);
    const openTestsCount = tests.filter((test) => !test.isLocked).length;
    const lockedTestsCount = tests.length - openTestsCount;
    const listTitle = mode === 'bank' ? 'تدريبات المادة' : 'اختبارات المادة';
    const listAction = mode === 'bank' ? 'ابدأ التدريب' : 'ابدأ الاختبار';

    const toggleFavorite = (idx: number) => {
        setFavorites(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    // Mock Questions
    const mockQuestions = Array.from({ length: selectedTest?.questions || 30 }).map((_, i) => ({
        id: i + 1,
        text: `السؤال رقم ${i + 1}: أوجد مجموع الحاصلين على مجموع جيد وأقل بناءً على الجدول المرفق.`,
        options: ['أ) 20', 'ب) 32', 'ج) 40', 'د) 30'],
        correctAnswer: 'ب) 32',
        image: i === 0 ? "https://picsum.photos/seed/math1/800/400" : null
    }));

    useEffect(() => {
        let timer: any;
        if (testState === 'in-progress' && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && testState === 'in-progress') {
            setTestState('result');
        }
        return () => clearInterval(timer);
    }, [testState, timeLeft]);

    const handleTestClick = (test: Test) => {
        setSelectedTest(test);
        if (test.isLocked) {
            if (onLockedClick) {
                onLockedClick(test);
            } else {
                setTestState('popup');
            }
        } else {
            if (onStartTest) {
                onStartTest(test);
                return;
            }
            setTestState('pre-test');
        }
    };

    const startTest = () => {
        const durationMinutes = parseInt(selectedTest?.duration || '60');
        setTimeLeft(durationMinutes * 60);
        setTestState('in-progress');
        setCurrentQuestionIndex(0);
        setAnswers({});
        setMarkedForReview({});
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleAnswer = (option: string) => {
        setAnswers(prev => ({ ...prev, [currentQuestionIndex]: option }));
    };

    const toggleReview = () => {
        setMarkedForReview(prev => ({ ...prev, [currentQuestionIndex]: !prev[currentQuestionIndex] }));
    };

    const calculateScore = () => {
        let correct = 0;
        mockQuestions.forEach((q, index) => {
            if (answers[index] === q.correctAnswer) correct++;
        });
        return {
            correct,
            incorrect: mockQuestions.length - correct,
            percentage: Math.round((correct / mockQuestions.length) * 100)
        };
    };

    if (testState === 'list') {
        if (tests.length === 0) {
            return (
                <Card className="mx-auto max-w-3xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-400">
                        <FileText size={28} />
                    </div>
                    <h3 className="text-lg font-black text-gray-900">
                        {mode === 'bank' ? 'لا توجد تدريبات منشورة الآن' : 'لا توجد اختبارات منشورة الآن'}
                    </h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-gray-500">
                        سيظهر هنا ما يختاره المدير لهذه المادة فقط.
                    </p>
                </Card>
            );
        }

        return (
            <div className="space-y-4 max-w-4xl mx-auto">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-right">
                        <div className="text-xs font-black text-indigo-600">{listTitle}</div>
                        <div className="mt-2 text-2xl font-black text-indigo-900">{tests.length}</div>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-right">
                        <div className="text-xs font-black text-emerald-600">مفتوح الآن</div>
                        <div className="mt-2 text-2xl font-black text-emerald-800">{openTestsCount}</div>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-right">
                        <div className="text-xs font-black text-amber-600">ضمن باقة</div>
                        <div className="mt-2 text-2xl font-black text-amber-800">{lockedTestsCount}</div>
                    </div>
                </div>
                {tests.map((test) => (
                    <div key={test.id} onClick={() => handleTestClick(test)} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group">
                        <div className="flex items-center gap-4 mb-4 md:mb-0 w-full md:w-auto">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${test.isLocked ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                {test.isLocked ? <Lock size={24} /> : <Unlock size={24} />}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-lg text-gray-800 group-hover:text-indigo-600 transition-colors">{test.title}</h3>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${test.isLocked ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'}`}>
                                        {test.isLocked ? 'ضمن باقة' : 'مفتوح الآن'}
                                    </span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${test.type === 'trial' ? 'bg-green-100 text-green-700' : test.type === 'comprehensive' ? 'bg-purple-100 text-purple-700' : test.type === 'bank' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {test.type === 'trial' ? 'تجريبي' : test.type === 'comprehensive' ? 'شامل' : test.type === 'bank' ? 'بنك أسئلة' : 'محاكي'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                                    <span className="flex items-center gap-1"><Clock size={14} /> {test.duration}</span>
                                    <span className="flex items-center gap-1"><CheckCircle size={14} /> {test.questions} سؤال</span>
                                    <span className="flex items-center gap-1"><Star size={14} /> {test.level}</span>
                                </div>
                            </div>
                        </div>
                        <button className={`px-6 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 shrink-0 ${test.isLocked ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100' : 'bg-white text-indigo-600 border-2 border-indigo-600 hover:bg-indigo-600 hover:text-white'}`}>
                            {test.isLocked ? 'فتح الباقة' : listAction}
                            <ChevronRight size={18} className="transform rotate-180" />
                        </button>
                    </div>
                ))}
            </div>
        );
    }

    if (testState === 'popup') {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl animate-fade-in">
                    <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-gray-800 mb-2">هذا {mode === 'bank' ? 'البنك' : 'الاختبار'} ضمن الباقة المدفوعة</h2>
                    <p className="text-gray-600 mb-8">اشترك الآن لتتمكن من فتح جميع {mode === 'bank' ? 'بنوك الأسئلة' : 'الاختبارات المحاكية'} والتدرب بشكل احترافي.</p>
                    
                    <div className="space-y-3">
                        <button
                            onClick={() => setShowPaymentModal(true)}
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md flex items-center justify-center gap-2"
                        >
                            <Star size={18} className="fill-current" />
                            اشترك في الباقة الكاملة ⭐
                        </button>
                        <button
                            onClick={() => setShowPaymentModal(true)}
                            className="w-full bg-white text-indigo-600 border-2 border-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors"
                        >
                            اشترك في باقة الاختبارات فقط
                        </button>
                        <button onClick={() => setTestState('list')} className="w-full text-gray-500 py-2 font-medium hover:text-gray-700 transition-colors mt-2">
                            تراجع
                        </button>
                    </div>
                </div>
                <PaymentModal
                    isOpen={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                    item={{
                        id: `locked-${mode}-${selectedTest?.id || 'content'}`,
                        packageId: `locked-${mode}-${selectedTest?.id || 'content'}`,
                        purchaseType: 'package',
                        title: selectedTest?.title || (mode === 'bank' ? 'باقة التدريب' : 'باقة الاختبارات'),
                        price: 99,
                        currency: 'ر.س',
                    }}
                    type={mode === 'bank' ? 'package' : 'test'}
                />
            </div>
        );
    }

    if (testState === 'pre-test') {
        return (
            <div className="max-w-2xl mx-auto">
                <Card className="p-8 text-center">
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileText size={40} />
                    </div>
                    <h2 className="text-3xl font-black text-gray-800 mb-4">{selectedTest?.title}</h2>
                    
                    <div className="flex justify-center gap-8 mb-8">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-indigo-600">{selectedTest?.questions}</div>
                            <div className="text-sm text-gray-500">سؤال</div>
                        </div>
                        <div className="w-px bg-gray-200"></div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-indigo-600">{selectedTest?.duration}</div>
                            <div className="text-sm text-gray-500">الوقت المخصص</div>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-right mb-8">
                        <h4 className="font-bold text-amber-800 flex items-center gap-2 mb-2">
                            <AlertTriangle size={18} /> تعليمات هامة:
                        </h4>
                        <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                            <li>تأكد من استقرار اتصالك بالإنترنت.</li>
                            <li>لا تقم بتحديث الصفحة أثناء الاختبار.</li>
                            <li>بمجرد انتهاء الوقت سيتم تسليم الاختبار تلقائياً.</li>
                        </ul>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={startTest} className="flex-1 bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors shadow-lg flex items-center justify-center gap-2">
                            {mode === 'bank' ? 'ابدأ التصفح' : 'ابدأ الاختبار'} <PlayCircle size={20} />
                        </button>
                        <button onClick={() => setTestState('list')} className="px-6 py-4 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                            إلغاء
                        </button>
                    </div>
                </Card>
            </div>
        );
    }

    if (testState === 'in-progress') {
        const question = mockQuestions[currentQuestionIndex];
        const answeredCount = Object.keys(answers).length;
        const progress = (answeredCount / mockQuestions.length) * 100;
        const answeredThisQuestion = Boolean(answers[currentQuestionIndex]);

        return (
            <div className={`mx-auto max-w-5xl rounded-3xl p-3 transition-colors ${isNightMode ? 'bg-slate-950 text-white' : 'bg-transparent text-gray-900'}`}>
                {/* Top Bar */}
                <div className={`sticky top-4 z-10 mb-5 rounded-2xl border p-3 shadow-sm ${isNightMode ? 'border-slate-800 bg-slate-900' : 'border-gray-200 bg-white'}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <button onClick={() => setTestState('confirm-submit')} className="order-3 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-black text-white transition-colors hover:bg-amber-600 lg:order-1">
                            إنهاء {mode === 'bank' ? 'التصفح' : 'الاختبار'}
                        </button>
                        <div className="order-1 flex flex-wrap items-center justify-center gap-3 lg:order-2">
                            <div className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-lg font-black ${isNightMode ? 'bg-slate-800 text-amber-300' : 'bg-amber-50 text-amber-600'}`}>
                                <Clock size={20} />
                                {formatTime(timeLeft)}
                            </div>
                            <div className={`rounded-xl px-4 py-2 text-sm font-black ${isNightMode ? 'bg-indigo-500/15 text-indigo-200' : 'bg-indigo-50 text-indigo-700'}`}>
                                السؤال {currentQuestionIndex + 1} من {mockQuestions.length}
                            </div>
                        </div>
                        <div className="order-2 flex flex-wrap items-center justify-center gap-2 lg:order-3">
                            <button
                                type="button"
                                onClick={() => setIsNightMode((value) => !value)}
                                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition-colors ${isNightMode ? 'bg-slate-800 text-amber-200 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                            >
                                {isNightMode ? <Sun size={15} /> : <Moon size={15} />}
                                {isNightMode ? 'نهاري' : 'ليلي'}
                            </button>
                            <button
                                onClick={toggleReview}
                                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition-colors ${
                                    markedForReview[currentQuestionIndex]
                                        ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-200/40'
                                        : isNightMode
                                            ? 'bg-slate-800 text-amber-200 hover:bg-slate-700'
                                            : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100'
                                }`}
                            >
                                <Star size={16} className={markedForReview[currentQuestionIndex] ? 'fill-current' : ''} />
                                {markedForReview[currentQuestionIndex] ? 'محدد للمراجعة' : 'مراجعة لاحقًا'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                    <ProgressBar percentage={progress} label={`تم حل ${answeredCount} من ${mockQuestions.length}`} color="primary" />
                </div>

                {/* Question Area */}
                <Card className={`mb-6 flex min-h-[430px] flex-col overflow-hidden border-0 p-0 shadow-sm ${isNightMode ? 'bg-slate-900 text-white' : 'bg-white'}`}>
                    <div className="h-2 w-full bg-indigo-600" />
                    <div className="flex-1 p-5 sm:p-8">
                        <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <h3 className={`text-lg font-black leading-9 sm:text-xl ${isNightMode ? 'text-white' : 'text-gray-900'}`}>
                                {question.text}
                            </h3>
                            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${answeredThisQuestion ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                {answeredThisQuestion ? 'تمت الإجابة' : 'لم تجب بعد'}
                            </span>
                        </div>
                        
                        {question.image ? (
                            <div className={`mb-8 rounded-2xl border p-3 ${isNightMode ? 'border-slate-700 bg-black' : 'border-gray-200 bg-gray-50'}`}>
                                <img src={question.image} alt="صورة السؤال" className="mx-auto max-h-[320px] w-full object-contain" referrerPolicy="no-referrer" />
                            </div>
                        ) : null}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {question.options.map((option, idx) => {
                                const isSelected = answers[currentQuestionIndex] === option;

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleAnswer(option)}
                                        className={`min-h-[88px] w-full rounded-2xl border-2 px-4 py-3 text-right transition-all ${
                                            isSelected
                                                ? isNightMode
                                                    ? 'border-indigo-400 bg-indigo-500/20 text-white'
                                                    : 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-sm'
                                                : isNightMode
                                                    ? 'border-slate-700 bg-slate-800 text-slate-100 hover:border-indigo-400'
                                                    : 'border-gray-200 bg-white text-gray-800 hover:border-indigo-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex h-full items-center justify-between gap-3">
                                            <span className="min-w-0 flex-1 text-center text-sm font-black leading-7 sm:text-base">
                                                {stripOptionLabel(option)}
                                            </span>
                                            <div className="flex shrink-0 items-center gap-3">
                                                <span className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${isSelected ? 'border-indigo-600 bg-white' : isNightMode ? 'border-slate-500' : 'border-gray-300'}`}>
                                                    <span className={`h-3.5 w-3.5 rounded-full ${isSelected ? 'bg-indigo-600' : 'bg-transparent'}`} />
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </Card>

                {/* Navigation */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <button 
                        onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentQuestionIndex === 0}
                        className={`flex items-center justify-center gap-2 rounded-xl border px-6 py-3 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isNightMode ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                        <ArrowRight size={20} /> السابق
                    </button>
                    
                    <div className="flex max-w-full gap-1 overflow-x-auto px-2 lg:max-w-[58%]">
                        {mockQuestions.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentQuestionIndex(idx)}
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-black transition-colors ${
                                    currentQuestionIndex === idx ? 'bg-indigo-600 text-white' :
                                    markedForReview[idx] ? 'border border-amber-300 bg-amber-100 text-amber-800' :
                                    answers[idx] ? 'border border-emerald-300 bg-emerald-100 text-emerald-700' :
                                    isNightMode ? 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800' :
                                    'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                                }`}
                            >
                                {idx + 1}
                            </button>
                        ))}
                    </div>

                    <button 
                        onClick={() => {
                            if (currentQuestionIndex === mockQuestions.length - 1) {
                                setTestState('confirm-submit');
                            } else {
                                setCurrentQuestionIndex(prev => Math.min(mockQuestions.length - 1, prev + 1));
                            }
                        }}
                        className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-3 font-bold text-white shadow-md transition-colors hover:bg-indigo-700"
                    >
                        {currentQuestionIndex === mockQuestions.length - 1 ? 'إنهاء' : 'التالي'} <ArrowLeft size={20} />
                    </button>
                </div>
            </div>
        );
    }

    if (testState === 'confirm-submit') {
        const answeredCount = Object.keys(answers).length;
        const unansweredCount = mockQuestions.length - answeredCount;

        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl animate-fade-in">
                    <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-gray-800 mb-2">هل أنت متأكد من إنهاء {mode === 'bank' ? 'التصفح' : 'الاختبار'}؟</h2>
                    
                    {unansweredCount > 0 && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-6 text-sm font-bold">
                            يوجد {unansweredCount} أسئلة لم تقم بالإجابة عليها!
                        </div>
                    )}
                    
                    <div className="flex gap-4 mt-8">
                        <button onClick={() => setTestState('result')} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md">
                            نعم، قم بالإنهاء
                        </button>
                        <button onClick={() => setTestState('in-progress')} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                            العودة {mode === 'bank' ? 'للتصفح' : 'للإختبار'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (testState === 'result') {
        const score = calculateScore();
        const durationMinutes = parseInt(selectedTest?.duration || '60');
        const timeUsed = (durationMinutes * 60) - timeLeft;
        const resultTone = score.percentage >= 80
            ? {
                label: 'ممتاز',
                title: 'أداء قوي ومطمئن',
                message: 'النتيجة تبين أنك فاهم أغلب الأفكار الأساسية، ونحتاج فقط تثبيت بعض النقاط الصغيرة.'
            }
            : score.percentage >= 60
                ? {
                    label: 'جيد',
                    title: 'مستوى جيد ويحتاج تعزيز',
                    message: 'أنت على الطريق الصحيح، ومع مراجعة مركزة ستحسن الدرجة بسرعة.'
                }
                : {
                    label: 'يحتاج دعم',
                    title: 'نحتاج خطة مراجعة قصيرة',
                    message: 'النتيجة تقول إن أفضل خطوة الآن هي مراجعة المهارة الأساسية ثم حل تدريب قصير.'
                };
        const targetLabel = selectedTest?.title || (mode === 'bank' ? 'البنك المفتوح' : 'الاختبار الحالي');

        if (resultViewMode === 'review') {
            const q = mockQuestions[currentReviewIdx];
            return (
                <div className="max-w-4xl mx-auto animate-fade-in pb-20">
                    <header className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setResultViewMode('summary')} className="text-gray-500 hover:text-indigo-600 transition-colors">
                                <ArrowRight />
                            </button>
                            <h1 className="text-xl font-bold">مراجعة الحلول</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="bg-amber-500 text-white px-4 py-1.5 rounded-xl text-sm font-bold">
                                السؤال {currentReviewIdx + 1} من {mockQuestions.length}
                            </span>
                            <button 
                                onClick={() => toggleFavorite(currentReviewIdx)}
                                className={`${favorites[currentReviewIdx] ? 'bg-rose-500 hover:bg-rose-600' : 'bg-indigo-500 hover:bg-indigo-600'} text-white px-4 py-1.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors`}
                            >
                                {favorites[currentReviewIdx] ? <Trash2 size={16} /> : <Star size={16} />}
                                {favorites[currentReviewIdx] ? 'مسح من المفضلة' : 'إضافة للمفضلة'}
                            </button>
                        </div>
                    </header>

                    <Card className="p-0 overflow-hidden border-2 border-gray-100 shadow-xl">
                        <div className="p-8 bg-white">
                            <div className="bg-gray-50 rounded-2xl p-8 mb-8 flex flex-col items-center justify-center border border-gray-100 min-h-[250px]">
                                {q.image ? (
                                    <img src={q.image} alt="Question" className="max-h-64 object-contain mb-6" referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="text-center mb-6">
                                        <FileText size={48} className="text-gray-200 mx-auto mb-2" />
                                        <span className="text-sm text-gray-400 font-bold">[ صورة توضيحية للسؤال ]</span>
                                    </div>
                                )}
                                <p className="text-xl font-bold text-gray-800 text-center leading-relaxed px-4">
                                    {q.text}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                                {['A', 'B', 'C', 'D'].map((label, i) => {
                                    const isCorrect = q.options[i] === q.correctAnswer;
                                    const isUser = answers[currentReviewIdx] === q.options[i];
                                    
                                    let borderClass = "border-gray-200 text-gray-400";
                                    let bgClass = "bg-white";
                                    
                                    if (showExplanation) {
                                        if (isCorrect) {
                                            borderClass = "border-emerald-500 text-emerald-600";
                                            bgClass = "bg-emerald-50";
                                        } else if (isUser && !isCorrect) {
                                            borderClass = "border-red-500 text-red-600";
                                            bgClass = "bg-red-50";
                                        }
                                    }

                                    return (
                                        <div key={i} className="flex flex-col items-center gap-2">
                                            <div className={`w-10 h-10 rounded-full border-2 transition-all ${borderClass} ${bgClass}`} />
                                            <span className="text-xs font-bold text-gray-400">{q.options[i]}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setVideoData({ url: "https://www.youtube.com/embed/dQw4w9WgXcQ", title: `شرح السؤال ${currentReviewIdx + 1}` })}
                                    className="bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                                >
                                    <PlayCircle size={20} />
                                    شرح الفيديو
                                </button>
                                <button 
                                    onClick={() => setShowExplanation(!showExplanation)}
                                    className="bg-white border-2 border-indigo-100 text-indigo-600 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-50 transition-all"
                                >
                                    <Eye size={20} />
                                    {showExplanation ? 'إخفاء الحل' : 'إظهار الحل'}
                                </button>
                            </div>

                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => {
                                        setCurrentReviewIdx(prev => Math.max(0, prev - 1));
                                        setShowExplanation(false);
                                    }}
                                    disabled={currentReviewIdx === 0}
                                    className="bg-gray-200 text-gray-600 px-6 py-2.5 rounded-xl font-bold disabled:opacity-50 transition-all"
                                >
                                    السابق
                                </button>
                                <button 
                                    onClick={() => {
                                        if (currentReviewIdx < mockQuestions.length - 1) {
                                            setCurrentReviewIdx(prev => prev + 1);
                                            setShowExplanation(false);
                                        } else {
                                            setResultViewMode('summary');
                                        }
                                    }}
                                    className="bg-slate-700 text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all"
                                >
                                    {currentReviewIdx === mockQuestions.length - 1 ? 'إنهاء المراجعة' : 'التالي'}
                                    <ChevronRightIcon size={20} className="transform rotate-180" />
                                </button>
                            </div>
                        </div>
                    </Card>

                    {showExplanation && (
                        <div className="animate-slide-up mt-6">
                            <Card className="p-6 border-2 border-emerald-100 bg-emerald-50/30 text-right">
                                <h4 className="font-bold text-emerald-800 mb-3 flex items-center gap-2">
                                    <CheckCircle2 size={20} />
                                    توضيح الحل الصحيح:
                                </h4>
                                <p className="text-gray-700 leading-relaxed font-medium">
                                    هذا شرح افتراضي للحل الصحيح للسؤال رقم {currentReviewIdx + 1}. يتم توضيح الخطوات المنطقية للوصول للنتيجة النهائية.
                                </p>
                            </Card>
                        </div>
                    )}

                    {videoData && (
                        <VideoModal 
                            videoUrl={videoData.url} 
                            title={videoData.title} 
                            onClose={() => setVideoData(null)} 
                        />
                    )}
                </div>
            );
        }

        return (
            <div className="max-w-3xl mx-auto animate-fade-in">
                <Card className="relative mb-8 overflow-hidden border-0 p-6 text-center shadow-sm sm:p-8">
                    <div className={`absolute left-0 top-0 h-2 w-full ${score.percentage >= 80 ? 'bg-emerald-500' : score.percentage >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                    <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                        <CheckCircle size={38} />
                    </div>
                    <div className="mb-2 inline-flex rounded-full bg-slate-100 px-4 py-1 text-xs font-black text-slate-700">
                        {mode === 'bank' ? 'ملخص التدريب' : 'نتيجة الاختبار'}
                    </div>
                    <h2 className="text-2xl font-black text-gray-900">{resultTone.title}</h2>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-gray-500">{targetLabel}</p>

                    <div className="my-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-2xl bg-indigo-50 p-4">
                            <div className="text-xs font-bold text-indigo-600">النتيجة</div>
                            <div className="mt-2 text-3xl font-black text-indigo-700">{score.percentage}%</div>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 p-4">
                            <div className="text-xs font-bold text-emerald-600">صحيح</div>
                            <div className="mt-2 text-3xl font-black text-emerald-700">{score.correct}</div>
                        </div>
                        <div className="rounded-2xl bg-rose-50 p-4">
                            <div className="text-xs font-bold text-rose-600">خطأ</div>
                            <div className="mt-2 text-3xl font-black text-rose-700">{score.incorrect}</div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                            <div className="text-xs font-bold text-slate-500">الوقت</div>
                            <div className="mt-2 text-lg font-black text-slate-800">{formatTime(timeUsed)}</div>
                        </div>
                    </div>

                    <div className="mx-auto mb-7 max-w-2xl rounded-2xl border border-slate-100 bg-slate-50 p-4 text-right">
                        <div className="font-black text-gray-900">{resultTone.label}</div>
                        <p className="mt-2 text-sm leading-7 text-gray-600">{resultTone.message}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                        <button 
                            onClick={() => setResultViewMode('review')}
                            className="rounded-xl bg-emerald-500 px-5 py-3 font-black text-white shadow-lg shadow-emerald-100 transition-colors hover:bg-emerald-600"
                        >
                            <CheckCircle size={20} className="ml-2 inline" /> مراجعة الحلول
                        </button>
                        <button onClick={startTest} className="rounded-xl border-2 border-gray-200 bg-white px-5 py-3 font-black text-gray-700 transition-colors hover:bg-gray-50">
                            <PlayCircle size={18} className="ml-2 inline" /> أعد الاختبار
                        </button>
                        <button onClick={() => setTestState('list')} className="rounded-xl bg-gray-100 px-5 py-3 font-black text-gray-700 transition-colors hover:bg-gray-200">
                            العودة للقائمة
                        </button>
                    </div>
                </Card>
            </div>
        );
    }

    return null;
};
