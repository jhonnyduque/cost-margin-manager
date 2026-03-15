import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

// EmptyState consume clases CSS de global.css exclusivamente.
// No usar clases Tailwind directas ni valores hardcodeados aquí.

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
    className = '',
}) => {
    return (
        <div className={`empty-state ${className}`.trim()}>
            {Icon && (
                <div className="empty-state-icon">
                    <Icon size={24} />
                </div>
            )}

            <h4>{title}</h4>

            <p>{description}</p>

            {action && (
                <Button variant="primary" onClick={action.onClick}>
                    {action.label}
                </Button>
            )}
        </div>
    );
};