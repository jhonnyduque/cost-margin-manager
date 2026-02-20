import React from 'react';
import { tokens } from '@/design/design-tokens';

interface PageHeaderProps {
    title: string;
    description?: string;
    actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => {
    return (
        <div
            className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: tokens.colors.border }}
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
            {actions && <div className="flex gap-3">{actions}</div>}
        </div>
    );
};
