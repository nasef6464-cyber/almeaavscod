
import React from 'react';
import { MainLayout } from './MainLayout';

// Re-exporting MainLayout as Layout to maintain compatibility with existing imports
// or simply replacing the content if we want to keep the file name.
// Here I replace the content with the new MainLayout usage.

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <MainLayout>
            {children}
        </MainLayout>
    );
};

export default Layout;
