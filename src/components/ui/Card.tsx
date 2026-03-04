import React from 'react';
import { tokens } from '../../design/design-tokens';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    style,
    noPadding = false,
    ...props
}) => {
    return (
        <div
            style={style}
            className={`surface-card relative overflow-hidden ${noPadding ? '!p-0' : ''} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};
