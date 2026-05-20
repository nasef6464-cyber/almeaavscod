import React from 'react';
import { useParams } from 'react-router-dom';
import { LearningSection } from '../components/LearningSection';

interface QudratSectionProps {
    type?: 'quant' | 'verbal' | 'packages';
}

export const QudratSection: React.FC<QudratSectionProps> = ({ type: propType }) => {
    const { type: paramType } = useParams<{ type: string }>();
    const sectionType = propType || paramType || 'quant';

    const titles: Record<string, string> = {
        quant: 'القدرات (كمي)',
        verbal: 'القدرات (لفظي)',
        packages: 'باقات القدرات',
    };

    const title = titles[sectionType] || 'القسم';

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <header className="relative overflow-hidden bg-indigo-900 py-10 text-white sm:py-12">
                <div className="relative z-10 mx-auto max-w-7xl px-4 text-center">
                    <h1 className="mb-2 break-words text-3xl font-bold sm:text-4xl">{title}</h1>
                    <p className="text-sm text-indigo-200 sm:text-base">
                        تأسيس شامل، تدريب مكثف، واختبارات محاكية
                    </p>
                </div>
            </header>

            <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
                <LearningSection category="qudrat" subject={sectionType} title={title} colorTheme="amber" />
            </div>
        </div>
    );
};
