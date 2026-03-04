import React from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';

interface GrowthChartProps {
    data: any[];
}

export function MainGrowthChart({ data }: GrowthChartProps) {
    return (
        <div className="h-[300px] w-full mt-4 overflow-hidden relative">
            <ResponsiveContainer width="99%" height={300}>
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 'bold' }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 'bold' }}
                        tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                        contentStyle={{
                            borderRadius: '16px',
                            border: 'none',
                            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            padding: '12px'
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="realMrr"
                        stroke="#6366f1"
                        strokeWidth={4}
                        fillOpacity={1}
                        fill="url(#colorReal)"
                        name="MRR Real"
                    />
                    <Area
                        type="monotone"
                        dataKey="projectedMrr"
                        stroke="#cbd5e1"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        fill="transparent"
                        name="MRR Proyectado"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export function PlanDonutChart({ data }: { data: any[] }) {
    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

    // Simplificado para el MVP
    return (
        <div className="flex flex-col gap-4">
            <div className="h-[200px] w-full flex items-center justify-center">
                {/* Placeholder para un donut chart de Recharts si se desea más complejidad, 
                   pero para impacto visual rápido usaremos una lista con mini-barras de progreso */}
                <div className="w-full space-y-3">
                    {data.map((item, index) => (
                        <div key={item.name} className="space-y-1">
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-slate-500 capitalize">{item.name}</span>
                                <span className="text-slate-800">{item.value} companies</span>
                            </div>
                            <div className="w-full bg-slate-50 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-1000"
                                    style={{
                                        width: `${(item.value / data.reduce((a, b) => a + b.value, 0)) * 100}%`,
                                        backgroundColor: COLORS[index % COLORS.length]
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
