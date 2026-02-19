import React from 'react';
import { tokens } from '../../design/design-tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    isLoading?: boolean;
    icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    isLoading,
    icon,
    children,
    className = '',
    style,
    ...props
}) => {
    const baseStyles: React.CSSProperties = {
        height: '40px', // Identical height rule
        borderRadius: tokens.radius.md,
        padding: `0 ${tokens.spacing.md}`,
        fontSize: tokens.typography.body.fontSize,
        fontWeight: tokens.typography.body.fontWeight,
        transition: 'all 0.2s ease',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: props.disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: props.disabled || isLoading ? 0.7 : 1,
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

    // Hover effects would typically be done with CSS/Tailwind, but since we're restricting tokens...
    // For now, we'll rely on the base colors. Interactive states might need CSS or a wrapper.
    // We can use Tailwind for hover states if they map to tokens? 
    // User said: "ALLOWED: layout utilities ... NOT ALLOWED: visual identity decisions."
    // So strict token usage means we set the background. 
    // For hover, to keep it simple and strict, we might need a CSS class or module, 
    // but to avoid complexity we will just rely on the fact that users requested strict token usage.
    // I will add a simple class for hover dimming/opacity if needed, or just standard tailwind hover utilities if they match? 
    // No, `hover:bg-blue-700` allows arbitrary colors.
    // I will use `opacity-90` on hover for all buttons via Tailwind to be safe and consistent.

    return (
        <button
            style={{ ...baseStyles, ...variantStyles[variant], ...style }}
            className={`hover:opacity-90 active:scale-95 ${className}`}
            disabled={props.disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <span className="mr-2 animate-spin">⟳</span>
            ) : icon ? (
                <span className="mr-2">{icon}</span>
            ) : null}
            {children}
        </button>
    );
};
