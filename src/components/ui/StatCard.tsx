import React from 'react';
import { Card } from './Card';
import { tokens } from '../../design/design-tokens';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon?: LucideIcon;
    trend?: {
        value: number; // percentage
        positive: boolean;
    };
    className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    icon: Icon,
    trend,
    className = ''
}) => {
    return (
        <Card className={`flex flex-col gap-2 ${className}`}>
            <div className="flex items-center justify-between">
                <span
                    style={{
                        color: tokens.colors.text.secondary,
                        fontSize: tokens.typography.body.fontSize,
                        fontWeight: 500
                    }}
                >
                    {title}
                </span>
                {Icon && (
                    <div
                        className="rounded-full p-2"
                        style={{
                            backgroundColor: tokens.colors.bg,
                            color: tokens.colors.text.secondary
                        }}
                    >
                        <Icon size={16} />
                    </div>
                )}
            </div>

            <div className="flex items-baseline gap-2">
                <span
                    style={{
                        fontSize: tokens.typography.titleLg.fontSize,
                        fontWeight: tokens.typography.titleLg.fontWeight,
                        color: tokens.colors.text.primary,
                        lineHeight: 1
                    }}
                >
                    {value}
                </span>
                {trend && (
                    <span
                        style={{
                            fontSize: tokens.typography.caption.fontSize,
                            fontWeight: 500,
                            color: trend.positive ? tokens.colors.success : tokens.colors.error
                        }}
                    >
                        {trend.positive ? '+' : ''}{trend.value}%
                    </span>
                )}
            </div>
        </Card>
    );
};
