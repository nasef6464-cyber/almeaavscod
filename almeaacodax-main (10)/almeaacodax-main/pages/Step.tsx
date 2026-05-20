import React from 'react';
import { useStore } from '../store/useStore';
import { PathLayout, PathCard } from '../components/PathLayout';

export const Step: React.FC = () => {
    const { subjects, courses } = useStore();
    
    // Filter only STEP courses for the grid below
    const filteredCourses = courses.filter(course => !course.isPackage && (course.category === 'STEP' || course.category === 'step'));

    const pathSubjects = subjects.filter(s => s.pathId === 'p_step');

    const stepCards: PathCard[] = [
        ...pathSubjects.map((subject, index) => {
            const colors = ['bg-[#ea580c]', 'bg-[#2563eb]', 'bg-[#059669]', 'bg-[#8b5cf6]', 'bg-[#f59e0b]'];
            return {
                id: subject.id,
                title: subject.name,
                subtitle: 'تأسيس - تدريب - نماذج',
                color: colors[index % colors.length],
      link: `/category/p_step?subject=${subject.id}`
            };
        })
    ];

    return (
        <PathLayout
            title="اختبار كفايات اللغة الإنجليزية (STEP)"
            subtitle="استعد لاختبار ستيب مع شروحات مبسطة وتدريبات مكثفة"
            cards={stepCards}
            coursesTitle="أحدث الدورات"
            courses={filteredCourses}
        />
    );
};
