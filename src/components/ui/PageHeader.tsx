import React from 'react';

// PageHeader consume clases CSS de global.css exclusivamente.
// No usar clases Tailwind directas ni valores hardcodeados aquí.

interface PageHeaderProps {
    title: string;
    description?: string;
    actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => {
    return (
        <div className="page-header">
            <div>
                <h1 className="text-h1">
                    {title}
                </h1>
                {description && (
                    <p className="text-body text-secondary" style={{ marginTop: 'var(--space-4)' }}>
                        {description}
                    </p>
                )}
            </div>
            {actions && (
                <div className="row">
                    {actions}
                </div>
            )}
        </div>
    );
};