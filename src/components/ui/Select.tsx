import React from 'react';
import { tokens } from '../../design/design-tokens';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    fullWidth?: boolean;
}

export const Select: React.FC<SelectProps> = ({
    label,
    error,
    fullWidth = true,
    className = '',
    style,
    children,
    ...props
}) => {
    const selectStyles: React.CSSProperties = {
        height: '40px',
        borderRadius: tokens.radius.md,
        border: `1px solid ${error ? tokens.colors.error : tokens.colors.border}`,
        padding: `0 ${tokens.spacing.xl} 0 ${tokens.spacing.md}`, // Extra right padding for chevron
        fontSize: tokens.typography.body.fontSize,
        color: tokens.colors.text.primary,
        backgroundColor: tokens.colors.surface,
        width: fullWidth ? '100%' : 'auto',
        outline: 'none',
        appearance: 'none', // Hide default arrow
        cursor: 'pointer',
        transition: 'border-color 0.2s ease',
    };

    return (
        <div className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : ''} ${className}`}>
            {label && (
                <label
                    style={{
                        fontSize: tokens.typography.caption.fontSize,
                        color: tokens.colors.text.secondary,
                        fontWeight: 500
                    }}
                >
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    style={{ ...selectStyles, ...style }}
                    className="placeholder:text-gray-400 focus:ring-2 focus:ring-blue-100"
                    onFocus={(e) => {
                        e.currentTarget.style.borderColor = tokens.colors.brand;
                        props.onFocus?.(e);
                    }}
                    onBlur={(e) => {
                        e.currentTarget.style.borderColor = error ? tokens.colors.error : tokens.colors.border;
                        props.onBlur?.(e);
                    }}
                    {...props}
                >
                    {children}
                </select>
                <div
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: tokens.colors.text.secondary }}
                >
                    <ChevronDown size={16} />
                </div>
            </div>
            {error && (
                <span style={{ color: tokens.colors.error, fontSize: tokens.typography.caption.fontSize }}>
                    {error}
                </span>
            )}
        </div>
    );
};
