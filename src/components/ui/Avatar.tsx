import React from 'react';
import { colors, typography, radius } from '@/design/design-tokens';

interface AvatarProps {
    src?: string;
    alt?: string;
    fallback?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
    src,
    alt = '',
    fallback,
    size = 'md',
    className = ''
}) => {
    const sizeClasses = {
        sm: "size-8",
        md: "size-10",
        lg: "size-12"
    };

    const iconSize = size === 'sm' ? typography.icon.xs : typography.icon.sm;

    return (
        <div className={`
            relative flex-shrink-0 flex items-center justify-center overflow-hidden
            ${radius.pill} ${colors.surfaceMuted} border ${colors.borderSubtle}
            ${sizeClasses[size]}
            ${className}
        `}>
            {src ? (
                <img
                    src={src}
                    alt={alt}
                    className="h-full w-full object-cover"
                />
            ) : (
                <span className={`${typography.text.secondary} font-bold uppercase`}>
                    {fallback || alt.charAt(0) || '?'}
                </span>
            )}
        </div>
    );
};
