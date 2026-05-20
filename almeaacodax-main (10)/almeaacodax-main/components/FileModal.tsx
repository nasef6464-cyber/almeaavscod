
import React from 'react';
import { X, Download } from 'lucide-react';

interface FileModalProps {
    fileUrl: string;
    title: string;
    type: 'pdf' | 'image';
    onClose: () => void;
}

export const FileModal: React.FC<FileModalProps> = ({ fileUrl, title, type, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] overflow-hidden shadow-2xl flex flex-col relative">
                {/* Header */}
                <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100 z-10">
                    <h3 className="font-bold text-gray-800 pr-2">{title}</h3>
                    <div className="flex items-center gap-2">
                        <a 
                            href={fileUrl} 
                            download 
                            className="bg-emerald-50 text-emerald-600 p-2 rounded-full hover:bg-emerald-100 transition-colors flex items-center gap-2 px-4"
                        >
                            <Download size={20} />
                            <span className="text-sm font-bold">تحميل</span>
                        </a>
                        <button 
                            onClick={onClose}
                            className="bg-red-50 text-red-500 p-2 rounded-full hover:bg-red-100 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content Container */}
                <div className="flex-1 bg-gray-100 overflow-auto flex items-center justify-center">
                    {type === 'pdf' ? (
                        <iframe 
                            className="w-full h-full"
                            src={`${fileUrl}#toolbar=0`} 
                            title={title}
                        ></iframe>
                    ) : (
                        <img 
                            src={fileUrl} 
                            alt={title} 
                            className="max-w-full max-h-full object-contain"
                            referrerPolicy="no-referrer"
                        />
                    )}
                </div>
                
                {/* Footer Info */}
                <div className="bg-gray-50 p-4 text-center text-sm text-gray-500">
                    عرض الملف من منصة المئة التعليمية
                </div>
            </div>
        </div>
    );
};
