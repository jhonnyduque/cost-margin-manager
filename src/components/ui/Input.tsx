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
    ...props
}) => {
    return (
        <div className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : ''} ${className}`}>
            {label && (
                <label className="text-label text-text-secondary">
                    {label}
                </label>
            )}
            <input
                className={`
                    h-10 px-4 rounded-sm outline-none transition-colors
                    bg-bg-card text-body text-text-primary
                    placeholder:text-text-muted
                    focus:ring-2 focus:ring-offset-0 focus:ring-brand/20
                    ${error ? 'border border-error focus:border-error' : 'border border-border focus:border-brand'}
                `}
                {...props}
            />
            {error && (
                <span className="text-caption text-error">
                    {error}
                </span>
            )}
        </div>
    );
};
