import React from 'react';
import { typography } from '@/design/typography';

interface PageHeaderProps {
    title: string;
    description?: string;
    actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => {
    return (
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 className={`${typography.pageTitle} text-slate-900`}>
                    {title}
                </h1>
                {description && (
                    <p className={`mt-1 ${typography.body} text-slate-500`}>
                        {description}
                    </p>
                )}
            </div>
            {actions && <div className="flex gap-3">{actions}</div>}
        </div>
    );
};