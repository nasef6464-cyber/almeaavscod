import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from './ui/Card';
import { Star, User, Sparkles, Loader2 } from 'lucide-react';
import { generateCourseSummary } from '../services/geminiService';
import { useStore } from '../store/useStore';

export interface PathCard {
    id: string;
    title: string;
    subtitle: string;
    color: string;
    link: string;
    isPillSubtitle?: boolean;
}

interface PathLayoutProps {
    title: string;
    subtitle: string;
    cards: PathCard[];
    coursesTitle?: string;
    courses: any[];
    children?: React.ReactNode;
}

const getCardGridClass = (count: number) => {
    if (count >= 5) return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 md:gap-6';
    if (count === 4) return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6';
    if (count === 3) return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6';
    if (count === 2) return 'grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6';
    return 'grid grid-cols-1 gap-4 md:gap-6';
};

const CourseItem: React.FC<{ course: any }> = ({ course }) => {
    const [summary, setSummary] = useState<string | null>(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const { user, enrolledCourses, hasScopedPackageAccess } = useStore();

    const isPurchased =
        enrolledCourses.includes(course.id) ||
        (user.subscription?.purchasedCourses || []).includes(course.id) ||
        hasScopedPackageAccess('courses', course.pathId || course.category, course.subjectId || course.subject) ||
        course.isPurchased;

    const handleGetSummary = async () => {
        if (summary) return;
        setLoadingSummary(true);
        const text = await generateCourseSummary(course.title);
        setSummary(text);
        setLoadingSummary(false);
    };

    return (
        <Card className="flex flex-col h-full hover:shadow-xl transition-shadow duration-300 border border-gray-100 overflow-hidden rounded-2xl">
            <div className="relative h-48 bg-gray-100 group overflow-hidden">
                <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur shadow-sm px-2 py-1 rounded-lg text-xs font-bold text-gray-700 flex items-center gap-1">
                    <Star size={12} className="text-amber-400 fill-current" />
                    {course.rating}
                </div>
            </div>

            <div className="p-5 flex-1 flex flex-col">
                <div className="mb-2">
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                        course.title.includes('كمي') ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                        {course.category}
                    </span>
                </div>

                <h3 className="text-lg font-bold text-[#1e1b4b] mb-2 leading-snug">{course.title}</h3>

                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                        <User size={14} />
                    </div>
                    <span>{course.instructor}</span>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-50 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-400 line-through">{course.price + 100} {course.currency}</span>
                            <span className="text-xl font-black text-emerald-600">
                                {course.price} <span className="text-xs font-normal text-gray-500">{course.currency}</span>
                            </span>
                        </div>
                        <Link
                            to={`/course/${course.id}`}
                            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                                isPurchased
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    : 'bg-white border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white'
                            }`}
                        >
                            {isPurchased ? 'مواصلة التعلم' : 'اشترك الآن'}
                        </Link>
                    </div>

                    <div>
                        {!summary && !loadingSummary && (
                            <button
                                onClick={handleGetSummary}
                                className="text-xs font-bold text-purple-600 flex items-center gap-1 hover:text-purple-800 transition-colors bg-purple-50 px-3 py-1.5 rounded-lg w-full justify-center"
                            >
                                <Sparkles size={14} />
                                شرح موجز (AI)
                            </button>
                        )}

                        {loadingSummary && (
                            <div className="text-xs text-gray-500 flex items-center gap-2 justify-center bg-gray-50 p-2 rounded-lg">
                                <Loader2 size={14} className="animate-spin" />
                                جاري التحميل...
                            </div>
                        )}

                        {summary && (
                            <div className="text-xs text-gray-600 bg-purple-50 p-3 rounded-lg leading-relaxed border border-purple-100 animate-fade-in">
                                <div className="flex items-center gap-1 text-purple-700 font-bold mb-1">
                                    <Sparkles size={12} />
                                    ملخص ذكي:
                                </div>
                                {summary}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
};

export const PathLayout: React.FC<PathLayoutProps> = ({ title, subtitle, cards, coursesTitle, courses, children }) => {
    return (
        <div className="bg-white min-h-screen pb-20 font-sans">
            <div className="py-16 text-center px-4">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#1e1b4b] mb-4 leading-tight break-words">{title}</h1>
                <p className="text-gray-500 max-w-2xl mx-auto text-sm md:text-base leading-6">{subtitle}</p>
            </div>

            <div className="max-w-7xl mx-auto px-4 mb-16">
                <div className={getCardGridClass(cards.length)}>
                    {cards.map((card) => (
                        <Link
                            key={card.id}
                            to={card.link || '#'}
                            className={`${card.color} rounded-3xl p-5 sm:p-6 md:p-8 text-center text-white hover:-translate-y-1 transition-transform shadow-lg flex flex-col justify-center items-center min-h-[160px]`}
                        >
                            <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-3 leading-tight break-words">{card.title}</h2>
                            {card.isPillSubtitle ? (
                                <span className="bg-white/20 px-4 py-1.5 rounded-full text-xs md:text-sm font-bold inline-block break-words">
                                    {card.subtitle}
                                </span>
                            ) : (
                                <span className="text-xs md:text-sm font-bold opacity-90 break-words">
                                    {card.subtitle}
                                </span>
                            )}
                        </Link>
                    ))}
                </div>
            </div>

            {courses && courses.length > 0 && (
                <div className="max-w-7xl mx-auto px-4 mb-16">
                    <div className="mb-8 flex items-center gap-3">
                        <div className="w-2 h-8 bg-[#4f46e5] rounded-full"></div>
                        <h2 className="text-xl sm:text-2xl font-bold text-[#1e1b4b] leading-tight">{coursesTitle || 'أحدث الدورات'}</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {courses.map((course) => (
                            <CourseItem key={course.id} course={course} />
                        ))}
                    </div>
                </div>
            )}

            {children}
        </div>
    );
};
