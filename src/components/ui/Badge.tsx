import React from 'react';
import { tokens } from '../../design/design-tokens';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'brand';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
    children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
    variant = 'neutral',
    children,
    className = '',
    style,
    ...props
}) => {
    const baseStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        padding: `2px ${tokens.spacing.xs}`,
        borderRadius: tokens.radius.full,
        fontSize: '0.75rem', // 12px
        fontWeight: 500,
        lineHeight: '1rem',
        whiteSpace: 'nowrap',
    };

    const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
        neutral: {
            backgroundColor: tokens.colors.bg,
            color: tokens.colors.text.secondary,
            border: `1px solid ${tokens.colors.border}`,
        },
        success: {
            backgroundColor: 'rgba(16, 185, 129, 0.1)', // #10B981 with opacity
            color: '#059669', // darker green for text
            border: '1px solid rgba(16, 185, 129, 0.2)',
        },
        warning: {
            backgroundColor: 'rgba(245, 158, 11, 0.1)', // #F59E0B with opacity
            color: '#D97706', // darker yellow/orange for text
            border: '1px solid rgba(245, 158, 11, 0.2)',
        },
        error: {
            backgroundColor: 'rgba(239, 68, 68, 0.1)', // #EF4444 with opacity
            color: '#DC2626', // darker red for text
            border: '1px solid rgba(239, 68, 68, 0.2)',
        },
        brand: {
            backgroundColor: 'rgba(37, 99, 235, 0.1)', // #2563EB with opacity
            color: tokens.colors.brand,
            border: `1px solid rgba(37, 99, 235, 0.2)`,
        }
    };

    return (
        <span
            style={{ ...baseStyle, ...variantStyles[variant], ...style }}
            className={className}
            {...props}
        >
            {children}
        </span>
    );
};
