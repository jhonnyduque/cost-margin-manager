import React from 'react';
import { Calendar, Filter, ChevronDown, Download, Share2 } from 'lucide-react';

interface GlobalFilterBarProps {
    dateRange: string;
    onDateRangeChange: (range: string) => void;
    startDate: string;
    onStartDateChange: (date: string) => void;
    endDate: string;
    onEndDateChange: (date: string) => void;
    plan: string;
    onPlanChange: (plan: string) => void;
    segment: string;
    onSegmentChange: (segment: string) => void;
}

export function GlobalFilterBar({
    dateRange, onDateRangeChange,
    startDate, onStartDateChange,
    endDate, onEndDateChange,
    plan, onPlanChange,
    segment, onSegmentChange
}: GlobalFilterBarProps) {
    return (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-100 bg-white/50 p-2 pl-6 backdrop-blur-xl">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 border-r border-slate-100 pr-6">
                    <Calendar size={16} className="text-indigo-600" />
                    <select
                        value={dateRange}
                        onChange={(e) => onDateRangeChange(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none cursor-pointer hover:text-indigo-600 transition-colors"
                    >
                        <option value="last-30">Últimos 30 días</option>
                        <option value="last-90">Últimos 90 días</option>
                        <option value="ytd">Año a la fecha</option>
                        <option value="last-12m">Últimos 12 meses</option>
                        <option value="custom">Rango personalizado</option>
                    </select>

                    {dateRange === 'custom' && (
                        <div className="flex items-center gap-2 ml-4 animate-in slide-in-from-left-2 duration-300">
                            <input
                                type="date"
                                value={startDate}
                                min="2024-01-01"
                                max={endDate}
                                onChange={(e) => onStartDateChange(e.target.value)}
                                className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                            <span className="text-slate-300 text-[10px] font-bold">al</span>
                            <input
                                type="date"
                                value={endDate}
                                min={startDate || "2024-01-01"}
                                onChange={(e) => onEndDateChange(e.target.value)}
                                className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 cursor-pointer group relative">
                        <div className="rounded-lg bg-slate-100 p-1.5 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            <Filter size={14} />
                        </div>
                        <select
                            value={plan}
                            onChange={(e) => onPlanChange(e.target.value)}
                            className="appearance-none bg-transparent pr-6 text-xs font-bold text-slate-500 group-hover:text-slate-900 transition-colors focus:outline-none cursor-pointer"
                        >
                            <option value="all">Todos los Planes</option>
                            <option value="starter">Starter</option>
                            <option value="growth">Growth</option>
                            <option value="enterprise">Enterprise</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-0 text-slate-400 pointer-events-none" />
                    </div>

                    <div className="flex items-center gap-2 cursor-pointer group relative">
                        <div className="rounded-lg bg-slate-100 p-1.5 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            <Filter size={14} />
                        </div>
                        <select
                            value={segment}
                            onChange={(e) => onSegmentChange(e.target.value)}
                            className="appearance-none bg-transparent pr-6 text-xs font-bold text-slate-500 group-hover:text-slate-900 transition-colors focus:outline-none cursor-pointer"
                        >
                            <option value="all">Todos los Segmentos</option>
                            <option value="new">Nuevos</option>
                            <option value="loyal">Leales</option>
                            <option value="at-risk">En Riesgo</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-0 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all active:scale-95">
                    <Share2 size={16} />
                    Compartir Informe
                </button>
                <button className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all">
                    <Download size={16} />
                    Exportar CSV
                </button>
            </div>
        </div>
    );
}
