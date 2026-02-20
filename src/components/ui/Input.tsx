import React from 'react';
import { tokens } from '../../design/design-tokens';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    fullWidth = true,
    className = '',
    style,
    ...props
}) => {
    const inputStyles: React.CSSProperties = {
        height: '40px',
        borderRadius: tokens.radius.md,
        border: `1px solid ${error ? tokens.colors.error : tokens.colors.border}`,
        padding: `0 ${tokens.spacing.md}`,
        fontSize: tokens.typography.body.fontSize,
        color: tokens.colors.text.primary,
        backgroundColor: tokens.colors.surface,
        width: fullWidth ? '100%' : 'auto',
        outline: 'none',
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
            <input
                style={{ ...inputStyles, ...style }}
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
            />
            {error && (
                <span style={{ color: tokens.colors.error, fontSize: tokens.typography.caption.fontSize }}>
                    {error}
                </span>
            )}
        </div>
    );
};
