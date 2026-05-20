
import React from 'react';
import { useStore } from '../store/useStore';
import { PathLayout, PathCard } from '../components/PathLayout';

export const Qudrat: React.FC = () => {
    const { paths, subjects, courses } = useStore();
    
    // Filter only Qudrat courses for the grid below
    const filteredCourses = courses.filter(course => !course.isPackage && (course.category === 'القدرات' || course.category === 'قدرات'));

    const qudratPath = paths.find((path) => path.id === 'p_qudrat')
        || paths.find((path) => path.name.includes('القدرات') || path.name.includes('قدرات'));
    const qudratPathId = qudratPath?.id || 'p_qudrat';
    const pathSubjects = subjects.filter(s => s.pathId === qudratPathId);

    const qudratCards: PathCard[] = [
        {
            id: 'offers',
            title: 'العروض والباقات',
            subtitle: '% خصومات حصرية',
            color: 'bg-[#10b981]',
            link: `/category/${qudratPathId}?tab=packages`,
            isPillSubtitle: true
        },
        ...pathSubjects.map((subject, index) => {
            const colors = ['bg-[#2563eb]', 'bg-[#f59e0b]', 'bg-[#8b5cf6]', 'bg-[#ea580c]', 'bg-[#059669]'];
            return {
                id: subject.id,
                title: subject.name,
                subtitle: 'تأسيس - محاكي - شروحات',
                color: colors[index % colors.length],
      link: `/category/${qudratPathId}?subject=${subject.id}`
            };
        })
    ];

    return (
        <PathLayout
            title="دورات القدرات 2025"
            subtitle="تأسيس وتدريب شامل لاختبار القدرات العامة مع نخبة من أفضل المعلمين"
            cards={qudratCards}
            coursesTitle="أحدث الدورات"
            courses={filteredCourses}
        />
    );
};
