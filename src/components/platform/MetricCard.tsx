import React from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { Info, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';
import { Card } from '@/components/ui/Card';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface MetricCardProps {
    title: string;
    value: string | number;
    trend?: {
        value: number;
        label: string;
        isPositive: boolean;
    };
    description?: string;
    icon?: React.ReactNode;
    sparklineData?: { value: number }[];
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
    size?: 'sm' | 'md' | 'lg';
    visualType?: 'chart' | 'gauge';
    loading?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    trend,
    description,
    icon,
    sparklineData,
    variant = 'default',
    size = 'md',
    visualType = 'chart',
    loading = false
}) => {
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    if (loading) {
        return (
            <Card className={cn("animate-pulse", size === 'lg' ? "md:col-span-2" : "")}>
                <div className="flex justify-between items-start mb-4">
                    <div className={`w-24 h-4 ${colors.surfaceMuted} ${radius.sm}`} />
                    <div className={`w-8 h-8 ${radius.pill} ${colors.surfaceMuted}`} />
                </div>
                <div className={`w-32 h-8 ${colors.surfaceMuted} ${radius.sm} mb-4`} />
                <div className={`w-full h-12 ${colors.surfaceMuted} ${radius.sm}`} />
            </Card>
        );
    }

    const colorClasses = {
        default: colors.textPrimary,
        primary: colors.info,
        success: colors.success,
        warning: colors.warning,
        error: colors.danger
    };

    const valueSizeMapping = {
        sm: typography.text.section,
        md: typography.text.title,
        lg: typography.text.display
    };

    const slugId = `gr-${title.replace(/[^a-z0-1]/gi, '-').toLowerCase()}`;

    return (
        <Card className={cn(
            "group transition-all hover:brightness-[0.98] cursor-default",
            size === 'lg' ? `md:col-span-2 ${shadows.lg}` : ""
        )}>
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 group/title">
                    <span className={`${typography.text.caption} ${colors.textSecondary} font-bold`}>{title}</span>
                    {description && (
                        <div className="relative group/desc">
                            <Info size={typography.icon.xs} className={`${colors.textMuted} hover:${colors.info} cursor-help transition-colors`} />
                            <div className={`absolute left-0 top-full mt-2 w-64 ${spacing.pMd} bg-slate-900/95 backdrop-blur-md ${typography.text.secondary} text-slate-200 ${radius.md} ${shadows.modal} border border-white/10 opacity-0 group-hover/desc:opacity-100 pointer-events-none transition-all duration-300 translate-y-2 group-hover/desc:translate-y-0 z-[100]`}>
                                {description}
                            </div>
                        </div>
                    )}
                </div>
                {icon && (
                    <div className={`${radius.md} ${colors.surfaceMuted} p-2 ${colors.textMuted} group-hover:${colors.bgBrandSubtle} group-hover:${colors.brand} transition-all`}>
                        {React.cloneElement(icon as React.ReactElement, { size: typography.icon.md })}
                    </div>
                )}
            </div>

            <div className="flex items-baseline gap-3 mb-6">
                <h3 className={cn(valueSizeMapping[size], colorClasses[variant], "tracking-tighter")}>
                    {value}
                </h3>
                {trend && (
                    <span className={cn(
                        `flex items-center ${typography.text.caption} font-bold ${spacing.pxSm} py-1 ${radius.pill} ${shadows.sm} border`,
                        trend.isPositive
                            ? `${colors.bgSuccess} ${colors.success} ${colors.borderSuccess}`
                            : `${colors.bgDanger} ${colors.danger} ${colors.borderDanger}`
                    )}>
                        {trend.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {trend.value}%
                    </span>
                )}
            </div>

            {visualType === 'chart' && sparklineData && (
                <div className="h-16 w-full mt-auto opacity-30 group-hover:opacity-100 transition-all overflow-hidden relative">
                    <ResponsiveContainer width="99%" height={64}>
                        <AreaChart data={sparklineData}>
                            <Tooltip
                                cursor={false}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className={`${colors.surface} ${spacing.pxSm} py-1 ${radius.sm} ${shadows.modal} border ${colors.borderSubtle} ${typography.text.caption} font-black ${colors.textSecondary}`}>
                                                {payload[0].value}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <defs>
                                <linearGradient id={slugId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={variant === 'success' || trend?.isPositive ? "#10b981" : "#6366f1"} stopOpacity={0.2} />
                                    <stop offset="95%" stopColor={variant === 'success' || trend?.isPositive ? "#10b981" : "#6366f1"} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={variant === 'success' || trend?.isPositive ? "#10b981" : "#6366f1"}
                                strokeWidth={2}
                                fillOpacity={1}
                                fill={`url(#${slugId})`}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {visualType === 'gauge' && (
                <div className={`relative h-2 w-full ${colors.surfaceMuted} ${radius.pill} overflow-hidden mt-4`}>
                    <div
                        className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            parseFloat(value.toString()) < 3 ? "bg-emerald-500" :
                                parseFloat(value.toString()) < 5 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${Math.min(100, (parseFloat(value.toString()) / 10) * 100)}%` }}
                    />
                </div>
            )}
        </Card>
    );
}
