import React from 'react';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';

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
    ...props
}) => {
    return (
        <div className={`flex flex-col ${spacing.xs} ${fullWidth ? 'w-full' : ''} ${className}`}>
            {label && (
                <label className={`${typography.text.caption} ${colors.textSecondary} ml-1`}>
                    {label}
                </label>
            )}
            <input
                className={`
                    h-10 ${spacing.pxMd} ${radius.md} outline-none transition-all duration-200
                    ${colors.surface} ${colors.textPrimary}
                    placeholder:${colors.textMuted}
                    border ${colors.borderStandard}
                    focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600
                    ${error ? `border-red-500 focus:ring-red-500/10 focus:border-red-600` : ''}
                `}
                {...props}
            />
            {error && (
                <span className={`${typography.text.secondary} ${colors.danger} font-medium ml-1`}>
                    {error}
                </span>
            )}
        </div>
    );
};
