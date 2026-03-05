import React, { useMemo } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { MRRWaterfallPoint } from '@/services/adminStatsService';
import { typography } from '@/design/typography';

interface MRRWaterfallChartProps {
    data: MRRWaterfallPoint[];
}

export function MRRWaterfallChart({ data }: MRRWaterfallChartProps) {
    const chartData = useMemo(() => {
        return data.map(item => {
            const net = item.new + item.expansion + item.reactivation + item.churn + item.contraction;
            return {
                ...item,
                'Nuevo MRR': item.new,
                'Expansión': item.expansion,
                'Reactivación': item.reactivation,
                'Churn': item.churn,
                'Contracción': item.contraction,
                'Cambio Neto': net
            };
        });
    }, [data]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-2xl backdrop-blur-md">
                    <p className={`mb-2 ${typography.uiLabel} uppercase text-slate-500 tracking-widest`}>{label}</p>
                    <div className="space-y-1.5">
                        {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center justify-between gap-8">
                                <span className={`${typography.uiLabel} text-slate-600`}>{entry.name}</span>
                                <span className={`${typography.uiLabel} ${entry.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {entry.value >= 0 ? '+' : ''}${Math.abs(entry.value).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-full w-full rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h3 className={`${typography.uiLabel} text-slate-900 uppercase tracking-tight`}>Cascada de MRR</h3>
                    <p className={`${typography.caption} text-slate-500`}>Desglose mensual de crecimiento y pérdida de ingresos.</p>
                </div>
            </div>

            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                            tickFormatter={(v) => `$${v}`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                        <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={2} />

                        <Bar dataKey="Nuevo MRR" stackId="pos" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={24} />
                        <Bar dataKey="Expansión" stackId="pos" fill="#818cf8" barSize={24} />
                        <Bar dataKey="Reactivación" stackId="pos" fill="#c7d2fe" barSize={24} radius={[4, 4, 0, 0]} />

                        <Bar dataKey="Churn" stackId="neg" fill="#f43f5e" radius={[0, 0, 4, 4]} barSize={24} />
                        <Bar dataKey="Contracción" stackId="neg" fill="#fb7185" radius={[0, 0, 4, 4]} barSize={24} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-6 flex flex-wrap gap-4 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-indigo-600" />
                    <span className={`${typography.uiLabel} text-slate-500 uppercase tracking-wider`}>Nuevo</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-indigo-400" />
                    <span className={`${typography.uiLabel} text-slate-500 uppercase tracking-wider`}>Expansión</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-rose-500" />
                    <span className={`${typography.uiLabel} text-slate-500 uppercase tracking-wider`}>Churn</span>
                </div>
            </div>
        </div>
    );
}
