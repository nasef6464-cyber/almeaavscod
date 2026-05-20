import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle,
  Eye,
  EyeOff,
  Heart,
  PlayCircle,
  RotateCcw,
  Star,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { useStore } from '../store/useStore';
import { VideoModal } from '../components/VideoModal';
import { Question } from '../types';
import { normalizeQuestionHtml } from '../utils/questionHtml';
import { sanitizeArabicText } from '../utils/sanitizeMojibakeArabic';

type ReviewTab = 'favorites' | 'reviewLater' | 'mistakes';

const tabMeta: Record<ReviewTab, { label: string; empty: string; icon: React.ReactNode }> = {
  favorites: {
    label: 'المفضلة',
    empty: 'لا توجد أسئلة مفضلة حاليًا.',
    icon: <Heart size={16} />,
  },
  reviewLater: {
    label: 'مراجعة لاحقًا',
    empty: 'لا توجد أسئلة محددة للمراجعة لاحقًا.',
    icon: <Star size={16} />,
  },
  mistakes: {
    label: 'أخطأت فيها',
    empty: 'لا توجد أسئلة خاطئة محفوظة حتى الآن.',
    icon: <RotateCcw size={16} />,
  },
};

const uniqueById = (items: Question[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const Favorites: React.FC = () => {
  const {
    favorites,
    reviewLater,
    questionAttempts,
    questions,
    toggleFavorite,
    toggleReviewLater,
  } = useStore();
  const [activeTab, setActiveTab] = useState<ReviewTab>('favorites');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const wrongQuestionIds = useMemo(
    () => new Set(questionAttempts.filter((attempt) => !attempt.isCorrect).map((attempt) => attempt.questionId)),
    [questionAttempts],
  );

  const tabQuestions = useMemo(() => {
    if (activeTab === 'favorites') {
      return questions.filter((question) => favorites.includes(question.id));
    }

    if (activeTab === 'reviewLater') {
      return questions.filter((question) => reviewLater.includes(question.id));
    }

    return uniqueById(questions.filter((question) => wrongQuestionIds.has(question.id)));
  }, [activeTab, favorites, questions, reviewLater, wrongQuestionIds]);

  const tabCounts = useMemo<Record<ReviewTab, number>>(() => ({
    favorites: questions.filter((question) => favorites.includes(question.id)).length,
    reviewLater: questions.filter((question) => reviewLater.includes(question.id)).length,
    mistakes: uniqueById(questions.filter((question) => wrongQuestionIds.has(question.id))).length,
  }), [favorites, questions, reviewLater, wrongQuestionIds]);

  const currentQuestion = tabQuestions[currentIndex];
  const currentMeta = tabMeta[activeTab];

  const resetQuestionView = (nextIndex = 0) => {
    setCurrentIndex(nextIndex);
    setShowAnswer(false);
    setShowVideo(false);
  };

  const handleTabChange = (tab: ReviewTab) => {
    setActiveTab(tab);
    resetQuestionView(0);
  };

  const handleNext = () => {
    if (currentIndex >= tabQuestions.length - 1) return;
    resetQuestionView(currentIndex + 1);
  };

  const handlePrev = () => {
    if (currentIndex === 0) return;
    resetQuestionView(currentIndex - 1);
  };

  const removeFromCurrentList = () => {
    if (!currentQuestion) return;

    if (activeTab === 'favorites') {
      toggleFavorite(currentQuestion.id);
    }

    if (activeTab === 'reviewLater') {
      toggleReviewLater(currentQuestion.id);
    }

    const nextIndex = currentIndex >= tabQuestions.length - 1 ? Math.max(0, tabQuestions.length - 2) : currentIndex;
    resetQuestionView(nextIndex);
  };

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-gray-500 hover:text-gray-700">
            <ArrowRight />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-emerald-700">مركز مراجعة الأسئلة</h1>
            <p className="text-sm text-gray-500 mt-1">مفضلاتك، أسئلة المراجعة لاحقًا، والأسئلة التي تحتاج إعادة تدريب.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-gray-100 p-1">
          {(Object.keys(tabMeta) as ReviewTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-black transition ${
                activeTab === tab ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tabMeta[tab].icon}
              {tabMeta[tab].label}
              <span className={`min-w-6 rounded-full px-2 py-0.5 text-[11px] font-black ${
                activeTab === tab ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-gray-500'
              }`}>
                {tabCounts[tab]}
              </span>
            </button>
          ))}
        </div>
      </header>

      {tabQuestions.length === 0 ? (
        <Card className="p-10 text-center border-dashed border-2 border-gray-200">
          <BookOpen size={48} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">{currentMeta.empty}</h2>
          <p className="text-sm text-gray-500">أثناء الاختبار يمكنك إضافة السؤال للمفضلة أو للمراجعة لاحقًا، وسيظهر هنا مباشرة.</p>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="rounded-2xl bg-amber-500 px-4 py-2 text-center text-sm font-black text-white shadow-sm">
              السؤال {currentIndex + 1} من {tabQuestions.length}
            </div>
            <div className="flex flex-wrap gap-2">
              {activeTab !== 'mistakes' ? (
                <button
                  onClick={removeFromCurrentList}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-600"
                >
                  <Trash2 size={16} />
                  إزالة من {currentMeta.label}
                </button>
              ) : null}
              {currentQuestion && !favorites.includes(currentQuestion.id) ? (
                <button
                  onClick={() => toggleFavorite(currentQuestion.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <Heart size={16} />
                  إضافة للمفضلة
                </button>
              ) : null}
              {currentQuestion && !reviewLater.includes(currentQuestion.id) ? (
                <button
                  onClick={() => toggleReviewLater(currentQuestion.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700 transition hover:bg-purple-100"
                >
                  <Star size={16} />
                  مراجعة لاحقًا
                </button>
              ) : null}
            </div>
          </div>

          <Card className="overflow-hidden border border-gray-200 shadow-md">
            <div className="bg-white p-4 sm:p-6 md:p-8 border-b border-gray-100 min-h-[220px] flex flex-col items-center justify-center">
              {currentQuestion.imageUrl ? (
                <div className="relative w-full max-w-3xl mx-auto">
                  <img
                    src={currentQuestion.imageUrl}
                    alt="صورة السؤال"
                    className="w-full max-h-[360px] object-contain rounded-lg border border-gray-100"
                    referrerPolicy="no-referrer"
                  />
                  {currentQuestion.text ? (
                    <div
                      className="mt-4 text-center font-bold text-lg text-gray-800 leading-loose"
                      dangerouslySetInnerHTML={{ __html: normalizeQuestionHtml(currentQuestion.text) }}
                    />
                  ) : null}
                </div>
              ) : (
                <div
                  className="text-lg sm:text-xl font-bold text-gray-800 text-center leading-loose break-words"
                  dangerouslySetInnerHTML={{ __html: normalizeQuestionHtml(currentQuestion.text) }}
                />
              )}
            </div>

            <div className="p-4 sm:p-6 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                {currentQuestion.options.map((option, idx) => {
                  const isCorrect = idx === currentQuestion.correctOptionIndex;
                  const statusColor = showAnswer && isCorrect
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200'
                    : 'border-gray-200 bg-white text-gray-700';

                  return (
                    <div key={`${currentQuestion.id}-${idx}`} className={`min-h-[76px] rounded-2xl border-2 px-4 py-3 shadow-sm ${statusColor}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex-1 text-center text-sm sm:text-base font-bold leading-relaxed break-words">
                          {sanitizeArabicText(option)}
                        </span>
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${showAnswer && isCorrect ? 'border-emerald-500' : 'border-gray-300'}`}>
                          {showAnswer && isCorrect ? <CheckCircle size={18} className="text-emerald-600" /> : null}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white p-4 border-t border-gray-200 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-2 w-full md:w-auto">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="flex-1 md:flex-none rounded-xl bg-slate-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-600 disabled:opacity-50"
                >
                  السابق
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentIndex === tabQuestions.length - 1}
                  className="flex-1 md:flex-none rounded-xl bg-slate-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  التالي
                  <ArrowLeft size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row md:w-auto">
                <button
                  onClick={() => setShowAnswer((value) => !value)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                >
                  {showAnswer ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showAnswer ? 'إخفاء الحل' : 'إظهار الحل'}
                </button>
                {currentQuestion.videoUrl ? (
                  <button
                    onClick={() => setShowVideo(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-100 transition hover:bg-emerald-600"
                  >
                    <PlayCircle size={16} />
                    شرح الفيديو
                  </button>
                ) : null}
              </div>
            </div>
          </Card>
        </>
      )}

      {showVideo && currentQuestion?.videoUrl ? (
        <VideoModal
          videoUrl={currentQuestion.videoUrl}
          title="شرح السؤال"
          onClose={() => setShowVideo(false)}
        />
      ) : null}
    </div>
  );
};

export default Favorites;
