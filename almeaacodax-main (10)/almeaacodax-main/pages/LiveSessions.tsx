import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Copy, ExternalLink, PlayCircle, Video } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useStore } from '../store/useStore';
import { sanitizeArabicText } from '../utils/sanitizeMojibakeArabic';

const LIVE_TYPES = new Set(['live_youtube', 'zoom', 'google_meet', 'teams']);

const providerLabelMap: Record<string, string> = {
    live_youtube: 'YouTube Live',
    zoom: 'Zoom',
    google_meet: 'Google Meet',
    teams: 'Microsoft Teams',
};

const displayText = (value?: string | null) => sanitizeArabicText(value) || '';

const canAccessLesson = (lesson: any, user: any) => {
    if (user.role === 'student' && lesson.showOnPlatform === false) {
        return false;
    }

    if (lesson.approvalStatus && lesson.approvalStatus !== 'approved' && user.role === 'student') {
        return false;
    }

    if (lesson.accessControl === 'public' || !lesson.accessControl) {
        return true;
    }

    if (lesson.accessControl === 'specific_groups') {
        const userGroups = user.groupIds || [];
        return (lesson.allowedGroupIds || []).some((groupId: string) => userGroups.includes(groupId));
    }

    return user.role !== 'student' || user.subscription?.plan === 'premium' || (user.subscription?.purchasedPackages || []).length > 0;
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

const LiveSessions: React.FC = () => {
    const { lessons, user, paths, subjects } = useStore();
    const [copyMessage, setCopyMessage] = useState('');

    const canSeeHiddenPaths = ['admin', 'teacher', 'supervisor'].includes(String(user.role));
    const visiblePathIds = useMemo(
        () => new Set(paths.filter((path) => canSeeHiddenPaths || path.isActive !== false).map((path) => path.id)),
        [canSeeHiddenPaths, paths],
    );

    const sessions = useMemo(
        () =>
            lessons
                .filter((lesson) => LIVE_TYPES.has(lesson.type))
                .filter((lesson) => canSeeHiddenPaths || !lesson.pathId || visiblePathIds.has(lesson.pathId))
                .filter((lesson) => canAccessLesson(lesson, user))
                .sort((a, b) => {
                    const aDate = a.meetingDate ? new Date(a.meetingDate).getTime() : Number.MAX_SAFE_INTEGER;
                    const bDate = b.meetingDate ? new Date(b.meetingDate).getTime() : Number.MAX_SAFE_INTEGER;
                    return aDate - bDate;
                }),
        [canSeeHiddenPaths, lessons, user, visiblePathIds],
    );

    const upcomingSessions = sessions.filter((lesson) => lesson.meetingDate && new Date(lesson.meetingDate).getTime() >= Date.now());
    const readySessions = sessions.filter((lesson) => !!lesson.meetingUrl);
    const recordedSessions = sessions.filter((lesson) => Boolean(lesson.recordingUrl) && lesson.showRecordingOnPlatform === true);

    const copySessionInvite = async (lesson: any) => {
        const pathName = displayText(paths.find((path) => path.id === lesson.pathId)?.name) || 'بدون مسار';
        const subjectName = displayText(subjects.find((subject) => subject.id === lesson.subjectId)?.name) || 'بدون مادة';
        const invite = [
            `حصة مباشرة: ${displayText(lesson.title)}`,
            `المسار / المادة: ${pathName} - ${subjectName}`,
            `الموعد: ${formatMeetingDate(lesson.meetingDate)}`,
            lesson.meetingUrl ? `رابط الدخول: ${lesson.meetingUrl}` : '',
            lesson.joinInstructions ? `تعليمات: ${displayText(lesson.joinInstructions)}` : '',
        ].filter(Boolean).join('\n');

        try {
            await navigator.clipboard.writeText(invite);
            setCopyMessage('تم نسخ بيانات الحصة بنجاح.');
        } catch {
            setCopyMessage('تعذر النسخ التلقائي. يمكنك فتح الرابط ونسخه يدويًا.');
        }
        window.setTimeout(() => setCopyMessage(''), 2500);
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in">
            <div className="text-right">
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900">الحصص المباشرة</h1>
                <p className="text-gray-500 mt-2">
                    تابع مواعيد الحصص القادمة وروابط Zoom وMeet وTeams والبث المباشر في صفحة واحدة منظمة.
                </p>
            </div>

            {copyMessage && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700">
                    {copyMessage}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SummaryCard title="كل الحصص" value={sessions.length.toString()} />
                <SummaryCard title="الحصص القادمة" value={upcomingSessions.length.toString()} />
                <SummaryCard title="جاهزة للدخول" value={readySessions.length.toString()} />
                <SummaryCard title="تسجيلات متاحة" value={recordedSessions.length.toString()} />
            </div>

            {sessions.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {sessions.map((lesson) => {
                        const pathName = displayText(paths.find((path) => path.id === lesson.pathId)?.name) || 'بدون مسار';
                        const subjectName = displayText(subjects.find((subject) => subject.id === lesson.subjectId)?.name) || 'بدون مادة';
                        const isUpcoming = lesson.meetingDate ? new Date(lesson.meetingDate).getTime() >= Date.now() : false;
                        const canWatchRecording = Boolean(lesson.recordingUrl) && lesson.showRecordingOnPlatform === true;

                        return (
                            <Card key={lesson.id} className="p-5 sm:p-6 border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                            <Video size={22} />
                                        </div>
                                        <div className="text-right">
                                            <h3 className="font-bold text-gray-900 text-lg">{displayText(lesson.title)}</h3>
                                            <p className="text-sm text-gray-500 mt-1">{pathName} - {subjectName}</p>
                                        </div>
                                    </div>
                                    <span className={`self-start px-3 py-1 rounded-full text-xs font-bold ${isUpcoming ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600'}`}>
                                        {isUpcoming ? 'قادمة' : 'متاحة'}
                                    </span>
                                </div>

                                <div className="mt-5 space-y-3 text-sm text-gray-600">
                                    <InfoRow label="المزود" value={providerLabelMap[lesson.type] || 'جلسة مباشرة'} />
                                    <InfoRow label="الموعد" value={formatMeetingDate(lesson.meetingDate)} />
                                    <InfoRow label="المدة" value={`${lesson.duration} دقيقة`} />
                                    {lesson.joinInstructions ? (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700">
                                            {displayText(lesson.joinInstructions)}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {lesson.meetingUrl ? (
                                        <a
                                            href={lesson.meetingUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors"
                                        >
                                            <ExternalLink size={18} />
                                            دخول الحصة
                                        </a>
                                    ) : (
                                        <div className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 text-gray-500 font-bold">
                                            <CalendarDays size={18} />
                                            بانتظار رابط الدخول
                                        </div>
                                    )}
                                    <button
                                        onClick={() => void copySessionInvite(lesson)}
                                        className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 font-bold hover:bg-amber-100 transition-colors"
                                    >
                                        <Copy size={18} />
                                        نسخ بيانات الحصة
                                    </button>
                                    <div className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold bg-gray-50">
                                        <CheckCircle2 size={18} />
                                        {isUpcoming ? 'حضّر جهازك قبل الموعد' : 'راجع تفاصيل الحصة لاحقًا'}
                                    </div>
                                    {canWatchRecording ? (
                                        <a
                                            href={lesson.recordingUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 transition-colors"
                                        >
                                            <PlayCircle size={18} />
                                            مشاهدة التسجيل
                                        </a>
                                    ) : null}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <Card className="p-10 text-center border border-dashed border-gray-200">
                    <Video size={40} className="mx-auto text-gray-300 mb-3" />
                    <h3 className="font-bold text-gray-800 mb-2">لا توجد حصص مباشرة متاحة الآن</h3>
                    <p className="text-sm text-gray-500">عند إضافة حصص Zoom أو Meet أو Teams أو بث مباشر ستظهر هنا بشكل منظم للطالب.</p>
                </Card>
            )}
        </div>
    );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex items-center justify-between gap-3">
        <span>{value}</span>
        <span className="font-bold">{label}</span>
    </div>
);

const SummaryCard: React.FC<{ title: string; value: string }> = ({ title, value }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="text-sm text-gray-500">{title}</div>
        <div className="text-3xl font-black text-gray-900 mt-2">{value}</div>
    </div>
);

export default LiveSessions;
