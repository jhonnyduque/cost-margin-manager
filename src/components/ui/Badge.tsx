import React from 'react';
import { colors, typography, spacing, radius } from '@/design/design-tokens';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'brand';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
    children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
    variant = 'neutral',
    children,
    className = '',
    ...props
}) => {
    const variants = {
        neutral: `${colors.surfaceMuted} ${colors.textSecondary} ${colors.borderSubtle}`,
        success: `${colors.bgSuccess} ${colors.success} ${colors.borderSuccess}`,
        warning: `${colors.bgWarning} ${colors.warning} ${colors.borderWarning}`,
        error: `${colors.bgDanger} ${colors.danger} ${colors.borderDanger}`,
        brand: `${colors.bgBrandSubtle} ${colors.brand} ${colors.borderBrand}`
    };

    return (
        <span
            className={`
                inline-flex items-center ${radius.pill} border ${spacing.pxSm} py-0.5
                ${typography.text.caption} font-bold tracking-tight
                ${variants[variant]}
                ${className}
            `}
            {...props}
        >
            {children}
        </span>
    );
};
