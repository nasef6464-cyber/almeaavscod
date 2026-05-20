import React from 'react';
import { Header } from './Header';

interface DashboardLayoutProps {
    children: React.ReactNode;
    sidebar: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, sidebar }) => {
    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col" dir="rtl">
            <Header />
            <div className="flex flex-1 overflow-hidden pt-16"> {/* Add padding top to account for fixed header if any, otherwise adjust */}
                {/* Sidebar */}
                <aside className="w-64 bg-white border-l border-gray-200 overflow-y-auto hidden md:block shadow-sm z-10">
                    {sidebar}
                </aside>
                
                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};
