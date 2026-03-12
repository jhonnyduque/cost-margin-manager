import React from 'react';
import { Card } from './Card';
import { LucideIcon } from 'lucide-react';
import { typography } from '@/design/typography';

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
    className = ''
}) => {
    const Wrapper = onClick ? 'button' : 'div';

    return (
        <Card
            className={`flex flex-col gap-2 ${onClick ? 'cursor-pointer transition-all hover:border-indigo-200 hover:shadow-md active:scale-[0.98]' : ''} ${className}`}
        >
            <Wrapper
                onClick={onClick}
                className={onClick ? 'text-left w-full' : undefined}
            >
                <div className="flex items-center justify-between">
                    <span className={`${typography.uiLabel} text-slate-500`}>
                        {title}
                    </span>
                    {Icon && (
                        <div className="rounded-full p-2 bg-slate-50 text-slate-500">
                            <Icon size={16} />
                        </div>
                    )}
                </div>

                <div className="flex items-baseline gap-2 mt-1">
                    <span className={`${typography.metric} text-slate-900 leading-none`}>
                        {value}
                    </span>
                    {trend && (
                        <span className={`${typography.caption} font-bold ${trend.positive ? 'text-slate-700' : 'text-slate-500'}`}>
                            {trend.positive ? '+' : ''}{trend.value}%
                        </span>
                    )}
                </div>

                {subtitle && (
                    <p className={`${typography.caption} mt-1`}>{subtitle}</p>
                )}

                {onClick && (
                    <p className={`${typography.caption} text-slate-500 font-bold mt-2 uppercase tracking-wider`}>Ver detalles →</p>
                )}
            </Wrapper>
        </Card>
    );
};