import React from 'react';
import { X } from 'lucide-react';
import { InteractiveQuestion, Question } from '../types';

const CustomVideoPlayer = React.lazy(() =>
    import('./CustomVideoPlayer').then((module) => ({ default: module.CustomVideoPlayer })),
);

interface VideoModalProps {
    videoUrl: string;
    title: string;
    interactiveQuestions?: InteractiveQuestion[];
    questionBank?: Question[];
    onClose: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ videoUrl, title, interactiveQuestions = [], questionBank = [], onClose }) => {
    const handleClose = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch((err) => console.error('Error exiting fullscreen:', err));
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-fade-in" dir="rtl">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col relative">
                <button
                    onClick={handleClose}
                    className="absolute left-3 top-3 z-[90] rounded-full bg-white/95 p-2.5 text-gray-800 shadow-lg transition hover:bg-white hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-white/80"
                    aria-label="إغلاق مشغل الفيديو"
                >
                    <X size={22} />
                </button>

                <div className="relative w-full pt-[56.25%] bg-black">
                    <div className="absolute top-0 left-0 w-full h-full">
                        <React.Suspense
                            fallback={
                                <div className="flex h-full w-full items-center justify-center bg-black text-sm font-bold text-white">
                                    جاري تجهيز المشغل...
                                </div>
                            }
                        >
                            <CustomVideoPlayer url={videoUrl} title={title} interactiveQuestions={interactiveQuestions} questionBank={questionBank} />
                        </React.Suspense>
                    </div>
                </div>

                <div className="bg-gray-50 p-3 sm:p-4 text-center text-xs sm:text-sm text-gray-500">
                    شرح تفصيلي مقدم من منصة المئة التعليمية
                </div>
            </div>
        </div>
    );
};
