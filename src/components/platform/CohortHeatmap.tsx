import { CohortPoint } from '@/services/adminStatsService';
import { typography } from '@/design/typography';

interface CohortHeatmapProps {
    data: CohortPoint[];
}

export function CohortHeatmap({ data }: CohortHeatmapProps) {
    // Agrupar datos por mes de inicio
    const cohorts = Array.from(new Set(data.map(d => d.month))).sort((a, b) => {
        const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months.indexOf(a.split(' ')[0]) - months.indexOf(b.split(' ')[0]);
    });

    const maxAge = Math.max(...data.map(d => d.age));

    const getColor = (percentage: number) => {
        if (percentage >= 95) return 'bg-indigo-600 text-white';
        if (percentage >= 90) return 'bg-indigo-500 text-white';
        if (percentage >= 85) return 'bg-indigo-400 text-white';
        if (percentage >= 80) return 'bg-indigo-300 text-slate-900';
        if (percentage >= 75) return 'bg-indigo-200 text-slate-800';
        return 'bg-indigo-100 text-slate-700';
    };

    return (
        <div className="h-full w-full rounded-3xl border border-slate-100 bg-white p-6 shadow-sm overflow-hidden">
            <div className="mb-6">
                <h3 className={`${typography.uiLabel} text-slate-900 uppercase tracking-tight`}>Cohortes de Retención</h3>
                <p className={`${typography.caption} text-slate-500`}>Porcentaje de retención de ingresos por mes de adquisición.</p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-1">
                    <thead>
                        <tr>
                            <td className={`p-2 ${typography.uiLabel} text-slate-500 uppercase tracking-widest bg-slate-50/50 rounded-lg`}>Cohorte</td>
                            {Array.from({ length: maxAge + 1 }).map((_, i) => (
                                <td key={i} className={`p-2 text-center ${typography.uiLabel} text-slate-500 uppercase tracking-widest bg-slate-50/50 rounded-lg`}>
                                    M{i}
                                </td>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {cohorts.map(month => (
                            <tr key={month}>
                                <td className={`p-2 ${typography.uiLabel} text-slate-900 bg-slate-50/30 rounded-lg whitespace-nowrap`}>
                                    {month}
                                </td>
                                {Array.from({ length: maxAge + 1 }).map((_, age) => {
                                    const point = data.find(d => d.month === month && d.age === age);
                                    if (!point) return <td key={age} className="p-2 bg-slate-50/10 rounded-lg" />;

                                    return (
                                        <td key={age} className="p-0">
                                            <div className={`group relative flex h-9 w-full items-center justify-center rounded-lg ${typography.uiLabel} transition-all hover:scale-105 hover:shadow-lg hover:z-10 cursor-default ${getColor(point.percentage)}`}>
                                                {Math.round(point.percentage)}%
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all pointer-events-none z-10">
                                                    <div className={`bg-slate-900 ${typography.caption} text-white p-2 rounded-lg shadow-xl text-center`}>
                                                        Cohorte: {month}<br />
                                                        Mes {age}: {point.percentage.toFixed(1)}%
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-1.5">
                    <span className={`${typography.uiLabel} text-slate-500 uppercase`}>Menor</span>
                    <div className="flex gap-0.5">
                        <div className="h-2 w-3 rounded-sm bg-indigo-100" />
                        <div className="h-2 w-3 rounded-sm bg-indigo-200" />
                        <div className="h-2 w-3 rounded-sm bg-indigo-400" />
                        <div className="h-2 w-3 rounded-sm bg-indigo-600" />
                    </div>
                    <span className={`${typography.uiLabel} text-slate-500 uppercase`}>Mayor</span>
                </div>
                <span className={`${typography.uiLabel} text-indigo-600 uppercase tracking-widest`}>Meta NRR: 110%</span>
            </div>
        </div>
    );
}
