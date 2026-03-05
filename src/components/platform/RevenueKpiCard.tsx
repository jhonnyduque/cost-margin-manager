import React from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { RevenueMetric } from '@/services/adminStatsService';

interface RevenueKpiCardProps {
    metric: RevenueMetric;
}

export const RevenueKpiCard: React.FC<RevenueKpiCardProps> = ({ metric }) => {
    const { title, value, description, trend, sparklineData, variant = 'primary' } = metric;

    const variants = {
        primary: 'bg-indigo-600/5 border-indigo-100 text-indigo-600',
        success: 'bg-emerald-600/5 border-emerald-100 text-emerald-600',
        warning: 'bg-amber-600/5 border-amber-100 text-amber-600',
        danger: 'bg-rose-600/5 border-rose-100 text-rose-600'
    };

    const chartColors = {
        primary: '#4f46e5',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#f43f5e'
    };

    return (
        <div className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 transition-all hover:shadow-xl hover:shadow-slate-200/50">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</span>
                        <div className="group/info relative">
                            <Info size={12} className="text-slate-300 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 scale-90 opacity-0 group-hover/info:scale-100 group-hover/info:opacity-100 transition-all pointer-events-none z-10">
                                <div className="bg-slate-900 text-[10px] text-white p-2 rounded-lg shadow-xl font-medium leading-relaxed">
                                    {description}
                                </div>
                                <div className="w-2 h-2 bg-slate-900 rotate-45 mx-auto -mt-1" />
                            </div>
                        </div>
                    </div>
                    <div className="text-3xl font-black text-slate-900 tracking-tight">{value}</div>
                </div>
                <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-tight ${trend.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {trend.isPositive ? <ArrowUpRight size={12} strokeWidth={3} /> : <ArrowDownRight size={12} strokeWidth={3} />}
                    {trend.value}%
                </div>
            </div>

            <div className="h-16 w-full -mx-6 -mb-6 mt-2 opacity-50 group-hover:opacity-100 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparklineData}>
                        <defs>
                            <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={chartColors[variant]} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={chartColors[variant]} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={chartColors[variant]}
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill={`url(#gradient-${title})`}
                            isAnimationActive={true}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="absolute bottom-6 right-6 text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                {trend.label}
            </div>
        </div>
    );
}
