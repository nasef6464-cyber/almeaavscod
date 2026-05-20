import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { LibraryItem } from '../../types';
import { Plus, Edit2, Trash2, FileText, Lock, LockOpen, Eye, Download, X, BookOpen, ExternalLink, CheckCircle2, AlertTriangle, Search, SlidersHorizontal } from 'lucide-react';
import { loadXlsx } from '../../utils/xlsxLoader';

interface LibraryManagerProps {
  subjectId: string;
}

const getLibraryReadinessMeta = (item: LibraryItem) => {
  const issues: string[] = [];
  if (!item.title?.trim()) issues.push('العنوان غير مكتمل');
  if (!item.subjectId) issues.push('غير مربوط بمادة');
  if (!item.sectionId) issues.push('غير مربوط بمهارة رئيسية');
  if (!(item.skillIds || []).length) issues.push('غير مربوط بمهارة فرعية');
  if (!item.url?.trim()) issues.push('لا يوجد رابط ملف');
  if (item.showOnPlatform !== false && item.approvalStatus && item.approvalStatus !== 'approved') issues.push('ظاهر قبل الاعتماد');

  return issues.length === 0
    ? { label: 'جاهز للطالب', issues, className: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'ready' as const }
    : { label: 'يحتاج ضبط', issues, className: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'warn' as const };
};

export const LibraryManager: React.FC<LibraryManagerProps> = ({ subjectId }) => {
  const {
    user,
    libraryItems,
    addLibraryItem,
    updateLibraryItem,
    deleteLibraryItem,
    subjects,
    sections,
    skills,
    paths
  } = useStore();
  const canReview = user.role === 'admin';

  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<LibraryItem> | null>(null);
  const [validationError, setValidationError] = useState('');
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'ready' | 'needs_attention' | 'visible' | 'hidden' | 'locked'>('all');

  const subjectItems = libraryItems.filter((item) => item.subjectId === subjectId);
  const currentSubject = subjects.find((item) => item.id === subjectId);
  const libraryOverview = {
    total: subjectItems.length,
    visible: subjectItems.filter((item) => item.showOnPlatform !== false).length,
    approved: subjectItems.filter((item) => item.approvalStatus === 'approved').length,
    locked: subjectItems.filter((item) => item.isLocked === true).length,
    supportReady: subjectItems.filter(
      (item) =>
        item.showOnPlatform !== false &&
        item.approvalStatus === 'approved' &&
        Boolean(item.url?.trim()) &&
        Boolean(item.sectionId) &&
        Boolean((item.skillIds || []).length),
    ).length,
  };
  const filteredSubjectItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('ar');

    return subjectItems.filter((item) => {
      const readinessMeta = getLibraryReadinessMeta(item);
      const skillNames = (item.skillIds || [])
        .map((skillId) => skills.find((skill) => skill.id === skillId)?.name || '')
        .join(' ');
      const haystack = [item.title, item.url, item.size, skillNames]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('ar');
      const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
      const matchesFilter =
        libraryFilter === 'all' ||
        (libraryFilter === 'ready' && readinessMeta.issues.length === 0) ||
        (libraryFilter === 'needs_attention' && readinessMeta.issues.length > 0) ||
        (libraryFilter === 'visible' && item.showOnPlatform !== false) ||
        (libraryFilter === 'hidden' && item.showOnPlatform === false) ||
        (libraryFilter === 'locked' && item.isLocked === true);

      return matchesSearch && matchesFilter;
    });
  }, [libraryFilter, searchTerm, skills, subjectItems]);

  const downloadLibraryExport = async () => {
    const XLSX = await loadXlsx();
    const workbook = XLSX.utils.book_new();
    const rows = [
      [
        'عنوان الملف',
        'النوع',
        'المسار',
        'المادة',
        'المهارة الرئيسية',
        'المهارات الفرعية',
        'الحجم',
        'التحميلات',
        'حالة الاعتماد',
        'الظهور على المنصة',
        'القفل/الفتح',
        'الرابط',
      ],
      ...filteredSubjectItems.map((item) => {
        const pathName = currentSubject?.pathId ? (paths.find((path) => path.id === currentSubject.pathId)?.name || '-') : '-';
        const sectionName = sections.find((section) => section.id === item.sectionId)?.name || '-';
        const skillNames = (item.skillIds || []).map((skillId) => skills.find((skill) => skill.id === skillId)?.name).filter(Boolean).join('، ');

        return [
          item.title,
          item.type,
          pathName,
          currentSubject?.name || '-',
          sectionName,
          skillNames || '-',
          item.size,
          item.downloads || 0,
          item.approvalStatus || 'draft',
          item.showOnPlatform === false ? 'مخفي' : 'ظاهر',
          item.isLocked ? 'مغلق' : 'مفتوح',
          item.url || '-',
        ];
      }),
    ];
    const summary = [
      ['البند', 'القيمة'],
      ['إجمالي ملفات المكتبة', libraryOverview.total],
      ['الظاهر في الفلتر الحالي', filteredSubjectItems.length],
      ['الظاهر على المنصة', libraryOverview.visible],
      ['المعتمد', libraryOverview.approved],
      ['المغلق على الطلاب', libraryOverview.locked],
      ['ملفات دعم جاهزة', libraryOverview.supportReady],
      ['تاريخ التصدير', new Date().toLocaleString('ar-SA')],
    ];

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summary), 'summary');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'library');
    XLSX.writeFile(workbook, `${currentSubject?.name || 'library'}-readiness.xlsx`);
  };

  const availableMainSkills = useMemo(
    () =>
      sections
        .filter((section) => section.subjectId === subjectId)
        .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [sections, subjectId]
  );

  const availableSubSkills = useMemo(
    () =>
      skills
        .filter((skill) => skill.subjectId === subjectId && (!editingItem?.sectionId || skill.sectionId === editingItem.sectionId))
        .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [editingItem?.sectionId, skills, subjectId]
  );

  useEffect(() => {
    if (!editingItem) return;

    const filteredSkillIds = (editingItem.skillIds || []).filter((skillId) =>
      skills.some(
        (skill) =>
          skill.id === skillId &&
          skill.subjectId === subjectId &&
          (!editingItem.sectionId || skill.sectionId === editingItem.sectionId)
      )
    );

    if (filteredSkillIds.length !== (editingItem.skillIds || []).length) {
      setEditingItem((prev) => (prev ? { ...prev, skillIds: filteredSkillIds } : prev));
    }
  }, [editingItem, skills, subjectId]);

  const handleSave = () => {
    if (!currentSubject?.pathId) {
      setValidationError('تعذر تحديد المسار المرتبط بهذه المادة.');
      return;
    }

    if (!editingItem?.sectionId) {
      setValidationError('اختر المهارة الرئيسة أولًا.');
      return;
    }

    if (!editingItem?.skillIds || editingItem.skillIds.length === 0) {
      setValidationError('اختر مهارة فرعية واحدة على الأقل لربط الملف بها.');
      return;
    }

    setValidationError('');

    if (editingItem?.id) {
      updateLibraryItem(editingItem.id, {
        ...editingItem,
        pathId: currentSubject.pathId,
        subjectId
      });
    } else {
      addLibraryItem({
        id: `lib_${Date.now()}`,
        title: editingItem?.title || 'ملف جديد',
        size: editingItem?.size || '0 MB',
        downloads: 0,
        type: editingItem?.type || 'pdf',
        pathId: currentSubject.pathId,
        subjectId,
        sectionId: editingItem.sectionId,
        skillIds: editingItem.skillIds || [],
        url: editingItem?.url || '',
        showOnPlatform: editingItem?.showOnPlatform !== false,
        isLocked: editingItem?.isLocked === true,
        approvalStatus: editingItem?.approvalStatus || 'draft'
      });
    }

    setIsEditing(false);
    setEditingItem(null);
  };

  const toggleSkill = (skillId: string) => {
    const currentIds = editingItem?.skillIds || [];
    const nextIds = currentIds.includes(skillId)
      ? currentIds.filter((id) => id !== skillId)
      : [...currentIds, skillId];

    setEditingItem((prev) => ({ ...prev, skillIds: nextIds }));
  };

  const handleTogglePlatformVisibility = (item: LibraryItem) => {
    updateLibraryItem(item.id, { showOnPlatform: item.showOnPlatform === false });
  };

  const handleToggleLock = (item: LibraryItem) => {
    updateLibraryItem(item.id, { isLocked: item.isLocked !== true });
  };

  const handleApprove = (item: LibraryItem) => {
    updateLibraryItem(item.id, {
      approvalStatus: 'approved',
      approvedAt: Date.now(),
    });
  };

  const handleReject = (item: LibraryItem) => {
    updateLibraryItem(item.id, {
      approvalStatus: 'rejected',
    });
  };

  const handlePreviewLibraryItem = (item: LibraryItem) => {
    setPreviewItem(item);
  };

  const handlePrepareForLearner = (item: LibraryItem) => {
    updateLibraryItem(item.id, {
      approvalStatus: 'approved',
      showOnPlatform: true,
      approvedAt: item.approvedAt || Date.now(),
    });
  };

  if (isEditing) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm animate-fade-in">
        <h3 className="text-xl font-bold text-gray-800 mb-6">
          {editingItem?.id ? 'تعديل ملف' : 'إضافة ملف جديد'}
        </h3>

        <div className="space-y-4 max-w-2xl">
          {validationError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {validationError}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">عنوان الملف</label>
            <input
              type="text"
              value={editingItem?.title || ''}
              onChange={(event) => setEditingItem((prev) => ({ ...prev, title: event.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">نوع الملف</label>
              <select
                value={editingItem?.type || 'pdf'}
                onChange={(event) => setEditingItem((prev) => ({ ...prev, type: event.target.value as LibraryItem['type'] }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="pdf">PDF</option>
                <option value="doc">Word / Document</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">حجم الملف</label>
              <input
                type="text"
                value={editingItem?.size || ''}
                onChange={(event) => setEditingItem((prev) => ({ ...prev, size: event.target.value }))}
                placeholder="مثال: 2.5 MB"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">رابط الملف</label>
            <input
              type="text"
              value={editingItem?.url || ''}
              onChange={(event) => setEditingItem((prev) => ({ ...prev, url: event.target.value }))}
              placeholder="مثال: رابط المشاركة من جوجل درايف"
              className="w-full px-4 py-2 border border-blue-300 bg-blue-50 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              dir="ltr"
            />
            <p className="text-xs text-gray-500 mt-2">
              ضع رابط الملف المباشر أو رابط المشاركة السحابية.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">المهارة الرئيسة</label>
              <select
                value={editingItem?.sectionId || ''}
                onChange={(event) =>
                  setEditingItem((prev) => ({
                    ...prev,
                    sectionId: event.target.value || undefined,
                    skillIds: []
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- اختر المهارة الرئيسة --</option>
                {availableMainSkills.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">ربط بالمهارات الفرعية</label>
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto border border-gray-200 rounded-xl p-3 bg-gray-50">
                {availableSubSkills.length > 0 ? (
                  availableSubSkills.map((skill) => {
                    const isSelected = editingItem?.skillIds?.includes(skill.id);
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => toggleSkill(skill.id)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-right text-sm font-bold transition-colors ${
                          isSelected
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                            : 'border-gray-100 bg-white text-gray-700 hover:border-indigo-100 hover:bg-indigo-50'
                        }`}
                      >
                        <span>{skill.name}</span>
                        <span
                          className={`h-5 w-5 rounded-full border ${
                            isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 bg-white'
                          }`}
                        />
                      </button>
                    );
                  })
                ) : (
                  <div className="text-sm text-gray-500">
                    {!editingItem?.sectionId
                      ? 'اختر المهارة الرئيسة أولًا.'
                      : 'لا توجد مهارات فرعية لهذه المهارة الرئيسة بعد.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            مصدر الربط هنا هو مركز المهارات الحقيقي: المهارة الرئيسة ثم المهارات الفرعية التابعة لها، وليس مواضيع التأسيس.
          </p>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">
            <div className="font-black">مكان ظهور الملف</div>
            <div className="mt-1 font-bold">
              يظهر في مكتبة المادة، وإذا كان مرتبطًا بمهارة فرعية ومعتمدًا ومفتوحًا يظهر أيضًا كملف دعم داخل موضوع التأسيس المرتبط بنفس المهارة.
            </div>
          </div>

          <label className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={editingItem?.showOnPlatform !== false}
              onChange={(event) => setEditingItem((prev) => ({ ...prev, showOnPlatform: event.target.checked }))}
              className="w-5 h-5 text-indigo-600 rounded"
            />
            <span className="font-medium text-gray-700">إظهار هذا الملف على المنصة</span>
          </label>
          <label className="flex items-center gap-3 bg-amber-50 p-3 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={editingItem?.isLocked === true}
              onChange={(event) => setEditingItem((prev) => ({ ...prev, isLocked: event.target.checked }))}
              className="w-5 h-5 text-amber-600 rounded"
            />
            <span className="font-medium text-gray-700">جعل هذا الملف ضمن باقة المكتبة بدل الفتح المجاني</span>
          </label>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700"
            >
              حفظ
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditingItem(null);
                setValidationError('');
              }}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-xl font-bold hover:bg-gray-200"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-800">إدارة المكتبة</h3>
          <p className="text-gray-500 mt-1">إدارة الملفات والمستندات الخاصة بهذه المادة</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={downloadLibraryExport}
            className="border border-emerald-200 bg-emerald-50 px-5 py-2 rounded-xl font-bold text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-2"
          >
            <Download size={18} />
            تصدير المكتبة
          </button>
          <button
            onClick={() => {
              setValidationError('');
              setEditingItem({ sectionId: undefined, skillIds: [], showOnPlatform: false });
              setIsEditing(true);
            }}
            className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            إضافة ملف جديد
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          { label: 'إجمالي عناصر المكتبة', value: libraryOverview.total, tone: 'text-slate-800 bg-slate-50' },
          { label: 'الظاهر على المنصة', value: libraryOverview.visible, tone: 'text-sky-800 bg-sky-50' },
          { label: 'الملفات المعتمدة', value: libraryOverview.approved, tone: 'text-emerald-800 bg-emerald-50' },
          { label: 'الملفات المغلقة', value: libraryOverview.locked, tone: 'text-amber-800 bg-amber-50' },
          { label: 'ملفات دعم جاهزة', value: libraryOverview.supportReady, tone: 'text-violet-800 bg-violet-50' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="text-sm font-bold text-gray-500">{item.label}</div>
            <div className={`mt-3 inline-flex rounded-2xl px-4 py-3 text-2xl font-black ${item.tone}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-sm font-black text-gray-700">
            <SlidersHorizontal size={18} className="text-indigo-500" />
            تنظيم الملفات
            <span className="rounded-full bg-gray-50 px-3 py-1 text-xs text-gray-500">
              {filteredSubjectItems.length} من {subjectItems.length}
            </span>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-[1fr_220px] lg:w-auto lg:min-w-[560px]">
            <label className="relative block">
              <Search size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ابحث باسم الملف أو المهارة..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-3 pr-10 text-sm font-bold outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <select
              value={libraryFilter}
              onChange={(event) => setLibraryFilter(event.target.value as typeof libraryFilter)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">كل الملفات</option>
              <option value="ready">جاهزة للطالب</option>
              <option value="needs_attention">تحتاج ضبط</option>
              <option value="visible">ظاهرة على المنصة</option>
              <option value="hidden">مخفية عن المنصة</option>
              <option value="locked">مقفولة على الطلاب</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSubjectItems.map((item) => {
          const readinessMeta = getLibraryReadinessMeta(item);
          const needsManualCompletion = readinessMeta.issues.some((issue) =>
            issue.includes('غير مربوط') || issue.includes('لا يوجد') || issue.includes('العنوان')
          );

          return (
          <div key={item.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center">
                <FileText size={24} />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingItem(item);
                    setIsEditing(true);
                  }}
                  className="text-gray-400 hover:text-indigo-600"
                >
                  <Edit2 size={18} />
                </button>
                <button onClick={() => deleteLibraryItem(item.id)} className="text-gray-400 hover:text-red-600">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <h4 className="font-bold text-gray-800 mb-1">{item.title}</h4>
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
              <span>{item.size}</span>
              <span>•</span>
              <span>{item.downloads} تحميل</span>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.showOnPlatform === false ? 'bg-gray-100 text-gray-600' : 'bg-sky-50 text-sky-700'}`}>
                {item.showOnPlatform === false ? 'مخفي عن المنصة' : 'ظاهر على المنصة'}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.isLocked ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {item.isLocked ? 'ضمن باقة المكتبة' : 'مفتوح مجاني'}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                item.approvalStatus === 'approved'
                  ? 'bg-emerald-50 text-emerald-700'
                  : item.approvalStatus === 'rejected'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700'
              }`}>
                {item.approvalStatus === 'approved'
                  ? 'معتمد'
                  : item.approvalStatus === 'rejected'
                    ? 'مرفوض'
                    : 'مسودة'}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-bold ${readinessMeta.className}`} title={readinessMeta.issues.join('، ') || 'لا توجد ملاحظات'}>
                {readinessMeta.icon === 'ready' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                {readinessMeta.label}
              </span>
              <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700">
                مكتبة المادة
              </span>
              {(item.skillIds || []).length > 0 ? (
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                  readinessMeta.issues.length === 0 ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {readinessMeta.issues.length === 0 ? 'ملف دعم جاهز' : 'ملف دعم يحتاج ضبط'}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 mt-auto">
              {(item.skillIds || []).slice(0, 3).map((skillId) => {
                const skillName = skills.find((skill) => skill.id === skillId)?.name;
                if (!skillName) return null;
                return (
                  <span key={`${item.id}-${skillId}`} className="px-2 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                    {skillName}
                  </span>
                );
              })}
              {(item.skillIds || []).length > 3 && (
                <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                  +{(item.skillIds || []).length - 3}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
              {readinessMeta.issues.length > 0 && (
                <button
                  onClick={() => {
                    if (needsManualCompletion) {
                      setEditingItem(item);
                      setIsEditing(true);
                      return;
                    }
                    handlePrepareForLearner(item);
                  }}
                  className="px-3 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                  title={readinessMeta.issues.join('، ')}
                >
                  {needsManualCompletion ? 'استكمال' : 'اعتماد وإظهار'}
                </button>
              )}
              {canReview && item.approvalStatus !== 'approved' && (
                <button
                  onClick={() => handleApprove(item)}
                  className="px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  اعتماد
                </button>
              )}
              {canReview && item.approvalStatus !== 'rejected' && (
                <button
                  onClick={() => handleReject(item)}
                  className="px-3 py-1 text-xs font-bold text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  رفض
                </button>
              )}
              <button
                onClick={() => handlePreviewLibraryItem(item)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                title="معاينة الملف قبل النشر"
              >
                <Eye size={18} />
              </button>
              <button
                onClick={() => handleTogglePlatformVisibility(item)}
                className={`p-2 rounded-lg transition-colors ${item.showOnPlatform === false ? 'text-gray-500 hover:bg-gray-100' : 'text-sky-600 hover:bg-sky-50'}`}
                title={item.showOnPlatform === false ? 'إظهار الملف على المنصة' : 'إخفاء الملف عن المنصة'}
              >
                {item.showOnPlatform === false ? <Lock size={18} /> : <LockOpen size={18} />}
              </button>
              <button
                onClick={() => handleToggleLock(item)}
                className={`p-2 rounded-lg transition-colors ${item.isLocked ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                title={item.isLocked ? 'جعله مجانيًا في مكتبة المادة' : 'جعله ضمن باقة المكتبة'}
              >
                {item.isLocked ? <Lock size={18} /> : <LockOpen size={18} />}
              </button>
            </div>
          </div>
          );
        })}

        {subjectItems.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            لا توجد ملفات في المكتبة حاليًا.
          </div>
        )}
        {subjectItems.length > 0 && filteredSubjectItems.length === 0 && (
          <div className="col-span-full rounded-3xl border border-dashed border-gray-200 bg-white py-12 text-center text-gray-500">
            لا توجد ملفات مطابقة لهذا البحث أو الفلتر.
          </div>
        )}
      </div>

      {previewItem ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 py-6" onClick={() => setPreviewItem(null)}>
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">معاينة الملف</div>
                <h3 className="mt-3 text-xl font-black text-gray-900">{previewItem.title}</h3>
                <p className="mt-1 text-sm leading-7 text-gray-500">هذه المعاينة تشرح للمدير أو المعلم ما سيظهر داخل المكتبة قبل النشر.</p>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                aria-label="إغلاق المعاينة"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-black text-slate-500">المسار</div>
                <div className="mt-2 text-sm font-black text-slate-900">{paths.find((path) => path.id === previewItem.pathId)?.name || (currentSubject?.pathId ? 'مرتبط بالمادة الحالية' : 'غير محدد')}</div>
              </div>
              <div className="rounded-2xl bg-indigo-50 p-4">
                <div className="text-xs font-black text-indigo-500">المادة</div>
                <div className="mt-2 text-sm font-black text-indigo-900">{currentSubject?.name || 'غير محدد'}</div>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <div className="text-xs font-black text-emerald-500">النوع</div>
                <div className="mt-2 text-sm font-black text-emerald-900">{previewItem.type === 'pdf' ? 'PDF' : previewItem.type === 'video' ? 'فيديو' : 'مستند'}</div>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <div className="text-xs font-black text-amber-500">الحجم / التحميلات</div>
                <div className="mt-2 text-sm font-black text-amber-900">{previewItem.size} - {previewItem.downloads || 0}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-3xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-black text-gray-800">
                  <BookOpen size={16} className="text-emerald-500" />
                  حالة النشر
                </div>
                <div className="mt-4 space-y-2 text-sm font-bold text-gray-700">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">الظهور: {previewItem.showOnPlatform === false ? 'مخفي عن المنصة' : 'ظاهر على المنصة'}</div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">القفل: {previewItem.isLocked ? 'مغلق على الطلاب' : 'مفتوح للعرض'}</div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    الاعتماد: {previewItem.approvalStatus === 'approved' ? 'معتمد' : previewItem.approvalStatus === 'rejected' ? 'مرفوض' : 'مسودة'}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(previewItem.skillIds || []).slice(0, 4).map((skillId) => {
                    const skill = skills.find((item) => item.id === skillId);
                    return skill ? (
                      <span key={skillId} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                        {skill.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-100 bg-gray-50 p-4 sm:p-5">
                <div className="text-sm font-black text-gray-800">طريقة الفتح</div>
                <p className="mt-2 text-sm leading-7 text-gray-600">
                  {previewItem.url ? 'يمكن فتح الملف مباشرة من الرابط أو استخدامه داخل صفحة المادة والدروس والمكتبة.' : 'لا يوجد رابط مباشر محفوظ، ويمكن ربطه لاحقًا من نفس الشاشة.'}
                </p>
                {previewItem.url ? (
                  <a
                    href={previewItem.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700"
                  >
                    <ExternalLink size={16} />
                    فتح الملف
                  </a>
                ) : null}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => setPreviewItem(null)}
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
