import React from 'react';
import { Card } from './Card';
import { LucideIcon } from 'lucide-react';

// StatCard consume clases CSS de global.css exclusivamente.
// No usar clases Tailwind directas ni valores hardcodeados aquí.

interface StatCardProps {
    title: string;
    value: string | number;
    icon?: LucideIcon;
    trend?: {
        value: number;
        positive: boolean;
    };
    subtitle?: string;
    onClick?: () => void;
    className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    icon: Icon,
    trend,
    subtitle,
    onClick,
    className = '',
}) => {
    const Wrapper = onClick ? 'button' : 'div';

    return (
        <Card
            className={className}
            style={onClick ? { cursor: 'pointer' } : undefined}
        >
            <Wrapper
                onClick={onClick}
                className={onClick ? 'w-full text-left' : undefined}
            >
                {/* Header — título e ícono */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="text-small" style={{ color: 'var(--color-neutral-700)', fontWeight: 500 }}>
                        {title}
                    </span>
                    {Icon && (
                        <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '2rem',
                            height: '2rem',
                            borderRadius: 'var(--radius-lg)',
                            background: 'var(--color-neutral-100)',
                            color: 'var(--color-neutral-400)',
                            flexShrink: 0,
                        }}>
                            <Icon size={16} />
                        </span>
                    )}
                </div>

                {/* Valor principal */}
                <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 'var(--space-8)',
                    marginTop: 'var(--space-4)',
                }}>
                    <span className="metric-value" style={{ fontSize: 'var(--text-h2-size)' }}>
                        {value}
                    </span>
                    {trend && (
                        <span
                            className={trend.positive ? 'text-success' : 'text-muted'}
                            style={{ fontWeight: 600 }}
                        >
                            {trend.positive ? '+' : ''}{trend.value}%
                        </span>
                    )}
                </div>

                {/* Subtítulo */}
                {subtitle && (
                    <p className="text-small text-muted" style={{ marginTop: 'var(--space-4)' }}>
                        {subtitle}
                    </p>
                )}

                {/* CTA cuando es clickeable */}
                {onClick && (
                    <p className="text-small" style={{
                        marginTop: 'var(--space-8)',
                        color: 'var(--color-primary)',
                        fontWeight: 600,
                    }}>
                        Ver detalles →
                    </p>
                )}
            </Wrapper>
        </Card>
    );
};