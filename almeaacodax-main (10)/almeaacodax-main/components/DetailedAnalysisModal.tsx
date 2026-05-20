import React from 'react';
import { Target, X } from 'lucide-react';
import { sanitizeArabicText } from '../utils/sanitizeMojibakeArabic';

interface Skill {
  name: string;
  percentage: number;
  color: string;
  subjectName?: string;
  sectionName?: string;
  recommendation?: string;
}

interface DetailedAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  skills?: Skill[];
  mode?: 'test' | 'bank';
}

const displayText = (value?: string | null) => sanitizeArabicText(value) || '';

const getSimpleLevel = (percentage: number) => {
  if (percentage >= 80) {
    return {
      label: 'مطمئن',
      className: 'bg-emerald-50 text-emerald-700',
    };
  }

  if (percentage >= 60) {
    return {
      label: 'مراجعة بسيطة',
      className: 'bg-amber-50 text-amber-700',
    };
  }

  return {
    label: 'ابدأ بها',
    className: 'bg-rose-50 text-rose-700',
  };
};

const defaultSkills: Skill[] = [
  {
    name: 'الفهم الأساسي',
    percentage: 85,
    color: 'bg-blue-500',
    subjectName: 'المادة الحالية',
    sectionName: 'المهارة الرئيسية',
    recommendation: 'تدريب قصير يكفي للتثبيت.',
  },
  {
    name: 'المهارة التطبيقية',
    percentage: 70,
    color: 'bg-purple-500',
    subjectName: 'المادة الحالية',
    sectionName: 'المهارة الرئيسية',
    recommendation: 'شرح قصير ثم أسئلة متدرجة.',
  },
  {
    name: 'حل المسألة',
    percentage: 45,
    color: 'bg-rose-500',
    subjectName: 'المادة الحالية',
    sectionName: 'المهارة الرئيسية',
    recommendation: 'ابدأ بها الآن.',
  },
];

export const DetailedAnalysisModal: React.FC<DetailedAnalysisModalProps> = ({
  isOpen,
  onClose,
  skills,
  mode = 'test',
}) => {
  if (!isOpen) return null;

  const displaySkills = (skills && skills.length > 0 ? skills : defaultSkills)
    .map((skill) => ({
      ...skill,
      name: displayText(skill.name) || 'مهارة غير مسماة',
      subjectName: displayText(skill.subjectName),
      sectionName: displayText(skill.sectionName),
      recommendation: displayText(skill.recommendation),
    }))
    .sort((a, b) => a.percentage - b.percentage);
  const weakestSkill = displaySkills[0];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-4" dir="rtl">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl animate-scale-up">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
              <Target size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-black text-gray-900">تحليل المهارات</h2>
              <p className="mt-0.5 text-xs font-bold text-gray-500">
                {mode === 'bank' ? 'من التدريب' : 'من الاختبار'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[72vh] space-y-3 overflow-y-auto p-4">
          {weakestSkill ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-3">
              <div className="text-[11px] font-black text-amber-700">ابدأ من هنا</div>
              <div className="mt-1 text-base font-black text-gray-900">{weakestSkill.name}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black">
                <span className="rounded-full bg-white px-3 py-1 text-amber-700">{weakestSkill.percentage}%</span>
                <span className="rounded-full bg-white px-3 py-1 text-gray-700">شرح ثم تدريب قصير</span>
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            {displaySkills.map((skill, idx) => {
              const levelMeta = getSimpleLevel(skill.percentage);

              return (
                <div key={`${skill.name}-${idx}`} className="rounded-2xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap gap-1.5 text-[11px] font-black">
                        {skill.subjectName ? (
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
                            {skill.subjectName}
                          </span>
                        ) : null}
                        {skill.sectionName ? (
                          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-600">
                            {skill.sectionName}
                          </span>
                        ) : null}
                        <span className={`rounded-full px-2.5 py-1 ${levelMeta.className}`}>
                          {levelMeta.label}
                        </span>
                      </div>
                      <h3 className="break-words text-sm font-black text-gray-800 sm:text-base">
                        {skill.name}
                      </h3>
                      {skill.recommendation ? (
                        <p className="mt-1 text-xs font-bold leading-6 text-gray-500">{skill.recommendation}</p>
                      ) : null}
                    </div>

                    <div className="shrink-0 rounded-2xl bg-gray-50 px-3 py-2 text-center">
                      <div className="text-lg font-black text-gray-800">{skill.percentage}%</div>
                    </div>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full ${skill.color} transition-all duration-700 ease-out`}
                      style={{ width: `${skill.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={onClose}
            className="w-full rounded-xl bg-gray-900 py-2.5 text-sm font-black text-white transition-colors hover:bg-gray-800"
          >
            تم
          </button>
        </div>
      </div>
    </div>
  );
};
