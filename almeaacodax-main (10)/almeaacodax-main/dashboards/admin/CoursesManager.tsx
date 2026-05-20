import React, { useState } from 'react';
import { Course } from '../../types';
import { useStore } from '../../store/useStore';
import { AdvancedCourseBuilder } from './AdvancedCourseBuilder';
import { Plus, Search, Edit2, Trash2, Eye, Star, Users, Lock, LockOpen, X, BookOpen, Target, ExternalLink, PlayCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

interface CoursesManagerProps {
  subjectId?: string;
}

const getCourseStatusMeta = (course: Course) => {
  if (course.approvalStatus === 'rejected') {
    return { label: 'مرفوض', className: 'bg-red-50 text-red-600' };
  }

  if (course.approvalStatus === 'pending_review') {
    return { label: 'بانتظار المراجعة', className: 'bg-amber-50 text-amber-600' };
  }

  if (course.approvalStatus === 'approved' && course.isPublished !== false) {
    return { label: 'معتمد ومنشور', className: 'bg-emerald-50 text-emerald-600' };
  }

  if (course.approvalStatus === 'approved') {
    return { label: 'معتمد غير منشور', className: 'bg-blue-50 text-blue-600' };
  }

  return {
    label: course.isPublished !== false ? 'منشور قديم' : 'مسودة',
    className: course.isPublished !== false ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600',
  };
};

const getCourseVisibilityMeta = (course: Course) =>
  course.showOnPlatform === false
    ? { label: 'مخفي عن المنصة', className: 'bg-gray-100 text-gray-600' }
    : { label: 'ظاهر على المنصة', className: 'bg-sky-50 text-sky-700' };

const getCourseAccessMeta = (course: Course) =>
  course.isPackage
    ? { label: 'باقة بيع', className: 'bg-violet-50 text-violet-700' }
    : course.price > 0
      ? { label: 'مدفوعة / تحتاج اشتراك', className: 'bg-amber-50 text-amber-700' }
      : { label: 'مفتوحة أو مجانية', className: 'bg-emerald-50 text-emerald-700' };

const getCourseReadinessMeta = (course: Course) => {
  const issues: string[] = [];
  if (!course.title?.trim()) issues.push('العنوان غير مكتمل');
  if (!course.subjectId && !course.subject) issues.push('غير مربوط بمادة');
  if (course.showOnPlatform !== false && course.isPublished === false) issues.push('ظاهر للطالب لكنه غير منشور');
  if (course.showOnPlatform !== false && course.approvalStatus && course.approvalStatus !== 'approved') issues.push('ظاهر قبل الاعتماد');
  if (course.isPackage && course.price > 0 && !course.packageContentTypes?.length) issues.push('الباقة تحتاج تحديد ما تفتحه');

  return issues.length === 0
    ? { label: 'جاهز للطالب', issues, className: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'ready' as const }
    : { label: 'يحتاج ضبط', issues, className: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'warn' as const };
};

export const CoursesManager: React.FC<CoursesManagerProps> = ({ subjectId }) => {
  const { courses, addCourse, updateCourse, deleteCourse, subjects } = useStore();
  const [isBuilding, setIsBuilding] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);
  const [saveError, setSaveError] = useState('');
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const currentSubject = subjectId ? subjects.find((item) => item.id === subjectId) : undefined;

  const handleCreateNew = () => {
    setEditingCourse(
      subjectId
        ? ({
            subject: subjectId,
            subjectId,
            pathId: currentSubject?.pathId,
            showOnPlatform: false,
          } as Partial<Course> as Course)
        : ({ showOnPlatform: false } as Partial<Course> as Course),
    );
    setIsBuilding(true);
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setIsBuilding(true);
  };

  const handleSaveCourse = async (courseData: Partial<Course>) => {
    setIsSavingCourse(true);
    setSaveError('');
    const normalizedTitle = String(courseData.title || '').trim();
    if (!normalizedTitle) {
      setSaveError('اكتب اسم الدورة أولًا قبل الحفظ.');
      setIsSavingCourse(false);
      return;
    }

    const normalizedSubjectId = subjectId || courseData.subjectId || courseData.subject || '';
    const normalizedSubject = normalizedSubjectId || courseData.subject || '';
    const normalizedPathId =
      courseData.pathId || currentSubject?.pathId || subjects.find((item) => item.id === normalizedSubjectId)?.pathId || '';

    const normalizedCourseData: Partial<Course> = {
      ...courseData,
      title: normalizedTitle,
      instructor: String(courseData.instructor || '').trim() || 'فريق المنصة',
      subject: normalizedSubject,
      subjectId: normalizedSubjectId || undefined,
      pathId: normalizedPathId || undefined,
    };

    try {
      if (editingCourse?.id) {
        await updateCourse(editingCourse.id, normalizedCourseData);
      } else {
        const newCourse = {
          ...normalizedCourseData,
          id: `course_${Date.now()}`,
          showOnPlatform: typeof normalizedCourseData.showOnPlatform === 'boolean' ? normalizedCourseData.showOnPlatform : false,
        } as Course;
        await addCourse(newCourse);
      }

      setIsBuilding(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'تعذر حفظ الدورة على الخادم.');
    } finally {
      setIsSavingCourse(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه الدورة نهائيًا؟')) {
      setSaveError('');
      try {
        await deleteCourse(id);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'تعذر حذف الدورة على الخادم.');
      }
    }
  };

  const handleApprove = (course: Course) => {
    updateCourse(course.id, {
      approvalStatus: 'approved',
      isPublished: true,
      approvedAt: Date.now(),
    });
  };

  const handleReject = (course: Course) => {
    updateCourse(course.id, {
      approvalStatus: 'rejected',
      isPublished: false,
    });
  };

  const handleTogglePlatformVisibility = (course: Course) => {
    updateCourse(course.id, {
      showOnPlatform: course.showOnPlatform === false,
    });
  };

  const handleToggleRepositoryPublish = (course: Course) => {
    updateCourse(course.id, {
      isPublished: course.isPublished === false,
    });
  };

  const handlePrepareForLearner = (course: Course) => {
    updateCourse(course.id, {
      approvalStatus: 'approved',
      isPublished: true,
      showOnPlatform: true,
      approvedAt: course.approvedAt || Date.now(),
    });
  };

  const handlePreviewCourse = (course: Course) => {
    setPreviewCourse(course);
  };

  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      (course.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (course.category || course.pathId || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = subjectId ? (course.subjectId || course.subject) === subjectId : true;
    return matchesSearch && matchesSubject;
  });
  const courseOverview = {
    total: filteredCourses.length,
    visible: filteredCourses.filter((course) => course.showOnPlatform !== false).length,
    published: filteredCourses.filter((course) => course.isPublished !== false).length,
    sellable: filteredCourses.filter((course) => course.isPackage || course.price > 0).length,
  };

  if (isBuilding) {
    return (
      <div className="space-y-4">
        {saveError ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {saveError}
          </div>
        ) : null}
        {isSavingCourse ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
            جارٍ حفظ الدورة على الخادم...
          </div>
        ) : null}
        <AdvancedCourseBuilder initialCourse={editingCourse} onSave={handleSaveCourse} onCancel={() => setIsBuilding(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {saveError ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {saveError}
        </div>
      ) : null}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">إدارة الدورات (LMS)</h2>
          <p className="text-gray-500 text-sm mt-1">
            هذه الشاشة هي مستودع الدورات. اعتماد الدورة شيء، وظهورها على المنصة للطالب شيء آخر.
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          إنشاء دورة جديدة
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="ابحث عن دورة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الدورات', value: courseOverview.total, tone: 'text-slate-800 bg-slate-50' },
          { label: 'الظاهر على المنصة', value: courseOverview.visible, tone: 'text-sky-800 bg-sky-50' },
          { label: 'المنشور في المستودع', value: courseOverview.published, tone: 'text-emerald-800 bg-emerald-50' },
          { label: 'القابل للبيع / الاشتراك', value: courseOverview.sellable, tone: 'text-amber-800 bg-amber-50' },
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
                <th className="px-6 py-4 text-sm font-bold text-gray-600">الدورة</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">القسم</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">السعر</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">إحصائيات</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">الحالة</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCourses.map((course) => {
                const statusMeta = getCourseStatusMeta(course);
                const visibilityMeta = getCourseVisibilityMeta(course);
                const readinessMeta = getCourseReadinessMeta(course);

                return (
                  <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={course.thumbnail || 'https://via.placeholder.com/150'}
                          alt={course.title}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div>
                          <div className="font-bold text-gray-800">{course.title}</div>
                          <div className="text-xs text-gray-500">{course.instructor}</div>
                          {(course.ownerType || course.approvalStatus) && (
                            <div className="text-[11px] text-gray-400 mt-1">
                              {course.ownerType === 'teacher'
                                ? 'محتوى معلم'
                                : course.ownerType === 'school'
                                  ? 'محتوى مدرسة'
                                  : 'محتوى المنصة'}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs font-bold">{course.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-emerald-600">
                        {course.price} {course.currency}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Users size={12} /> {course.fakeStudentsCount || course.studentCount || 0} طالب
                        </div>
                        <div className="flex items-center gap-1">
                          <Star size={12} className="text-amber-400" /> {course.fakeRating || course.rating || 0} تقييم
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusMeta.className}`}>{statusMeta.label}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${visibilityMeta.className}`}>{visibilityMeta.label}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getCourseAccessMeta(course).className}`}>{getCourseAccessMeta(course).label}</span>
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
                            onClick={() => handlePrepareForLearner(course)}
                            className="px-3 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                            title={readinessMeta.issues.join('، ')}
                          >
                            تجهيز للطالب
                          </button>
                        )}
                        {course.approvalStatus !== 'approved' && (
                          <button
                            onClick={() => handleApprove(course)}
                            className="px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                          >
                            اعتماد
                          </button>
                        )}
                        {course.approvalStatus !== 'rejected' && (
                          <button
                            onClick={() => handleReject(course)}
                            className="px-3 py-1 text-xs font-bold text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            رفض
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(course)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="تعديل الدورة"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handlePreviewCourse(course)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="معاينة الدورة قبل النشر"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleToggleRepositoryPublish(course)}
                          className={`p-2 rounded-lg transition-colors ${
                            course.isPublished === false ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={course.isPublished === false ? 'نشر داخل المستودع' : 'إلغاء النشر من المستودع'}
                        >
                          {course.isPublished === false ? <Lock size={18} /> : <LockOpen size={18} />}
                        </button>
                        <button
                          onClick={() => handleTogglePlatformVisibility(course)}
                          className={`p-2 rounded-lg transition-colors ${
                            course.showOnPlatform === false
                              ? 'text-gray-500 hover:bg-gray-100'
                              : 'text-sky-600 hover:bg-sky-50'
                          }`}
                          title={course.showOnPlatform === false ? 'إظهار على المنصة' : 'إخفاء عن المنصة'}
                        >
                          {course.showOnPlatform === false ? <Lock size={18} /> : <LockOpen size={18} />}
                        </button>
                        <button
                          onClick={() => handleDelete(course.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCourses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    لا توجد دورات مطابقة للبحث.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {previewCourse ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 py-6" onClick={() => setPreviewCourse(null)}>
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">معاينة الدورة</div>
                <h3 className="mt-3 text-xl font-black text-gray-900">{previewCourse.title}</h3>
                <p className="mt-1 text-sm leading-7 text-gray-500">هذا الملخص يوضح ما سيراه الطالب قبل الفتح أو النشر.</p>
              </div>
              <button
                onClick={() => setPreviewCourse(null)}
                className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                aria-label="إغلاق المعاينة"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-black text-slate-500">المسار</div>
                <div className="mt-2 text-sm font-black text-slate-900">{subjects.find((item) => item.id === (previewCourse.subjectId || previewCourse.subject || ''))?.pathId ? 'مرتبط بمسار' : 'غير محدد'}</div>
              </div>
              <div className="rounded-2xl bg-indigo-50 p-4">
                <div className="text-xs font-black text-indigo-500">المادة</div>
                <div className="mt-2 text-sm font-black text-indigo-900">{subjects.find((item) => item.id === (previewCourse.subjectId || previewCourse.subject || ''))?.name || 'غير محدد'}</div>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <div className="text-xs font-black text-emerald-500">النوع</div>
                <div className="mt-2 text-sm font-black text-emerald-900">{previewCourse.isPackage ? 'باقة' : 'دورة'}</div>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <div className="text-xs font-black text-amber-500">السعر</div>
                <div className="mt-2 text-sm font-black text-amber-900">{previewCourse.price || 0} {previewCourse.currency || 'SAR'}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-3xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-black text-gray-800">
                  <PlayCircle size={16} className="text-emerald-500" />
                  جاهزية العرض
                </div>
                <div className="mt-4 space-y-2 text-sm font-bold text-gray-700">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">الحالة: {getCourseStatusMeta(previewCourse).label}</div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">الظهور: {getCourseVisibilityMeta(previewCourse).label}</div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">الوصول: {getCourseAccessMeta(previewCourse).label}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {previewCourse.ownerType ? (
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                      {previewCourse.ownerType === 'teacher' ? 'محتوى معلم' : previewCourse.ownerType === 'school' ? 'محتوى مدرسة' : 'محتوى المنصة'}
                    </span>
                  ) : null}
                  {previewCourse.isPackage ? (
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">باقة قابلة للبيع</span>
                  ) : null}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-100 bg-gray-50 p-4 sm:p-5">
                <div className="flex items-center gap-2 text-sm font-black text-gray-800">
                  <BookOpen size={16} className="text-indigo-500" />
                  وصف ومحتوى مختصر
                </div>
                <p className="mt-3 text-sm leading-7 text-gray-600">
                  {previewCourse.description || 'لا يوجد وصف مفصل محفوظ لهذه الدورة بعد.'}
                </p>
                <div className="mt-4 space-y-2 text-sm font-bold text-gray-700">
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">المدرب: {previewCourse.instructor || 'غير محدد'}</div>
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">الفئة: {previewCourse.category || 'غير محدد'}</div>
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">الطلاب: {previewCourse.fakeStudentsCount || previewCourse.studentCount || 0}</div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const pathId = previewCourse.pathId || previewCourse.category || '';
                  const subjectId = previewCourse.subjectId || previewCourse.subject || '';
                  const subjectQuery = subjectId ? `?subject=${subjectId}&tab=courses&package=${previewCourse.id}` : `?tab=packages&package=${previewCourse.id}`;
                  window.open(`${window.location.origin}/#/category/${pathId}${subjectQuery}`, '_blank', 'noopener,noreferrer');
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700"
              >
                <ExternalLink size={16} />
                فتح الصفحة
              </button>
              <button
                onClick={() => setPreviewCourse(null)}
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
