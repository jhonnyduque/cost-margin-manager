import React from 'react';
import { ChevronDown } from 'lucide-react';
import { typography } from '@/design/typography';

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
    children,
    ...props
}) => {
    return (
        <div className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : ''} ${className}`}>
            {label && (
                <label className={`${typography.uiLabel} text-slate-500`}>
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    className={`
                        h-11 w-full pl-4 pr-10 rounded-xl outline-none transition-all duration-200
                        bg-white text-slate-700 appearance-none cursor-pointer
                        ring-1 ring-inset ring-slate-200
                        focus:ring-2 focus:ring-indigo-500 focus:shadow-sm
                        ${typography.body}
                        ${error ? 'ring-red-200 focus:ring-red-500' : ''}
                    `}
                    {...props}
                >
                    {children}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <ChevronDown size={18} />
                </div>
            </div>
            {error && (
                <span className={`${typography.caption} text-red-500 font-medium`}>
                    {error}
                </span>
            )}
        </div>
    );
};
