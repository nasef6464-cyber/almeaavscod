import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileJson, History, Loader2, RefreshCw, Save, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';

type BackupPayload = {
    schemaVersion?: number;
    kind?: string;
    createdAt?: string;
    database?: string;
    scope?: {
        type: 'full' | 'path';
        pathId?: string;
        pathName?: string;
        note?: string;
    };
    summary?: Record<string, number>;
    collections?: Array<{ name: string; documents: unknown[] }>;
};

type RestoreResponse = {
    ok?: boolean;
    applied?: boolean;
    replaced?: boolean;
    summary?: Record<string, { backup: number; current: number; action: string }>;
    note?: string;
};

type BackupSnapshot = {
    id: string;
    title: string;
    createdAt: string;
    createdByEmail?: string;
    database?: string;
    summary?: Record<string, number>;
    totalDocuments?: number;
};

type BackupActivity = {
    id: string;
    action: 'snapshot-created' | 'snapshot-deleted' | 'restore-preview' | 'restore-applied' | 'restore-safety-snapshot';
    title: string;
    actorEmail?: string;
    snapshotId?: string;
    safetySnapshotId?: string;
    source?: string;
    applied?: boolean;
    replaced?: boolean;
    totalDocuments?: number;
    createdAt: string;
};

type BackupStatus = {
    status: 'ready' | 'ready_with_notes' | 'action_required';
    totalSnapshots: number;
    restoreAppliedCount: number;
    latestSnapshot?: BackupSnapshot | null;
    latestActivity?: BackupActivity | null;
    backupAgeHours?: number | null;
    checks?: Array<{ key: string; label: string; passed: boolean; severity: 'ok' | 'warning' | 'critical' }>;
    recommendation?: string;
};

const collectionLabels: Record<string, string> = {
    paths: 'المسارات',
    levels: 'المراحل',
    subjects: 'المواد',
    sections: 'الأقسام',
    skills: 'المهارات',
    topics: 'الموضوعات',
    lessons: 'الدروس',
    questions: 'الأسئلة',
    quizzes: 'الاختبارات',
    courses: 'الدورات والباقات',
    libraryItems: 'المكتبة',
    groups: 'المدارس والمجموعات',
    b2bPackages: 'باقات المدارس',
    accessCodes: 'أكواد الوصول',
    studyPlans: 'خطط الدراسة',
    homepageSettings: 'إعدادات الرئيسية',
    paymentSettings: 'إعدادات الدفع',
};

const essentialCollections = ['paths', 'subjects', 'sections', 'skills', 'topics', 'lessons', 'questions', 'quizzes'];

const isValidLearningBackup = (payload: BackupPayload | null) =>
    payload?.kind === 'almeaa-learning-content-backup' &&
    payload?.schemaVersion === 1 &&
    Array.isArray(payload?.collections);

const downloadJson = (payload: unknown, fileName: string) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};

export const BackupManager: React.FC = () => {
    const {
        paths,
        levels,
        subjects,
        sections,
        skills,
        topics,
        lessons,
        questions,
        quizzes,
        courses,
        libraryItems,
    } = useStore();
    const [isCreating, setIsCreating] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [backupPayload, setBackupPayload] = useState<BackupPayload | null>(null);
    const [selectedFileName, setSelectedFileName] = useState('');
    const [restorePreview, setRestorePreview] = useState<RestoreResponse | null>(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [replaceMode, setReplaceMode] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
    const [activities, setActivities] = useState<BackupActivity[]>([]);
    const [snapshotsLoading, setSnapshotsLoading] = useState(false);
    const [snapshotTitle, setSnapshotTitle] = useState('');
    const [selectedSnapshotId, setSelectedSnapshotId] = useState('');
    const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
    const [selectedPathExportId, setSelectedPathExportId] = useState('');

    const backupSummaryRows = useMemo(() => {
        const summary = backupPayload?.summary || Object.fromEntries((backupPayload?.collections || []).map((item) => [item.name, item.documents.length]));
        return Object.entries(summary).map(([name, count]) => ({
            name,
            label: collectionLabels[name] || name,
            count,
        }));
    }, [backupPayload]);

    const missingEssentialCollections = useMemo(() => {
        const existing = new Set((backupPayload?.collections || []).map((item) => item.name));
        return essentialCollections.filter((name) => !existing.has(name));
    }, [backupPayload]);

    const backupTotals = useMemo(() => backupSummaryRows.reduce((sum, row) => sum + Number(row.count || 0), 0), [backupSummaryRows]);
    const pathExportPreview = useMemo<Record<string, unknown[]> | null>(() => {
        if (!selectedPathExportId) return null;

        const pathSubjects = subjects.filter((subject) => subject.pathId === selectedPathExportId);
        const subjectIds = new Set(pathSubjects.map((subject) => subject.id));
        const pathLevels = levels.filter((level) => level.pathId === selectedPathExportId);
        const pathSections = sections.filter((section) => subjectIds.has(section.subjectId));
        const sectionIds = new Set(pathSections.map((section) => section.id));
        const pathSkills = skills.filter(
            (skill) => skill.pathId === selectedPathExportId || subjectIds.has(skill.subjectId) || sectionIds.has(skill.sectionId),
        );
        const skillIds = new Set(pathSkills.map((skill) => skill.id));
        const pathTopics = topics.filter((topic) => topic.pathId === selectedPathExportId || subjectIds.has(topic.subjectId));
        const pathLessons = lessons.filter(
            (lesson) =>
                lesson.pathId === selectedPathExportId ||
                (lesson.subjectId ? subjectIds.has(lesson.subjectId) : false) ||
                (lesson.sectionId ? sectionIds.has(lesson.sectionId) : false) ||
                (lesson.skillIds || []).some((skillId) => skillIds.has(skillId)),
        );
        const lessonIds = new Set(pathLessons.map((lesson) => lesson.id));
        const pathQuestions = questions.filter(
            (question) =>
                question.pathId === selectedPathExportId ||
                (question.sectionId ? sectionIds.has(question.sectionId) : false) ||
                (question.skillIds || []).some((skillId) => skillIds.has(skillId)),
        );
        const questionIds = new Set(pathQuestions.map((question) => question.id));
        const pathQuizzes = quizzes.filter(
            (quiz) =>
                quiz.pathId === selectedPathExportId ||
                subjectIds.has(quiz.subjectId) ||
                (quiz.sectionId ? sectionIds.has(quiz.sectionId) : false) ||
                (quiz.skillIds || []).some((skillId) => skillIds.has(skillId)) ||
                (quiz.questionIds || []).some((questionId) => questionIds.has(questionId)),
        );
        const pathCourses = courses.filter(
            (course) =>
                course.pathId === selectedPathExportId ||
                (course.subjectId ? subjectIds.has(course.subjectId) : false) ||
                (course.sectionId ? sectionIds.has(course.sectionId) : false) ||
                (course.skills || []).some((skillId) => skillIds.has(skillId)) ||
                (course.modules || []).some((module) => module.lessons.some((lesson) => lessonIds.has(lesson.id))),
        );
        const courseIds = new Set(pathCourses.map((course) => course.id));
        const packageCourses = courses.filter((course) => (course.includedCourses || []).some((courseId) => courseIds.has(courseId)));
        const pathLibraryItems = libraryItems.filter(
            (item) =>
                item.pathId === selectedPathExportId ||
                subjectIds.has(item.subjectId) ||
                (item.sectionId ? sectionIds.has(item.sectionId) : false) ||
                (item.skillIds || []).some((skillId) => skillIds.has(skillId)),
        );

        return {
            paths: paths.filter((path) => path.id === selectedPathExportId),
            levels: pathLevels,
            subjects: pathSubjects,
            sections: pathSections,
            skills: pathSkills,
            topics: pathTopics,
            lessons: pathLessons,
            questions: pathQuestions,
            quizzes: pathQuizzes,
            courses: [...pathCourses, ...packageCourses.filter((course) => !courseIds.has(course.id))],
            libraryItems: pathLibraryItems,
        };
    }, [courses, lessons, levels, libraryItems, paths, questions, quizzes, sections, selectedPathExportId, skills, subjects, topics]);
    const pathExportRows = useMemo(() => {
        if (!pathExportPreview) return [];

        return Object.entries(pathExportPreview).map(([name, documents]) => ({
            name,
            label: collectionLabels[name] || name,
            count: documents.length,
        }));
    }, [pathExportPreview]);
    const selectedExportPath = paths.find((path) => path.id === selectedPathExportId);
    const requiredConfirmText = replaceMode ? 'استبدال' : 'استرجاع';

    const latestSafetySnapshot = activities.find((activity) => activity.action === 'restore-safety-snapshot');
    const statusTone = backupStatus?.status === 'ready'
        ? {
            label: 'جاهز',
            box: 'border-emerald-100 bg-emerald-50 text-emerald-800',
            dot: 'bg-emerald-500',
        }
        : backupStatus?.status === 'ready_with_notes'
            ? {
                label: 'جاهز مع تنبيه',
                box: 'border-amber-100 bg-amber-50 text-amber-800',
                dot: 'bg-amber-500',
            }
            : {
                label: 'يحتاج نسخة',
                box: 'border-rose-100 bg-rose-50 text-rose-800',
                dot: 'bg-rose-500',
            };

    const activityLabel = (action: BackupActivity['action']) => {
        if (action === 'snapshot-created') return 'حفظ نسخة';
        if (action === 'snapshot-deleted') return 'حذف نسخة';
        if (action === 'restore-preview') return 'فحص استرجاع';
        if (action === 'restore-applied') return 'استرجاع فعلي';
        return 'نسخة أمان تلقائية';
    };

    const loadSnapshots = async () => {
        setSnapshotsLoading(true);
        setErrorMessage('');

        try {
            const [snapshotsResponse, activitiesResponse, statusResponse] = await Promise.all([
                api.listLearningBackupSnapshots(),
                api.listLearningBackupActivity(),
                api.getLearningBackupStatus(),
            ]);
            setSnapshots((snapshotsResponse.snapshots || []) as BackupSnapshot[]);
            setActivities((activitiesResponse.activities || []) as BackupActivity[]);
            setBackupStatus(statusResponse as BackupStatus);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'تعذر تحميل النسخ المحفوظة على السيرفر.');
        } finally {
            setSnapshotsLoading(false);
        }
    };

    useEffect(() => {
        void loadSnapshots();
    }, []);

    const createBackup = async () => {
        setIsCreating(true);
        setErrorMessage('');
        setStatusMessage('');

        try {
            const payload = await api.createLearningBackup() as BackupPayload;
            if (!isValidLearningBackup(payload)) {
                throw new Error('ملف النسخة غير صالح.');
            }

            setBackupPayload(payload);
            setSelectedFileName('');
            setRestorePreview(null);
            setConfirmText('');
            const safeDate = (payload.createdAt || new Date().toISOString()).replace(/[:.]/g, '-');
            downloadJson(payload, `almeaa-learning-content-${safeDate}.json`);
            setStatusMessage('تم إنشاء نسخة احتياطية من محتوى التعلم وتحميلها.');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'تعذر إنشاء النسخة الاحتياطية الآن.');
        } finally {
            setIsCreating(false);
        }
    };

    const createPathBackup = () => {
        if (!selectedPathExportId || !selectedExportPath || !pathExportPreview) {
            setErrorMessage('اختر مسارًا أولًا قبل إنشاء نسخة مسار.');
            return;
        }

        const collections = Object.entries(pathExportPreview).map(([name, documents]) => ({
            name,
            documents,
        }));
        const summary = Object.fromEntries(collections.map((collection) => [collection.name, collection.documents.length]));
        const createdAt = new Date().toISOString();
        const safePathName = selectedExportPath.name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-');
        const payload: BackupPayload = {
            schemaVersion: 1,
            kind: 'almeaa-learning-content-backup',
            createdAt,
            database: 'scoped-path-export',
            scope: {
                type: 'path',
                pathId: selectedExportPath.id,
                pathName: selectedExportPath.name,
                note: 'نسخة مسار محدد فقط: تصلح للحفظ الخارجي أو الفحص قبل الاسترجاع.',
            },
            summary,
            collections,
        };

        setBackupPayload(payload);
        setSelectedFileName(`نسخة مسار: ${selectedExportPath.name}`);
        setRestorePreview(null);
        setConfirmText('');
        downloadJson(payload, `almeaa-path-${safePathName}-${createdAt.replace(/[:.]/g, '-')}.json`);
        setStatusMessage(`تم تحميل نسخة لمسار ${selectedExportPath.name}. احتفظ بها على جهازك أو Google Drive.`);
    };

    const createSnapshot = async () => {
        setIsCreating(true);
        setErrorMessage('');
        setStatusMessage('');

        try {
            const response = await api.createLearningBackupSnapshot({
                title: snapshotTitle.trim() || undefined,
            }) as { snapshot?: BackupSnapshot };
            setSnapshotTitle('');
            setStatusMessage('تم حفظ نسخة احتياطية داخلية على السيرفر. يمكن تحميلها أو استرجاعها لاحقا من هذه اللوحة.');
            await loadSnapshots();
            if (response.snapshot?.id) {
                setSelectedSnapshotId(response.snapshot.id);
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'تعذر حفظ النسخة على السيرفر الآن.');
        } finally {
            setIsCreating(false);
        }
    };

    const loadSnapshotBackup = async (snapshotId: string, shouldDownload = false) => {
        if (!snapshotId) return;
        setIsCreating(true);
        setErrorMessage('');
        setStatusMessage('');

        try {
            const response = await api.getLearningBackupSnapshot(snapshotId) as { snapshot?: BackupSnapshot; backup?: BackupPayload };
            if (!isValidLearningBackup(response.backup || null)) {
                throw new Error('النسخة المحفوظة على السيرفر غير صالحة.');
            }

            setBackupPayload(response.backup as BackupPayload);
            setSelectedSnapshotId(snapshotId);
            setSelectedFileName(response.snapshot?.title || 'نسخة محفوظة على السيرفر');
            setRestorePreview(null);
            setConfirmText('');

            if (shouldDownload) {
                const safeDate = (response.backup?.createdAt || new Date().toISOString()).replace(/[:.]/g, '-');
                downloadJson(response.backup, `almeaa-server-snapshot-${safeDate}.json`);
                setStatusMessage('تم تحميل النسخة المحفوظة من السيرفر.');
            } else {
                setStatusMessage('تم تحميل النسخة من السيرفر داخل اللوحة. افحصها قبل أي استرجاع.');
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'تعذر تحميل النسخة من السيرفر.');
        } finally {
            setIsCreating(false);
        }
    };

    const deleteSnapshot = async (snapshotId: string) => {
        const confirmed = window.confirm('هل تريد حذف هذه النسخة المحفوظة من السيرفر؟ يفضل تحميلها على جهازك قبل الحذف.');
        if (!confirmed) return;

        setSnapshotsLoading(true);
        setErrorMessage('');
        setStatusMessage('');

        try {
            await api.deleteLearningBackupSnapshot(snapshotId);
            if (selectedSnapshotId === snapshotId) {
                setSelectedSnapshotId('');
            }
            setStatusMessage('تم حذف النسخة المحفوظة من السيرفر.');
            await loadSnapshots();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'تعذر حذف النسخة المحفوظة.');
        } finally {
            setSnapshotsLoading(false);
        }
    };

    const readBackupFile = async (file: File) => {
        setErrorMessage('');
        setStatusMessage('');
        setRestorePreview(null);

        try {
            const raw = await file.text();
            const parsed = JSON.parse(raw) as BackupPayload;
            if (!isValidLearningBackup(parsed)) {
                throw new Error('هذا الملف ليس نسخة تعليمية صالحة للمنصة.');
            }

            setBackupPayload(parsed);
            setSelectedFileName(file.name);
            setConfirmText('');
            setStatusMessage('تم قراءة الملف. ابدأ بالفحص قبل أي استرجاع.');
        } catch (error) {
            setBackupPayload(null);
            setSelectedFileName('');
            setErrorMessage(error instanceof Error ? error.message : 'تعذر قراءة ملف النسخة.');
        }
    };

    const runRestore = async (apply: boolean) => {
        if (!backupPayload) {
            setErrorMessage('اختر ملف نسخة احتياطية أولًا.');
            return;
        }

        setIsRestoring(true);
        setErrorMessage('');
        setStatusMessage('');

        try {
            const response = await api.restoreLearningBackup({
                backup: backupPayload,
                apply,
                replace: apply ? replaceMode : false,
                confirmText: apply ? confirmText : undefined,
            }) as RestoreResponse;

            setRestorePreview(response);
            await loadSnapshots();
            setStatusMessage(apply ? 'تم تطبيق الاسترجاع بنجاح.' : 'تم فحص الملف بدون أي تعديل على قاعدة البيانات.');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'تعذر تنفيذ العملية الآن.');
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-emerald-700 p-6 text-white shadow-lg">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-100">
                            <ShieldCheck size={18} />
                            حماية محتوى المنصة
                        </div>
                        <h2 className="text-2xl font-black">النسخ الاحتياطي والاسترجاع</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-7 text-emerald-50">
                            احفظ نسخة من المسارات والمواد والمهارات والدروس والأسئلة والاختبارات. هذا لا يشمل كلمات مرور المستخدمين أو بيانات الدفع.
                        </p>
                    </div>
                    <button
                        onClick={createBackup}
                        disabled={isCreating}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                    >
                        {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                        إنشاء وتحميل نسخة
                    </button>
                </div>
            </div>

            {statusMessage ? (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                    <CheckCircle2 size={18} />
                    {statusMessage}
                </div>
            ) : null}

            {errorMessage ? (
                <div className="flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                    <AlertTriangle size={18} />
                    {errorMessage}
                </div>
            ) : null}

            <section className={`rounded-3xl border p-5 shadow-sm ${statusTone.box}`}>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`h-3 w-3 rounded-full ${statusTone.dot}`} />
                            <h3 className="text-lg font-black">حالة النسخ الاحتياطي: {statusTone.label}</h3>
                        </div>
                        <p className="mt-2 max-w-3xl text-sm font-bold leading-7">
                            {backupStatus?.recommendation || 'جاري قراءة حالة النسخ الاحتياطي من السيرفر.'}
                        </p>
                        {backupStatus?.latestSnapshot ? (
                            <p className="mt-1 text-xs font-bold opacity-80">
                                آخر نسخة: {backupStatus.latestSnapshot.title} · {new Date(backupStatus.latestSnapshot.createdAt).toLocaleString('ar-SA')}
                            </p>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
                        <div className="rounded-2xl bg-white/70 p-4">
                            <div className="text-xs font-black opacity-75">عدد النسخ</div>
                            <div className="mt-2 text-2xl font-black">{backupStatus?.totalSnapshots ?? snapshots.length}</div>
                        </div>
                        <div className="rounded-2xl bg-white/70 p-4">
                            <div className="text-xs font-black opacity-75">عمر آخر نسخة</div>
                            <div className="mt-2 text-2xl font-black">
                                {typeof backupStatus?.backupAgeHours === 'number' ? `${backupStatus.backupAgeHours}س` : '--'}
                            </div>
                        </div>
                        <div className="rounded-2xl bg-white/70 p-4">
                            <div className="text-xs font-black opacity-75">عناصر آخر نسخة</div>
                            <div className="mt-2 text-2xl font-black">{backupStatus?.latestSnapshot?.totalDocuments ?? 0}</div>
                        </div>
                        <div className="rounded-2xl bg-white/70 p-4">
                            <div className="text-xs font-black opacity-75">استرجاع فعلي</div>
                            <div className="mt-2 text-2xl font-black">{backupStatus?.restoreAppliedCount ?? 0}</div>
                        </div>
                    </div>
                </div>

                {backupStatus?.checks?.length ? (
                    <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
                        {backupStatus.checks.map((check) => (
                            <div key={check.key} className="flex items-center gap-2 rounded-2xl bg-white/70 p-3 text-sm font-black">
                                {check.passed ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                                <span>{check.label}</span>
                            </div>
                        ))}
                    </div>
                ) : null}
            </section>

            <section className="rounded-3xl border border-blue-100 bg-blue-50/60 p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-black text-blue-950">
                            <Download size={19} className="text-blue-700" />
                            نسخة احتياطية لمسار واحد
                        </h3>
                        <p className="mt-1 max-w-3xl text-sm font-bold leading-7 text-blue-800">
                            استخدمها عندما تريد حفظ القدرات أو التحصيلي وحده: المسار، مواده، الأقسام، المهارات، الموضوعات، الدروس، الأسئلة، الاختبارات، الدورات والمكتبة.
                        </p>
                    </div>
                    <div className="flex w-full flex-col gap-2 xl:w-[460px]">
                        <select
                            value={selectedPathExportId}
                            onChange={(event) => setSelectedPathExportId(event.target.value)}
                            className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">اختر المسار المطلوب نسخه</option>
                            {paths.map((path) => (
                                <option key={path.id} value={path.id}>
                                    {path.name}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={createPathBackup}
                            disabled={!selectedPathExportId}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60"
                        >
                            <Download size={18} />
                            تحميل نسخة المسار
                        </button>
                    </div>
                </div>

                {pathExportRows.length ? (
                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
                        {pathExportRows.map((row) => (
                            <div key={row.name} className="rounded-2xl border border-blue-100 bg-white p-3">
                                <div className="text-xs font-black text-blue-700">{row.label}</div>
                                <div className="mt-2 text-xl font-black text-blue-950">{row.count}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-5 rounded-2xl border border-dashed border-blue-200 bg-white/70 p-5 text-center text-sm font-bold text-blue-700">
                        اختر مسارًا لعرض ما سيتم حفظه قبل التحميل.
                    </div>
                )}
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-black text-gray-900">
                            <Save size={19} className="text-emerald-600" />
                            خزنة النسخ المحفوظة على السيرفر
                        </h3>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
                            هذه نسخ داخلية محفوظة داخل قاعدة البيانات لتسهيل الرجوع السريع. الأفضل دائما تحميل نسخة JSON خارجية أيضا والاحتفاظ بها على جهازك أو Google Drive.
                        </p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
                        <input
                            type="text"
                            value={snapshotTitle}
                            onChange={(event) => setSnapshotTitle(event.target.value)}
                            placeholder="اسم اختياري للنسخة"
                            className="min-w-0 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:w-72"
                        />
                        <button
                            type="button"
                            onClick={createSnapshot}
                            disabled={isCreating}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                            {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            حفظ Snapshot
                        </button>
                        <button
                            type="button"
                            onClick={loadSnapshots}
                            disabled={snapshotsLoading}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                            <RefreshCw size={18} className={snapshotsLoading ? 'animate-spin' : ''} />
                            تحديث
                        </button>
                    </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100">
                    {snapshotsLoading ? (
                        <div className="p-5 text-sm text-gray-500">جاري تحميل النسخ المحفوظة...</div>
                    ) : snapshots.length === 0 ? (
                        <div className="p-8 text-center">
                            <ShieldCheck className="mx-auto mb-3 text-emerald-500" size={34} />
                            <p className="font-bold text-gray-900">لا توجد نسخ محفوظة على السيرفر بعد</p>
                            <p className="mt-1 text-sm text-gray-500">اضغط حفظ Snapshot لإنشاء أول نسخة داخلية.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {snapshots.map((snapshot) => (
                                <div
                                    key={snapshot.id}
                                    className={`flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between ${
                                        selectedSnapshotId === snapshot.id ? 'bg-emerald-50/60' : 'bg-white'
                                    }`}
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h4 className="font-black text-gray-900">{snapshot.title}</h4>
                                            {selectedSnapshotId === snapshot.id ? (
                                                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">محددة</span>
                                            ) : null}
                                        </div>
                                        <p className="mt-1 text-xs leading-5 text-gray-500">
                                            {new Date(snapshot.createdAt).toLocaleString('ar-SA')} · {snapshot.totalDocuments || 0} عنصر · {snapshot.database || 'قاعدة غير محددة'}
                                        </p>
                                        {snapshot.createdByEmail ? (
                                            <p className="mt-1 text-xs text-gray-400">أنشأها: {snapshot.createdByEmail}</p>
                                        ) : null}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => loadSnapshotBackup(snapshot.id)}
                                            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
                                        >
                                            تحميل داخل اللوحة
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => loadSnapshotBackup(snapshot.id, true)}
                                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-700 hover:bg-gray-50"
                                        >
                                            <Download size={14} />
                                            تنزيل JSON
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteSnapshot(snapshot.id)}
                                            className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2 text-xs font-black text-rose-700 hover:bg-rose-100"
                                        >
                                            <Trash2 size={14} />
                                            حذف
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-black text-gray-900">
                            <History size={19} className="text-slate-700" />
                            سجل النسخ والاسترجاع
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-gray-500">
                            أي حفظ أو فحص أو استرجاع فعلي يظهر هنا. قبل أي استرجاع فعلي يحفظ السيرفر نسخة أمان تلقائية يمكن الرجوع لها.
                        </p>
                    </div>
                    {latestSafetySnapshot ? (
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                            آخر نسخة أمان: {new Date(latestSafetySnapshot.createdAt).toLocaleString('ar-SA')}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-600">
                            لم يتم تنفيذ استرجاع فعلي بعد
                        </div>
                    )}
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100">
                    {snapshotsLoading ? (
                        <div className="p-5 text-sm text-gray-500">جاري تحميل سجل العمليات...</div>
                    ) : activities.length === 0 ? (
                        <div className="p-8 text-center">
                            <History className="mx-auto mb-3 text-slate-400" size={34} />
                            <p className="font-bold text-gray-900">لا توجد عمليات مسجلة بعد</p>
                            <p className="mt-1 text-sm text-gray-500">ابدأ بحفظ Snapshot أو فحص ملف استرجاع.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {activities.slice(0, 8).map((activity) => (
                                <div key={activity.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${
                                                activity.action === 'restore-applied'
                                                    ? 'bg-rose-50 text-rose-700'
                                                    : activity.action === 'restore-safety-snapshot'
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : 'bg-slate-100 text-slate-700'
                                            }`}>
                                                {activityLabel(activity.action)}
                                            </span>
                                            {activity.replaced ? (
                                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">استبدال كامل</span>
                                            ) : null}
                                        </div>
                                        <p className="mt-2 font-black text-gray-900">{activity.title}</p>
                                        <p className="mt-1 text-xs text-gray-500">
                                            {new Date(activity.createdAt).toLocaleString('ar-SA')} · {activity.actorEmail || 'النظام'} · {activity.totalDocuments || 0} عنصر
                                        </p>
                                        {activity.safetySnapshotId ? (
                                            <p className="mt-1 text-xs font-bold text-emerald-700">
                                                تم حفظ نسخة أمان قبل التنفيذ: {activity.safetySnapshotId}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="text-xs font-bold text-gray-400">
                                        {activity.source === 'uploaded-file' ? 'ملف خارجي' : activity.source === 'server-snapshot' ? 'Snapshot داخلي' : 'النظام'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm xl:col-span-2">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-black text-gray-900">محتوى النسخة الحالية</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {backupPayload ? `مصدر النسخة: ${selectedFileName || 'نسخة تم إنشاؤها الآن'}` : 'أنشئ نسخة أو ارفع ملف نسخة سابق.'}
                            </p>
                        </div>
                        <FileJson className="text-emerald-600" />
                    </div>

                    {backupPayload ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <div className="rounded-2xl bg-emerald-50 p-4">
                                    <div className="text-xs font-bold text-emerald-700">إجمالي العناصر</div>
                                    <div className="mt-2 text-2xl font-black text-emerald-900">{backupTotals}</div>
                                </div>
                                <div className="rounded-2xl bg-blue-50 p-4">
                                    <div className="text-xs font-bold text-blue-700">تاريخ النسخة</div>
                                    <div className="mt-2 text-sm font-black text-blue-900">{backupPayload.createdAt ? new Date(backupPayload.createdAt).toLocaleString('ar-SA') : 'غير محدد'}</div>
                                </div>
                                <div className={`rounded-2xl p-4 ${missingEssentialCollections.length ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                                    <div className={`text-xs font-bold ${missingEssentialCollections.length ? 'text-amber-700' : 'text-emerald-700'}`}>حالة الملف</div>
                                    <div className={`mt-2 text-sm font-black ${missingEssentialCollections.length ? 'text-amber-900' : 'text-emerald-900'}`}>
                                        {missingEssentialCollections.length ? `ينقص ${missingEssentialCollections.length} مجموعات` : 'جاهز للفحص'}
                                    </div>
                                </div>
                            </div>

                            {missingEssentialCollections.length ? (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
                                    هذه النسخة قديمة أو ناقصة. المجموعات الناقصة: {missingEssentialCollections.map((name) => collectionLabels[name] || name).join('، ')}.
                                </div>
                            ) : null}

                            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                                {backupSummaryRows.map((row) => (
                                    <div key={row.name} className="rounded-2xl bg-gray-50 p-4">
                                        <div className="text-xs font-bold text-gray-500">{row.label}</div>
                                        <div className="mt-2 text-2xl font-black text-gray-900">{row.count}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm leading-7 text-gray-500">
                            لا توجد نسخة محددة بعد.
                        </div>
                    )}
                </section>

                <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-black text-gray-900">رفع نسخة للاسترجاع</h3>
                    <p className="mt-1 text-sm leading-6 text-gray-500">ابدأ دائمًا بفحص الملف. الاسترجاع الحقيقي لا يتم إلا عند الضغط على تطبيق.</p>

                    <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center hover:border-emerald-300 hover:bg-emerald-50/50">
                        <Upload size={24} className="mb-2 text-emerald-600" />
                        <span className="text-sm font-black text-gray-800">اختيار ملف JSON</span>
                        <span className="mt-1 text-xs text-gray-500">{selectedFileName || 'نسخة محتوى تعلم من المنصة'}</span>
                        <input
                            type="file"
                            accept="application/json,.json"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void readBackupFile(file);
                                event.target.value = '';
                            }}
                        />
                    </label>

                    <div className="mt-5 space-y-3">
                        <button
                            onClick={() => runRestore(false)}
                            disabled={!backupPayload || isRestoring}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                        >
                            {isRestoring ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                            فحص قبل الاسترجاع
                        </button>

                        <label className="flex items-start gap-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
                            <input
                                type="checkbox"
                                checked={replaceMode}
                                onChange={(event) => {
                                    setReplaceMode(event.target.checked);
                                    setConfirmText('');
                                }}
                                className="mt-1"
                            />
                            <span>
                                استبدال كامل لمجموعات التعلم قبل الاسترجاع. استخدمه فقط عند الرجوع لنسخة قديمة بعد مشكلة كبيرة.
                            </span>
                        </label>

                        <div className="rounded-2xl border border-gray-200 bg-white p-3">
                            <label className="text-xs font-black text-gray-600">
                                للتطبيق الحقيقي اكتب: <span className="text-slate-900">{requiredConfirmText}</span>
                            </label>
                            <input
                                type="text"
                                value={confirmText}
                                onChange={(event) => setConfirmText(event.target.value)}
                                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder={requiredConfirmText}
                            />
                        </div>

                        <button
                            onClick={() => runRestore(true)}
                            disabled={!backupPayload || isRestoring || confirmText !== requiredConfirmText}
                            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                            تطبيق الاسترجاع
                        </button>
                    </div>
                </section>
            </div>

            {restorePreview?.summary ? (
                <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                    <h3 className="mb-4 text-lg font-black text-gray-900">نتيجة الفحص أو الاسترجاع</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-right text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-gray-500">
                                    <th className="p-3">العنصر</th>
                                    <th className="p-3">داخل النسخة</th>
                                    <th className="p-3">الحالي في القاعدة</th>
                                    <th className="p-3">الإجراء</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(restorePreview.summary as NonNullable<RestoreResponse['summary']>).map(([name, row]) => (
                                    <tr key={name} className="border-b border-gray-50">
                                        <td className="p-3 font-bold text-gray-900">{collectionLabels[name] || name}</td>
                                        <td className="p-3">{row.backup}</td>
                                        <td className="p-3">{row.current}</td>
                                        <td className="p-3">{row.action}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ) : null}
        </div>
    );
};
