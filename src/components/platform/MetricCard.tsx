import React from 'react';
import { ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export function MetricCard({
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
}: MetricCardProps) {
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    if (loading) {
        return (
            <div className={cn(
                "rounded-3xl border border-slate-100 bg-white p-6 shadow-sm animate-pulse",
                size === 'lg' ? "md:col-span-2" : ""
            )}>
                <div className="flex justify-between items-start mb-4">
                    <div className="w-24 h-4 bg-slate-100 rounded" />
                    <div className="w-8 h-8 rounded-full bg-slate-50" />
                </div>
                <div className="w-32 h-8 bg-slate-100 rounded mb-4" />
                <div className="w-full h-12 bg-slate-50 rounded" />
            </div>
        );
    }

    const colorClasses = {
        default: 'text-slate-800',
        primary: 'text-indigo-600',
        success: 'text-emerald-600',
        warning: 'text-amber-600',
        error: 'text-red-600'
    };

    const valueSize = {
        sm: 'text-xl',
        md: 'text-2xl lg:text-3xl',
        lg: 'text-4xl md:text-5xl lg:text-6xl'
    };

    const slugId = `gr-${title.replace(/[^a-z0-1]/gi, '-').toLowerCase()}`;

    return (
        <div className={cn(
            "group rounded-[32px] border border-slate-100 bg-white p-8 transition-all hover:shadow-2xl hover:border-slate-200",
            size === 'lg' ? "md:col-span-2 shadow-lg shadow-slate-100" : "shadow-sm"
        )}>
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 group/title">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{title}</span>
                    {description && (
                        <div className="relative group/desc">
                            <Info size={12} className="text-slate-300 hover:text-indigo-500 cursor-help transition-colors" />
                            <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-slate-900/95 backdrop-blur-md text-[11px] text-slate-200 rounded-2xl shadow-2xl border border-white/10 opacity-0 group-hover/desc:opacity-100 pointer-events-none transition-all duration-300 translate-y-2 group-hover/desc:translate-y-0 z-[100] font-sans">
                                <div className="absolute -top-1 left-1.5 w-2 h-2 bg-slate-900 rotate-45 border-l border-t border-white/10" />
                                {description}
                            </div>
                        </div>
                    )}
                </div>
                {icon && (
                    <div className="rounded-2xl bg-slate-50 p-2.5 text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                        {icon}
                    </div>
                )}
            </div>

            <div className="flex items-baseline gap-3 mb-6">
                <h3 className={cn("font-black tracking-tighter", valueSize[size], colorClasses[variant])}>
                    {value}
                </h3>
                {trend && (
                    <span className={cn(
                        "flex items-center text-xs font-black px-2 py-1 rounded-xl shadow-sm",
                        trend.isPositive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                        {trend.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {trend.value}%
                    </span>
                )}
            </div>

            {visualType === 'chart' && sparklineData && (
                <div className="h-16 w-full mt-auto opacity-40 group-hover:opacity-100 transition-opacity overflow-hidden relative">
                    <ResponsiveContainer width="99%" height={64}>
                        <AreaChart data={sparklineData}>
                            <Tooltip
                                cursor={false}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-white px-2 py-1 rounded-lg shadow-xl border border-slate-50 text-[10px] font-black text-slate-600">
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
                                strokeWidth={3}
                                fillOpacity={1}
                                fill={`url(#${slugId})`}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {visualType === 'gauge' && (
                <div className="relative h-4 w-full bg-slate-100 rounded-full overflow-hidden mt-4">
                    <div
                        className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            parseFloat(value.toString()) < 3 ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" :
                                parseFloat(value.toString()) < 5 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${Math.min(100, (parseFloat(value.toString()) / 10) * 100)}%` }}
                    />
                </div>
            )}
        </div>
    );
}
