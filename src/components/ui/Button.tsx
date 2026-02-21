import React from 'react';
import { tokens } from '../../design/design-tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    isLoading?: boolean;
    icon?: React.ReactNode;
    // Opcional: si alguien pasa fullWidth por error, lo convertimos a clase
    fullWidth?: boolean; // ← agregamos para absorber la prop y evitar warning
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    isLoading = false,
    icon,
    children,
    className = '',
    style,
    fullWidth,
    disabled,
    ...props
}) => {
    const baseStyles: React.CSSProperties = {
        height: '40px',
        borderRadius: tokens.radius.md,
        padding: `0 ${tokens.spacing.md}`,
        fontSize: tokens.typography.body.fontSize,
        fontWeight: tokens.typography.body.fontWeight,
        transition: 'all 0.2s ease',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled || isLoading ? 0.7 : 1,
        border: '1px solid transparent',
        outline: 'none',
    };

    const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
        primary: {
            backgroundColor: tokens.colors.brand,
            color: tokens.colors.surface,
            border: `1px solid ${tokens.colors.brand}`,
            boxShadow: tokens.shadow.subtle,
        },
        secondary: {
            backgroundColor: tokens.colors.surface,
            color: tokens.colors.text.primary,
            border: `1px solid ${tokens.colors.border}`,
            boxShadow: tokens.shadow.subtle,
        },
        ghost: {
            backgroundColor: 'transparent',
            color: tokens.colors.text.secondary,
            border: '1px solid transparent',
            boxShadow: 'none',
        },
    };

    return (
        <button
            style={{ ...baseStyles, ...variantStyles[variant], ...style }}
            className={`
        hover:opacity-90 active:scale-95
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
            disabled={disabled || isLoading}
            aria-busy={isLoading}
            aria-disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <>
                    <span className="mr-2 inline-block animate-spin">⟳</span>
                    {children || 'Cargando...'}
                </>
            ) : (
                <>
                    {icon && <span className="mr-2">{icon}</span>}
                    {children}
                </>
            )}
        </button>
    );
};