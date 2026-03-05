import { Sparkles, TrendingUp, AlertCircle, Lightbulb, ArrowRight } from 'lucide-react';
import { typography } from '@/design/typography';

interface AIInsightsPanelProps {
    metrics?: any; // Usamos any temporalmente para no importar todo el objeto si no es necesario, o Tipar correctamente
    loading?: boolean;
}

export function AIInsightsPanel({ metrics, loading }: AIInsightsPanelProps) {
    if (loading) {
        return (
            <div className="h-full rounded-3xl border border-slate-100 bg-white p-6 shadow-sm animate-pulse">
                <div className="h-8 w-32 bg-slate-100 rounded-lg mb-6" />
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-50 rounded-2xl" />)}
                </div>
            </div>
        );
    }

    const insights = [
        {
            type: 'growth',
            icon: <TrendingUp size={16} />,
            title: 'Análisis de Crecimiento',
            text: metrics?.mrrGrowth > 0
                ? `Crecimiento del ${metrics.mrrGrowth}% detectado. El momento de tracción es positivo.`
                : 'Crecimiento estable. Monitoreando nuevas oportunidades de expansión.',
            color: 'text-emerald-600',
            bg: 'bg-emerald-50'
        },
        {
            type: 'risk',
            icon: <AlertCircle size={16} />,
            title: 'Salud de Clientes',
            text: metrics?.churnRate > 2
                ? `Alerta: Tasa de churn en ${metrics.churnRate}%. Se recomienda revisar cuentas inactivas.`
                : `Retención saludable. El churn actual de ${metrics?.churnRate || 0}% está bajo la meta.`,
            color: metrics?.churnRate > 2 ? 'text-rose-600' : 'text-emerald-600',
            bg: metrics?.churnRate > 2 ? 'bg-rose-50' : 'bg-emerald-50'
        },
        {
            type: 'opportunity',
            icon: <Lightbulb size={16} />,
            title: 'Optimización de Recursos',
            text: metrics?.seatUtilization > 80
                ? `Utilización de seats al ${Math.round(metrics.seatUtilization)}%. Alta probabilidad de Upsell.`
                : `Capacidad disponible. ${Math.round(100 - (metrics?.seatUtilization || 0))}% de seats libres para expansión.`,
            color: 'text-amber-600',
            bg: 'bg-amber-50'
        }
    ];

    return (
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="rounded-xl bg-indigo-600 p-2 text-white shadow-lg shadow-indigo-200">
                    <Sparkles size={18} />
                </div>
                <div>
                    <h3 className={`${typography.uiLabel} text-slate-900 uppercase tracking-tight leading-none mb-1`}>Inteligencia Real</h3>
                    <p className={`${typography.uiLabel} text-slate-500 uppercase tracking-widest`}>Análisis de Datos Vivos</p>
                </div>
            </div>

            <div className="space-y-4">
                {insights.map((item, idx) => (
                    <div key={idx} className="group relative rounded-2xl border border-slate-50 bg-slate-50/30 p-4 transition-all hover:bg-white hover:shadow-md hover:border-slate-100">
                        <div className="flex items-start gap-3">
                            <div className={`rounded-lg ${item.bg} ${item.color} p-2 transition-transform group-hover:scale-110`}>
                                {item.icon}
                            </div>
                            <div className="flex-1">
                                <h4 className={`${typography.uiLabel} text-slate-900 uppercase tracking-tight mb-1`}>{item.title}</h4>
                                <p className={`${typography.caption} text-slate-600 leading-relaxed font-medium`}>
                                    {item.text}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 rounded-2xl bg-indigo-600 p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                    <span className={`${typography.uiLabel} uppercase tracking-widest opacity-80`}>Proyección de Ingresos (MRR)</span>
                    <span className={`rounded-full bg-white/20 px-2 py-0.5 ${typography.uiLabel}`}>Datos Reales</span>
                </div>
                <div className={`${typography.metric} mb-1`}>${Math.round(metrics?.totalMRR || 0).toLocaleString()}</div>
                <p className={`${typography.caption} font-bold opacity-80 leading-tight`}>Cifra basada en suscripciones activas procesadas.</p>
            </div>
        </div>
    );
}
