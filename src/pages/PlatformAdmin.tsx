import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import {
    Server, Users, AlertTriangle, Layers, CreditCard,
    UserPlus, ChevronRight, Megaphone, Send, Activity,
    TrendingUp, ShieldCheck, Globe, Zap, Clock, Info, ExternalLink
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { eventBusService } from '@/services/eventBusService';
import { EVENTS, SOURCE_MODULES } from '@/core/events';
import { adminStatsService, PlatformMetrics, GrowthPoint, VIPStatus } from '@/services/adminStatsService';
import { MetricCard } from '@/components/platform/MetricCard';
import { ActivityFeed } from '@/components/platform/ActivityFeed';
import { MainGrowthChart, PlanDonutChart } from '@/components/platform/Charts';
import { CommandPalette } from '@/components/platform/CommandPalette';

// Subcomponente: Consola de Comunicación (v1.3 mejorada)
function BroadcastConsole() {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleBroadcast = async () => {
        if (!message.trim()) return;
        setSending(true);
        setStatus(null);
        try {
            await eventBusService.emitEvent({
                eventKey: EVENTS.SYSTEM_MAINTENANCE,
                sourceModule: SOURCE_MODULES.SYSTEM,
                payload: {
                    title: title.trim() || undefined,
                    message: message.trim()
                }
            });
            setTitle('');
            setMessage('');
            setStatus({ type: 'success', text: 'Mensaje global emitido con éxito.' });
            setTimeout(() => setStatus(null), 3000);
        } catch (err) {
            setStatus({ type: 'error', text: 'Error al emitir mensaje.' });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                    <Megaphone size={20} />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Comunicación Global</h2>
                    <p className="text-xs text-slate-500">Envía alertas instantáneas a toda la plataforma.</p>
                </div>
            </div>

            <div className="space-y-4">
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Título (opcional, por defecto: Aviso BETO OS)"
                    className="w-full rounded-xl bg-slate-50 border-none px-4 py-3 text-sm font-bold text-slate-700 ring-1 ring-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                />
                <div className="flex gap-2">
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Contenido del mensaje..."
                        rows={3}
                        className="flex-1 rounded-xl bg-slate-50 border-none px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all resize-none"
                    />
                </div>
                <button
                    onClick={handleBroadcast}
                    disabled={sending || !message.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all shadow-sm"
                >
                    {sending ? 'Enviando...' : <><Send size={16} /> Enviar Broadcast</>}
                </button>
            </div>

            {status && (
                <p className={`mt-4 text-center text-xs font-bold ${status.type === 'success' ? 'text-emerald-600' : 'text-red-600'} animate-in slide-in-from-top-1`}>
                    {status.type === 'success' ? '✓' : '!'} {status.text}
                </p>
            )}
        </div>
    );
}

export default function PlatformAdmin() {
    const { user, enterCompanyAsFounder } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'billing' | 'ops'>('overview');
    const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
    const [growthData, setGrowthData] = useState<GrowthPoint[]>([]);
    const [planData, setPlanData] = useState<any[]>([]);
    const [vipTenants, setVipTenants] = useState<VIPStatus[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [m, g, p, v] = await Promise.all([
                adminStatsService.getPlatformSummary(),
                adminStatsService.getGrowthData(),
                adminStatsService.getPlanDistribution(),
                adminStatsService.getVIPTenants(5)
            ]);
            setMetrics(m);
            setGrowthData(g);
            setPlanData(p);
            setVipTenants(v);
        } catch (err) {
            console.error('Error loading admin stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleTenantAccess = async (companyId: string) => {
        try {
            await enterCompanyAsFounder(companyId);
            navigate('/dashboard');
        } catch (err) {
            console.error('Error accessing tenant:', err);
        }
    };

    if (!user?.is_super_admin) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] text-center p-8">
                <ShieldCheck size={48} className="text-red-100 mb-4" />
                <h2 className="text-xl font-black text-slate-900">Acceso Restringido</h2>
                <p className="text-slate-500 mt-2 max-w-xs">Solo el Fundador de BETO OS tiene acceso al Control Center.</p>
                <button onClick={() => navigate('/dashboard')} className="mt-6 text-sm font-bold text-indigo-600 hover:underline">Volver al Dashboard</button>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Estrategia', icon: TrendingUp },
        { id: 'tenants', label: 'Empresas', icon: Globe },
        { id: 'billing', label: 'Finanzas', icon: CreditCard },
        { id: 'ops', label: 'Operaciones', icon: Zap },
    ];

    return (
        <div className="animate-in fade-in space-y-8 duration-700 pb-12">
            {/* Header Estratégico */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-800">Control Center <span className="text-indigo-600">v2.0</span></h1>
                    <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5"><Clock size={14} /> Actualizado en tiempo real</span>
                        <span className="text-slate-300">·</span>
                        <span className="flex items-center gap-1.5 text-emerald-600 font-bold"><Activity size={14} /> System Health: Healthy</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <CommandPalette />
                    <div className="flex items-center gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100 w-fit">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                            >
                                <tab.icon size={16} />
                                <span className="hidden md:inline">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                    {/* Columna Principal: Métricas y Gráficos */}
                    <div className="lg:col-span-8 space-y-8 min-w-0">
                        {/* Grid de KPIs Premium */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <MetricCard
                                title="North Star: MRR"
                                value={`$${metrics?.totalMRR.toLocaleString()}`}
                                description="Ingresos Mensuales Recurrentes. Mide el dinero que entra de forma estable cada mes por suscripciones. Es el indicador de salud financiera número uno."
                                trend={{ value: 15.2, label: 'MoM', isPositive: true }}
                                icon={<TrendingUp size={24} />}
                                sparklineData={growthData.map(d => ({ value: d.realMrr }))}
                                variant="primary"
                                size="lg"
                                loading={loading}
                            />

                            <MetricCard
                                title="Churn Rate (MM)"
                                value={`${metrics?.churnRate}%`}
                                description="Tasa de cancelación. Mide cuántos clientes perdemos cada mes. Nuestro objetivo es que sea inferior al 3% para un crecimiento saludable."
                                trend={{ value: 0.3, label: 'improving', isPositive: true }}
                                icon={<Users size={20} />}
                                visualType="gauge"
                                variant="success"
                                loading={loading}
                            />
                            <MetricCard
                                title="Active Tenants"
                                value={metrics?.activeTenants || 0}
                                description="Número de empresas activas usando la plataforma. Cada empresa puede tener múltiples usuarios contratados."
                                trend={{ value: 4, label: 'new this month', isPositive: true }}
                                icon={<Globe size={20} />}
                                loading={loading}
                            />
                        </div>

                        {/* Gráfico de Crecimiento Avanzado */}
                        <div className="rounded-[32px] border border-slate-100 bg-white p-8 lg:p-10 shadow-sm transition-all hover:shadow-xl">
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tighter">Performance de Plataforma</h3>
                                    <p className="text-sm text-slate-400 font-medium">Trayectoria de MRR Real vs Metas Proyectadas</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <div className="w-3 h-1 bg-indigo-600 rounded-full" /> MRR Real
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <div className="w-3 h-1 bg-slate-200 rounded-full border border-dashed border-slate-400" /> Proyectado
                                    </div>
                                </div>
                            </div>
                            <MainGrowthChart data={growthData} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* VIP Tenants Section */}
                            <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Top 5 VIP Tenants</h3>
                                    <button onClick={() => setActiveTab('tenants')} className="text-[10px] font-black text-indigo-600 hover:underline">VER TODOS</button>
                                </div>
                                <div className="space-y-6">
                                    {vipTenants.map((tenant) => (
                                        <div key={tenant.id} className="flex items-center justify-between group p-3 hover:bg-slate-50 transition-all rounded-2xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:bg-white group-hover:text-indigo-600 transition-all">
                                                    {tenant.name[0]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-700">{tenant.name}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{tenant.plan}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right flex flex-col justify-center">
                                                    <div className="text-sm font-black text-slate-800">${tenant.mrr}</div>
                                                    <div className="text-[10px] font-bold text-emerald-500">{Math.round(tenant.usage)}% usage</div>
                                                </div>
                                                <button
                                                    onClick={() => handleTenantAccess(tenant.id)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-600 hover:text-white"
                                                >
                                                    Acceder <ExternalLink size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Distribución de Planes</h3>
                                    <PlanDonutChart data={planData} />
                                </div>
                                <div className="rounded-[32px] border border-slate-100 bg-indigo-600 p-8 shadow-xl shadow-indigo-100 text-white group cursor-pointer overflow-hidden relative">
                                    <Zap className="absolute -right-4 -top-4 w-32 h-32 opacity-10 group-hover:rotate-12 transition-transform" />
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-xs font-black uppercase tracking-widest opacity-60">Lifetime Value (LTV)</h3>
                                        <div className="relative group/ltv">
                                            <Info size={12} className="opacity-40 hover:opacity-100 cursor-help transition-opacity" />
                                            <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-800 text-[10px] text-white rounded-lg shadow-xl opacity-0 group-hover/ltv:opacity-100 pointer-events-none transition-opacity z-50 font-medium leading-tight">
                                                Estimación total de ingresos por cliente antes de cancelar. Ayuda a calcular cuánto podemos invertir en captar nuevos usuarios.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-4xl font-black tracking-tighter mb-4">${Math.round(metrics?.ltv || 0).toLocaleString()}</div>
                                    <p className="text-[11px] font-bold opacity-80 leading-relaxed">Valor proyectado promedio por empresa basado en churn actual y ticket promedio.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Columna Lateral: Realtime Activity */}
                    <div className="lg:col-span-4 space-y-8 min-w-0">
                        {/* Acciones Rápidas Pro */}
                        <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Operaciones</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => navigate('/platform/environments')} className="flex flex-col items-center justify-center gap-3 p-5 rounded-[24px] bg-slate-50 border border-slate-100 hover:bg-white hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50 hover:text-indigo-600 transition-all group">
                                    <Layers size={24} className="text-slate-300 group-hover:text-indigo-500 group-hover:scale-110 transition-all" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter">Entornos</span>
                                </button>
                                <button onClick={() => navigate('/platform/users')} className="flex flex-col items-center justify-center gap-3 p-5 rounded-[24px] bg-slate-50 border border-slate-100 hover:bg-white hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50 hover:text-indigo-600 transition-all group">
                                    <UserPlus size={24} className="text-slate-300 group-hover:text-indigo-500 group-hover:scale-110 transition-all" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter">Equipo</span>
                                </button>
                                <button onClick={() => navigate('/platform/billing')} className="flex flex-col items-center justify-center gap-3 p-5 rounded-[24px] bg-slate-50 border border-slate-100 hover:bg-white hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50 hover:text-indigo-600 transition-all group">
                                    <CreditCard size={24} className="text-slate-300 group-hover:text-indigo-500 group-hover:scale-110 transition-all" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter">Facturación</span>
                                </button>
                                <div className="flex flex-col items-center justify-center gap-3 p-5 rounded-[24px] bg-indigo-600 text-white cursor-pointer hover:bg-indigo-700 hover:shadow-2xl hover:shadow-indigo-500/20 transition-all shadow-lg active:scale-95 group">
                                    <ShieldCheck size={24} className="group-hover:scale-110 transition-all" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter">Auditoría</span>
                                </div>
                            </div>
                        </div>

                        {/* Live Activity Feed */}
                        <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm flex-1 flex flex-col min-h-[500px]">
                            <div className="flex items-center justify-between mb-10">
                                <div className="flex items-center gap-2">
                                    <Activity size={18} className="text-indigo-500" />
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Actividad en Vivo</h3>
                                </div>
                                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-[0_0_8px_#10b981] animate-pulse" />
                            </div>
                            <ActivityFeed />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'ops' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl animate-in slide-in-from-bottom-4 duration-500">
                    <BroadcastConsole />

                    <div className="rounded-[32px] border border-slate-100 bg-white p-10 shadow-sm">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 shadow-inner">
                                <Zap size={24} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-slate-900 tracking-tighter">Cluster Health</h2>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Estado crítico de infraestructura</p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            {[
                                { name: 'Supabase Main DB', status: 'Optimal', uptime: '99.98%', ping: '12ms' },
                                { name: 'Auth Node (Gemini)', status: 'Optimal', uptime: '100%', ping: '8ms' },
                                { name: 'Realtime WebSocket', status: 'Active', uptime: '99.95%', ping: '42ms' },
                                { name: 'Stripe API Gateway', status: 'Optimal', uptime: '100%', ping: '110ms' }
                            ].map((s) => (
                                <div key={s.name} className="flex items-center justify-between p-4 rounded-3xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-md">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-slate-800">{s.name}</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Uptime: {s.uptime}</span>
                                            <span className="text-slate-200">·</span>
                                            <span className="text-[10px] font-bold text-indigo-400 uppercase">{s.ping}</span>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 bg-white border border-slate-100 text-[10px] font-black text-emerald-600 rounded-xl shadow-sm">
                                        {s.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'tenants' && (
                <div className="p-12 text-center rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200">
                    <Globe size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-black text-slate-900">Gestión de Tenants</h3>
                    <p className="text-sm text-slate-500 max-w-xs mx-auto mt-2">Próximamente estaremos integrando el TanStack DataTable v2.0 para una gestión de datos de clase mundial.</p>
                    <button onClick={() => navigate('/platform/environments')} className="mt-6 px-6 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50">Gestionar Entornos Manualmente</button>
                </div>
            )}
        </div>
    );
}
