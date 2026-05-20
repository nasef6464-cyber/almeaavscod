import React, { useEffect, useState } from 'react';
import { LearningRecommendation, SkillGap } from '../types';
import { generateLearningPath } from '../services/geminiService';
import { Sparkles, Zap, ArrowLeft, BrainCircuit, Clock } from 'lucide-react';
import { Card } from './ui/Card';

interface Props {
    skills: SkillGap[];
}

export const SmartLearningPath: React.FC<Props> = ({ skills }) => {
    const [recommendations, setRecommendations] = useState<LearningRecommendation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPath = async () => {
            setLoading(true);
            const data = await generateLearningPath(skills);
            setRecommendations(data);
            setLoading(false);
        };
        fetchPath();
    }, [skills]);

    if (loading) {
        return (
            <Card className="p-6 border-secondary-200 bg-gradient-to-br from-secondary-50 to-white">
                <div className="flex items-center gap-3 mb-4">
                    <BrainCircuit className="text-secondary-500 animate-pulse" size={24} />
                    <h3 className="font-bold text-lg text-gray-800">جاري تحليل أدائك وبناء مسار ذكي...</h3>
                </div>
                <div className="space-y-3">
                    <div className="h-16 bg-gray-100 rounded-xl animate-pulse"></div>
                    <div className="h-16 bg-gray-100 rounded-xl animate-pulse"></div>
                </div>
            </Card>
        );
    }

    if (recommendations.length === 0) return null;

    return (
        <div className="relative">
            <div className="flex items-center gap-2 mb-4">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-2 rounded-lg shadow-lg shadow-purple-200">
                    <Sparkles size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-lg text-gray-900">مسار التعلم الذكي</h3>
                    <p className="text-xs text-gray-500">تم اختياره لك بناءً على المهارات التي تحتاج دعمًا</p>
                </div>
            </div>

            <div className="relative border-r-2 border-purple-100 mr-4 space-y-6">
                {recommendations.map((item, index) => (
                    <div key={item.id} className="relative pr-8 animate-fade-in" style={{ animationDelay: `${index * 150}ms` }}>
                        <div
                            className={`absolute -right-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                                item.priority === 'high' ? 'bg-red-500' : 'bg-purple-500'
                            }`}
                        ></div>

                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${
                                            item.type === 'lesson'
                                                ? 'bg-blue-500'
                                                : item.type === 'quiz'
                                                  ? 'bg-amber-500'
                                                  : 'bg-emerald-500'
                                        }`}
                                    >
                                        {item.type === 'lesson' ? 'درس' : item.type === 'quiz' ? 'اختبار' : 'مراجعة'}
                                    </span>
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                        <Clock size={12} /> {item.duration}
                                    </span>
                                </div>
                                {item.priority === 'high' && (
                                    <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                                        <Zap size={12} /> أولوية عالية
                                    </span>
                                )}
                            </div>

                            <h4 className="font-bold text-gray-800 text-lg mb-1">{item.title}</h4>

                            <div className="bg-purple-50 p-2 rounded-lg mb-3">
                                <p className="text-xs text-purple-700 flex items-start gap-2">
                                    <Sparkles size={12} className="mt-0.5 shrink-0" />
                                    {item.reason}
                                </p>
                            </div>

                            <button className="w-full rounded-xl bg-gradient-to-l from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-black text-white shadow-sm shadow-indigo-100 transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-200">
                                <span className="inline-flex items-center justify-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-white/80 animate-pulse" />
                                    {item.actionLabel}
                                    <ArrowLeft size={16} />
                                </span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
