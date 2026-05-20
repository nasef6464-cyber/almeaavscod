import React from 'react';
import { CheckCircle2, Copy, Download, Share2, Target, X } from 'lucide-react';
import { QuizHistoryItem, SkillGap } from '../types';
import { sanitizeArabicText } from '../utils/sanitizeMojibakeArabic';
import { printElementAsPdf } from '../utils/printPdf';
import { shareTextSummary } from '../utils/shareText';

interface QuizDetailsModalProps {
  quiz: QuizHistoryItem;
  onClose: () => void;
}

const displayText = (value?: string | null) => sanitizeArabicText(value) || '';

const getMasteryTone = (mastery: number) => {
  if (mastery >= 80) {
    return {
      label: 'مطمئنة',
      card: 'border-emerald-100 bg-emerald-50',
      badge: 'bg-white text-emerald-700',
      bar: 'bg-emerald-500',
    };
  }

  if (mastery >= 60) {
    return {
      label: 'تحتاج مراجعة',
      card: 'border-amber-100 bg-amber-50',
      badge: 'bg-white text-amber-700',
      bar: 'bg-amber-500',
    };
  }

  return {
    label: 'ابدأ بها',
    card: 'border-rose-100 bg-rose-50',
    badge: 'bg-white text-rose-700',
    bar: 'bg-rose-500',
  };
};

const getScoreTone = (score: number) => {
  if (score >= 80) return 'border-emerald-100 text-emerald-600';
  if (score >= 60) return 'border-amber-100 text-amber-600';
  return 'border-rose-100 text-rose-600';
};

const buildSummaryText = (quiz: QuizHistoryItem, weakestSkill?: SkillGap) => {
  const title = displayText(quiz.title) || 'اختبار';
  const score = quiz.bestAttempt?.score ?? quiz.firstAttempt?.score ?? 0;
  const weakSkillName = displayText(weakestSkill?.skill);
  const mainSkillName = displayText(weakestSkill?.section);

  if (!weakestSkill) {
    return `نتيجة ${title}: ${score}%. لا توجد مهارات تفصيلية كافية، والأفضل مراجعة الحلول ثم إعادة اختبار قصير.`;
  }

  return `نتيجة ${title}: ${score}%. أكثر مهارة تحتاج متابعة: ${weakSkillName}${mainSkillName ? ` ضمن ${mainSkillName}` : ''} بنسبة ${weakestSkill.mastery}%.`;
};

export const QuizDetailsModal: React.FC<QuizDetailsModalProps> = ({ quiz, onClose }) => {
  const [copied, setCopied] = React.useState(false);
  const [shared, setShared] = React.useState(false);
  const [showAllSkills, setShowAllSkills] = React.useState(false);

  const sortedSkills = React.useMemo(
    () => [...(quiz.skillsAnalysis || [])].sort((a, b) => a.mastery - b.mastery),
    [quiz.skillsAnalysis],
  );
  const weakestSkill = sortedSkills[0];
  const score = quiz.bestAttempt?.score ?? quiz.firstAttempt?.score ?? 0;
  const summaryText = buildSummaryText(quiz, weakestSkill);
  const visibleSkills = showAllSkills ? sortedSkills : sortedSkills.slice(0, 3);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const shareSummary = async () => {
    try {
      await shareTextSummary('ملخص نتيجة الاختبار', summaryText);
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    } catch {
      setShared(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-4" dir="rtl">
      <div className="flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-in">
        <div className="print-hide flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <h2 className="text-lg font-black leading-7 text-secondary-500 sm:text-xl">تفاصيل نتيجة الاختبار</h2>
            <p className="mt-1 text-xs font-bold text-gray-400">{displayText(quiz.title) || 'اختبار سابق'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => printElementAsPdf('quiz-details-print-area', 'تفاصيل نتيجة الاختبار')}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100"
            >
              <Download size={15} />
              PDF
            </button>
            <button
              onClick={copySummary}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
            >
              {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
              {copied ? 'تم النسخ' : 'نسخ الملخص'}
            </button>
            <button
              onClick={shareSummary}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
            >
              {shared ? <CheckCircle2 size={15} /> : <Share2 size={15} />}
              {shared ? 'تمت المشاركة' : 'مشاركة'}
            </button>
            <button onClick={onClose} className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100" aria-label="إغلاق">
              <X size={22} />
            </button>
          </div>
        </div>

        <div id="quiz-details-print-area" className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
            <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                ملخص سريع
              </div>
              <div className="mt-4 flex items-center justify-center">
                <div className={`flex h-36 w-36 flex-col items-center justify-center rounded-full border-[12px] bg-white text-center shadow-inner ${getScoreTone(score)}`}>
                  <div className="text-3xl font-black">{score}%</div>
                  <div className="text-xs font-bold text-gray-400">النتيجة</div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-2xl bg-gray-50 p-3">
                  <div className="text-lg font-black text-gray-900">{quiz.questionCount}</div>
                  <div className="text-[11px] font-bold text-gray-500">عدد الأسئلة</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3">
                  <div className="text-lg font-black text-gray-900">{quiz.bestAttempt?.time || quiz.firstAttempt?.time || 'غير محدد'}</div>
                  <div className="text-[11px] font-bold text-gray-500">وقت الحل</div>
                </div>
              </div>
              <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-7 text-slate-700">
                {summaryText}
              </p>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-black text-gray-900">المهارات التي ظهرت في الاختبار</h3>
                  <p className="mt-1 text-sm leading-7 text-gray-500">
                    مرتبة من الأضعف للأقوى حتى يعرف الطالب وولي الأمر من أين يبدأ التحسين.
                  </p>
                </div>
                <span className="self-start rounded-full bg-gray-50 px-3 py-1 text-xs font-black text-gray-600">
                  {sortedSkills.length} مهارة
                </span>
              </div>

              <div className="mt-5 grid gap-3">
                {sortedSkills.length > 0 ? (
                  visibleSkills.map((skill, index) => {
                    const tone = getMasteryTone(skill.mastery);
                    const skillName = displayText(skill.skill) || 'مهارة غير مسماة';
                    const sectionName = displayText(skill.section);
                    const recommendation = displayText(skill.recommendation);

                    return (
                      <div key={`${skillName}-${index}`} className={`rounded-2xl border p-4 ${tone.card}`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="mb-3 flex flex-wrap gap-2 text-[11px] font-black">
                              <span className={`rounded-full px-3 py-1 ${tone.badge}`}>{tone.label}</span>
                              {sectionName ? (
                                <span className="rounded-full bg-white px-3 py-1 text-indigo-700">
                                  المهارة الرئيسية: {sectionName}
                                </span>
                              ) : null}
                            </div>
                            <div className="font-black leading-7 text-gray-900">
                              {skillName}
                            </div>
                            {recommendation ? (
                              <p className="mt-2 text-sm font-bold leading-7 text-gray-600">
                                {recommendation}
                              </p>
                            ) : (
                              <p className="mt-2 text-sm font-bold leading-7 text-gray-600">
                                شاهد شرحًا قصيرًا، ثم حل تدريبًا بسيطًا على نفس المهارة.
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
                            <div className="text-2xl font-black text-gray-900">{skill.mastery}%</div>
                            <div className="text-[11px] font-bold text-gray-400">الإتقان</div>
                          </div>
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${skill.mastery}%` }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm font-bold leading-7 text-gray-500">
                    لا توجد بيانات مهارية تفصيلية لهذه المحاولة بعد. عند ربط الأسئلة بالمهارات سيظهر التحليل هنا تلقائيًا.
                  </div>
                )}

                {sortedSkills.length > 3 ? (
                  <button
                    onClick={() => setShowAllSkills((value) => !value)}
                    className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700 transition-colors hover:bg-indigo-100"
                  >
                    {showAllSkills ? 'إظهار أول 3 مهارات فقط' : `عرض كل المهارات (${sortedSkills.length})`}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold leading-7 text-emerald-800">
            <Target size={16} className="ml-2 inline" />
            القاعدة الذهبية: لا تراجع كل شيء دفعة واحدة. ابدأ بأضعف مهارة، ثم شرح قصير، ثم تدريب بسيط، ثم أعد القياس.
          </div>
        </div>
      </div>
    </div>
  );
};
