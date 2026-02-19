import React from 'react';
import { tokens } from '../../design/design-tokens';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    style,
    noPadding = false,
    ...props
}) => {
    return (
        <div
            style={{
                backgroundColor: tokens.colors.surface,
                borderRadius: tokens.radius.lg,
                boxShadow: tokens.shadow.subtle,
                border: `1px solid ${tokens.colors.border}`,
                padding: noPadding ? 0 : tokens.spacing.lg,
                ...style
            }}
            className={`relative overflow-hidden ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};
