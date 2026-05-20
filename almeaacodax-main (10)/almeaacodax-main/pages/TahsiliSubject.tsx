import React from 'react';
import { useParams } from 'react-router-dom';
import { LearningSection } from '../components/LearningSection';

export const TahsiliSubject: React.FC = () => {
    const { subject } = useParams<{ subject: string }>();
    const safeSubject = subject || 'math';

    const subjectTitles: Record<string, string> = {
        math: 'الرياضيات (تحصيلي)',
        physics: 'الفيزياء (تحصيلي)',
        chemistry: 'الكيمياء (تحصيلي)',
        biology: 'الأحياء (تحصيلي)',
        packages: 'عروض وباقات التحصيلي',
    };

    const title = subjectTitles[safeSubject] || 'المادة العلمية';

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <header className="bg-gradient-to-r from-gray-900 to-gray-800 px-4 py-10 text-center text-white sm:py-12">
                <h1 className="mb-2 break-words text-2xl font-bold sm:text-3xl">{title}</h1>
                <p className="text-sm text-gray-300 sm:text-base">كل ما تحتاجه للتفوق في {title.split(' ')[0]}</p>
            </header>

            <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
                <LearningSection category="tahsili" subject={safeSubject} title={title} colorTheme="indigo" />
            </div>
        </div>
    );
};
