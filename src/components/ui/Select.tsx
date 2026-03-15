import React from 'react';
import { ChevronDown } from 'lucide-react';

// Select consume clases CSS de global.css exclusivamente.
// No usar clases Tailwind directas ni valores hardcodeados aquí.

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
    id,
    children,
    ...props
}) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
        <div className={`field ${fullWidth ? 'w-full' : ''} ${className}`.trim()}>
            {label && (
                <label className="field-label" htmlFor={selectId}>
                    {label}
                </label>
            )}
            <div style={{ position: 'relative' }}>
                <select
                    id={selectId}
                    className={`select ${error ? 'is-error' : ''}`.trim()}
                    style={{ paddingRight: 'var(--space-32)', appearance: 'none' }}
                    {...props}
                >
                    {children}
                </select>
                <span
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        right: 'var(--space-12)',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        color: 'var(--color-neutral-400)',
                        display: 'flex',
                    }}
                >
                    <ChevronDown size={16} />
                </span>
            </div>
            {error && (
                <span className="field-error">
                    {error}
                </span>
            )}
        </div>
    );
};