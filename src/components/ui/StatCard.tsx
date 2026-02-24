import React from 'react';
import { Card } from './Card';
import { LucideIcon } from 'lucide-react';

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
                    <span className="text-sm font-medium text-slate-500">
                        {title}
                    </span>
                    {Icon && (
                        <div className="rounded-full p-2 bg-slate-50 text-slate-500">
                            <Icon size={16} />
                        </div>
                    )}
                </div>

                <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl lg:text-3xl font-bold text-slate-900 leading-none">
                        {value}
                    </span>
                    {trend && (
                        <span className={`text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                            {trend.positive ? '+' : ''}{trend.value}%
                        </span>
                    )}
                </div>

                {subtitle && (
                    <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
                )}

                {onClick && (
                    <p className="text-xs text-indigo-500 font-medium mt-2">Ver detalles →</p>
                )}
            </Wrapper>
        </Card>
    );
};