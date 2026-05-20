import React, { useMemo, useState } from 'react';
import { Search, MessageCircle, Filter, Plus, ArrowRight, BookOpen, HelpCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';

type QAFilter = 'all' | 'answered' | 'unanswered' | string;

interface QAItem {
    id: string;
    user: string;
    date: string;
    title: string;
    content: string;
    subject: string;
    courseId: string;
    courseTitle: string;
    category: string;
    hasAnswer: boolean;
    answer?: string;
}

const QA: React.FC = () => {
    const [filter, setFilter] = useState<QAFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const { courses, subjects, paths, user } = useStore();

    const canSeeHiddenPaths = ['admin', 'teacher', 'supervisor'].includes(String(user.role));
    const visiblePathIds = useMemo(
        () => new Set(paths.filter((path) => canSeeHiddenPaths || path.isActive !== false).map((path) => path.id)),
        [canSeeHiddenPaths, paths],
    );

    const qaItems = useMemo<QAItem[]>(() => {
        const publishedCourses = courses.filter((course) => {
            if (course.isPackage) return false;
            if (course.isPublished === false || course.showOnPlatform === false) return false;
            if (course.approvalStatus && course.approvalStatus !== 'approved' && !canSeeHiddenPaths) return false;
            return !course.pathId || visiblePathIds.has(course.pathId);
        });

        return publishedCourses
            .flatMap((course) => {
                const subject = subjects.find((item) => item.id === course.subjectId);
                const path = paths.find((item) => item.id === course.pathId);
                const subjectLabel = subject?.name || path?.name || course.category || 'عام';

                return (course.qa || []).map((item, index) => ({
                    id: `${course.id}-${item.id || index}`,
                    user: item.user || 'طالب بالمنصة',
                    date: item.date || 'حديثًا',
                    title: item.question,
                    content: item.answer || 'بانتظار رد المدرس أو فريق المنصة على هذا السؤال.',
                    subject: subjectLabel,
                    courseId: course.id,
                    courseTitle: course.title,
                    category: course.category || subjectLabel,
                    hasAnswer: Boolean(item.answer && item.answer.trim().length > 0),
                    answer: item.answer,
                }));
            })
            .reverse();
    }, [canSeeHiddenPaths, courses, paths, subjects, visiblePathIds]);

    const availableTags = useMemo(() => {
        const tags = new Set<string>();
        qaItems.forEach((item) => {
            if (item.subject.trim()) {
                tags.add(item.subject.trim());
            }
        });

        return ['الكل', 'تمت الإجابة', 'بانتظار الرد', ...Array.from(tags).slice(0, 8)];
    }, [qaItems]);

    const filteredQuestions = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        return qaItems.filter((item) => {
            const matchesFilter =
                filter === 'all'
                    ? true
                    : filter === 'answered'
                        ? item.hasAnswer
                        : filter === 'unanswered'
                            ? !item.hasAnswer
                            : item.subject === filter;

            const matchesQuery =
                !normalizedQuery ||
                item.title.toLowerCase().includes(normalizedQuery) ||
                item.content.toLowerCase().includes(normalizedQuery) ||
                item.courseTitle.toLowerCase().includes(normalizedQuery) ||
                item.user.toLowerCase().includes(normalizedQuery);

            return matchesFilter && matchesQuery;
        });
    }, [filter, qaItems, searchQuery]);

    const totalAnswered = qaItems.filter((item) => item.hasAnswer).length;

    return (
        <div className="space-y-6 pb-20">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 sm:gap-4">
                    <Link to="/" className="text-gray-500 hover:text-gray-700">
                        <ArrowRight size={24} />
                    </Link>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-amber-600 leading-tight">سؤال وجواب</h1>
                        <p className="text-sm text-gray-500">الأسئلة الحقيقية المرتبطة بالدورات والمنشورة داخل المنصة</p>
                    </div>
                </div>
                <Link
                    to="/courses"
                    className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md w-full sm:w-auto"
                >
                    <Plus size={18} />
                    <span className="hidden md:inline">استعرض الدورات واسأل من داخلها</span>
                    <span className="md:hidden">الدورات</span>
                </Link>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="p-4 border border-amber-100 bg-amber-50">
                    <div className="text-2xl font-black text-amber-600">{qaItems.length}</div>
                    <div className="text-sm text-gray-600 font-bold">إجمالي الأسئلة المنشورة</div>
                </Card>
                <Card className="p-4 border border-emerald-100 bg-emerald-50">
                    <div className="text-2xl font-black text-emerald-600">{totalAnswered}</div>
                    <div className="text-sm text-gray-600 font-bold">أسئلة تمت الإجابة عليها</div>
                </Card>
                <Card className="p-4 border border-blue-100 bg-blue-50">
                    <div className="text-2xl font-black text-blue-600">{Math.max(qaItems.length - totalAnswered, 0)}</div>
                    <div className="text-sm text-gray-600 font-bold">أسئلة بانتظار الرد</div>
                </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="ابحث في الأسئلة أو أسماء الدورات..."
                        className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                    />
                </div>
                <button className="bg-white border border-gray-200 text-gray-600 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors w-full sm:w-auto flex items-center justify-center">
                    <Filter size={20} />
                </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {availableTags.map((tag) => {
                    const isActive =
                        (filter === 'all' && tag === 'الكل') ||
                        (filter === 'answered' && tag === 'تمت الإجابة') ||
                        (filter === 'unanswered' && tag === 'بانتظار الرد') ||
                        filter === tag;

                    return (
                        <button
                            key={tag}
                            onClick={() => {
                                if (tag === 'الكل') {
                                    setFilter('all');
                                } else if (tag === 'تمت الإجابة') {
                                    setFilter('answered');
                                } else if (tag === 'بانتظار الرد') {
                                    setFilter('unanswered');
                                } else {
                                    setFilter(tag);
                                }
                            }}
                            className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                                isActive
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {tag}
                        </button>
                    );
                })}
            </div>

            <div className="space-y-4">
                {filteredQuestions.map((item) => (
                    <Card key={item.id} className="p-5 hover:shadow-md transition-shadow cursor-pointer group">
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.hasAnswer ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                    <HelpCircle size={18} />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-gray-900 text-sm group-hover:text-amber-600 transition-colors truncate">{item.user}</h4>
                                    <span className="text-xs text-gray-400">{item.date}</span>
                                </div>
                            </div>
                            <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded-md font-medium shrink-0 self-start sm:self-auto">
                                {item.subject}
                            </span>
                        </div>

                        <h3 className="font-bold text-base sm:text-lg text-gray-800 mb-2 leading-7 break-words">{item.title}</h3>
                        <p className="text-gray-500 text-sm line-clamp-2 mb-4">
                            {item.content}
                        </p>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-3">
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-gray-500 text-sm">
                                <span className="flex items-center gap-1">
                                    <MessageCircle size={16} />
                                    {item.hasAnswer ? 'إجابة واحدة' : 'بدون إجابة'}
                                </span>
                                <span className="flex items-center gap-1">
                                    <BookOpen size={16} />
                                    {item.courseTitle}
                                </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {item.hasAnswer ? (
                                    <span className="text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded flex items-center gap-1">
                                        تمت الإجابة
                                    </span>
                                ) : (
                                    <span className="text-amber-600 text-xs font-bold bg-amber-50 px-2 py-1 rounded flex items-center gap-1">
                                        بانتظار الرد
                                    </span>
                                )}
                                <Link
                                    to={`/course/${item.courseId}`}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 w-full sm:w-auto"
                                >
                                    صفحة الدورة
                                </Link>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {filteredQuestions.length === 0 && (
                <Card className="p-12 text-center border-dashed border-2 border-gray-200">
                    <div className="w-16 h-16 rounded-full bg-gray-50 text-gray-300 flex items-center justify-center mx-auto mb-4">
                        <MessageCircle size={28} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">لا توجد أسئلة مطابقة الآن</h3>
                    <p className="text-sm text-gray-500 mb-4">
                        إمّا أنه لا توجد أسئلة منشورة بعد، أو أن نتائج البحث/الفلترة الحالية لا تطابق البيانات الموجودة.
                    </p>
                    <Link to="/courses" className="text-indigo-600 font-bold hover:underline">
                        انتقل إلى الدورات
                    </Link>
                </Card>
            )}
        </div>
    );
};

export default QA;
