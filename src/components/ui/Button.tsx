import React from 'react';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: 'base' | 'sm' | 'lg' | 'icon';
    isLoading?: boolean;
    icon?: React.ReactNode;
    fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'base',
    isLoading = false,
    icon,
    children,
    className = '',
    fullWidth,
    disabled,
    ...props
}) => {

    const baseClasses = `
    inline-flex items-center justify-center gap-2
    ${radius.md}
    transition-all duration-200
    outline-none whitespace-nowrap
    focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600
    active:scale-[0.98]
  `;

    const sizeClasses = {
        base: `${spacing.pxLg} py-2 text-[13px] font-bold uppercase tracking-wider`,
        sm: `${spacing.pxMd} py-1.5 text-[11px] font-black uppercase tracking-widest`,
        lg: `${spacing.pxXl} py-2.5 text-[14px] font-bold uppercase tracking-wide`,
        icon: "p-2 aspect-square"
    };

    const layoutClasses = `
    ${fullWidth ? 'w-full' : ''}
    ${(disabled || isLoading) ? 'opacity-40 cursor-not-allowed' : ''}
  `;

    const variantClasses: Record<ButtonVariant, string> = {
        primary: `
      ${colors.bgBrand} ${colors.textInverted}
      hover:brightness-110
      border border-transparent
      ${shadows.sm}
    `,
        secondary: `
      ${colors.surface} ${colors.textPrimary}
      hover:${colors.surfaceMuted}
      border ${colors.borderStandard}
      ${shadows.sm}
    `,
        ghost: `
      bg-transparent ${colors.textSecondary}
      hover:${colors.surfaceMuted} hover:${colors.brand}
      border border-transparent
    `,
        danger: `
      ${colors.bgDanger} ${colors.danger}
      hover:bg-red-600 hover:${colors.textInverted}
      border ${colors.borderDanger}
    `
    };

    const iconSize = size === 'sm' ? typography.icon.xs : typography.icon.sm;

    return (
        <button
            className={`
        ${baseClasses}
        ${sizeClasses[size]}
        ${layoutClasses}
        ${variantClasses[variant]}
        ${className}
      `}
            disabled={disabled || isLoading}
            aria-busy={isLoading}
            aria-disabled={disabled || isLoading}
            {...props}
        >

            {isLoading ? (
                <svg
                    className="animate-spin h-4 w-4 text-current"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    width={iconSize}
                    height={iconSize}
                >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            ) : (
                <>
                    {icon && (
                        <span className="flex-shrink-0">
                            {React.cloneElement(icon as React.ReactElement, {
                                size: iconSize,
                                className: (icon as React.ReactElement).props.className
                            })}
                        </span>
                    )}
                    {children}
                </>
            )}
        </button>
    );
};
