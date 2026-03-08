import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import {
    Server, Users, AlertTriangle, Layers, CreditCard,
    UserPlus, ChevronRight, Megaphone, Send, Activity,
    TrendingUp, ShieldCheck, Globe, Zap, Clock, Info, ExternalLink, ArrowUpRight, Tags
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
import { useStore } from '@/store';
import { EntityList } from '@/components/entity/EntityList';
import { EntityConfig } from '@/components/entity/types';
import { getPlanDisplay, getStatusDisplay } from '@/config/subscription.config';
import { Company } from '@/types';
import { CreateTenantModal } from '@/components/CreateTenantModal';
import EditTenantModal from '@/components/EditTenantModal';
import { Plus, Search, MoreHorizontal, Printer, Download } from 'lucide-react';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { Button } from '@/components/ui/Button';
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
                eventKey: EVENTS.SYSTEM_BROADCAST,
                sourceModule: SOURCE_MODULES.SYSTEM,
                payload: {
                    title: title.trim() || 'Aviso BETO OS',
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

// Subcomponente: Gestión de Taxonomías (BETO OS v2.0)
function TaxonomySection({
    materialTypes, uomCategories, unitsOfMeasure,
    addMaterialType, updateMaterialType, deleteMaterialType,
    addUomCategory, updateUomCategory, deleteUomCategory,
    addUnitOfMeasure, updateUnitOfMeasure, deleteUnitOfMeasure
}: any) {
    const [activeSubTab, setActiveSubTab] = useState<'types' | 'categories' | 'units'>('types');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [formData, setFormData] = useState<any>({});

    const handleSave = async () => {
        try {
            if (activeSubTab === 'types') {
                if (editingItem) await updateMaterialType(editingItem.id, formData.name);
                else await addMaterialType(formData.name);
            } else if (activeSubTab === 'categories') {
                if (editingItem) await updateUomCategory(editingItem.id, formData.name, formData.key);
                else await addUomCategory(formData.name, formData.key);
            } else if (activeSubTab === 'units') {
                if (!formData.name || !formData.symbol || !formData.category_id) {
                    alert('Por favor completa todos los campos obligatorios.');
                    return;
                }
                const factor = parseFloat(formData.conversion_factor);
                if (isNaN(factor) || factor <= 0) {
                    alert('El factor de conversión debe ser un número positivo.');
                    return;
                }
                const cleanData = { ...formData, conversion_factor: factor };
                if (editingItem) await updateUnitOfMeasure(editingItem.id, cleanData);
                else await addUnitOfMeasure(cleanData);
            }
            setIsAddModalOpen(false);
            setEditingItem(null);
            setFormData({});
        } catch (err) {
            alert('Error al guardar: ' + (err as any).message);
        }
    };

    const handleEdit = (item: any) => {
        setEditingItem(item);
        setFormData(item);
        setIsAddModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este elemento? Podría causar inconsistencias en datos existentes.')) return;
        try {
            if (activeSubTab === 'types') await deleteMaterialType(id);
            else if (activeSubTab === 'categories') await deleteUomCategory(id);
            else if (activeSubTab === 'units') await deleteUnitOfMeasure(id);
        } catch (err) {
            alert('Error al eliminar: ' + (err as any).message);
        }
    };

    const subTabs = [
        { id: 'types', label: 'Tipos de Material', icon: Layers },
        { id: 'categories', label: 'Categorías UOM', icon: TrendingUp },
        { id: 'units', label: 'Unidades de Medida', icon: Zap },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 w-full sm:w-max overflow-x-auto">
                    {subTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${typography.uiLabel} transition-all whitespace-nowrap ${activeSubTab === tab.id
                                ? 'bg-white text-indigo-600 shadow-sm font-bold'
                                : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>
                <Button
                    variant="primary"
                    icon={<Plus size={18} />}
                    onClick={() => { setEditingItem(null); setFormData({}); setIsAddModalOpen(true); }}
                >
                    Añadir {activeSubTab === 'types' ? 'Tipo' : activeSubTab === 'categories' ? 'Categoría' : 'Unidad'}
                </Button>
            </div>

            <SectionBlock>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className={`border-b ${colors.borderStandard}`}>
                            <tr>
                                <th className={`text-left py-4 px-4 ${typography.caption} font-bold ${colors.textSecondary} uppercase tracking-wider`}>Nombre</th>
                                {activeSubTab === 'categories' && <th className={`text-left py-4 px-4 ${typography.caption} font-bold ${colors.textSecondary} uppercase tracking-wider`}>Key</th>}
                                {activeSubTab === 'units' && (
                                    <>
                                        <th className={`text-left py-4 px-4 ${typography.caption} font-bold ${colors.textSecondary} uppercase tracking-wider`}>Símbolo</th>
                                        <th className={`text-left py-4 px-4 ${typography.caption} font-bold ${colors.textSecondary} uppercase tracking-wider`}>Factor</th>
                                        <th className={`text-left py-4 px-4 ${typography.caption} font-bold ${colors.textSecondary} uppercase tracking-wider`}>Categoría</th>
                                    </>
                                )}
                                <th className={`text-right py-4 px-4 ${typography.caption} font-bold ${colors.textSecondary} uppercase tracking-wider`}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(activeSubTab === 'types' ? materialTypes : activeSubTab === 'categories' ? uomCategories : unitsOfMeasure).map((item: any) => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-4 px-4">
                                        <span className={`${typography.bodySm} font-semibold text-slate-900`}>{item.name}</span>
                                        {activeSubTab === 'units' && item.is_base && (
                                            <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] uppercase font-bold border border-indigo-100">BASE</span>
                                        )}
                                    </td>
                                    {activeSubTab === 'categories' && <td className="py-4 px-4 font-mono text-xs text-slate-500">{item.key}</td>}
                                    {activeSubTab === 'units' && (
                                        <>
                                            <td className="py-4 px-4 font-mono text-xs text-slate-500">{item.symbol}</td>
                                            <td className="py-4 px-4 text-slate-600">{item.conversion_factor}</td>
                                            <td className="py-4 px-4 text-slate-500 text-xs">
                                                {uomCategories.find((c: any) => c.id === item.category_id)?.name || 'N/A'}
                                            </td>
                                        </>
                                    )}
                                    <td className="py-4 px-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleEdit(item)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><MoreHorizontal size={18} /></button>
                                            <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><AlertTriangle size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SectionBlock>

            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
                    <div className={`bg-white ${radius['3xl']} shadow-2xl w-full max-w-lg overflow-hidden border ${colors.borderStandard}`}>
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h2 className={`${typography.sectionTitle} text-slate-900`}>
                                {editingItem ? 'Editar' : 'Nueva'} {activeSubTab === 'types' ? 'Tipo de Material' : activeSubTab === 'categories' ? 'Categoría UOM' : 'Unidad de Medida'}
                            </h2>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className={`${typography.caption} font-bold text-slate-600 uppercase mb-2 block`}>Nombre</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className={`w-full ${radius.xl} bg-slate-50 border-none px-4 py-3 ${typography.body} text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all`}
                                />
                            </div>

                            {activeSubTab === 'categories' && (
                                <div>
                                    <label className={`${typography.caption} font-bold text-slate-600 uppercase mb-2 block`}>Key (Identificador técnico)</label>
                                    <input
                                        type="text"
                                        value={formData.key || ''}
                                        onChange={e => setFormData({ ...formData, key: e.target.value })}
                                        className={`w-full ${radius.xl} bg-slate-50 border-none px-4 py-3 ${typography.body} text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all`}
                                    />
                                </div>
                            )}

                            {activeSubTab === 'units' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={`${typography.caption} font-bold text-slate-600 uppercase mb-2 block`}>Símbolo</label>
                                        <input
                                            type="text"
                                            value={formData.symbol || ''}
                                            onChange={e => setFormData({ ...formData, symbol: e.target.value })}
                                            className="w-full rounded-xl bg-slate-50 border-none px-4 py-3 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className={`${typography.caption} font-bold text-slate-600 uppercase mb-2 block`}>Factor (Base=1)</label>
                                        <input
                                            type="number"
                                            value={formData.conversion_factor || ''}
                                            onChange={e => setFormData({ ...formData, conversion_factor: parseFloat(e.target.value) })}
                                            className="w-full rounded-xl bg-slate-50 border-none px-4 py-3 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                                            disabled={formData.is_base}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className={`${typography.caption} font-bold text-slate-600 uppercase mb-2 block`}>Categoría</label>
                                        <select
                                            value={formData.category_id || ''}
                                            onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                                            className="w-full rounded-xl bg-slate-50 border-none px-4 py-3 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">Seleccionar Categoría...</option>
                                            {uomCategories.map((c: any) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2 flex items-center gap-3 py-2">
                                        <input
                                            type="checkbox"
                                            id="is_base"
                                            checked={formData.is_base || false}
                                            onChange={e => {
                                                const isChecked = e.target.checked;
                                                const newFormData = { ...formData, is_base: isChecked };
                                                if (isChecked) {
                                                    newFormData.conversion_factor = 1;
                                                }
                                                setFormData(newFormData);
                                            }}
                                            className="size-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor="is_base" className={`${typography.bodySm} font-medium text-slate-700`}>Es Unidad Base (Factor = 1)</label>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className={`px-6 py-2.5 ${radius.xl} ${typography.uiLabel} text-slate-600 hover:bg-slate-200 transition-all`}>Cancelar</button>
                            <button onClick={handleSave} className={`px-8 py-2.5 ${radius.xl} ${typography.uiLabel} bg-indigo-600 text-white hover:bg-indigo-700 shadow-md active:scale-95 transition-all`}>Guardar Cambios</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PlatformAdmin() {
    const { user, enterCompanyAsFounder, refreshAuth } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'billing' | 'ops' | 'taxonomies'>('overview');
    const {
        materialTypes, uomCategories, unitsOfMeasure,
        addMaterialType, updateMaterialType, deleteMaterialType,
        addUomCategory, updateUomCategory, deleteUomCategory,
        addUnitOfMeasure, updateUnitOfMeasure, deleteUnitOfMeasure,
        loadUomMetadata
    } = useStore();
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

    useEffect(() => {
        if (activeTab === 'taxonomies') {
            loadUomMetadata();
        }
    }, [activeTab]);

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
        { id: 'taxonomies', label: 'Taxonomías', icon: Tags, isNew: true },
    ];

    return (
        <PageContainer className="space-y-8 pb-12">
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
                                    <span className="hidden sm:inline italic-none">{tab.label}</span>
                                    {(tab as any).isNew && (
                                        <span className="ml-1 size-1.5 rounded-full bg-rose-500 animate-pulse border border-white" />
                                    )}
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
                                progressValue={metrics?.churnRate || 0}
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
                                <div className="flex flex-wrap justify-end gap-x-6 gap-y-2">
                                    <div className={`flex items-center gap-2 ${typography.uiLabel} text-slate-500 whitespace-nowrap`}>
                                        <div className="w-3 h-1 bg-indigo-600 rounded-full" /> MRR Real
                                    </div>
                                    <div className={`flex items-center gap-2 ${typography.uiLabel} text-slate-500 whitespace-nowrap`}>
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
                                <div onClick={() => setActiveTab('taxonomies')} className={`flex flex-col items-center justify-center gap-3 ${spacing.pLg} ${radius['2xl']} ${colors.bgMain} border ${colors.borderStandard} hover:${colors.bgSurface} hover:${colors.borderBrand} hover:${shadows.xl} hover:shadow-indigo-50 hover:text-indigo-600 transition-all group cursor-pointer`}>
                                    <Tags size={24} className={`${colors.textMuted} group-hover:text-indigo-500 group-hover:scale-110 transition-all`} />
                                    <span className={`${typography.uiLabel}`}>Taxonomías</span>
                                </div>
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

            {activeTab === 'taxonomies' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <TaxonomySection
                        materialTypes={materialTypes}
                        uomCategories={uomCategories}
                        unitsOfMeasure={unitsOfMeasure}
                        addMaterialType={addMaterialType}
                        updateMaterialType={updateMaterialType}
                        deleteMaterialType={deleteMaterialType}
                        addUomCategory={addUomCategory}
                        updateUomCategory={updateUomCategory}
                        deleteUomCategory={deleteUomCategory}
                        addUnitOfMeasure={addUnitOfMeasure}
                        updateUnitOfMeasure={updateUnitOfMeasure}
                        deleteUnitOfMeasure={deleteUnitOfMeasure}
                    />
                </div>
            )}

            {activeTab === 'tenants' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                                    className={`w-full h-10 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl ${typography.text.body} transition-all focus:ring-2 focus:ring-indigo-500 focus:bg-white`}
                                />
                            </div>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setIsCreateModalOpen(true)}
                                icon={<Plus size={16} />}
                            >
                                <span className="hidden sm:inline">Nueva Empresa</span>
                            </Button>
                        </div>
                    </div>

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
        </PageContainer>
    );
}
