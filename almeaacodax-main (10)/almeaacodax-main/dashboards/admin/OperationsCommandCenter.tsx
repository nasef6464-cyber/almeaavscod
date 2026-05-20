import React, { useEffect, useMemo, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    Bug,
    CheckCircle2,
    Clock,
    Database,
    Download,
    ExternalLink,
    Globe2,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    Wrench,
    XCircle,
} from 'lucide-react';
import { api } from '../../services/api';

type OperationalStatus = {
    checkedAt: string;
    database: { status: string; name: string };
    counts: Record<string, number>;
    visible: Record<string, number>;
    learningReadiness: {
        score: number;
        usableSpaces: number;
        emptySpaces: number;
        spaces: Array<{
            pathId: string;
            pathName?: string;
            subjectId: string;
            subjectName: string;
            total: number;
            topics: number;
            lessons: number;
            quizzes: number;
            courses: number;
            library: number;
            issueCount?: number;
            missingLessonRefs?: number;
            missingQuizRefs?: number;
            unplayableLinkedLessons?: number;
            status?: 'ready' | 'needs_attention' | 'empty';
        }>;
        readySpaces?: number;
        spacesNeedingAttention?: number;
    };
    issues: Record<string, number>;
    deployment: {
        api: string;
        database: string;
        frontend: string;
        nodeEnv: string;
        clientUrl: string;
    };
};

type AuditCheck = {
    id: string;
    area: string;
    severity: 'critical' | 'warning' | 'info' | 'success';
    title: string;
    detail: string;
    count: number;
    action: string;
    owner: string;
    routeHint?: string;
    samples?: string[];
};

type RepairAction =
    | 'hide-empty-published-quizzes'
    | 'hide-empty-active-paths'
    | 'unlink-unavailable-topic-lessons'
    | 'unlink-unavailable-topic-quizzes';

type OperationsAudit = {
    checkedAt: string;
    score: number;
    totals: {
        checks: number;
        issues: number;
        critical: number;
        warnings: number;
        info: number;
    };
    inventory: Record<string, number>;
    areaSummary: Record<string, { total: number; issues: number; critical: number }>;
    checks: AuditCheck[];
    priorities: AuditCheck[];
};

type ClientEvent = {
    _id: string;
    severity: 'info' | 'warning' | 'error';
    source: string;
    message: string;
    path?: string;
    userEmail?: string;
    role?: string;
    appVersion?: string;
    metadata?: Record<string, unknown>;
    resolved?: boolean;
    resolvedAt?: string | null;
    resolvedByEmail?: string;
    createdAt: string;
};

type ClientEventsResponse = {
    events: ClientEvent[];
    summary: {
        unresolvedCount: number;
        last24hCount: number;
    };
};

type SeoStatus = {
    checkedAt: string;
    siteUrl: string;
    sitemapUrl: string;
    robotsUrl: string;
    manifestUrl: string;
    indexableRoutes: number;
    paths: number;
    subjects: number;
    warnings: string[];
    sampleRoutes: Array<{ title: string; loc: string }>;
};

type DeliveryReadiness = {
    checkedAt: string;
    score: number;
    status: 'ready' | 'ready_with_notes' | 'blocked';
    summary: {
        failed: number;
        warnings: number;
        passed: number;
        auditScore: number;
        latestBackupAt: string;
        backupAgeHours: number | null;
        clientErrors24h: number;
        aiErrors24h: number;
    };
    checks: Array<{
        id: string;
        title: string;
        status: 'pass' | 'warning' | 'fail';
        detail: string;
        action: string;
        routeHint?: string;
    }>;
    nextActions: Array<{
        id: string;
        title: string;
        action: string;
        routeHint?: string;
    }>;
};

const areaLabels: Record<string, string> = {
    student_journey: 'رحلة الطالب',
    content: 'المحتوى',
    assessment: 'الاختبارات',
    media: 'الفيديو والملفات',
    accounts: 'الحسابات',
    payments: 'الدفع',
    seo: 'ظهور الموقع',
    security: 'الأمان',
    deployment: 'النشر والربط',
};

const severityLabels = {
    critical: 'حرج',
    warning: 'تنبيه',
    info: 'معلومة',
    success: 'سليم',
};

const severityStyles = {
    critical: {
        badge: 'bg-red-50 text-red-700 border-red-200',
        icon: 'text-red-500',
        card: 'border-red-100 bg-red-50/40',
    },
    warning: {
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: 'text-amber-500',
        card: 'border-amber-100 bg-amber-50/40',
    },
    info: {
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: 'text-blue-500',
        card: 'border-blue-100 bg-blue-50/40',
    },
    success: {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: 'text-emerald-500',
        card: 'border-emerald-100 bg-emerald-50/40',
    },
};

const ownerLabels: Record<string, string> = {
    admin: 'الإدارة',
    content: 'المحتوى',
    finance: 'المالية',
    technical: 'تقني',
};

const formatNumber = (value: number | undefined) => (value || 0).toLocaleString('ar-EG');
const formatEventDate = (value: string) => {
    try {
        return new Date(value).toLocaleString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: 'short',
        });
    } catch {
        return value;
    }
};

const SeverityIcon: React.FC<{ severity: AuditCheck['severity']; className?: string }> = ({ severity, className }) => {
    if (severity === 'critical') return <XCircle className={className} size={18} />;
    if (severity === 'warning') return <AlertTriangle className={className} size={18} />;
    if (severity === 'info') return <Activity className={className} size={18} />;
    return <CheckCircle2 className={className} size={18} />;
};

export const OperationsCommandCenter: React.FC = () => {
    const [status, setStatus] = useState<OperationalStatus | null>(null);
    const [audit, setAudit] = useState<OperationsAudit | null>(null);
    const [clientEvents, setClientEvents] = useState<ClientEventsResponse | null>(null);
    const [seoStatus, setSeoStatus] = useState<SeoStatus | null>(null);
    const [deliveryReadiness, setDeliveryReadiness] = useState<DeliveryReadiness | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info' | 'success'>('all');
    const [repairingAction, setRepairingAction] = useState<RepairAction | null>(null);
    const [resolvingEventId, setResolvingEventId] = useState<string | null>(null);
    const [resolvingAllEvents, setResolvingAllEvents] = useState(false);
    const [repairMessage, setRepairMessage] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);

        try {
            const [nextStatus, nextAudit, nextClientEvents, nextSeoStatus, nextDeliveryReadiness] = await Promise.all([
                api.getOperationalStatus(),
                api.getOperationsAudit(),
                api.getClientEvents(12),
                api.getSeoStatus(),
                api.getDeliveryReadiness(),
            ]);
            setStatus(nextStatus as OperationalStatus);
            setAudit(nextAudit as OperationsAudit);
            setClientEvents(nextClientEvents as ClientEventsResponse);
            setSeoStatus(nextSeoStatus as SeoStatus);
            setDeliveryReadiness(nextDeliveryReadiness as DeliveryReadiness);
        } catch (loadError) {
            console.error('Failed to load operations command center', loadError);
            setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل فحص النظام الآن.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredChecks = useMemo(() => {
        if (!audit) return [];
        const activeChecks = audit.checks.filter((item) => item.count > 0 || item.severity === 'success');
        if (filter === 'all') {
            return activeChecks;
        }
        return activeChecks.filter((item) => item.severity === filter);
    }, [audit, filter]);

    const readinessLabel = audit?.score === 100
        ? 'جاهز بثقة عالية'
        : (audit?.score || 0) >= 80
            ? 'جاهز مع ملاحظات'
            : (audit?.score || 0) >= 55
                ? 'يحتاج ضبط قبل التوسع'
                : 'يحتاج تدخل عاجل';

    const deliveryLabel = deliveryReadiness?.status === 'ready'
        ? 'جاهز للتسليم'
        : deliveryReadiness?.status === 'ready_with_notes'
            ? 'جاهز مع ملاحظات'
            : 'معلّق قبل التسليم';

    const downloadAudit = () => {
        if (!audit) return;
        const blob = new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `almeaa-operations-audit-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const repairActionByCheckId: Partial<Record<string, { action: RepairAction; label: string; confirm: string }>> = {
        'published-quizzes-without-questions': {
            action: 'hide-empty-published-quizzes',
            label: 'إخفاء الاختبارات الفارغة',
            confirm: 'سيتم إخفاء الاختبارات المنشورة التي لا تحتوي أسئلة عن الطلاب. هل تريد المتابعة؟',
        },
        'active-paths-without-subjects': {
            action: 'hide-empty-active-paths',
            label: 'إخفاء المسارات الفارغة',
            confirm: 'سيتم إخفاء المسارات النشطة التي لا تحتوي مواد من الصفحة الرئيسية والقائمة. هل تريد المتابعة؟',
        },
        'missing-linked-lessons': {
            action: 'unlink-unavailable-topic-lessons',
            label: 'تنظيف روابط الدروس',
            confirm: 'سيتم حذف روابط الدروس غير المتاحة من الموضوعات فقط، بدون حذف أي درس من مركز الدروس. هل تريد المتابعة؟',
        },
        'missing-linked-quizzes': {
            action: 'unlink-unavailable-topic-quizzes',
            label: 'تنظيف روابط الاختبارات',
            confirm: 'سيتم حذف روابط الاختبارات غير المتاحة من الموضوعات فقط، بدون حذف الاختبارات نفسها. هل تريد المتابعة؟',
        },
    };

    const runRepair = async (action: RepairAction, confirmMessage: string) => {
        if (!window.confirm(confirmMessage)) {
            return;
        }

        setRepairingAction(action);
        setRepairMessage(null);

        try {
            const result = await api.runOperationsRepair({ action, apply: true });
            setRepairMessage(`${result.message} العدد المتأثر: ${formatNumber(result.affected)}.`);
            await loadData();
        } catch (repairError) {
            console.error('Failed to run operations repair', repairError);
            setRepairMessage(repairError instanceof Error ? repairError.message : 'تعذر تنفيذ الإصلاح الآن.');
        } finally {
            setRepairingAction(null);
        }
    };

    const resolveClientEvent = async (eventId: string) => {
        setResolvingEventId(eventId);
        setRepairMessage(null);

        try {
            await api.resolveClientEvent(eventId);
            setRepairMessage('تم إغلاق الخطأ في سجل المراقبة. سيظل محفوظا كأثر تاريخي للمراجعة.');
            await loadData();
        } catch (resolveError) {
            console.error('Failed to resolve client event', resolveError);
            setRepairMessage(resolveError instanceof Error ? resolveError.message : 'تعذر إغلاق الخطأ الآن.');
        } finally {
            setResolvingEventId(null);
        }
    };

    const resolveAllClientErrors = async () => {
        if (!window.confirm('سيتم وضع علامة تم الحل على كل أخطاء الواجهة غير المغلقة. استخدمها بعد التأكد أن السبب اتصلح. هل تريد المتابعة؟')) {
            return;
        }

        setResolvingAllEvents(true);
        setRepairMessage(null);

        try {
            const result = await api.resolveClientEvents({ severity: 'error' });
            setRepairMessage(`تم إغلاق ${formatNumber(result.modifiedCount)} خطأ واجهة غير مغلق.`);
            await loadData();
        } catch (resolveError) {
            console.error('Failed to resolve client events', resolveError);
            setRepairMessage(resolveError instanceof Error ? resolveError.message : 'تعذر إغلاق الأخطاء الآن.');
        } finally {
            setResolvingAllEvents(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-600 mb-2">
                        <Sparkles size={16} />
                        مركز قيادة المنصة
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">مراقبة وتشخيص الموقع</h1>
                    <p className="text-sm text-gray-500 mt-2 max-w-3xl">
                        فحص عملي يساعدك تعرف هل الطالب يقدر يدخل ويتعلم، وهل المحتوى والاختبارات والفيديو والربط والأمان في حالة سليمة.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={downloadAudit}
                        disabled={!audit}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                        <Download size={16} />
                        تحميل التقرير
                    </button>
                    <button
                        type="button"
                        onClick={loadData}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-60"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        فحص الآن
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
                    {error}
                </div>
            )}

            {repairMessage && (
                <div className="p-4 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm">
                    {repairMessage}
                </div>
            )}

            <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <ShieldCheck size={18} className="text-emerald-600" />
                            جاهزية التسليم النهائي
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            ملخص واحد يجمع الربط، المحتوى، النسخ الاحتياطي، الأخطاء، والمساعد الذكي قبل أي تسليم أو إطلاق.
                        </p>
                    </div>
                    <div className={`rounded-2xl px-5 py-3 text-center ${
                        deliveryReadiness?.status === 'ready'
                            ? 'bg-emerald-50 text-emerald-700'
                            : deliveryReadiness?.status === 'ready_with_notes'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-red-50 text-red-700'
                    }`}>
                        <div className="text-xs font-bold">الحالة</div>
                        <div className="mt-1 text-lg font-black">{deliveryLabel}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-4">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-xs font-bold text-gray-500">درجة التسليم</p>
                        <p className="mt-2 text-3xl font-black text-gray-900">{formatNumber(deliveryReadiness?.score)}%</p>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-xs font-bold text-gray-500">ناجح</p>
                        <p className="mt-2 text-3xl font-black text-emerald-700">{formatNumber(deliveryReadiness?.summary.passed)}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-xs font-bold text-gray-500">تنبيهات</p>
                        <p className="mt-2 text-3xl font-black text-amber-700">{formatNumber(deliveryReadiness?.summary.warnings)}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-xs font-bold text-gray-500">مانع تسليم</p>
                        <p className="mt-2 text-3xl font-black text-red-700">{formatNumber(deliveryReadiness?.summary.failed)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 px-5 pb-5 xl:grid-cols-2">
                    <div className="rounded-2xl border border-gray-100">
                        <div className="border-b border-gray-100 px-4 py-3 font-bold text-gray-900">قائمة التسليم</div>
                        <div className="divide-y divide-gray-100">
                            {(deliveryReadiness?.checks || []).map((item) => (
                                <div key={item.id} className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-black text-gray-900">{item.title}</p>
                                            <p className="mt-1 text-xs leading-5 text-gray-500">{item.detail}</p>
                                        </div>
                                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                                            item.status === 'pass'
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : item.status === 'warning'
                                                    ? 'bg-amber-50 text-amber-700'
                                                    : 'bg-red-50 text-red-700'
                                        }`}>
                                            {item.status === 'pass' ? 'سليم' : item.status === 'warning' ? 'تنبيه' : 'مهم'}
                                        </span>
                                    </div>
                                    {item.status !== 'pass' && (
                                        <p className="mt-3 rounded-xl bg-gray-50 p-3 text-xs font-bold leading-6 text-gray-700">{item.action}</p>
                                    )}
                                </div>
                            ))}
                            {!deliveryReadiness && (
                                <div className="p-4 text-sm text-gray-500">جاري تحميل جاهزية التسليم...</div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100">
                        <div className="border-b border-gray-100 px-4 py-3 font-bold text-gray-900">خطوات قبل التسليم</div>
                        <div className="space-y-3 p-4">
                            {(deliveryReadiness?.nextActions || []).length > 0 ? deliveryReadiness?.nextActions.map((item) => (
                                <div key={item.id} className="rounded-2xl bg-amber-50 p-4">
                                    <p className="font-black text-amber-900">{item.title}</p>
                                    <p className="mt-2 text-sm leading-6 text-amber-800">{item.action}</p>
                                </div>
                            )) : (
                                <div className="rounded-2xl bg-emerald-50 p-5 text-sm font-bold leading-7 text-emerald-700">
                                    لا توجد خطوات مانعة للتسليم الآن.
                                </div>
                            )}

                            <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">
                                آخر نسخة احتياطية: {deliveryReadiness?.summary.latestBackupAt ? new Date(deliveryReadiness.summary.latestBackupAt).toLocaleString('ar-SA') : 'غير موجودة'}.
                                أخطاء الواجهة آخر 24 ساعة: {formatNumber(deliveryReadiness?.summary.clientErrors24h)}.
                                أخطاء المساعد آخر 24 ساعة: {formatNumber(deliveryReadiness?.summary.aiErrors24h)}.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-sm text-gray-500">درجة جاهزية المنصة</p>
                            <div className="mt-2 flex items-end gap-3">
                                <span className="text-5xl font-black text-gray-900">{formatNumber(audit?.score)}</span>
                                <span className="text-sm text-gray-500 pb-2">/ 100</span>
                            </div>
                            <p className="text-sm font-bold text-indigo-600 mt-3">{readinessLabel}</p>
                        </div>
                        <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <ShieldCheck size={34} />
                        </div>
                    </div>
                    <div className="mt-6 h-3 rounded-full bg-gray-100 overflow-hidden">
                        <div
                            className={`h-full rounded-full ${(audit?.score || 0) >= 80 ? 'bg-emerald-500' : (audit?.score || 0) >= 55 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${audit?.score || 0}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                        آخر فحص: {audit?.checkedAt ? new Date(audit.checkedAt).toLocaleString('ar-SA') : loading ? 'جاري الفحص...' : 'غير متاح'}
                    </p>
                </div>

                {[
                    { label: 'مشكلات حرجة', value: audit?.totals.critical || 0, icon: <XCircle size={22} />, color: 'text-red-600 bg-red-50' },
                    { label: 'تنبيهات', value: audit?.totals.warnings || 0, icon: <AlertTriangle size={22} />, color: 'text-amber-600 bg-amber-50' },
                    { label: 'مساحات جاهزة', value: status?.learningReadiness.usableSpaces || 0, icon: <CheckCircle2 size={22} />, color: 'text-emerald-600 bg-emerald-50' },
                    { label: 'قاعدة البيانات', value: status?.database.status === 'connected' ? 'متصلة' : 'غير متصلة', icon: <Database size={22} />, color: 'text-blue-600 bg-blue-50' },
                ].map((item) => (
                    <div key={item.label} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                        <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${item.color}`}>
                            {item.icon}
                        </div>
                        <p className="text-sm text-gray-500 mt-4">{item.label}</p>
                        <p className="text-2xl font-black text-gray-900 mt-1">
                            {typeof item.value === 'number' ? formatNumber(item.value) : item.value}
                        </p>
                    </div>
                ))}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Activity size={18} className="text-indigo-600" />
                            صحة مساحات التعلم
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            فحص سريع لكل مادة ظاهرة للطلاب: هل فيها محتوى؟ وهل روابط الدروس والاختبارات داخل المواضيع سليمة؟
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                            سليمة: {formatNumber(status?.learningReadiness.readySpaces)}
                        </span>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                            تحتاج انتباه: {formatNumber(status?.learningReadiness.spacesNeedingAttention)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                            فارغة: {formatNumber(status?.learningReadiness.emptySpaces)}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 p-5 xl:grid-cols-2">
                    {(status?.learningReadiness.spaces || []).map((space) => {
                        const spaceStatus = space.status || (space.total === 0 ? 'empty' : (space.issueCount || 0) > 0 ? 'needs_attention' : 'ready');
                        const tone = spaceStatus === 'ready'
                            ? 'border-emerald-100 bg-emerald-50/50 text-emerald-700'
                            : spaceStatus === 'needs_attention'
                                ? 'border-amber-100 bg-amber-50/60 text-amber-700'
                                : 'border-slate-100 bg-slate-50 text-slate-600';

                        return (
                            <div key={`${space.pathId}-${space.subjectId}`} className="rounded-2xl border border-gray-100 bg-white p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold text-gray-400">{space.pathName || space.pathId}</div>
                                        <h3 className="mt-1 truncate text-base font-black text-gray-900">{space.subjectName}</h3>
                                    </div>
                                    <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${tone}`}>
                                        {spaceStatus === 'ready' ? 'جاهزة للطالب' : spaceStatus === 'needs_attention' ? 'تحتاج مراجعة' : 'فارغة'}
                                    </span>
                                </div>

                                <div className="mt-4 grid grid-cols-5 gap-2 text-center">
                                    {[
                                        ['مواضيع', space.topics],
                                        ['دروس', space.lessons],
                                        ['اختبارات', space.quizzes],
                                        ['دورات', space.courses],
                                        ['ملفات', space.library],
                                    ].map(([label, value]) => (
                                        <div key={label} className="rounded-xl bg-gray-50 p-2">
                                            <div className="text-[11px] font-bold text-gray-500">{label}</div>
                                            <div className="mt-1 text-lg font-black text-gray-900">{formatNumber(Number(value))}</div>
                                        </div>
                                    ))}
                                </div>

                                {(space.issueCount || 0) > 0 ? (
                                    <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-800">
                                        مراجع مكسورة: دروس {formatNumber(space.missingLessonRefs)}، اختبارات {formatNumber(space.missingQuizRefs)}، دروس بلا تشغيل {formatNumber(space.unplayableLinkedLessons)}.
                                    </div>
                                ) : space.total === 0 ? (
                                    <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs font-bold leading-6 text-slate-600">
                                        هذه المادة ظاهرة لكنها لا تحتوي محتوى طالب منشور حتى الآن.
                                    </div>
                                ) : (
                                    <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-bold leading-6 text-emerald-700">
                                        روابط هذه المساحة سليمة حسب آخر فحص.
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {!loading && !(status?.learningReadiness.spaces || []).length && (
                        <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 xl:col-span-2">
                            لا توجد مساحات تعلم ظاهرة للطلاب حاليًا.
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Bug size={18} className="text-rose-500" />
                            سجل أخطاء الواجهة الحية
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            أي صفحة بيضاء، خطأ JavaScript، أو فشل في مشغل الفيديو يتم تسجيله هنا تلقائيا مع الرابط والحساب إن كان مسجلا.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
                            آخر 24 ساعة: {formatNumber(clientEvents?.summary.last24hCount)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                            غير مغلقة: {formatNumber(clientEvents?.summary.unresolvedCount)}
                        </span>
                        {(clientEvents?.summary.unresolvedCount || 0) > 0 && (
                            <button
                                type="button"
                                onClick={resolveAllClientErrors}
                                disabled={resolvingAllEvents}
                                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
                            >
                                {resolvingAllEvents ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                                إغلاق أخطاء الواجهة
                            </button>
                        )}
                    </div>
                </div>

                <div className="divide-y divide-gray-100">
                    {loading && (
                        <div className="p-5 text-sm text-gray-500">جاري تحميل سجل الأخطاء...</div>
                    )}
                    {!loading && (!clientEvents?.events.length) && (
                        <div className="p-8 text-center">
                            <CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={34} />
                            <p className="font-bold text-gray-900">لا توجد أخطاء واجهة مسجلة حاليا</p>
                            <p className="mt-1 text-sm text-gray-500">هذا يعني أن الصفحات لم ترسل أخطاء جديدة للسيرفر في الفترة الأخيرة.</p>
                        </div>
                    )}
                    {clientEvents?.events.map((event) => (
                        <div key={event._id} className="p-5 hover:bg-gray-50/70">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                            event.severity === 'error'
                                                ? 'bg-rose-50 text-rose-700'
                                                : event.severity === 'warning'
                                                    ? 'bg-amber-50 text-amber-700'
                                                    : 'bg-blue-50 text-blue-700'
                                        }`}>
                                            {event.severity === 'error' ? 'خطأ' : event.severity === 'warning' ? 'تنبيه' : 'معلومة'}
                                        </span>
                                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
                                            {event.source}
                                        </span>
                                        {event.role ? (
                                            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                                                {event.role}
                                            </span>
                                        ) : null}
                                        {event.resolved ? (
                                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                                تم الحل
                                            </span>
                                        ) : (
                                            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                                                مفتوح
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-3 break-words text-sm font-bold text-gray-900">{event.message}</p>
                                    <p className="mt-2 break-all text-xs text-gray-500">{event.path || 'بدون رابط'}</p>
                                    {event.userEmail ? (
                                        <p className="mt-1 text-xs text-gray-500">الحساب: {event.userEmail}</p>
                                    ) : null}
                                    {event.resolvedAt ? (
                                        <p className="mt-1 text-xs text-emerald-600">
                                            أغلق بواسطة {event.resolvedByEmail || 'مشرف'} في {formatEventDate(event.resolvedAt)}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                                        <Clock size={14} />
                                        {formatEventDate(event.createdAt)}
                                    </div>
                                    {!event.resolved && (
                                        <button
                                            type="button"
                                            onClick={() => resolveClientEvent(event._id)}
                                            disabled={resolvingEventId === event._id}
                                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                                        >
                                            {resolvingEventId === event._id ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                                            تم الحل
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">الأولويات التي تحتاج تصرف</h2>
                            <p className="text-sm text-gray-500 mt-1">مرتبة حسب الخطورة وتأثيرها على الطالب والتشغيل.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(['all', 'critical', 'warning', 'info', 'success'] as const).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setFilter(item)}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${
                                        filter === item
                                            ? 'bg-gray-900 text-white border-gray-900'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {item === 'all' ? 'الكل' : severityLabels[item]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="divide-y divide-gray-100">
                        {loading && (
                            <div className="p-6 text-sm text-gray-500">جاري فحص المنصة...</div>
                        )}
                        {!loading && filteredChecks.length === 0 && (
                            <div className="p-8 text-center">
                                <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={36} />
                                <p className="font-bold text-gray-900">لا توجد عناصر في هذا التصنيف</p>
                                <p className="text-sm text-gray-500 mt-1">غيّر الفلتر أو أعد الفحص لاحقا.</p>
                            </div>
                        )}
                        {filteredChecks.map((item) => {
                            const style = severityStyles[item.severity];
                            const repair = repairActionByCheckId[item.id];
                            return (
                                <div key={item.id} className="p-5 hover:bg-gray-50/70 transition-colors">
                                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                        <div className="flex gap-3">
                                            <div className={`mt-0.5 ${style.icon}`}>
                                                <SeverityIcon severity={item.severity} />
                                            </div>
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="font-bold text-gray-900">{item.title}</h3>
                                                    <span className={`text-xs px-2 py-1 rounded-full border ${style.badge}`}>
                                                        {severityLabels[item.severity]}
                                                    </span>
                                                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                                                        {areaLabels[item.area] || item.area}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-2 leading-6">{item.detail}</p>
                                                <div className={`mt-3 rounded-lg border p-3 text-sm ${style.card}`}>
                                                    <div className="font-bold text-gray-800 flex items-center gap-2">
                                                        <Wrench size={15} />
                                                        التصرف المطلوب
                                                    </div>
                                                    <p className="text-gray-700 mt-1">{item.action}</p>
                                                </div>
                                                {!!item.samples?.length && (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {item.samples.map((sample) => (
                                                            <span key={`${item.id}-${sample}`} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                                                {sample}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="lg:text-left min-w-[120px]">
                                            <p className="text-2xl font-black text-gray-900">{formatNumber(item.count)}</p>
                                            <p className="text-xs text-gray-500">المسؤول: {ownerLabels[item.owner] || item.owner}</p>
                                            {repair && item.count > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => runRepair(repair.action, repair.confirm)}
                                                    disabled={repairingAction === repair.action}
                                                    className="mt-3 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 disabled:opacity-60"
                                                >
                                                    {repairingAction === repair.action ? <RefreshCw size={14} className="animate-spin" /> : <Wrench size={14} />}
                                                    {repair.label}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                        <h2 className="font-bold text-gray-900">خريطة الجاهزية</h2>
                        <p className="text-sm text-gray-500 mt-1">ملخص سريع لكل منطقة في المنصة.</p>
                        <div className="mt-4 space-y-3">
                            {Object.entries((audit?.areaSummary || {}) as NonNullable<typeof audit>['areaSummary']).map(([area, summary]) => (
                                <div key={area} className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">{areaLabels[area] || area}</p>
                                        <p className="text-xs text-gray-500">
                                            {formatNumber(summary.issues)} ملاحظات من {formatNumber(summary.total)}
                                        </p>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        summary.critical > 0
                                            ? 'bg-red-50 text-red-700'
                                            : summary.issues > 0
                                                ? 'bg-amber-50 text-amber-700'
                                                : 'bg-emerald-50 text-emerald-700'
                                    }`}>
                                        {summary.critical > 0 ? 'عاجل' : summary.issues > 0 ? 'مراجعة' : 'سليم'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                            <Globe2 size={18} className="text-indigo-600" />
                            ظهور الموقع في البحث
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            فحص روابط الفهرسة التي يحتاجها Google ومحركات البحث.
                        </p>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                                <p className="text-xs text-gray-500">صفحات</p>
                                <p className="mt-1 text-xl font-black text-gray-900">{formatNumber(seoStatus?.indexableRoutes)}</p>
                            </div>
                            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                                <p className="text-xs text-gray-500">مسارات</p>
                                <p className="mt-1 text-xl font-black text-gray-900">{formatNumber(seoStatus?.paths)}</p>
                            </div>
                            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                                <p className="text-xs text-gray-500">مواد</p>
                                <p className="mt-1 text-xl font-black text-gray-900">{formatNumber(seoStatus?.subjects)}</p>
                            </div>
                        </div>
                        <div className="mt-4 space-y-2">
                            {[
                                ['Sitemap', seoStatus?.sitemapUrl],
                                ['Robots', seoStatus?.robotsUrl],
                                ['Manifest', seoStatus?.manifestUrl],
                            ].map(([label, href]) => (
                                <a
                                    key={label}
                                    href={href || '#'}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-50"
                                >
                                    <span>{label}</span>
                                    <ExternalLink size={14} />
                                </a>
                            ))}
                        </div>
                        {!!seoStatus?.warnings.length && (
                            <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs leading-6 text-amber-800">
                                {seoStatus.warnings[0]}
                            </div>
                        )}
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                        <h2 className="font-bold text-gray-900">تشغيل الإنتاج</h2>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            {[
                                ['الواجهة', status?.deployment.frontend || 'Vercel'],
                                ['الخادم', status?.deployment.api || 'Render'],
                                ['القاعدة', status?.deployment.database || 'Atlas'],
                                ['الوضع', status?.deployment.nodeEnv || 'غير معروف'],
                            ].map(([label, value]) => (
                                <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                                    <p className="text-xs text-gray-500">{label}</p>
                                    <p className="text-sm font-bold text-gray-900 mt-1">{value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-indigo-600 rounded-lg p-5 text-white">
                        <h2 className="font-bold">فكرة التطوير التالية</h2>
                        <p className="text-sm text-indigo-50 mt-2 leading-6">
                            بعد هذه اللوحة نقدر نضيف سجل أخطاء مباشر للواجهة والـ API، بحيث أي صفحة بيضاء أو فشل فيديو يظهر هنا تلقائيا مع الرابط والحساب والدقيقة التي حدث فيها.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
