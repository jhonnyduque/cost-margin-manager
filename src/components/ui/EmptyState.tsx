import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';
import { typography } from '@/design/typography';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    action,
    className = ''
}) => {
    return (
        <div className={`flex flex-col items-center justify-center p-12 text-center rounded-[32px] border-2 border-dashed border-slate-100 bg-slate-50/30 ${className}`}>
            {Icon && (
                <div className="mb-6 rounded-2xl bg-white p-4 text-slate-300 shadow-sm ring-1 ring-slate-100">
                    <Icon size={32} />
                </div>
            )}

            <h3 className={`${typography.sectionTitle} text-slate-900 mb-2`}>
                {title}
            </h3>

            <p className={`${typography.body} text-slate-500 max-w-sm mx-auto mb-8`}>
                {description}
            </p>

            {action && (
                <Button onClick={action.onClick} className="font-bold">
                    {action.label}
                </Button>
            )}
        </div>
    );
};
