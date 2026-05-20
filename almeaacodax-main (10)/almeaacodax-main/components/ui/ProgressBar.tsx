import React from 'react';

interface ProgressBarProps {
    percentage: number;
    label?: string;
    showPercentage?: boolean;
    color?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
    percentage, 
    label, 
    showPercentage = true,
    color = 'secondary'
}) => {
    
    let colorClass = 'bg-secondary-500';
    if (color === 'primary') colorClass = 'bg-primary-500';
    if (color === 'danger') colorClass = 'bg-red-500';
    if (color === 'warning') colorClass = 'bg-amber-500';
    if (color === 'success') colorClass = 'bg-emerald-500';

    return (
        <div className="w-full">
            {(label || showPercentage) && (
                <div className="flex justify-between mb-1">
                    {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
                    {showPercentage && <span className="text-sm font-bold text-gray-600">{percentage}%</span>}
                </div>
            )}
            <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div 
                    className={`h-2.5 rounded-full transition-all duration-500 ${colorClass}`} 
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};
