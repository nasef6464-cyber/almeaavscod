import React, { useMemo, useState } from 'react';
import { CalendarDays, Copy, Download, ExternalLink, Lock, LockOpen, Plus, Video } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Lesson, LessonType } from '../../types';
import { UnifiedLessonBuilder } from './builders/UnifiedLessonBuilder';
import { sanitizeArabicText } from '../../utils/sanitizeMojibakeArabic';

const LIVE_TYPES: LessonType[] = ['live_youtube', 'zoom', 'google_meet', 'teams'];

const providerLabelMap: Record<LessonType, string> = {
    video: 'فيديو',
    quiz: 'اختبار',
    file: 'ملف',
    assignment: 'واجب',
    text: 'نص',
    live_youtube: 'YouTube Live',
    zoom: 'Zoom',
    google_meet: 'Google Meet',
    teams: 'Microsoft Teams',
};

const displayText = (value?: string | null) => sanitizeArabicText(value) || '';

const downloadCsv = (fileName: string, rows: string[][]) => {
    const csv = rows
        .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
};

export const LiveSessionsManager: React.FC = () => {
    const { lessons, paths, subjects, updateLesson, addLesson, deleteLesson } = useStore();
    const [isEditing, setIsEditing] = useState(false);
    const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
    const [copyMessage, setCopyMessage] = useState('');

    const liveLessons = useMemo(
        () =>
            lessons
                .filter((lesson) => LIVE_TYPES.includes(lesson.type))
                .sort((a, b) => {
                    const aDate = a.meetingDate ? new Date(a.meetingDate).getTime() : 0;
                    const bDate = b.meetingDate ? new Date(b.meetingDate).getTime() : 0;
                    return bDate - aDate;
                }),
        [lessons],
    );

    const publishedLessons = liveLessons.filter((lesson) => lesson.approvalStatus === 'approved' && lesson.showOnPlatform);
    const upcomingLessons = liveLessons.filter((lesson) => lesson.meetingDate && new Date(lesson.meetingDate).getTime() >= Date.now());
    const recordedLessons = liveLessons.filter((lesson) => lesson.recordingUrl && lesson.showRecordingOnPlatform);
    const needsSetupLessons = liveLessons.filter((lesson) => !lesson.meetingUrl || !lesson.meetingDate || !lesson.pathId || !lesson.subjectId);

    const createNewLesson = () => {
        setCurrentLesson({
            id: '',
            title: '',
            type: 'zoom',
            duration: '60',
            isCompleted: false,
            pathId: '',
            subjectId: '',
            sectionId: '',
            skillIds: [],
            order: liveLessons.length + 1,
            accessControl: 'public',
            meetingUrl: '',
            meetingDate: '',
            recordingUrl: '',
            joinInstructions: '',
            showRecordingOnPlatform: false,
            approvalStatus: 'draft',
            showOnPlatform: false,
        });
        setIsEditing(true);
    };

    const handleSave = (_moduleId: string | undefined, lessonToSave: Lesson) => {
        if (currentLesson?.id) {
            updateLesson(lessonToSave.id, lessonToSave);
        } else {
            addLesson({
                ...lessonToSave,
                id: `live_${Date.now()}`,
            });
        }
        setIsEditing(false);
        setCurrentLesson(null);
    };

    const togglePlatformVisibility = (lesson: Lesson) => {
        const shouldShow = !lesson.showOnPlatform;
        updateLesson(lesson.id, {
            showOnPlatform: shouldShow,
            ...(shouldShow && lesson.approvalStatus !== 'approved' ? { approvalStatus: 'approved' } : {}),
        });
    };

    const formatMeetingDate = (meetingDate?: string) =>
        meetingDate
            ? new Date(meetingDate).toLocaleString('ar-SA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            })
            : 'غير محدد';

    const buildInviteText = (lesson: Lesson) => {
        const pathName = displayText(paths.find((path) => path.id === lesson.pathId)?.name) || 'بدون مسار';
        const subjectName = displayText(subjects.find((subject) => subject.id === lesson.subjectId)?.name) || 'بدون مادة';
        return [
            `حصة مباشرة: ${displayText(lesson.title)}`,
            `المسار / المادة: ${pathName} - ${subjectName}`,
            `الموعد: ${formatMeetingDate(lesson.meetingDate)}`,
            lesson.meetingUrl ? `رابط الدخول: ${lesson.meetingUrl}` : 'رابط الدخول سيضاف لاحقًا.',
            lesson.joinInstructions ? `تعليمات: ${displayText(lesson.joinInstructions)}` : '',
        ].filter(Boolean).join('\n');
    };

    const copyInvite = async (lesson: Lesson) => {
        const inviteText = buildInviteText(lesson);
        try {
            await navigator.clipboard.writeText(inviteText);
            setCopyMessage(`تم نسخ دعوة: ${displayText(lesson.title)}`);
        } catch {
            setCopyMessage('تعذر النسخ التلقائي، يمكنك فتح الحصة ونسخ الرابط يدويًا.');
        }
        window.setTimeout(() => setCopyMessage(''), 2500);
    };

    const exportSchedule = () => {
        downloadCsv('live-sessions-schedule.csv', [
            ['الحصة', 'المزود', 'المسار', 'المادة', 'الموعد', 'المدة', 'الحالة', 'الإظهار', 'رابط الدخول', 'رابط التسجيل'],
            ...liveLessons.map((lesson) => [
                displayText(lesson.title),
                providerLabelMap[lesson.type] || lesson.type,
                displayText(paths.find((path) => path.id === lesson.pathId)?.name) || 'بدون مسار',
                displayText(subjects.find((subject) => subject.id === lesson.subjectId)?.name) || 'بدون مادة',
                formatMeetingDate(lesson.meetingDate),
                `${lesson.duration} دقيقة`,
                lesson.approvalStatus === 'approved' ? 'معتمد' : lesson.approvalStatus === 'pending_review' ? 'بانتظار المراجعة' : lesson.approvalStatus === 'rejected' ? 'مرفوض' : 'مسودة',
                lesson.showOnPlatform ? 'ظاهر' : 'مخفي',
                lesson.meetingUrl || '',
                lesson.recordingUrl || '',
            ]),
        ]);
    };

    if (isEditing && currentLesson) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-120px)] animate-fade-in relative z-50">
                <UnifiedLessonBuilder
                    initialLesson={currentLesson}
                    onSave={handleSave}
                    onCancel={() => {
                        setIsEditing(false);
                        setCurrentLesson(null);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">إدارة الحصص المباشرة</h2>
                    <p className="text-gray-500 text-sm mt-1">
                        نظم جلسات Zoom وMeet وTeams والبث المباشر في مساحة مستقلة، ولا تظهر للطالب إلا عند الجاهزية.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <a
                        href="#/live-sessions"
                        target="_blank"
                        rel="noreferrer"
                        className="bg-white text-indigo-700 border border-indigo-100 px-4 py-2 rounded-xl font-bold hover:bg-indigo-50 transition-colors flex items-center gap-2"
                    >
                        <ExternalLink size={18} />
                        معاينة الطالب
                    </a>
                    <button
                        onClick={exportSchedule}
                        className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl font-bold hover:bg-emerald-100 transition-colors flex items-center gap-2"
                    >
                        <Download size={18} />
                        تصدير الجدول
                    </button>
                    <button
                        onClick={createNewLesson}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                        <Plus size={18} />
                        إضافة حصة مباشرة
                    </button>
                </div>
            </div>

            {copyMessage && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700">
                    {copyMessage}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <SummaryCard title="إجمالي الحصص" value={liveLessons.length.toString()} />
                <SummaryCard title="منشور للطلاب" value={publishedLessons.length.toString()} />
                <SummaryCard title="قادمة" value={upcomingLessons.length.toString()} />
                <SummaryCard title="لها تسجيل" value={recordedLessons.length.toString()} />
                <SummaryCard title="تحتاج ضبط" value={needsSetupLessons.length.toString()} />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">الحصة</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">المزود</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">المسار / المادة</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">الموعد</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">الحالة</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">الإظهار</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {liveLessons.map((lesson) => {
                                const pathName = displayText(paths.find((path) => path.id === lesson.pathId)?.name) || 'بدون مسار';
                                const subjectName = displayText(subjects.find((subject) => subject.id === lesson.subjectId)?.name) || 'بدون مادة';
                                const meetingDateLabel = formatMeetingDate(lesson.meetingDate);
                                const readinessNotes = [
                                    !lesson.meetingUrl ? 'ينقص الرابط' : '',
                                    !lesson.meetingDate ? 'ينقص الموعد' : '',
                                    !lesson.pathId || !lesson.subjectId ? 'ينقص التصنيف' : '',
                                ].filter(Boolean);

                                return (
                                    <tr key={lesson.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                                    <Video size={18} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-800">{displayText(lesson.title) || 'حصة بدون عنوان'}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{lesson.duration} دقيقة</div>
                                                    {readinessNotes.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1">
                                                            {readinessNotes.map((note) => (
                                                                <span key={note} className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                                                                    {note}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{providerLabelMap[lesson.type] || lesson.type}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{pathName} - {subjectName}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{meetingDateLabel}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                lesson.approvalStatus === 'approved'
                                                    ? 'bg-emerald-50 text-emerald-600'
                                                    : lesson.approvalStatus === 'pending_review'
                                                        ? 'bg-amber-50 text-amber-600'
                                                        : lesson.approvalStatus === 'rejected'
                                                            ? 'bg-rose-50 text-rose-600'
                                                            : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {lesson.approvalStatus === 'approved'
                                                    ? 'معتمد'
                                                    : lesson.approvalStatus === 'pending_review'
                                                        ? 'بانتظار المراجعة'
                                                        : lesson.approvalStatus === 'rejected'
                                                            ? 'مرفوض'
                                                            : 'مسودة'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${lesson.showOnPlatform ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                                                {lesson.showOnPlatform ? 'ظاهر' : 'مخفي'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <button
                                                    onClick={() => togglePlatformVisibility(lesson)}
                                                    className={`px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                                                        lesson.showOnPlatform ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                    }`}
                                                >
                                                    {lesson.showOnPlatform ? <Lock size={13} /> : <LockOpen size={13} />}
                                                    {lesson.showOnPlatform ? 'إخفاء' : 'فتح'}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setCurrentLesson(lesson);
                                                        setIsEditing(true);
                                                    }}
                                                    className="px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100"
                                                >
                                                    تعديل
                                                </button>
                                                <button
                                                    onClick={() => void copyInvite(lesson)}
                                                    className="px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 inline-flex items-center gap-1"
                                                >
                                                    <Copy size={13} />
                                                    نسخ الدعوة
                                                </button>
                                                {lesson.meetingUrl ? (
                                                    <a
                                                        href={lesson.meetingUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 inline-flex items-center gap-1"
                                                    >
                                                        <ExternalLink size={13} />
                                                        فتح
                                                    </a>
                                                ) : null}
                                                <button
                                                    onClick={() => {
                                                        if (confirm('هل أنت متأكد من حذف هذه الحصة؟')) {
                                                            deleteLesson(lesson.id);
                                                        }
                                                    }}
                                                    className="px-3 py-2 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100"
                                                >
                                                    حذف
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {liveLessons.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                                        لا توجد حصص مباشرة مضافة حتى الآن.
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

const SummaryCard: React.FC<{ title: string; value: string }> = ({ title, value }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 text-sm text-gray-500">
            <CalendarDays size={15} />
            {title}
        </div>
        <div className="text-3xl font-black text-gray-900 mt-2">{value}</div>
    </div>
);
