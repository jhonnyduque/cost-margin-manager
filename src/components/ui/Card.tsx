import React from 'react';
import { colors, spacing, radius, shadows, typography } from '@/design/design-tokens';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    noPadding?: boolean;
}

export const Card: React.FC<CardProps> & {
    Header: React.FC<React.HTMLAttributes<HTMLDivElement>>;
    Content: React.FC<React.HTMLAttributes<HTMLDivElement> & { noPadding?: boolean }>;
    Footer: React.FC<React.HTMLAttributes<HTMLDivElement>>;
} = ({
    children,
    className = '',
    noPadding = false,
    ...props
}) => {
        return (
            <div
                className={`
                relative overflow-hidden
                ${colors.surface} ${radius.lg} ${shadows.card} border
                ${noPadding ? '' : spacing.pLg}
                ${className}
            `}
                {...props}
            >
                {children}
            </div>
        );
    };

Card.Header = ({ children, className = '', ...props }) => (
    <div className={`flex items-center justify-between mb-5 ${className}`} {...props}>
        {children}
    </div>
);

Card.Content = ({ children, className = '', noPadding = false, ...props }) => (
    <div className={`${noPadding ? '' : ''} ${className}`} {...props}>
        {children}
    </div>
);

Card.Footer = ({ children, className = '', ...props }) => (
    <div className={`mt-6 pt-6 border-t ${colors.borderSubtle} ${className}`} {...props}>
        {children}
    </div>
);
