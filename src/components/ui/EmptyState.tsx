import React from 'react';
import { tokens } from '../../design/design-tokens';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string; // For layout
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    action,
    className = ''
}) => {
    return (
        <div
            className={`flex flex-col items-center justify-center text-center p-8 ${className}`}
            style={{
                borderRadius: tokens.radius.lg,
                border: `2px dashed ${tokens.colors.border}`,
                backgroundColor: tokens.colors.bg, // Slightly different bg to distinguish from Card? Or surface?
                // Usually empty states are on surface but with dashed border.
                // Let's stick to simple clear design.
            }}
        >
            {Icon && (
                <div
                    className="mb-4 p-3 rounded-full"
                    style={{
                        backgroundColor: tokens.colors.bg, // darker circle
                        color: tokens.colors.text.muted
                    }}
                >
                    <Icon size={32} />
                </div>
            )}

            <h3
                style={{
                    fontSize: tokens.typography.titleMd.fontSize,
                    fontWeight: 500,
                    color: tokens.colors.text.primary,
                    marginBottom: tokens.spacing.xs
                }}
            >
                {title}
            </h3>

            <p
                style={{
                    fontSize: tokens.typography.body.fontSize,
                    color: tokens.colors.text.secondary,
                    maxWidth: '400px',
                    marginBottom: action ? tokens.spacing.lg : 0
                }}
            >
                {description}
            </p>

            {action && (
                <Button onClick={action.onClick}>
                    {action.label}
                </Button>
            )}
        </div>
    );
};
