import React from 'react';
import { typography } from '@/design/design-tokens';

// Button variants map directly to CSS classes defined in global.css.
// Do NOT add inline styles or Tailwind classes here — use .btn-* classes only.

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: 'base' | 'sm';
    isLoading?: boolean;
    icon?: React.ReactNode;
    fullWidth?: boolean;
}

const variantClass: Record<ButtonVariant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
};

const iconSize = {
    base: typography.icon.sm,  // 16px
    sm: typography.icon.xs,  // 14px
};

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'base',
    isLoading = false,
    icon,
    children,
    className = '',
    fullWidth = false,
    disabled,
    ...props
}) => {
    const classes = [
        'btn',
        variantClass[variant],
        size === 'sm' ? 'btn-sm' : '',
        fullWidth ? 'w-full' : '',
        className,
    ].filter(Boolean).join(' ');

    return (
        <button
            className={classes}
            disabled={disabled || isLoading}
            aria-busy={isLoading}
            aria-disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <svg
                    className="animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    width={iconSize[size]}
                    height={iconSize[size]}
                    aria-hidden="true"
                >
                    <circle
                        className="opacity-25"
                        cx="12" cy="12" r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            ) : (
                <>
                    {icon && (
                        <span className="flex-shrink-0" aria-hidden="true">
                            {React.cloneElement(icon as React.ReactElement, {
                                size: iconSize[size],
                            })}
                        </span>
                    )}
                    {children}
                </>
            )}
        </button>
    );
};