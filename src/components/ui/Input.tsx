import React from 'react';

// Input consume clases CSS de global.css exclusivamente.
// No usar clases Tailwind directas ni valores hardcodeados aquí.

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
    id,
    ...props
}) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
        <div className={`field ${fullWidth ? 'w-full' : ''} ${className}`.trim()}>
            {label && (
                <label className="field-label" htmlFor={inputId}>
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={`input ${error ? 'is-error' : ''}`.trim()}
                {...props}
            />
            {error && (
                <span className="field-error">
                    {error}
                </span>
            )}
        </div>
    );
};