
import React from 'react';
import { useStore } from '../store/useStore';
import { PathLayout, PathCard } from '../components/PathLayout';

export const Tahsili: React.FC = () => {
    const { paths, subjects, courses } = useStore();
    
    // Filter only Tahsili courses for the grid below
    const filteredCourses = courses.filter(course => !course.isPackage && (course.category === 'التحصيلي' || course.category === 'تحصيلي'));

    const tahsiliPath = paths.find((path) => path.id === 'p_tahsili')
        || paths.find((path) => path.name.includes('التحصيلي') || path.name.includes('تحصيلي'));
    const tahsiliPathId = tahsiliPath?.id || 'p_tahsili';
    const pathSubjects = subjects.filter(s => s.pathId === tahsiliPathId);

    const tahsiliCards: PathCard[] = [
        {
            id: 'packages',
            title: 'الباقات',
            subtitle: 'عروض حصرية',
            color: 'bg-[#e11d48]',
            link: `/category/${tahsiliPathId}?tab=packages`,
            isPillSubtitle: true
        },
        ...pathSubjects.map((subject, index) => {
            const colors = ['bg-[#059669]', 'bg-[#8b5cf6]', 'bg-[#ea580c]', 'bg-[#2563eb]', 'bg-[#f59e0b]'];
            return {
                id: subject.id,
                title: subject.name,
                subtitle: 'شروحات - تجميعات - تدريب',
                color: colors[index % colors.length],
      link: `/category/${tahsiliPathId}?subject=${subject.id}`
            };
        })
    ];

    return (
        <PathLayout
            title="التحصيلي العلمي"
            subtitle="تغطية شاملة لجميع المواد العلمية مع بنوك أسئلة محدثة وشروحات تفاعلية"
            cards={tahsiliCards}
            coursesTitle="أحدث الدورات"
            courses={filteredCourses}
        >
            {/* Info Section specific to Tahsili */}
            <div className="max-w-7xl mx-auto px-4 text-center mt-12 mb-8">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                    <h2 className="text-2xl font-bold text-[#1e1b4b] mb-8">لماذا تختار دورات التحصيلي معنا؟</h2>
                    <div className="grid md:grid-cols-3 gap-8 text-right">
                        <FeatureItem title="تغطية شاملة" desc="شرح لجميع مقررات الصف الأول والثاني والثالث الثانوي" />
                        <FeatureItem title="تجميعات محدثة" desc="حل وشرح أحدث التجميعات والأسئلة المتكررة" />
                        <FeatureItem title="خرائط ذهنية" desc="ملخصات ذكية لربط المعلومات وتسهيل الحفظ" />
                    </div>
                </div>
            </div>
        </PathLayout>
    );
};

const FeatureItem = ({ title, desc }: { title: string, desc: string }) => (
    <div className="p-4">
        <h3 className="font-bold text-lg text-[#1e1b4b] mb-2 border-r-4 border-emerald-500 pr-3">{title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
    </div>
);
