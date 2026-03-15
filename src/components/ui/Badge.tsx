import React from 'react';

// Badge variants map directly to CSS classes defined in global.css
// Do NOT add inline styles or Tailwind classes here — use .badge-* classes only.

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
    children: React.ReactNode;
}

const variantClass: Record<BadgeVariant, string> = {
    neutral: 'badge-neutral',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    brand: 'badge-info',   // brand usa info-soft como base visual
};

export const Badge: React.FC<BadgeProps> = ({
    variant = 'neutral',
    children,
    className = '',
    ...props
}) => {
    return (
        <span
            className={`badge ${variantClass[variant]} ${className}`.trim()}
            {...props}
        >
            {children}
        </span>
    );
};