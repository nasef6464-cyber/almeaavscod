import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, style }) => {
    return (
        <div 
            onClick={onClick}
            className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}
            style={style}
        >
            {children}
        </div>
    );
};
