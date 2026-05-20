import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, BookOpen, Send, CheckCircle, ArrowRight } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { useStore } from '../store/useStore';
import { sanitizeArabicText } from '../utils/sanitizeMojibakeArabic';

const displayText = (value?: string | null) => sanitizeArabicText(value) || '';

export const BookSession: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addActivity, paths, subjects, sections, skills } = useStore();
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const requestedSkillId = searchParams.get('skillId');
  const requestedSkillName = displayText(searchParams.get('skillName'));
  const requestedSubjectName = displayText(searchParams.get('subjectName'));
  const requestedSectionName = displayText(searchParams.get('sectionName'));

  const sessionTargets = useMemo(() => {
    const primarySkillTargets = skills.map((skill) => {
      const subjectItem = subjects.find((item) => item.id === skill.subjectId);
      const pathItem = subjectItem ? paths.find((item) => item.id === subjectItem.pathId) : undefined;
      const sectionItem = sections.find((item) => item.id === skill.sectionId);

      if (pathItem?.isActive === false) {
        return null;
      }

      const labelParts = [
        displayText(pathItem?.name),
        displayText(subjectItem?.name),
        displayText(sectionItem?.name),
        displayText(skill.name),
      ].filter(Boolean);

      return {
        value: `skill:${skill.id}`,
        label: labelParts.join(' - '),
      };
    }).filter((target): target is { value: string; label: string } => Boolean(target));

    const secondaryTargets = sections
      .filter((section) => !primarySkillTargets.some((item) => item.label.includes(displayText(section.name))))
      .map((section) => {
        const subjectItem = subjects.find((item) => item.id === section.subjectId);
        const pathItem = subjectItem ? paths.find((item) => item.id === subjectItem.pathId) : undefined;
        if (pathItem?.isActive === false) {
          return null;
        }
        const labelParts = [displayText(pathItem?.name), displayText(subjectItem?.name), displayText(section.name)].filter(Boolean);

        return {
          value: `section:${section.id}`,
          label: labelParts.join(' - '),
        };
      }).filter((target): target is { value: string; label: string } => Boolean(target));

    const fallbackTarget = {
      value: 'other',
      label: 'أخرى (يرجى التوضيح في الملاحظات)',
    };

    return [...primarySkillTargets, ...secondaryTargets, fallbackTarget];
  }, [paths, sections, skills, subjects]);

  const selectedTargetLabel = useMemo(
    () => sessionTargets.find((target) => target.value === subject)?.label || subject,
    [sessionTargets, subject],
  );

  useEffect(() => {
    if (subject || sessionTargets.length === 0) return;

    if (requestedSkillId) {
      const directTarget = sessionTargets.find((target) => target.value === `skill:${requestedSkillId}`);
      if (directTarget) {
        setSubject(directTarget.value);
        return;
      }
    }

    if (requestedSkillName) {
      const nameTarget = sessionTargets.find((target) => target.label.includes(requestedSkillName));
      if (nameTarget) {
        setSubject(nameTarget.value);
        return;
      }

      setSubject('other');
    }
  }, [requestedSkillId, requestedSkillName, sessionTargets, subject]);

  useEffect(() => {
    if (notes || !requestedSkillName) return;

    const details = [
      requestedSubjectName ? `المادة: ${requestedSubjectName}` : null,
      requestedSectionName ? `المهارة الرئيسية: ${requestedSectionName}` : null,
      `المهارة المطلوبة: ${requestedSkillName}`,
      'مصدر الطلب: نتيجة اختبار الطالب',
    ].filter(Boolean);

    setNotes(`أرغب في حصة علاجية مركزة على:\n${details.join('\n')}`);
  }, [notes, requestedSectionName, requestedSkillName, requestedSubjectName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (date < today) {
      setFormError('اختر تاريخًا قادمًا أو تاريخ اليوم للحجز.');
      return;
    }

    addActivity({
      type: 'session_booked',
      title: `تم حجز حصة خاصة: ${selectedTargetLabel}`,
      link: '/dashboard?tab=sessions',
    });

    setIsSubmitted(true);

    setTimeout(() => {
      navigate('/dashboard?tab=sessions');
    }, 3000);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-5 sm:p-8 text-center space-y-6 animate-scale-up">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={40} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 leading-tight">تم تأكيد الحجز بنجاح</h2>
            <p className="text-gray-500">تم إرسال طلبك للمدرس. سيتم التواصل معك قريبًا لتأكيد الموعد.</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl text-right text-sm text-gray-600 space-y-2">
            <p><span className="font-bold">المادة / المهارة:</span> {selectedTargetLabel}</p>
            <p><span className="font-bold">التاريخ:</span> {date}</p>
            <p><span className="font-bold">الوقت:</span> {time}</p>
          </div>
          <p className="text-xs text-gray-400">سيتم تحويلك للرئيسية تلقائيًا...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in pb-20">
      <header className="flex items-start gap-3 sm:gap-4">
        <Link to="/dashboard" className="text-gray-500 hover:text-gray-700 transition-colors" aria-label="العودة للوحة الطالب">
          <ArrowRight size={24} />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">حجز حصة خاصة</h1>
          <p className="text-gray-500 text-sm">احجز جلسة فردية مع المدرس للتركيز على النقاط الصعبة.</p>
        </div>
      </header>

      <Card className="p-5 sm:p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {requestedSkillName ? (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm leading-7 text-indigo-800">
              <div className="font-black">تم تجهيز طلب حصة علاجية من تقريرك</div>
              <div className="mt-1">
                {requestedSubjectName ? <span className="ml-2">المادة: <strong>{requestedSubjectName}</strong></span> : null}
                {requestedSectionName ? <span className="ml-2">المهارة الرئيسية: <strong>{requestedSectionName}</strong></span> : null}
                <span>المهارة: <strong>{requestedSkillName}</strong></span>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">المادة / المهارة</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                <BookOpen size={18} />
              </div>
              <select
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-4 pr-10 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
              >
                <option value="" disabled>اختر المادة أو المهارة...</option>
                {sessionTargets.map((target) => (
                  <option key={target.value} value={target.value}>
                    {target.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
              {formError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">التاريخ المفضل</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                  <Calendar size={18} />
                </div>
                <input
                  type="date"
                  required
                  value={date}
                  min={today}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-4 pr-10 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">الوقت المفضل</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                  <Clock size={18} />
                </div>
                <select
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-4 pr-10 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                >
                  <option value="" disabled>اختر الوقت...</option>
                  <option value="04:00 PM - 05:00 PM">04:00 م - 05:00 م</option>
                  <option value="05:00 PM - 06:00 PM">05:00 م - 06:00 م</option>
                  <option value="08:00 PM - 09:00 PM">08:00 م - 09:00 م</option>
                  <option value="09:00 PM - 10:00 PM">09:00 م - 10:00 م</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">ملاحظات للمدرس (اختياري)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب هنا أي تفاصيل أو أسئلة معينة تريد التركيز عليها خلال الحصة..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px] resize-y"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-base sm:text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 flex items-center justify-center gap-2"
          >
            <Send size={20} />
            تأكيد الحجز
          </button>
        </form>
      </Card>
    </div>
  );
};
