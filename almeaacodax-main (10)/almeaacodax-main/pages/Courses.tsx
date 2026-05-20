
import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Link } from 'react-router-dom';
import { Search, Filter, BookOpen, Star, ArrowRight, ChevronDown, ChevronUp, User, List, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { adapter } from '../services/adapter';
import { Course } from '../types';
import { sanitizeArabicText } from '../utils/sanitizeMojibakeArabic';

const displayText = (value?: string | null) => sanitizeArabicText(value);

const Courses: React.FC = () => {
    const { user, paths, enrolledCourses, completedLessons, hasScopedPackageAccess } = useStore();
    const [activeTab, setActiveTab] = useState<'enrolled' | 'active' | 'completed'>('active');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
    const [courses, setCourses] = useState<Course[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const loadCourses = async () => {
            setIsLoading(true);
            try {
                const data = await adapter.getCourses();
                if (mounted) {
                    setCourses(data);
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        loadCourses();

        return () => {
            mounted = false;
        };
    }, []);

    const canSeeHiddenPaths = ['admin', 'teacher', 'supervisor'].includes(String(user.role));
    const visiblePathIds = useMemo(
        () => new Set(paths.filter((path) => canSeeHiddenPaths || path.isActive !== false).map((path) => path.id)),
        [canSeeHiddenPaths, paths],
    );

    const canShowCourse = (course: Course) =>
        !course.isPackage &&
        (canSeeHiddenPaths || !course.pathId || visiblePathIds.has(course.pathId)) &&
        course.showOnPlatform !== false &&
        course.isPublished !== false &&
        (!course.approvalStatus || course.approvalStatus === 'approved');

    // Map courses with dynamic progress based on completedLessons
    const coursesWithProgress = useMemo(() => {
        return courses.map(course => {
            const hasAccess =
                enrolledCourses.includes(course.id) ||
                (user.subscription?.purchasedCourses || []).includes(course.id) ||
                hasScopedPackageAccess('courses', course.pathId || course.category, course.subjectId || course.subject);

            if (!hasAccess) return course;

            let totalLessons = 0;
            let completedCount = 0;

            course.modules?.forEach(module => {
                module.lessons.forEach(lesson => {
                    totalLessons++;
                    if (completedLessons.includes(lesson.id)) {
                        completedCount++;
                    }
                });
            });

            const progress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
            
            return {
                ...course,
                progress,
                isPurchased: true
            };
        });
    }, [courses, enrolledCourses, completedLessons, hasScopedPackageAccess, user.subscription?.purchasedCourses]);

    // Optimized Filter Logic with useMemo
    const filteredCourses = useMemo(() => {
        return coursesWithProgress.filter(c => 
            canShowCourse(c) &&
            (
                enrolledCourses.includes(c.id) ||
                (user.subscription?.purchasedCourses || []).includes(c.id) ||
                hasScopedPackageAccess('courses', c.pathId || c.category, c.subjectId || c.subject)
            ) &&
            ((c.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.category || c.pathId || '').toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [searchQuery, coursesWithProgress, enrolledCourses, hasScopedPackageAccess, user.subscription?.purchasedCourses, canSeeHiddenPaths, visiblePathIds]);

    const displayedCourses = useMemo(() => activeTab === 'completed' 
        ? filteredCourses.filter(c => c.progress === 100)
        : activeTab === 'active' 
            ? filteredCourses.filter(c => c.progress > 0 && c.progress < 100)
            : filteredCourses, // Enrolled shows all matching search
    [activeTab, filteredCourses]);

    const toggleCourseExpansion = (id: string) => {
        setExpandedCourseId(prev => prev === id ? null : id);
    };

    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-secondary-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <header className="flex items-start gap-3 sm:gap-4">
                <Link to="/" className="text-gray-500 hover:text-gray-700"><ArrowRight /></Link>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">دوراتي</h1>
                    <p className="text-sm text-gray-500">متابعة تقدمك في الدورات المسجلة</p>
                </div>
            </header>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ابحث في دوراتي..." 
                        className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-200 focus:border-secondary-500 focus:ring-1 focus:ring-secondary-500 outline-none transition-all"
                    />
                </div>
                <button className="bg-white border border-gray-200 text-gray-600 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors w-full sm:w-auto flex items-center justify-center">
                    <Filter size={20} />
                </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <div className="flex gap-6">
                    <TabButton 
                        label="الدورات الملتحق بها" 
                        count={filteredCourses.length} 
                        isActive={activeTab === 'enrolled'} 
                        onClick={() => setActiveTab('enrolled')} 
                    />
                    <TabButton 
                        label="الدورات النشطة" 
                        count={filteredCourses.filter(c => c.progress > 0 && c.progress < 100).length} 
                        isActive={activeTab === 'active'} 
                        onClick={() => setActiveTab('active')} 
                    />
                    <TabButton 
                        label="الدورات المكتملة" 
                        count={filteredCourses.filter(c => c.progress === 100).length} 
                        isActive={activeTab === 'completed'} 
                        onClick={() => setActiveTab('completed')} 
                    />
                </div>
            </div>

            {/* Courses Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedCourses.map((course) => {
                    const isExpanded = expandedCourseId === course.id;
                    return (
                        <Card 
                            key={course.id} 
                            className={`flex flex-col overflow-hidden border hover:shadow-lg transition-all duration-300 cursor-pointer ${isExpanded ? 'ring-2 ring-secondary-200 shadow-lg scale-[1.02] z-10' : ''}`}
                            onClick={() => toggleCourseExpansion(course.id)}
                        >
                            {/* Header Section */}
                            <div className="relative h-48 bg-gray-900 group">
                                <img 
                                    src={course.thumbnail} 
                                    alt={displayText(course.title)} 
                                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-90 transition-opacity" 
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                                
                                <div className="absolute bottom-0 left-0 right-0 p-5">
                                    <div className="flex justify-between items-start gap-3 mb-1">
                                        <span className="text-xs font-bold text-amber-400 mb-1 block">{course.category}</span>
                                        <div className="flex text-amber-400 text-xs">
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={i} size={12} fill={i < Math.floor(course.rating) ? "currentColor" : "none"} />
                                            ))}
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-base sm:text-lg text-white mb-1 leading-snug break-words">{displayText(course.title)}</h3>
                                    <div className="flex items-center gap-2 text-gray-300 text-xs">
                                        <User size={12} />
                                        <span>{displayText(course.instructor)}</span>
                                    </div>
                                </div>

                                {/* Expand Icon Indicator */}
                                <div className="absolute top-3 right-3 text-white/80 bg-black/30 p-1 rounded-full backdrop-blur-sm">
                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </div>
                            </div>

                            {/* Body Section */}
                            <div className="p-5 flex-1 flex flex-col bg-white">
                                {/* Basic Progress Info */}
                                <div className="mb-4">
                                    <div className="flex justify-between gap-3 text-xs text-gray-500 mb-1">
                                        <span>{course.progress}% مكتمل</span>
                                        <span>{course.modules?.reduce((acc, m) => acc + m.lessons.length, 0) || 0} دروس</span>
                                    </div>
                                    <ProgressBar percentage={course.progress} showPercentage={false} color="secondary" />
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="space-y-5 mb-4 animate-fade-in border-t border-gray-100 pt-4">
                                        {/* Description */}
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2 mb-2">
                                                <BookOpen size={16} className="text-secondary-500" />
                                                عن الدورة
                                            </h4>
                                            <p className="text-xs text-gray-600 leading-relaxed">
                                                {displayText(course.description) || 'لا يوجد وصف متاح.'}
                                            </p>
                                        </div>

                                        {/* Instructor Bio */}
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2 mb-2">
                                                <User size={16} className="text-secondary-500" />
                                                عن المدرب
                                            </h4>
                                            <p className="text-xs text-gray-600 leading-relaxed">
                                                {displayText(course.instructorBio) || 'لا توجد نبذة متاحة.'}
                                            </p>
                                        </div>

                                        {/* Syllabus */}
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2 mb-2">
                                                <List size={16} className="text-secondary-500" />
                                                المنهج الدراسي
                                            </h4>
                                            <div className="space-y-2">
                                                {course.modules?.map(module => module.lessons.map((item, idx) => {
                                                    const isCompleted = completedLessons.includes(item.id);
                                                    return (
                                                    <div key={item.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-2 bg-gray-50 rounded-lg text-xs">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                                                            <span className={`${isCompleted ? 'text-gray-800 font-medium' : 'text-gray-600'} break-words`}>{displayText(item.title)}</span>
                                                        </div>
                                                        <span className="text-gray-400 self-start sm:self-auto">{item.duration}</span>
                                                    </div>
                                                )})) || <p className="text-xs text-gray-400">لا يوجد منهج متاح.</p>}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Action Button */}
                                <div className="mt-auto">
                                    <Link 
                                        to={`/course/${course.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-secondary-500 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-secondary-600 transition-colors shadow-sm flex items-center justify-center"
                                    >
                                        {course.progress > 0 ? 'مواصلة التعلم' : 'ابدأ التعلم'}
                                    </Link>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {displayedCourses.length === 0 && (
                <div className="text-center py-8 sm:py-12 text-gray-400">
                    <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                    <p>لا توجد دورات في هذه القائمة.</p>
                </div>
            )}
        </div>
    );
};

const TabButton = ({ label, count, isActive, onClick }: { label: string; count: number; isActive: boolean; onClick: () => void }) => (
    <button 
        onClick={onClick}
        className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
            isActive 
                ? 'text-secondary-600 border-secondary-500' 
                : 'text-gray-500 border-transparent hover:text-gray-700'
        }`}
    >
        {label}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
            isActive ? 'bg-secondary-100 text-secondary-700' : 'bg-gray-100 text-gray-500'
        }`}>
            {count}
        </span>
    </button>
);

export default Courses;
