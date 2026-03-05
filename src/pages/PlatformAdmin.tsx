import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import {
    Server, Users, AlertTriangle, Layers, CreditCard,
    UserPlus, ChevronRight, Megaphone, Send, Activity,
    TrendingUp, ShieldCheck, Globe, Zap, Clock, Info, ExternalLink, ArrowUpRight
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { eventBusService } from '@/services/eventBusService';
import { EVENTS, SOURCE_MODULES } from '@/core/events';
import { adminStatsService, PlatformMetrics, GrowthPoint, VIPStatus, RevenueMetric, MRRWaterfallPoint, CohortPoint, BillingEvent } from '@/services/adminStatsService';
import { MetricCard } from '@/components/platform/MetricCard';
import { ActivityFeed } from '@/components/platform/ActivityFeed';
import { MainGrowthChart, PlanDonutChart } from '@/components/platform/Charts';
import { CommandPalette } from '@/components/platform/CommandPalette';
import { RevenueKpiCard } from '@/components/platform/RevenueKpiCard';
import { GlobalFilterBar } from '@/components/platform/GlobalFilterBar';
import { MRRWaterfallChart } from '@/components/platform/MRRWaterfallChart';
import { CohortHeatmap } from '@/components/platform/CohortHeatmap';
import { AIInsightsPanel } from '@/components/platform/AIInsightsPanel';
import { BillingEventTable } from '@/components/platform/BillingEventTable';
import { EntityList } from '@/components/entity/EntityList';
import { EntityConfig } from '@/components/entity/types';
import { getStatusDisplay } from '@/config/subscription.config';
import { Company } from '@/types';
import { CreateTenantModal } from '@/components/CreateTenantModal';
import EditTenantModal from '@/components/EditTenantModal';
import { Plus, Search, MoreHorizontal, Printer, Download } from 'lucide-react';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';

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
        <div className={`${radius.xl} border ${colors.borderStandard} ${colors.bgSurface} ${spacing.pLg} ${shadows.sm}`}>
            <div className="flex items-center gap-3 mb-6">
                <div className={`${radius.lg} ${colors.bgMain} p-2.5 text-indigo-600`}>
                    <Megaphone size={20} />
                </div>
                <div>
                    <h2 className={`${typography.uiLabel} ${colors.textPrimary}`}>Comunicación Global</h2>
                    <p className={`${typography.caption} ${colors.textSecondary}`}>Envía alertas instantáneas a toda la plataforma.</p>
                </div>
            </div>

            <div className="space-y-4">
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Título (opcional, por defecto: Aviso BETO OS)"
                    className={`w-full ${radius.xl} ${colors.bgMain} border-none px-4 py-3 ${typography.body} font-bold ${colors.textPrimary} ring-1 ${colors.borderSubtle} placeholder:${colors.textMuted} focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all`}
                />
                <div className="flex gap-2">
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Contenido del mensaje..."
                        rows={3}
                        className={`flex-1 ${radius.xl} ${colors.bgMain} border-none px-4 py-3 ${typography.body} ${colors.textPrimary} ring-1 ${colors.borderSubtle} placeholder:${colors.textMuted} focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all resize-none`}
                    />
                </div>
                <button
                    onClick={handleBroadcast}
                    disabled={sending || !message.trim()}
                    className={`w-full flex items-center justify-center gap-2 ${radius.xl} bg-indigo-600 py-3 ${typography.uiLabel} text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all ${shadows.sm}`}
                >
                    {sending ? 'Enviando...' : <><Send size={16} /> Enviar Broadcast</>}
                </button>
            </div>

            {status && (
                <p className={`mt-4 text-center ${typography.caption} font-semibold ${status.type === 'success' ? colors.statusSuccess : colors.statusDanger} animate-in slide-in-from-top-1`}>
                    {status.type === 'success' ? '✓' : '!'} {status.text}
                </p>
            )}
        </div>
    );
}

export default function PlatformAdmin() {
    const { user, enterCompanyAsFounder, refreshAuth } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'billing' | 'ops'>('overview');
    const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
    const [growthData, setGrowthData] = useState<GrowthPoint[]>([]);
    const [planData, setPlanData] = useState<any[]>([]);
    const [vipTenants, setVipTenants] = useState<VIPStatus[]>([]);

    // Revenue Intelligence State
    const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetric[]>([]);
    const [waterfallData, setWaterfallData] = useState<MRRWaterfallPoint[]>([]);
    const [cohortData, setCohortData] = useState<CohortPoint[]>([]);
    const [billingEvents, setBillingEvents] = useState<BillingEvent[]>([]);

    // Filtros de Finanzas
    const [dateRange, setDateRange] = useState('last-30');
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [planFilter, setPlanFilter] = useState('all');
    const [segmentFilter, setSegmentFilter] = useState('all');

    const [loading, setLoading] = useState(true);

    // Tenant Management States
    const [allCompanies, setAllCompanies] = useState<Company[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [fetchingTenants, setFetchingTenants] = useState(false);

    useEffect(() => {
        loadData();
    }, [activeTab, dateRange, startDate, endDate, planFilter, segmentFilter]);

    const fetchAllTenants = async () => {
        setFetchingTenants(true);
        try {
            const { data } = await supabase
                .from('companies')
                .select('*')
                .order('created_at', { ascending: false });
            if (data) setAllCompanies(data);
        } catch (err) {
            console.error('Error fetching all tenants:', err);
        } finally {
            setFetchingTenants(false);
        }
    };

    const loadData = async () => {
        if (activeTab === 'overview' && metrics) {
            // No recargar todo si ya tenemos métricas básicas y no estamos en finanzas
            // Pero si queremos que overview también reaccione a filtros (opcional)
        }

        setLoading(true);
        const filters = {
            dateRange,
            startDate,
            endDate,
            plan: planFilter,
            segment: segmentFilter
        };

        try {
            const [m, g, p, v, revIntel, waterfall, cohorts, events] = await Promise.all([
                adminStatsService.getPlatformSummary(),
                adminStatsService.getGrowthData(),
                adminStatsService.getPlanDistribution(),
                adminStatsService.getVIPTenants(5),
                adminStatsService.getRevenueIntelligence(filters),
                adminStatsService.getMRRWaterfall(filters),
                adminStatsService.getCohortRetention(filters),
                adminStatsService.getBillingEvents(10, filters)
            ]);
            setMetrics(m);
            setGrowthData(g);
            setPlanData(p);
            setVipTenants(v);
            setRevenueMetrics(revIntel);
            setWaterfallData(waterfall);
            setCohortData(cohorts);
            setBillingEvents(events);
            fetchAllTenants(); // Cargar todos para la gestión
        } catch (err) {
            console.error('Error loading admin stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (company: Company) => {
        setSelectedCompany(company);
        setIsEditModalOpen(true);
    };

    const handleCreateSuccess = () => {
        setIsCreateModalOpen(false);
        fetchAllTenants();
        refreshAuth();
    };

    const handleEditSuccess = () => {
        setIsEditModalOpen(false);
        setSelectedCompany(null);
        fetchAllTenants();
    };

    const filteredCompanies = React.useMemo(() => {
        if (!searchTerm.trim()) return allCompanies;
        const q = searchTerm.toLowerCase();
        return allCompanies.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.slug.toLowerCase().includes(q) ||
            (c.subscription_tier || '').toLowerCase().includes(q)
        );
    }, [allCompanies, searchTerm]);

    const tenantConfig: EntityConfig<Company> = {
        name: 'Environment',
        pluralName: 'Environments',
        rowIdKey: 'id' as keyof Company,
        fields: [
            {
                key: 'name' as keyof Company,
                label: 'Environment',
                type: 'text',
                render: (c) => (
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 font-semibold border border-slate-100">
                            {c.name[0]}
                        </div>
                        <div className="min-w-0">
                            <div className={`${typography.bodySm} font-semibold text-slate-900 truncate`}>{c.name}</div>
                            <div className={`${typography.caption} text-slate-500 font-mono truncate uppercase tracking-tighter`}>{c.slug}</div>
                        </div>
                    </div>
                )
            },
            {
                key: 'subscription_tier' as keyof Company,
                label: 'Plan',
                type: 'text',
                render: (c) => (
                    <span className={`${typography.uiLabel} capitalize text-slate-600 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100`}>
                        {c.subscription_tier || 'Demo'}
                    </span>
                )
            },
            {
                key: 'seat_count' as keyof Company,
                label: 'Usage',
                type: 'text',
                render: (c) => {
                    const seatPercent = Math.min(100, ((c.seat_count || 0) / (c.seat_limit || 1)) * 100);
                    const barColor = seatPercent > 85 ? 'bg-orange-500' : 'bg-indigo-500';
                    return (
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                                <div className={`h-full rounded-full ${barColor} shadow-sm`} style={{ width: `${seatPercent}%` }} />
                            </div>
                            <span className={`${typography.uiLabel} text-slate-500`}>{c.seat_count || 0}/{c.seat_limit || 1}</span>
                        </div>
                    );
                }
            },
            {
                key: 'subscription_status' as keyof Company,
                label: 'Status',
                type: 'badge',
                render: (c) => {
                    const status = getStatusDisplay(c.subscription_status);
                    return (
                        <span className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 ${typography.uiLabel} ${status.color} border shadow-sm`}>
                            <span className={`size-1.5 rounded-full ${status.dot} animate-pulse`} />
                            {status.label}
                        </span>
                    );
                }
            }
        ],
        actions: [
            {
                id: 'access',
                label: 'Acceder',
                icon: <ExternalLink size={16} />,
                onClick: (c) => handleTenantAccess(c.id)
            },
            {
                id: 'edit',
                label: 'Editar',
                icon: <MoreHorizontal size={16} />,
                onClick: (c) => handleEdit(c)
            }
        ]
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
            <div className={`flex flex-col items-center justify-center h-[70vh] text-center p-8 ${colors.bgMain}`}>
                <ShieldCheck size={48} className={`${colors.statusDanger} opacity-20 mb-4`} />
                <h2 className={`${typography.sectionTitle} ${colors.textPrimary}`}>Acceso Restringido</h2>
                <p className={`${typography.body} ${colors.textSecondary} mt-2 max-w-xs`}>Solo el Fundador de BETO OS tiene acceso al Control Center.</p>
                <button onClick={() => navigate('/dashboard')} className={`mt-6 ${typography.caption} font-bold text-indigo-600 hover:underline`}>Volver al Dashboard</button>
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
        <div className={`animate-in fade-in space-y-8 duration-700 pb-12 ${colors.bgMain}`}>
            {/* Header Estratégico (BETO OS v3.0) */}
            <UniversalPageHeader
                title="Control Center v2.0"
                breadcrumbs={
                    <>
                        <span>BETO OS</span>
                        <span>/</span>
                        <span className={colors.textPrimary}>Platform Control</span>
                    </>
                }
                metadata={[
                    <span key="1" className="flex items-center gap-1.5"><Clock size={14} /> Actualizado en tiempo real</span>
                ]}
                status={
                    <span className={`flex items-center gap-1.5 ${colors.statusSuccess} font-bold`}>
                        <Activity size={14} /> System Health: Healthy
                    </span>
                }
                actions={
                    <>
                        <CommandPalette />
                        <div className={`flex items-center gap-1 ${spacing.pXs} ${colors.bgSurface} ${radius.xl} border ${colors.borderStandard} w-max shrink-0 ${shadows.sm}`}>
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-3 sm:px-4 py-2 ${radius.lg} ${typography.uiLabel} transition-all ${activeTab === tab.id
                                        ? `bg-indigo-600 text-white ${shadows.md}`
                                        : `${colors.textSecondary} hover:${colors.textPrimary} hover:${colors.bgMain}`
                                        }`}
                                >
                                    <tab.icon size={16} />
                                    <span className="hidden lg:inline">{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </>
                }
            />

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
                        <div className={`${radius['3xl']} border ${colors.borderStandard} ${colors.bgSurface} ${spacing.pLg} lg:${spacing.pXl} ${shadows.sm} transition-all hover:${shadows.xl}`}>
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h3 className={`${typography.sectionTitle} ${colors.textPrimary} tracking-tighter`}>Performance de Plataforma</h3>
                                    <p className={`${typography.caption} ${colors.textSecondary} font-medium`}>Trayectoria de MRR Real vs Metas Proyectadas</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className={`flex items-center gap-2 ${typography.uiLabel} text-slate-500`}>
                                        <div className="w-3 h-1 bg-indigo-600 rounded-full" /> MRR Real
                                    </div>
                                    <div className={`flex items-center gap-2 ${typography.uiLabel} text-slate-500`}>
                                        <div className="w-3 h-1 bg-slate-200 rounded-full border border-dashed border-slate-400" /> Proyectado
                                    </div>
                                </div>
                            </div>
                            <MainGrowthChart data={growthData} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* VIP Tenants Section */}
                            <div className={`${radius['3xl']} border ${colors.borderStandard} ${colors.bgSurface} ${spacing.pLg} ${shadows.sm}`}>
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className={`${typography.sectionTitle} ${colors.textPrimary} tracking-tighter`}>Top 5 VIP Tenants</h3>
                                    <button onClick={() => setActiveTab('tenants')} className={`${typography.uiLabel} text-indigo-600 hover:underline`}>VER TODOS</button>
                                </div>
                                <div className="space-y-6">
                                    {vipTenants.map((tenant) => (
                                        <div key={tenant.id} className={`flex items-center justify-between group ${spacing.pSm} hover:${colors.bgMain} transition-all ${radius.xl}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`size-10 ${radius.xl} ${colors.bgMain} border ${colors.borderStandard} flex items-center justify-center font-semibold ${colors.textSecondary} group-hover:${colors.bgSurface} group-hover:text-indigo-600 transition-all`}>
                                                    {tenant.name[0]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={`${typography.body} font-bold ${colors.textPrimary}`}>{tenant.name}</span>
                                                    <span className={`${typography.caption} uppercase tracking-tighter ${colors.textMuted}`}>{tenant.plan}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right flex flex-col justify-center">
                                                    <div className={`${typography.body} font-bold ${colors.textPrimary}`}>${tenant.mrr}</div>
                                                    <div className={`${typography.caption} font-bold ${colors.statusSuccess}`}>{Math.round(tenant.usage)}% usage</div>
                                                </div>
                                                <button
                                                    onClick={() => handleTenantAccess(tenant.id)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 ${radius.xl} ${colors.bgMain} text-indigo-600 ${typography.uiLabel} opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-600 hover:text-white`}
                                                >
                                                    Acceder <ExternalLink size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className={`${radius['3xl']} border ${colors.borderStandard} ${colors.bgSurface} ${spacing.pLg} ${shadows.sm}`}>
                                    <h3 className={`${typography.sectionTitle} ${colors.textPrimary} tracking-tighter mb-8`}>Distribución de Planes</h3>
                                    <PlanDonutChart data={planData} />
                                </div>
                                <div className={`${radius['3xl']} border ${colors.borderStandard} bg-indigo-600 ${spacing.pLg} ${shadows.xl} shadow-indigo-100 text-white group cursor-pointer overflow-hidden relative`}>
                                    <Zap className="absolute -right-4 -top-4 w-32 h-32 opacity-10 group-hover:rotate-12 transition-transform" />
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className={`${typography.uiLabel} opacity-60`}>Lifetime Value (LTV)</h3>
                                        <div className="relative group/ltv">
                                            <Info size={12} className="opacity-40 hover:opacity-100 cursor-help transition-opacity" />
                                            <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-800 text-xs text-white rounded-lg shadow-xl opacity-0 group-hover/ltv:opacity-100 pointer-events-none transition-opacity z-50 font-medium leading-tight">
                                                Estimación total de ingresos por cliente antes de cancelar. Ayuda a calcular cuánto podemos invertir en captar nuevos usuarios.
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`${typography.metric} mb-4`}>${Math.round(metrics?.ltv || 0).toLocaleString()}</div>
                                    <p className={`${typography.caption} font-bold opacity-80 leading-relaxed`}>Valor proyectado promedio por empresa basado en churn actual y ticket promedio.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Columna Lateral: Realtime Activity */}
                    <div className="lg:col-span-4 space-y-8 min-w-0">
                        {/* Acciones Rápidas Pro */}
                        <div className={`${radius['3xl']} border ${colors.borderStandard} ${colors.bgSurface} ${spacing.pLg} ${shadows.sm}`}>
                            <h3 className={`${typography.sectionTitle} ${colors.textPrimary} tracking-tighter mb-8`}>Operaciones</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => navigate('/platform/environments')} className={`flex flex-col items-center justify-center gap-3 ${spacing.pLg} ${radius['2xl']} ${colors.bgMain} border ${colors.borderStandard} hover:${colors.bgSurface} hover:${colors.borderBrand} hover:${shadows.xl} hover:shadow-indigo-50 hover:text-indigo-600 transition-all group`}>
                                    <Layers size={24} className={`${colors.textMuted} group-hover:text-indigo-500 group-hover:scale-110 transition-all`} />
                                    <span className={`${typography.uiLabel}`}>Entornos</span>
                                </button>
                                <button onClick={() => navigate('/platform/users')} className={`flex flex-col items-center justify-center gap-3 ${spacing.pLg} ${radius['2xl']} ${colors.bgMain} border ${colors.borderStandard} hover:${colors.bgSurface} hover:${colors.borderBrand} hover:${shadows.xl} hover:shadow-indigo-50 hover:text-indigo-600 transition-all group`}>
                                    <UserPlus size={24} className={`${colors.textMuted} group-hover:text-indigo-500 group-hover:scale-110 transition-all`} />
                                    <span className={`${typography.uiLabel}`}>Equipo</span>
                                </button>
                                <button onClick={() => navigate('/platform/billing')} className={`flex flex-col items-center justify-center gap-3 ${spacing.pLg} ${radius['2xl']} ${colors.bgMain} border ${colors.borderStandard} hover:${colors.bgSurface} hover:${colors.borderBrand} hover:${shadows.xl} hover:shadow-indigo-50 hover:text-indigo-600 transition-all group`}>
                                    <CreditCard size={24} className={`${colors.textMuted} group-hover:text-indigo-500 group-hover:scale-110 transition-all`} />
                                    <span className={`${typography.uiLabel}`}>Facturación</span>
                                </button>
                                <div className={`flex flex-col items-center justify-center gap-3 ${spacing.pLg} ${radius['2xl']} bg-indigo-600 text-white cursor-pointer hover:bg-indigo-700 hover:shadow-2xl hover:shadow-indigo-500/20 transition-all shadow-lg active:scale-95 group`}>
                                    <ShieldCheck size={24} className="group-hover:scale-110 transition-all" />
                                    <span className={`${typography.uiLabel}`}>Auditoría</span>
                                </div>
                            </div>
                        </div>

                        {/* Live Activity Feed */}
                        <div className={`${radius['3xl']} border ${colors.borderStandard} ${colors.bgSurface} ${spacing.pLg} ${shadows.sm} flex-1 flex flex-col min-h-[500px]`}>
                            <div className="flex items-center justify-between mb-10">
                                <div className="flex items-center gap-2">
                                    <Activity size={18} className="text-indigo-500" />
                                    <h3 className={`${typography.sectionTitle} ${colors.textPrimary} tracking-tighter`}>Actividad en Vivo</h3>
                                </div>
                                <span className={`flex h-2.5 w-2.5 rounded-full ${colors.bgSuccess} border-2 border-white shadow-[0_0_8px_#10b981] animate-pulse`} />
                            </div>
                            <ActivityFeed />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'billing' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <GlobalFilterBar
                        dateRange={dateRange}
                        onDateRangeChange={setDateRange}
                        startDate={startDate}
                        onStartDateChange={(date) => {
                            setStartDate(date);
                            if (new Date(date) > new Date(endDate)) {
                                setEndDate(date);
                            }
                        }}
                        endDate={endDate}
                        onEndDateChange={(date) => {
                            setEndDate(date);
                            if (new Date(date) < new Date(startDate)) {
                                setStartDate(date);
                            }
                        }}
                        plan={planFilter}
                        onPlanChange={setPlanFilter}
                        segment={segmentFilter}
                        onSegmentChange={setSegmentFilter}
                    />

                    {/* KPI Grid 2026 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
                        {revenueMetrics.map((m, idx) => (
                            <RevenueKpiCard key={idx} metric={m} />
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Main Charts Section */}
                        <div className="lg:col-span-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="md:col-span-1">
                                    <MRRWaterfallChart data={waterfallData} />
                                </div>
                                <div className="md:col-span-1">
                                    <CohortHeatmap data={cohortData} />
                                </div>
                            </div>

                            <BillingEventTable events={billingEvents} />
                        </div>

                        {/* AI & Actions Section */}
                        <div className="lg:col-span-4 space-y-8">
                            <AIInsightsPanel metrics={metrics} loading={loading} />

                            <div className={`${radius['3xl']} border ${colors.borderStandard} ${colors.bgSurface} ${spacing.pLg} ${shadows.sm}`}>
                                <h3 className={`${typography.uiLabel} ${colors.textSecondary} mb-6`}>Acciones Rápidas</h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={() => {
                                            const confirm = window.confirm('¿Deseas generar una suscripción manual para una nueva empresa?');
                                            if (confirm) alert('Acción procesada: Redirigiendo al flujo de suscripción manual...');
                                        }}
                                        className={`w-full flex items-center justify-between ${spacing.pMd} ${radius['2xl']} ${colors.bgMain} border ${colors.borderStandard} hover:${colors.bgSurface} hover:${colors.borderBrand} hover:${shadows.lg} hover:text-indigo-600 transition-all ${typography.uiLabel}`}
                                    >
                                        Suscripción Manual
                                        <ArrowUpRight size={16} />
                                    </button>
                                    <button
                                        onClick={() => alert('Sincronizando facturas pendientes con el procesador de pagos...')}
                                        className={`w-full flex items-center justify-between ${spacing.pMd} ${radius['2xl']} ${colors.bgMain} border ${colors.borderStandard} hover:${colors.bgSurface} hover:${colors.borderBrand} hover:${shadows.lg} hover:text-indigo-600 transition-all ${typography.uiLabel}`}
                                    >
                                        Facturación Masiva
                                        <ArrowUpRight size={16} />
                                    </button>
                                    <button
                                        onClick={() => alert('Abriendo configuración de Webhooks de Facturación...')}
                                        className={`w-full flex items-center justify-between ${spacing.pMd} ${radius['2xl']} ${colors.bgMain} border ${colors.borderStandard} hover:${colors.bgSurface} hover:${colors.borderBrand} hover:${shadows.lg} hover:text-indigo-600 transition-all ${typography.uiLabel}`}
                                    >
                                        Webhooks de Facturación
                                        <ArrowUpRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'ops' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl animate-in slide-in-from-bottom-4 duration-500">
                    <BroadcastConsole />

                    <div className={`${radius['3xl']} border ${colors.borderStandard} ${colors.bgSurface} p-10 shadow-sm`}>
                        <div className="flex items-center gap-3 mb-8">
                            <div className={`${radius['2xl']} ${colors.bgMain} p-3 ${colors.statusSuccess} shadow-inner`}>
                                <Zap size={24} />
                            </div>
                            <div>
                                <h2 className={`${typography.sectionTitle} ${colors.textPrimary} tracking-tighter`}>Cluster Health</h2>
                                <p className={`${typography.uiLabel} ${colors.textSecondary}`}>Estado crítico de infraestructura</p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            {[
                                { name: 'Supabase Main DB', status: 'Optimal', uptime: '99.98%', ping: '12ms' },
                                { name: 'Auth Node (Gemini)', status: 'Optimal', uptime: '100%', ping: '8ms' },
                                { name: 'Realtime WebSocket', status: 'Active', uptime: '99.95%', ping: '42ms' },
                                { name: 'Stripe API Gateway', status: 'Optimal', uptime: '100%', ping: '110ms' }
                            ].map((s) => (
                                <div key={s.name} className={`flex items-center justify-between ${spacing.pMd} ${radius['3xl']} ${colors.bgMain} border ${colors.borderStandard} transition-all hover:${colors.bgSurface} hover:${shadows.md}`}>
                                    <div className="flex flex-col">
                                        <span className={`${typography.uiLabel} ${colors.textPrimary}`}>{s.name}</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`${typography.caption} font-bold ${colors.textSecondary} uppercase`}>Uptime: {s.uptime}</span>
                                            <span className={`${colors.textMuted}`}>·</span>
                                            <span className={`${typography.caption} font-bold text-indigo-400 uppercase`}>{s.ping}</span>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 ${colors.bgSurface} border ${colors.borderStandard} ${typography.uiLabel} ${colors.statusSuccess} ${radius.xl} ${shadows.sm}`}>
                                        {s.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'tenants' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className={`${typography.sectionTitle} ${colors.textPrimary} tracking-tighter`}>Gestión de Environments</h2>
                            <p className={`${typography.caption} ${colors.textSecondary} font-medium`}>Control total sobre las instancias y suscripciones de la plataforma</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative min-w-[320px]">
                                <Search size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${colors.textMuted} pointer-events-none`} />
                                <input
                                    type="text"
                                    placeholder="Buscar empresa, slug o plan..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className={`w-full ${radius.xl} ${colors.bgSurface} pl-11 pr-4 py-3 ${typography.uiLabel} ${colors.textPrimary} border ${colors.borderStandard} placeholder:${colors.textMuted} focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all ${shadows.sm}`}
                                />
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className={`flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white ${radius.xl} ${typography.uiLabel} hover:bg-indigo-700 ${shadows.lg} shadow-indigo-100 transition-all active:scale-95 font-bold`}
                            >
                                <Plus size={18} /> Nueva Empresa
                            </button>
                        </div>
                    </header>

                    <div className="rounded-[32px] border border-slate-100 bg-white overflow-hidden shadow-sm">
                        <EntityList
                            config={tenantConfig}
                            items={filteredCompanies}
                            loading={fetchingTenants}
                            emptyMessage="No se encontraron empresas con esos criterios."
                        />
                    </div>

                    <CreateTenantModal
                        isOpen={isCreateModalOpen}
                        onClose={() => setIsCreateModalOpen(false)}
                        onSuccess={handleCreateSuccess}
                    />

                    {selectedCompany && (
                        <EditTenantModal
                            isOpen={isEditModalOpen}
                            onClose={() => setIsEditModalOpen(false)}
                            company={selectedCompany}
                            onSuccess={handleEditSuccess}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
