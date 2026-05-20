
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Course } from '../types';
import { 
    Star, Clock, Users, BookOpen, CheckCircle, Lock, 
    PlayCircle, ChevronDown, ChevronUp, Share2, Heart,
    Award, BarChart, ShieldCheck, X
} from 'lucide-react';
import { PaymentModal } from './PaymentModal';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';

const CustomVideoPlayer = React.lazy(() =>
    import('./CustomVideoPlayer').then((module) => ({ default: module.CustomVideoPlayer })),
);

interface CourseLandingProps {
    course: Course;
}

export const CourseLanding: React.FC<CourseLandingProps> = ({ course }) => {
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'syllabus' | 'reviews'>('overview');
    const [expandedModules, setExpandedModules] = useState<string[]>(course.modules?.map(m => m.id) || []);
    const { user, enrolledCourses, hasScopedPackageAccess, getMatchingPackage } = useStore();
    const isStaffViewer = ['admin', 'teacher', 'supervisor'].includes(String(user?.role));
    const isCoursePubliclyAvailable =
        course.showOnPlatform !== false &&
        course.isPublished !== false &&
        (!course.approvalStatus || course.approvalStatus === 'approved');
    const hasPackageAccess = hasScopedPackageAccess('courses', course.pathId || course.category, course.subjectId || course.subject);
    const matchedPackage = getMatchingPackage('courses', course.pathId || course.category, course.subjectId || course.subject);
    const hasAccess =
        enrolledCourses.includes(course.id) ||
        (user.subscription?.purchasedCourses || []).includes(course.id) ||
        hasPackageAccess ||
        course.isPurchased;
    const publicPackageItem = course.isPackage && isCoursePubliclyAvailable
        ? {
            ...course,
            packageId: course.id,
            purchaseType: 'package',
            includedCourseIds: course.includedCourses || [],
            courseIds: course.includedCourses || [],
            contentTypes: course.packageContentTypes || ['all'],
            accessContext: 'هذه باقة عامة للشراء الفردي. إذا كنت تابعًا لمدرسة أو لديك وصول مفعل مسبقًا فلن تحتاج شراءها مرة أخرى.',
        }
        : null;
    const purchaseItem = publicPackageItem || (matchedPackage
        ? {
            id: matchedPackage.id,
            packageId: matchedPackage.id,
            purchaseType: 'package',
            title: matchedPackage.name,
            description: `هذه الباقة تفتح الدورات المرتبطة بـ ${course.subject || course.category}.`,
            contentTypes: matchedPackage.contentTypes,
            pathIds: matchedPackage.pathIds,
            subjectIds: matchedPackage.subjectIds,
            includedCourseIds: matchedPackage.courseIds,
            courseIds: matchedPackage.courseIds,
            price: course.price,
            currency: course.currency,
            accessContext: hasPackageAccess
                ? 'وصولك مفتوح بالفعل عبر باقة مرتبطة بهذه المادة.'
                : 'قد يكون هذا المحتوى متاحًا عبر المدرسة أو المجموعة. إذا بقي مغلقًا على حسابك فهذه هي الباقة المناسبة لفتحه.',
        }
        : course);
    const purchaseType = publicPackageItem || matchedPackage ? 'package' : 'course';

    if (!isStaffViewer && !isCoursePubliclyAvailable) {
        return (
            <div className="min-h-screen bg-gray-50 px-4 py-20 text-center" dir="rtl">
                <div className="mx-auto max-w-xl rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
                    <Lock className="mx-auto mb-4 text-gray-400" size={42} />
                    <h1 className="text-2xl font-black text-gray-900">المحتوى غير متاح حاليًا</h1>
                    <p className="mt-3 text-sm leading-7 text-gray-500">
                        هذه الدورة أو الباقة قيد التجهيز من الإدارة، وستظهر للطلاب بعد اعتمادها ونشرها.
                    </p>
                    <Link
                        to="/"
                        className="mt-6 inline-flex rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-black text-white hover:bg-indigo-700"
                    >
                        العودة للرئيسية
                    </Link>
                </div>
            </div>
        );
    }

    const toggleModule = (id: string) => {
        setExpandedModules(prev => 
            prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
        );
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-12"
                    >
                        {/* Description Section */}
                        <section className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-gray-100">
                            <h2 className="text-2xl font-black text-gray-900 mb-8">ماذا ستتعلم في هذه الدورة؟</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    'تأسيس شامل من الصفر في جميع المهارات',
                                    'استراتيجيات الحل السريع والذكي',
                                    'حل أحدث التجميعات والنماذج المتوقعة',
                                    'التدرب على إدارة الوقت في الاختبار',
                                    'تحليل نقاط الضعف والقوة بدقة',
                                    'متابعة مستمرة مع المدرس وفريق العمل'
                                ].map((item, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className="mt-1 bg-emerald-100 text-emerald-600 rounded-full p-0.5">
                                            <CheckCircle size={16} />
                                        </div>
                                        <span className="text-gray-700 text-sm md:text-base">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Instructor Section */}
                        <section className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-gray-100">
                            <h2 className="text-2xl font-black text-gray-900 mb-10">عن المدرس</h2>
                            <div className="flex flex-col md:flex-row gap-10">
                                <img src="https://i.pravatar.cc/150?u=instructor" alt={course.instructor} className="w-32 h-32 md:w-40 md:h-40 rounded-3xl object-cover shadow-xl" />
                                <div className="flex-1">
                                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{course.instructor}</h3>
                                    <p className="text-indigo-600 font-bold text-sm md:text-base mb-6">خبير تأسيس القدرات والتحصيلي</p>
                                    <p className="text-gray-600 leading-relaxed text-sm md:text-base mb-8">
                                        {course.instructorBio || 'مدرس خبير بخبرة تزيد عن 10 سنوات في تدريس مناهج القدرات والتحصيلي. ساعد آلاف الطلاب في تحقيق درجات متميزة والالتحاق بأفضل الجامعات.'}
                                    </p>
                                    <div className="grid grid-cols-2 gap-4 sm:flex sm:gap-8">
                                        <div className="text-center">
                                            <p className="text-2xl font-black text-gray-900">10k+</p>
                                            <p className="text-xs text-gray-400 mt-1">طالب</p>
                                        </div>
                                        <div className="text-center border-r border-gray-100 pr-8">
                                            <p className="text-2xl font-black text-gray-900">15</p>
                                            <p className="text-xs text-gray-400 mt-1">دورة</p>
                                        </div>
                                        <div className="text-center border-r border-gray-100 pr-8">
                                            <p className="text-2xl font-black text-gray-900">4.9</p>
                                            <p className="text-xs text-gray-400 mt-1">تقييم</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </motion.div>
                );
            case 'syllabus':
                return (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        {course.modules?.map((module) => (
                            <div key={module.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                {hasAccess && (
                                    <Link
                                        to={`/course/${course.id}`}
                                        className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 mb-4 transform hover:-translate-y-1 active:scale-95 flex items-center justify-center"
                                    >
                                        ابدأ التعلم الآن
                                    </Link>
                                )}
                                <button 
                                    onClick={() => toggleModule(module.id)}
                                    className="w-full flex items-center justify-between p-5 md:p-6 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-amber-100 text-amber-600 p-2.5 rounded-xl">
                                            <BookOpen size={22} />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-right md:text-lg">{module.title}</h3>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs text-gray-500 font-bold">{module.lessons.length} درس</span>
                                        {expandedModules.includes(module.id) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </div>
                                </button>
                                
                                <AnimatePresence>
                                    {expandedModules.includes(module.id) && (
                                        <motion.div 
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="divide-y divide-gray-50 overflow-hidden"
                                        >
                                            {module.lessons.map((lesson) => (
                                                <div key={lesson.id} className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-gray-400 group-hover:text-indigo-500 transition-colors">
                                                            {lesson.type === 'video' ? <PlayCircle size={20} /> : <BarChart size={20} />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm md:text-base font-bold text-gray-700">{lesson.title}</p>
                                                            <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">{lesson.duration}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-gray-300">
                                                        <Lock size={18} />
                                                    </div>
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </motion.div>
                );
            case 'reviews':
                return (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 text-center"
                    >
                        <Star size={48} className="mx-auto text-amber-400 mb-4" />
                        <h3 className="text-xl font-bold mb-2">تقييمات الطلاب</h3>
                        <p className="text-gray-500">هذه الدورة حصلت على تقييم {course.rating} من قبل طلابنا المتميزين.</p>
                    </motion.div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen pb-20" dir="rtl">
            {/* Video Preview Modal */}
            <AnimatePresence>
                {isPreviewOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-full max-w-4xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl"
                        >
                            <button 
                                onClick={() => setIsPreviewOpen(false)}
                                className="absolute top-4 right-4 z-20 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                            >
                                <X size={24} />
                            </button>
                            <React.Suspense
                                fallback={
                                    <div className="flex h-full w-full items-center justify-center bg-black text-sm font-bold text-white">
                                        جاري تجهيز المشغل...
                                    </div>
                                }
                            >
                                <CustomVideoPlayer 
                                    url={course.previewVideoUrl || 'https://www.youtube.com/watch?v=M5QGkOGZubQ'} 
                                    title={course.title}
                                />
                            </React.Suspense>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hero Background Strip */}
            <div className="absolute top-0 left-0 right-0 h-[300px] md:h-[380px] bg-[#0f172a] z-0 overflow-hidden">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-indigo-600/10 blur-3xl rounded-full -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-1/4 h-1/2 bg-blue-600/5 blur-3xl rounded-full -ml-10 -mb-10"></div>
            </div>

            {/* Main Layout Grid */}
            <div className="max-w-7xl mx-auto px-4 relative z-10 pt-8 md:pt-16">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 items-start">
                    
                    {/* Left Column: Info & Content */}
                    <div className="lg:col-span-2 space-y-8 md:space-y-12">
                        {/* Hero Info */}
                        <div className="text-white">
                            <div className="flex flex-wrap gap-2 mb-4">
                                <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">جديد</span>
                                <span className="bg-white/10 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{course.category}</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black mb-6 leading-tight text-right break-words">
                                {course.title}
                            </h1>
                            <p className="text-gray-300 text-sm md:text-base mb-8 max-w-2xl leading-relaxed">
                                {course.description}
                            </p>
                            
                            <div className="flex flex-wrap gap-6 text-xs mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                        <Users size={20} className="text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-[10px]">الطلاب المسجلين</p>
                                        <p className="font-bold text-sm">{course.studentCount || 1000}+ طالب</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 border-r border-white/10 pr-6">
                                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                                        <Star size={20} className="text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-[10px]">التقييم</p>
                                        <p className="font-bold text-sm">{course.rating} / 5.0</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 border-r border-white/10 pr-6">
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                        <Award size={20} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-[10px]">المستوى</p>
                                        <p className="font-bold text-sm">{course.level === 'Beginner' ? 'مبتدئ' : course.level === 'Intermediate' ? 'متوسط' : 'متقدم'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <img src="https://i.pravatar.cc/150?u=instructor" alt={course.instructor} className="w-12 h-12 rounded-full border-2 border-indigo-500" />
                                <div>
                                    <p className="text-gray-400 text-[10px]">المدرس</p>
                                    <p className="font-bold text-lg">{course.instructor}</p>
                                </div>
                            </div>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="flex overflow-x-auto border-b border-gray-200 sticky top-0 bg-gray-50/90 backdrop-blur-md z-20 pt-4">
                            <button 
                                onClick={() => setActiveTab('overview')}
                                className={`shrink-0 px-6 md:px-8 py-4 font-bold text-sm md:text-base transition-all ${activeTab === 'overview' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
                            >
                                نظرة عامة
                            </button>
                            <button 
                                onClick={() => setActiveTab('syllabus')}
                                className={`shrink-0 px-6 md:px-8 py-4 font-bold text-sm md:text-base transition-all ${activeTab === 'syllabus' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
                            >
                                منهج الدورة
                            </button>
                            <button 
                                onClick={() => setActiveTab('reviews')}
                                className={`shrink-0 px-6 md:px-8 py-4 font-bold text-sm md:text-base transition-all ${activeTab === 'reviews' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
                            >
                                المراجعات
                            </button>
                        </div>

                        <div className="pt-4">
                            <AnimatePresence mode="wait">
                                {renderTabContent()}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Right Column: Sticky Card */}
                    <div className="lg:sticky lg:top-24 z-30">
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="bg-white rounded-3xl shadow-2xl overflow-hidden text-gray-900 border border-gray-100"
                        >
                            <div 
                                className="relative aspect-video group cursor-pointer"
                                onClick={() => setIsPreviewOpen(true)}
                            >
                                <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/50 transition-all">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-xl transform group-hover:scale-110 transition-transform">
                                        <PlayCircle size={40} />
                                    </div>
                                </div>
                                <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-lg">
                                    معاينة الدورة
                                </div>
                            </div>
                            
                            <div className="p-5 sm:p-8">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                                    <div className="flex flex-col">
                                        <span className="text-gray-400 line-through text-sm">{course.originalPrice || course.price + 100} {course.currency}</span>
                                        <span className="text-3xl sm:text-4xl font-black text-indigo-600">{course.price} {course.currency}</span>
                                    </div>
                                    <div className="bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-xs font-black animate-pulse">
                                        خصم 30%
                                    </div>
                                </div>

                                <button 
                                    onClick={() => setIsPaymentModalOpen(true)}
                                    className={`w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 mb-4 transform hover:-translate-y-1 active:scale-95 ${hasAccess ? 'hidden' : ''}`}
                                >
                                    اشترك الآن
                                </button>

                                <p className="text-center text-gray-500 text-xs mb-8">ضمان استرداد الأموال لمدة 7 أيام</p>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-2">تشمل الدورة:</h4>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="flex items-center gap-3 text-sm text-gray-600">
                                            <PlayCircle size={18} className="text-indigo-500" />
                                            <span>{course.duration} ساعة من الفيديوهات المسجلة</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-gray-600">
                                            <BookOpen size={18} className="text-indigo-500" />
                                            <span>{course.features[0] || '73 درس'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-gray-600">
                                            <BarChart size={18} className="text-indigo-500" />
                                            <span>اختبارات محاكية وتقييمات دورية</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-gray-600">
                                            <ShieldCheck size={18} className="text-indigo-500" />
                                            <span>شهادة إتمام معتمدة</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-gray-600">
                                            <Clock size={18} className="text-indigo-500" />
                                            <span>وصول مدى الحياة للمحتوى</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 mt-8">
                                    <button className="flex-1 flex items-center justify-center gap-2 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                                        <Share2 size={18} /> مشاركة
                                    </button>
                                    <button className="flex-1 flex items-center justify-center gap-2 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                                        <Heart size={18} /> المفضلة
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>

            <PaymentModal 
                isOpen={isPaymentModalOpen} 
                onClose={() => setIsPaymentModalOpen(false)} 
                item={purchaseItem}
                type={purchaseType}
            />
        </div>
    );
};
