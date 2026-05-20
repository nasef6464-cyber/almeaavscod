import React, { useMemo, useRef, useState } from 'react';
import { Lesson, LessonType } from '../../types';
import { Plus, Search, Edit2, Trash2, Play, FileText, Lock, LockOpen, Eye, Download, X, BookOpen, ExternalLink, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { UnifiedLessonBuilder } from './builders/UnifiedLessonBuilder';
import { loadXlsx } from '../../utils/xlsxLoader';

interface LessonsManagerProps {
  subjectId?: string;
}

type ImportPreviewRow = {
  rowNumber: number;
  title: string;
  path: string;
  subject: string;
  mainSkill: string;
  subSkills: string;
  type: string;
  visibility: string;
  access: string;
};

type PendingImportBatch = {
  fileName: string;
  importedLessons: Lesson[];
  rowErrors: string[];
  previewRows: ImportPreviewRow[];
};

const normalizeLookup = (value?: string) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase();

const readCell = (row: Record<string, unknown>, keys: string[]) => {
  const normalizedRow = new Map<string, string>();
  Object.entries(row).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      normalizedRow.set(normalizeLookup(key), String(value).trim());
    }
  });

  for (const key of keys) {
    const value = normalizedRow.get(normalizeLookup(key));
    if (value) return value;
  }

  return '';
};

const splitValues = (value: string) =>
  value
    .split(/[,،;؛|]/)
    .map((item) => item.trim())
    .filter(Boolean);

const resolveLessonType = (value?: string): LessonType => {
  const normalized = normalizeLookup(value);
  if (['text', 'article', 'نص', 'مقال'].includes(normalized)) return 'text';
  if (['file', 'pdf', 'ملف'].includes(normalized)) return 'file';
  if (['zoom', 'زووم'].includes(normalized)) return 'zoom';
  if (['google_meet', 'meet', 'google meet', 'ميت'].includes(normalized)) return 'google_meet';
  if (['teams', 'تيمز'].includes(normalized)) return 'teams';
  if (['live_youtube', 'youtube live', 'بث مباشر'].includes(normalized)) return 'live_youtube';
  return 'video';
};

const resolveBoolean = (value?: string, fallback = false) => {
  const normalized = normalizeLookup(value);
  if (['yes', 'true', '1', 'نعم', 'ظاهر', 'مفتوح', 'نشط'].includes(normalized)) return true;
  if (['no', 'false', '0', 'لا', 'مخفي', 'مغلق', 'متوقف'].includes(normalized)) return false;
  return fallback;
};

const getStatusMeta = (lesson: Lesson) => {
  if (lesson.approvalStatus === 'rejected') {
    return { label: 'مرفوض', className: 'bg-red-50 text-red-600' };
  }

  if (lesson.approvalStatus === 'pending_review') {
    return { label: 'بانتظار المراجعة', className: 'bg-amber-50 text-amber-600' };
  }

  if (lesson.approvalStatus === 'approved') {
    return { label: 'معتمد', className: 'bg-emerald-50 text-emerald-600' };
  }

  return { label: 'محتوى قديم', className: 'bg-gray-100 text-gray-600' };
};

const getVisibilityMeta = (lesson: Lesson) =>
  lesson.showOnPlatform === false
    ? { label: 'مخفي عن المنصة', className: 'bg-gray-100 text-gray-600' }
    : { label: 'ظاهر على المنصة', className: 'bg-sky-50 text-sky-700' };

const getAccessMeta = (lesson: Lesson) =>
  lesson.isLocked
    ? { label: 'مغلق على الطلاب', className: 'bg-amber-50 text-amber-700' }
    : { label: 'مفتوح للعرض', className: 'bg-emerald-50 text-emerald-700' };

const getLessonReadinessMeta = (lesson: Lesson) => {
  const issues: string[] = [];
  if (!lesson.title?.trim()) issues.push('العنوان غير مكتمل');
  if (!lesson.subjectId) issues.push('غير مربوط بمادة');
  if (!lesson.sectionId) issues.push('غير مربوط بمهارة رئيسية');
  if (!(lesson.skillIds || []).length) issues.push('غير مربوط بمهارة فرعية');
  if (lesson.type === 'video' && !lesson.videoUrl) issues.push('درس فيديو بدون رابط');
  if (lesson.type === 'file' && !lesson.fileUrl) issues.push('درس ملف بدون رابط');
  if (lesson.showOnPlatform !== false && lesson.approvalStatus && lesson.approvalStatus !== 'approved') issues.push('ظاهر قبل الاعتماد');

  return issues.length === 0
    ? { label: 'جاهز للطالب', issues, className: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'ready' as const }
    : { label: 'يحتاج ضبط', issues, className: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'warn' as const };
};

export const LessonsManager: React.FC<LessonsManagerProps> = ({ subjectId }) => {
  const { user, lessons: globalLessons, addLesson, updateLesson, deleteLesson, paths, subjects, sections, skills, topics } = useStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canReview = user.role === 'admin';
  const managedPathIds = user.managedPathIds || [];
  const managedSubjectIds = user.managedSubjectIds || [];
  const allowedPaths = user.role === 'teacher'
    ? paths.filter((path) => managedPathIds.length === 0 || managedPathIds.includes(path.id))
    : paths;
  const allowedSubjects = user.role === 'teacher'
    ? subjects.filter((subject) => {
        if (managedSubjectIds.length > 0) return managedSubjectIds.includes(subject.id);
        if (managedPathIds.length > 0) return managedPathIds.includes(subject.pathId);
        return true;
      })
    : subjects;

  const [selectedPathId, setSelectedPathId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjectId || '');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImportBatch, setPendingImportBatch] = useState<PendingImportBatch | null>(null);

  const lessons = globalLessons.filter((lesson) => {
    if (user.role === 'teacher') {
      if (managedSubjectIds.length > 0 && !managedSubjectIds.includes(lesson.subjectId)) return false;
      if (managedPathIds.length > 0 && lesson.pathId && !managedPathIds.includes(lesson.pathId)) return false;
    }
    if (subjectId && lesson.subjectId !== subjectId) return false;
    if (selectedSubjectId && lesson.subjectId !== selectedSubjectId) return false;
    if (selectedSectionId && lesson.sectionId !== selectedSectionId) return false;
    if (selectedPathId && !subjectId && !selectedSubjectId && lesson.pathId !== selectedPathId) return false;
    if (selectedSkillId && (!lesson.skillIds || !lesson.skillIds.includes(selectedSkillId))) return false;
    return true;
  });

  const [currentLesson, setCurrentLesson] = useState<Partial<Lesson>>({
    title: '',
    type: 'video',
    duration: '0',
    isCompleted: false,
    subjectId: selectedSubjectId || '',
    sectionId: selectedSectionId || '',
    pathId: selectedPathId || '',
    skillIds: [],
    order: 1,
    showOnPlatform: false,
  });

  const availableMainSkills = useMemo(
    () => sections.filter((section) => section.subjectId === selectedSubjectId && allowedSubjects.some((subject) => subject.id === section.subjectId)),
    [allowedSubjects, sections, selectedSubjectId],
  );

  const availableSubSkills = useMemo(
    () =>
      skills
        .filter((skill) => skill.subjectId === selectedSubjectId && (!selectedSectionId || skill.sectionId === selectedSectionId))
        .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [skills, selectedSectionId, selectedSubjectId],
  );

  const subSkillNameMap = useMemo(() => new Map(availableSubSkills.map((skill) => [skill.id, skill.name])), [availableSubSkills]);

  const handleCreateNew = () => {
    setCurrentLesson({
      title: '',
      type: 'video',
      duration: '0',
      isCompleted: false,
      subjectId: selectedSubjectId || '',
      sectionId: selectedSectionId || '',
      pathId: selectedPathId || '',
      skillIds: [],
      order: lessons.length + 1,
      showOnPlatform: false,
    });
    setIsEditing(true);
  };

  const handleEdit = (lesson: Lesson) => {
    setCurrentLesson(lesson);
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الدرس نهائيًا؟')) {
      deleteLesson(id);
    }
  };

  const handleDuplicate = (lesson: Lesson) => {
    const duplicatedLesson: Lesson = {
      ...lesson,
      id: `l_${Date.now()}_copy`,
      title: `${lesson.title} (نسخة)`,
      approvalStatus: 'draft',
      showOnPlatform: false,
    };
    addLesson(duplicatedLesson);
  };

  const handleSave = (_moduleId: string | undefined, lessonToSave: Lesson) => {
    if (currentLesson.id) {
      updateLesson(lessonToSave.id, lessonToSave);
    } else {
      addLesson({
        ...lessonToSave,
        id: `l_${Date.now()}`,
      });
    }
    setIsEditing(false);
  };

  const handleApprove = (lesson: Lesson) => {
    updateLesson(lesson.id, {
      approvalStatus: 'approved',
      approvedAt: Date.now(),
    });
  };

  const handleReject = (lesson: Lesson) => {
    updateLesson(lesson.id, {
      approvalStatus: 'rejected',
    });
  };

  const handleTogglePlatformVisibility = (lesson: Lesson) => {
    updateLesson(lesson.id, {
      showOnPlatform: lesson.showOnPlatform === false,
    });
  };

  const handleToggleLessonLock = (lesson: Lesson) => {
    updateLesson(lesson.id, {
      isLocked: lesson.isLocked !== true,
    });
  };

  const handlePrepareForLearner = (lesson: Lesson) => {
    updateLesson(lesson.id, {
      approvalStatus: 'approved',
      showOnPlatform: true,
      approvedAt: lesson.approvedAt || Date.now(),
    });
  };

  const handlePreviewLesson = (lesson: Lesson) => {
    setPreviewLesson(lesson);
  };

  const createLessonPreviewRow = (lesson: Lesson, rowNumber: number): ImportPreviewRow => ({
    rowNumber,
    title: lesson.title || 'بدون عنوان',
    path: paths.find((path) => path.id === lesson.pathId)?.name || 'غير محدد',
    subject: subjects.find((subject) => subject.id === lesson.subjectId)?.name || 'غير محدد',
    mainSkill: sections.find((section) => section.id === lesson.sectionId)?.name || 'غير محدد',
    subSkills: (lesson.skillIds || [])
      .map((skillId) => skills.find((skill) => skill.id === skillId)?.name)
      .filter(Boolean)
      .join('، ') || 'غير محدد',
    type: lesson.type === 'video' ? 'فيديو' : lesson.type === 'text' ? 'نصي' : lesson.type,
    visibility: lesson.showOnPlatform === false ? 'مخفي' : 'ظاهر',
    access: lesson.isLocked ? 'مغلق' : 'مفتوح',
  });

  const parseImportWorkbook = (rows: Record<string, unknown>[], fileName: string): PendingImportBatch => {
    if (!rows.length) {
      throw new Error('ملف الدروس فارغ.');
    }

    const importedLessons: Lesson[] = [];
    const rowErrors: string[] = [];
    const previewRows: ImportPreviewRow[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      try {
        const lesson = buildLessonFromRow(row, rowNumber);
        importedLessons.push(lesson);
        previewRows.push(createLessonPreviewRow(lesson, rowNumber));
      } catch (error) {
        rowErrors.push(error instanceof Error ? error.message : `الصف ${rowNumber}: تعذر قراءة الدرس.`);
      }
    });

    if (!importedLessons.length) {
      throw new Error(rowErrors.slice(0, 5).join(' ') || 'لم يتم العثور على دروس صالحة للاستيراد.');
    }

    return {
      fileName,
      importedLessons,
      rowErrors,
      previewRows,
    };
  };

  const finalizePendingImport = () => {
    if (!pendingImportBatch) return;

    setIsImporting(true);
    setImportError(null);

    try {
      pendingImportBatch.importedLessons.forEach((lesson) => addLesson(lesson));
      setImportMessage(
        pendingImportBatch.rowErrors.length
          ? `تم اعتماد ${pendingImportBatch.importedLessons.length} درس، وتخطينا ${pendingImportBatch.rowErrors.length} صف يحتاج مراجعة.`
          : `تم اعتماد ${pendingImportBatch.importedLessons.length} درس وربطها بمركز المهارات بنجاح.`,
      );
      setPendingImportBatch(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'تعذر اعتماد الدروس الآن.');
    } finally {
      setIsImporting(false);
    }
  };

  const cancelPendingImport = () => {
    setPendingImportBatch(null);
    setImportMessage(null);
    setImportError(null);
  };

  const resolveLessonScopeFromRow = (row: Record<string, unknown>, rowNumber: number) => {
    const pathIdValue = readCell(row, ['pathId', 'path_id']);
    const pathName = readCell(row, ['المسار', 'path', 'pathName']);
    const subjectIdValue = readCell(row, ['subjectId', 'subject_id']);
    const subjectName = readCell(row, ['المادة', 'subject', 'subjectName']);
    const sectionIdValue = readCell(row, ['mainSkillId', 'sectionId', 'section_id']);
    const sectionName = readCell(row, ['المهارة الرئيسية', 'المهارة الرئيسة', 'mainSkill', 'section']);
    const skillIdsValue = readCell(row, ['subSkillIds', 'skillIds', 'skill_ids']);
    const skillName = readCell(row, ['المهارة الفرعية', 'skill', 'subSkill']);

    const matchedPath = allowedPaths.find((path) =>
      (pathIdValue && path.id === pathIdValue) || normalizeLookup(path.name) === normalizeLookup(pathName),
    );
    if (!matchedPath) {
      throw new Error(`الصف ${rowNumber}: المسار "${pathName || pathIdValue}" غير موجود أو خارج صلاحياتك.`);
    }

    const matchedSubject = allowedSubjects.find(
      (subject) =>
        subject.pathId === matchedPath.id &&
        ((subjectIdValue && subject.id === subjectIdValue) || normalizeLookup(subject.name) === normalizeLookup(subjectName)),
    );
    if (!matchedSubject) {
      throw new Error(`الصف ${rowNumber}: المادة "${subjectName || subjectIdValue}" غير موجودة داخل المسار.`);
    }

    const matchedSection = sections.find(
      (section) =>
        section.subjectId === matchedSubject.id &&
        ((sectionIdValue && section.id === sectionIdValue) || normalizeLookup(section.name) === normalizeLookup(sectionName)),
    );
    if (!matchedSection) {
      throw new Error(`الصف ${rowNumber}: المهارة الرئيسية "${sectionName || sectionIdValue}" غير موجودة داخل المادة.`);
    }

    const requestedSkillIds = splitValues(skillIdsValue);
    const requestedSkillNames = splitValues(skillName);
    const matchedSkillsById = requestedSkillIds
      .map((requestedSkillId) =>
        skills.find(
          (skill) =>
            skill.id === requestedSkillId &&
            skill.subjectId === matchedSubject.id &&
            skill.sectionId === matchedSection.id,
        ),
      )
      .filter(Boolean) as typeof skills;
    const matchedSkillsByName = requestedSkillNames
      .map((requestedSkillName) =>
        skills.find(
          (skill) =>
            skill.subjectId === matchedSubject.id &&
            skill.sectionId === matchedSection.id &&
            normalizeLookup(skill.name) === normalizeLookup(requestedSkillName),
        ),
      )
      .filter(Boolean) as typeof skills;
    const matchedSkills = [...matchedSkillsById, ...matchedSkillsByName].filter(
      (skill, index, allSkills) => allSkills.findIndex((item) => item.id === skill.id) === index,
    );

    if (
      (requestedSkillIds.length > 0 && matchedSkillsById.length !== requestedSkillIds.length) ||
      (requestedSkillNames.length > 0 && matchedSkillsByName.length !== requestedSkillNames.length) ||
      matchedSkills.length === 0
    ) {
      throw new Error(`الصف ${rowNumber}: المهارة الفرعية "${skillName || skillIdsValue}" غير موجودة تحت المهارة الرئيسية.`);
    }

    return { matchedPath, matchedSubject, matchedSection, matchedSkills };
  };

  const buildLessonFromRow = (row: Record<string, unknown>, rowNumber: number): Lesson => {
    const title = readCell(row, ['عنوان الدرس', 'اسم الدرس', 'title', 'lessonTitle']);
    const description = readCell(row, ['الوصف', 'description']);
    const typeValue = readCell(row, ['النوع', 'type', 'lessonType']);
    const duration = readCell(row, ['المدة', 'duration', 'minutes']);
    const videoUrl = readCell(row, ['رابط الفيديو', 'videoUrl', 'youtubeUrl']);
    const fileUrl = readCell(row, ['رابط الملف', 'fileUrl']);
    const content = readCell(row, ['المحتوى النصي', 'content']);
    const showValue = readCell(row, ['الظهور', 'showOnPlatform', 'visible']);
    const lockedValue = readCell(row, ['القفل', 'isLocked', 'locked']);
    const orderValue = readCell(row, ['الترتيب', 'order']);

    if (!title) {
      throw new Error(`الصف ${rowNumber}: عنوان الدرس مطلوب.`);
    }

    const { matchedPath, matchedSubject, matchedSection, matchedSkills } = resolveLessonScopeFromRow(row, rowNumber);
    const type = resolveLessonType(typeValue);
    if (['video', 'live_youtube'].includes(type) && !videoUrl) {
      throw new Error(`الصف ${rowNumber}: رابط الفيديو مطلوب لهذا النوع من الدروس.`);
    }
    if (type === 'file' && !fileUrl) {
      throw new Error(`الصف ${rowNumber}: رابط الملف مطلوب لدرس الملف.`);
    }

    return {
      id: `l_import_${Date.now()}_${rowNumber}`,
      title,
      description,
      type,
      duration: duration || '0',
      isCompleted: false,
      content: type === 'text' ? content || description : content,
      videoUrl: videoUrl || undefined,
      fileUrl: fileUrl || undefined,
      pathId: matchedPath.id,
      subjectId: matchedSubject.id,
      sectionId: matchedSection.id,
      skillIds: matchedSkills.map((skill) => skill.id),
      order: Number(orderValue) || globalLessons.length + rowNumber,
      showOnPlatform: resolveBoolean(showValue, false),
      isLocked: resolveBoolean(lockedValue, false),
      accessControl: resolveBoolean(lockedValue, false) ? 'enrolled' : 'public',
      ownerType: user.role === 'teacher' ? 'teacher' : 'platform',
      ownerId: user.id,
      createdBy: user.id,
      approvalStatus: user.role === 'admin' ? 'approved' : 'pending_review',
      approvedAt: user.role === 'admin' ? Date.now() : undefined,
    };
  };

  const downloadImportTemplate = async () => {
    const XLSX = await loadXlsx();
    const samplePath = allowedPaths[0];
    const sampleSubject = allowedSubjects.find((subject) => subject.pathId === samplePath?.id) || allowedSubjects[0];
    const sampleMainSkill = sections.find((section) => section.subjectId === sampleSubject?.id) || sections[0];
    const sampleSubSkill = skills.find((skill) => skill.subjectId === sampleSubject?.id && skill.sectionId === sampleMainSkill?.id) || skills[0];
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          pathId: samplePath?.id || '',
          subjectId: sampleSubject?.id || '',
          mainSkillId: sampleMainSkill?.id || '',
          subSkillIds: sampleSubSkill?.id || '',
          المسار: samplePath?.name || 'مسار القدرات',
          المادة: sampleSubject?.name || 'الكمي',
          'المهارة الرئيسية': sampleMainSkill?.name || 'مهارة رئيسية',
          'المهارة الفرعية': sampleSubSkill?.name || 'مهارة فرعية',
          'عنوان الدرس': 'مثال درس فيديو',
          الوصف: 'شرح مختصر للدرس',
          النوع: 'video',
          المدة: '12',
          'رابط الفيديو': 'https://www.youtube.com/watch?v=example',
          'رابط الملف': '',
          'المحتوى النصي': '',
          الظهور: 'لا',
          القفل: 'نعم',
          الترتيب: 1,
        },
      ]),
      'lessons',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        { field: 'pathId/subjectId/mainSkillId/subSkillIds', note: 'اختياري لكنه أدق في الربط. يمكن استخدام الأسماء بدلًا منه.' },
        { field: 'النوع', note: 'video أو text أو file أو live_youtube أو zoom أو google_meet أو teams.' },
        { field: 'الظهور', note: 'نعم/لا. الأفضل ترك الدرس مخفيًا حتى تراجعه ثم تظهره.' },
        { field: 'القفل', note: 'نعم تعني محتوى ضمن باقة/اشتراك، لا تعني مفتوح.' },
      ]),
      'instructions',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(allowedPaths.map((path) => ({ pathId: path.id, pathName: path.name }))),
      'paths-reference',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(allowedSubjects.map((subject) => ({
        subjectId: subject.id,
        pathId: subject.pathId,
        subjectName: subject.name,
        pathName: paths.find((path) => path.id === subject.pathId)?.name || '',
      }))),
      'subjects-reference',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(sections.filter((section) => allowedSubjects.some((subject) => subject.id === section.subjectId)).map((section) => ({
        mainSkillId: section.id,
        subjectId: section.subjectId,
        mainSkillName: section.name,
      }))),
      'main-skills-reference',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(skills.filter((skill) => allowedSubjects.some((subject) => subject.id === skill.subjectId)).map((skill) => ({
        subSkillId: skill.id,
        mainSkillId: skill.sectionId || '',
        subjectId: skill.subjectId,
        subSkillName: skill.name,
      }))),
      'sub-skills-reference',
    );
    XLSX.writeFile(workbook, 'lessons-import-template.xlsx');
  };

  const handleImportLessons = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsImporting(true);
    setImportMessage(null);
    setImportError(null);
    setPendingImportBatch(null);

    try {
      const XLSX = await loadXlsx();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
      const batch = parseImportWorkbook(rows, file.name);
      setPendingImportBatch(batch);
      setImportMessage(
        batch.rowErrors.length
          ? `تم تجهيز ${batch.importedLessons.length} درس للمراجعة، ويوجد ${batch.rowErrors.length} صف يحتاج تصحيح قبل الاعتماد.`
          : `تم تجهيز ${batch.importedLessons.length} درس للمراجعة. راجع الربط ثم اضغط اعتماد الدروس.`,
      );
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'تعذر استيراد ملف الدروس الآن.');
    } finally {
      setIsImporting(false);
    }
  };

  const filteredLessons = lessons.filter((lesson) => lesson.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const lessonOverview = {
    total: filteredLessons.length,
    visible: filteredLessons.filter((lesson) => lesson.showOnPlatform !== false).length,
    approved: filteredLessons.filter((lesson) => lesson.approvalStatus === 'approved').length,
    locked: filteredLessons.filter((lesson) => lesson.isLocked === true).length,
  };

  const downloadLessonsExport = async () => {
    const XLSX = await loadXlsx();
    const workbook = XLSX.utils.book_new();
    const lessonRows = [
      [
        'عنوان الدرس',
        'النوع',
        'المسار',
        'المادة',
        'المهارة الرئيسية',
        'المهارات الفرعية',
        'المدة',
        'حالة الاعتماد',
        'الظهور على المنصة',
        'القفل/الفتح',
        'رابط الفيديو أو الملف',
      ],
      ...filteredLessons.map((lesson) => {
        const pathName = paths.find((path) => path.id === lesson.pathId)?.name || '-';
        const subjectName = subjects.find((subject) => subject.id === lesson.subjectId)?.name || '-';
        const sectionName = sections.find((section) => section.id === lesson.sectionId)?.name || '-';
        const skillNames = (lesson.skillIds || [])
          .map((skillId) => skills.find((skill) => skill.id === skillId)?.name)
          .filter(Boolean)
          .join('، ');
        const status = getStatusMeta(lesson);
        const visibility = getVisibilityMeta(lesson);
        const access = getAccessMeta(lesson);

        return [
          lesson.title,
          lesson.type === 'video' ? 'فيديو' : lesson.type === 'text' ? 'نص/مقال' : 'تفاعلي',
          pathName,
          subjectName,
          sectionName,
          skillNames || '-',
          `${lesson.duration || 0} دقيقة`,
          status.label,
          visibility.label,
          access.label,
          lesson.videoUrl || lesson.fileUrl || '-',
        ];
      }),
    ];
    const summaryRows = [
      ['البند', 'القيمة'],
      ['إجمالي الدروس الحالية', lessonOverview.total],
      ['الظاهر على المنصة', lessonOverview.visible],
      ['الدروس المعتمدة', lessonOverview.approved],
      ['الدروس المغلقة', lessonOverview.locked],
      ['تاريخ التصدير', new Date().toLocaleString('ar-SA')],
    ];

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'summary');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(lessonRows), 'lessons');
    XLSX.writeFile(workbook, 'lessons-readiness.xlsx');
  };

  if (isEditing) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-120px)] animate-fade-in relative z-50">
        <UnifiedLessonBuilder initialLesson={currentLesson as Lesson} onSave={handleSave} onCancel={() => setIsEditing(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">مركز الدروس</h2>
          <p className="text-gray-500 text-sm mt-1">إدارة الدروس واعتماد ما يُرفع من المعلمين قبل ظهوره في المنصة.</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleImportLessons}
          className="hidden"
        />
        <button
          onClick={downloadImportTemplate}
          className="bg-white text-slate-700 border border-slate-100 px-4 py-2 rounded-xl font-bold hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
          <Download size={18} />
          قالب الاستيراد
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="bg-white text-blue-700 border border-blue-100 px-4 py-2 rounded-xl font-bold hover:bg-blue-50 disabled:opacity-60 transition-colors flex items-center gap-2"
        >
          <Upload size={18} />
          {isImporting ? 'جارٍ الاستيراد...' : 'استيراد دروس'}
        </button>
        <button
          onClick={downloadLessonsExport}
          className="bg-white text-emerald-700 border border-emerald-100 px-4 py-2 rounded-xl font-bold hover:bg-emerald-50 transition-colors flex items-center gap-2"
        >
          <Download size={18} />
          تصدير الدروس
        </button>
        <button
          onClick={handleCreateNew}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          إضافة درس جديد
        </button>
      </div>

      {pendingImportBatch && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700">
                مراجعة قبل الاعتماد
              </div>
              <h3 className="mt-3 text-lg font-black text-slate-900">ملف الدروس: {pendingImportBatch.fileName}</h3>
              <p className="mt-1 text-sm font-bold leading-7 text-slate-600">
                الدروس لم تُضاف بعد. راجع ربط المسار والمادة والمهارات وحالة الظهور والقفل، ثم اعتمدها عند التأكد.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={finalizePendingImport}
                disabled={isImporting}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
              >
                {isImporting ? 'جارٍ الاعتماد...' : 'اعتماد الدروس'}
              </button>
              <button
                onClick={cancelPendingImport}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                إلغاء
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4">
              <div className="text-xs font-black text-slate-500">جاهزة للاعتماد</div>
              <div className="mt-2 text-2xl font-black text-indigo-700">{pendingImportBatch.importedLessons.length}</div>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <div className="text-xs font-black text-slate-500">صفوف تحتاج مراجعة</div>
              <div className="mt-2 text-2xl font-black text-amber-600">{pendingImportBatch.rowErrors.length}</div>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <div className="text-xs font-black text-slate-500">مصدر المهارات</div>
              <div className="mt-2 text-sm font-black text-emerald-700">مركز المهارات فقط</div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-white bg-white">
            <table className="w-full min-w-[920px] text-right text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="px-4 py-3">الصف</th>
                  <th className="px-4 py-3">عنوان الدرس</th>
                  <th className="px-4 py-3">المسار</th>
                  <th className="px-4 py-3">المادة</th>
                  <th className="px-4 py-3">المهارة الرئيسية</th>
                  <th className="px-4 py-3">المهارات الفرعية</th>
                  <th className="px-4 py-3">النوع</th>
                  <th className="px-4 py-3">الظهور</th>
                  <th className="px-4 py-3">القفل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingImportBatch.previewRows.slice(0, 6).map((row) => (
                  <tr key={row.rowNumber} className="text-slate-700">
                    <td className="px-4 py-3 font-black text-slate-400">{row.rowNumber}</td>
                    <td className="px-4 py-3 font-black text-slate-900">{row.title}</td>
                    <td className="px-4 py-3">{row.path}</td>
                    <td className="px-4 py-3">{row.subject}</td>
                    <td className="px-4 py-3">{row.mainSkill}</td>
                    <td className="px-4 py-3">{row.subSkills}</td>
                    <td className="px-4 py-3">{row.type}</td>
                    <td className="px-4 py-3">{row.visibility}</td>
                    <td className="px-4 py-3">{row.access}</td>
                  </tr>
                ))}
                {pendingImportBatch.previewRows.length > 6 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-3 text-center text-xs font-black text-slate-500">
                      يتم عرض أول 6 دروس فقط، وسيتم اعتماد كل الدروس الجاهزة عند الضغط على اعتماد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pendingImportBatch.rowErrors.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-800">
              <div className="mb-2 font-black">أول ملاحظات تحتاج تصحيح:</div>
              <div className="space-y-1">
                {pendingImportBatch.rowErrors.slice(0, 5).map((error, index) => (
                  <div key={`${error}-${index}`}>{error}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(importMessage || importError) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
          importError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'
        }`}>
          {importError || importMessage}
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        {!subjectId && (
          <>
            <select
              value={selectedPathId}
              onChange={(e) => {
                setSelectedPathId(e.target.value);
                setSelectedSubjectId('');
                setSelectedSectionId('');
                setSelectedSkillId('');
              }}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">كل المسارات</option>
              {allowedPaths.map((path) => (
                <option key={path.id} value={path.id}>{path.name}</option>
              ))}
            </select>
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setSelectedSectionId('');
                setSelectedSkillId('');
              }}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={!selectedPathId}
            >
              <option value="">كل المواد</option>
              {allowedSubjects.filter((subject) => subject.pathId === selectedPathId).map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </>
        )}
        <select
          value={selectedSectionId}
          onChange={(e) => {
            setSelectedSectionId(e.target.value);
            setSelectedSkillId('');
          }}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={!selectedSubjectId}
        >
          <option value="">كل المهارات الرئيسة</option>
          {availableMainSkills.map((section) => (
            <option key={section.id} value={section.id}>{section.name}</option>
          ))}
        </select>
        <select
          value={selectedSkillId}
          onChange={(e) => setSelectedSkillId(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={!selectedSubjectId}
        >
          <option value="">كل المهارات الفرعية</option>
          {availableSubSkills.map((skill) => (
            <option key={skill.id} value={skill.id}>{skill.name}</option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="ابحث في عنوان الدرس..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الدروس', value: lessonOverview.total, tone: 'text-slate-800 bg-slate-50' },
          { label: 'الظاهر على المنصة', value: lessonOverview.visible, tone: 'text-sky-800 bg-sky-50' },
          { label: 'الدروس المعتمدة', value: lessonOverview.approved, tone: 'text-emerald-800 bg-emerald-50' },
          { label: 'الدروس المغلقة', value: lessonOverview.locked, tone: 'text-amber-800 bg-amber-50' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="text-sm font-bold text-gray-500">{item.label}</div>
            <div className={`mt-3 inline-flex rounded-2xl px-4 py-3 text-2xl font-black ${item.tone}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">عنوان الدرس</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">النوع</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">المدة</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">المادة</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">المهارات الفرعية</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">الحالة</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLessons.map((lesson) => {
                const statusMeta = getStatusMeta(lesson);
                const readinessMeta = getLessonReadinessMeta(lesson);
                return (
                  <tr key={lesson.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${lesson.type === 'video' ? 'bg-indigo-50 text-indigo-500' : 'bg-emerald-50 text-emerald-500'}`}>
                          {lesson.type === 'video' ? <Play size={18} className="ml-1" /> : <FileText size={18} />}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800">{lesson.title}</div>
                          <div className="text-[11px] text-gray-400 mt-1">
                            {lesson.ownerType === 'teacher' ? 'محتوى معلم' : lesson.ownerType === 'school' ? 'محتوى مدرسة' : 'محتوى المنصة'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {lesson.type === 'video' ? 'فيديو' : lesson.type === 'text' ? 'مقال' : 'درس تفاعلي'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{lesson.duration} دقيقة</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs font-bold">
                        {subjects.find((subject) => subject.id === lesson.subjectId)?.name || 'غير محدد'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(lesson.skillIds || []).slice(0, 3).map((skillId) => (
                          <span key={skillId} className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md text-xs font-bold">
                            {subSkillNameMap.get(skillId) || 'مهارة'}
                          </span>
                        ))}
                        {(lesson.skillIds || []).length > 3 && (
                          <span className="text-xs text-gray-500">+{(lesson.skillIds || []).length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusMeta.className}`}>{statusMeta.label}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getVisibilityMeta(lesson).className}`}>
                          {getVisibilityMeta(lesson).label}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getAccessMeta(lesson).className}`}>
                          {getAccessMeta(lesson).label}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-bold ${readinessMeta.className}`} title={readinessMeta.issues.join('، ') || 'لا توجد ملاحظات'}>
                          {readinessMeta.icon === 'ready' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                          {readinessMeta.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {readinessMeta.issues.length > 0 && (
                          <button
                            onClick={() => handlePrepareForLearner(lesson)}
                            className="px-3 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                            title={readinessMeta.issues.join('، ')}
                          >
                            تجهيز للطالب
                          </button>
                        )}
                        {canReview && lesson.approvalStatus !== 'approved' && (
                          <button onClick={() => handleApprove(lesson)} className="px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors">
                            اعتماد
                          </button>
                        )}
                        {canReview && lesson.approvalStatus !== 'rejected' && (
                          <button onClick={() => handleReject(lesson)} className="px-3 py-1 text-xs font-bold text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                            رفض
                          </button>
                        )}
                        <button
                          onClick={() => handleTogglePlatformVisibility(lesson)}
                          className={`p-2 rounded-lg transition-colors ${
                            lesson.showOnPlatform === false ? 'text-gray-500 hover:bg-gray-100' : 'text-sky-600 hover:bg-sky-50'
                          }`}
                          title={lesson.showOnPlatform === false ? 'إظهار الدرس على المنصة' : 'إخفاء الدرس عن المنصة'}
                        >
                          {lesson.showOnPlatform === false ? <Lock size={18} /> : <LockOpen size={18} />}
                        </button>
                        <button
                          onClick={() => handleToggleLessonLock(lesson)}
                          className={`p-2 rounded-lg transition-colors ${
                            lesson.isLocked ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={lesson.isLocked ? 'فتح الدرس للطلاب' : 'قفل الدرس على الطلاب'}
                        >
                          {lesson.isLocked ? <Lock size={18} /> : <LockOpen size={18} />}
                        </button>
                        <button onClick={() => handleDuplicate(lesson)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="نسخ">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        <button onClick={() => handleEdit(lesson)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="تعديل">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handlePreviewLesson(lesson)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="معاينة الدرس قبل النشر">
                          <Eye size={18} />
                        </button>
                        <button onClick={() => handleDelete(lesson.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="حذف">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredLessons.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    لا توجد دروس مطابقة للبحث.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {previewLesson ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 py-6" onClick={() => setPreviewLesson(null)}>
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <div className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">معاينة الدرس</div>
                <h3 className="mt-3 text-xl font-black text-gray-900">{previewLesson.title}</h3>
                <p className="mt-1 text-sm leading-7 text-gray-500">هذه المعاينة تعرض الدرس كما سيظهر داخل مساحة التعلم.</p>
              </div>
              <button
                onClick={() => setPreviewLesson(null)}
                className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                aria-label="إغلاق المعاينة"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-black text-slate-500">المسار</div>
                <div className="mt-2 text-sm font-black text-slate-900">{paths.find((path) => path.id === previewLesson.pathId)?.name || 'غير محدد'}</div>
              </div>
              <div className="rounded-2xl bg-indigo-50 p-4">
                <div className="text-xs font-black text-indigo-500">المادة</div>
                <div className="mt-2 text-sm font-black text-indigo-900">{subjects.find((subject) => subject.id === previewLesson.subjectId)?.name || 'غير محدد'}</div>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <div className="text-xs font-black text-emerald-500">النوع</div>
                <div className="mt-2 text-sm font-black text-emerald-900">
                  {previewLesson.type === 'video' ? 'فيديو' : previewLesson.type === 'text' ? 'نصي' : 'تفاعلي'}
                </div>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <div className="text-xs font-black text-amber-500">المدة</div>
                <div className="mt-2 text-sm font-black text-amber-900">{previewLesson.duration || 0} دقيقة</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-3xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-black text-gray-800">
                  <BookOpen size={16} className="text-indigo-500" />
                  جاهزية العرض
                </div>
                <div className="mt-4 space-y-2 text-sm font-bold text-gray-700">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">الحالة: {getStatusMeta(previewLesson).label}</div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">الظهور: {getVisibilityMeta(previewLesson).label}</div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">الفتح: {getAccessMeta(previewLesson).label}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(previewLesson.skillIds || []).slice(0, 4).map((skillId) => {
                    const skill = skills.find((item) => item.id === skillId);
                    return skill ? (
                      <span key={skillId} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                        {skill.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-100 bg-gray-50 p-4 sm:p-5">
                <div className="text-sm font-black text-gray-800">الشرح المختصر</div>
                <p className="mt-3 text-sm leading-7 text-gray-600">
                  {previewLesson.description || 'لا يوجد وصف محفوظ لهذا الدرس بعد.'}
                </p>
                <div className="mt-4 space-y-2 text-sm font-bold text-gray-700">
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">رابط الفيديو: {previewLesson.videoUrl ? 'متاح' : 'غير متاح'}</div>
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">الموضوعات المرتبطة: {topics.filter((item) => item.lessonIds?.includes(previewLesson.id)).length}</div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const topic = topics.find((item) => item.lessonIds?.includes(previewLesson.id));
                  const pathId = previewLesson.pathId || topic?.pathId || selectedPathId || '';
                  const targetSubjectId = previewLesson.subjectId || topic?.subjectId || selectedSubjectId;
                  const params = new URLSearchParams();
                  if (targetSubjectId) params.set('subject', targetSubjectId);
                  params.set('tab', 'skills');
                  params.set('content', 'lessons');
                  params.set('lesson', previewLesson.id);
                  if (topic?.id) params.set('topic', topic.id);
                  window.open(`${window.location.origin}/#/category/${pathId}?${params.toString()}`, '_blank', 'noopener,noreferrer');
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white hover:bg-indigo-700"
              >
                <ExternalLink size={16} />
                فتح الدرس
              </button>
              <button
                onClick={() => setPreviewLesson(null)}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-700 hover:bg-gray-50"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
