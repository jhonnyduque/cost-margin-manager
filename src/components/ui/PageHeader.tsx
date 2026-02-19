import React from 'react';
import { tokens } from '../../design/design-tokens';

interface PageHeaderProps {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string; // Adding className for layout utilities
}

export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    description,
    actions,
    className = ''
}) => {
    return (
        <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 ${className}`}
            style={{
                paddingBottom: tokens.spacing.lg,
                borderBottom: `1px solid ${tokens.colors.border}`,
            }}
        >
            <div>
                <h1
                    style={{
                        fontSize: tokens.typography.titleLg.fontSize,
                        fontWeight: tokens.typography.titleLg.fontWeight,
                        color: tokens.colors.text.primary,
                        marginBottom: tokens.spacing.xs
                    }}
                >
                    {title}
                </h1>
                {description && (
                    <p
                        style={{
                            fontSize: tokens.typography.body.fontSize,
                            color: tokens.colors.text.secondary
                        }}
                    >
                        {description}
                    </p>
                )}
            </div>

            {actions && (
                <div className="flex items-center gap-3">
                    {actions}
                </div>
            )}
        </div>
    );
};
