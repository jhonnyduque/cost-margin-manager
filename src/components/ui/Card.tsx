import React from 'react';

// Card consume clases CSS de global.css exclusivamente.
// No usar tokens como clases Tailwind ni valores hardcodeados aquí.

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    noPadding?: boolean;
}

export const Card: React.FC<CardProps> & {
    Header: React.FC<React.HTMLAttributes<HTMLDivElement>>;
    Content: React.FC<React.HTMLAttributes<HTMLDivElement>>;
    Footer: React.FC<React.HTMLAttributes<HTMLDivElement>>;
} = ({
    children,
    className = '',
    noPadding = false,
    ...props
}) => (
        <div
            className={`card ${noPadding ? 'card--no-padding' : ''} ${className}`.trim()}
            {...props}
        >
            {children}
        </div>
    );

Card.Header = ({ children, className = '', ...props }) => (
    <div
        className={`widget-head ${className}`.trim()}
        {...props}
    >
        {children}
    </div>
);

Card.Content = ({ children, className = '', ...props }) => (
    <div className={className} {...props}>
        {children}
    </div>
);

Card.Footer = ({ children, className = '', ...props }) => (
    <div
        className={className}
        style={{
            marginTop: 'var(--space-24)',
            paddingTop: 'var(--space-24)',
            borderTop: 'var(--border-default)',
        }}
        {...props}
    >
        {children}
    </div>
);