import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import {
    Server, Users, AlertTriangle, Layers, CreditCard,
    UserPlus, ChevronRight, Megaphone, Send, Activity,
    TrendingUp, ShieldCheck, Globe, Zap, Clock, ExternalLink, ArrowUpRight, Tags,
    Plus, Search, MoreHorizontal,
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
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { Button } from '@/components/ui/Button';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { TenantEngagementTable } from '@/components/platform/TenantEngagementTable';

/* ── Estilos reutilizables ── */
const card: React.CSSProperties = { borderRadius: 'var(--radius-2xl)', border: 'var(--border-default)', background: 'var(--surface-card)', padding: 'var(--space-24)', boxShadow: 'var(--shadow-sm)' };
const inset: React.CSSProperties = { borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', padding: 'var(--space-16)' };
const label: React.CSSProperties = { fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text-muted)' };
const sectionTitle: React.CSSProperties = { fontSize: 'var(--text-h3-size)', fontWeight: 700, color: 'var(--text-primary)' };

/* ── BroadcastConsole ── */
function BroadcastConsole() {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleBroadcast = async () => {
        if (!message.trim()) return;
        setSending(true); setStatus(null);
        try {
            await eventBusService.emitEvent({ eventKey: EVENTS.SYSTEM_BROADCAST, sourceModule: SOURCE_MODULES.SYSTEM, payload: { title: title.trim() || 'Aviso BETO OS', message: message.trim() } });
            setTitle(''); setMessage('');
            setStatus({ type: 'success', text: 'Mensaje global emitido con éxito.' });
            setTimeout(() => setStatus(null), 3000);
        } catch { setStatus({ type: 'error', text: 'Error al emitir mensaje.' }); }
        finally { setSending(false); }
    };

    const inputStyle: React.CSSProperties = { width: '100%', borderRadius: 'var(--radius-lg)', background: 'var(--surface-page)', border: 'none', padding: 'var(--space-12) var(--space-16)', fontSize: 'var(--text-body-size)', fontWeight: 700, color: 'var(--text-primary)', outline: 'none', boxShadow: '0 0 0 1px var(--border-color-default)', transition: 'box-shadow var(--transition-fast)' };

    return (
        <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', marginBottom: 'var(--space-24)' }}>
                <div style={{ borderRadius: 'var(--radius-lg)', background: 'var(--surface-primary-soft)', padding: 'var(--space-10)', color: 'var(--state-primary)' }}><Megaphone size={20} /></div>
                <div>
                    <h2 style={{ fontSize: 'var(--text-body-size)', fontWeight: 700, color: 'var(--text-primary)' }}>Comunicación Global</h2>
                    <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>Envía alertas instantáneas a toda la plataforma.</p>
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Título (opcional, por defecto: Aviso BETO OS)" style={inputStyle} onFocus={e => (e.target.style.boxShadow = '0 0 0 2px var(--state-primary)')} onBlur={e => (e.target.style.boxShadow = '0 0 0 1px var(--border-color-default)')} />
                <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Contenido del mensaje..." rows={3} style={{ ...inputStyle, resize: 'none' }} onFocus={e => (e.target.style.boxShadow = '0 0 0 2px var(--state-primary)')} onBlur={e => (e.target.style.boxShadow = '0 0 0 1px var(--border-color-default)')} />
                <button onClick={handleBroadcast} disabled={sending || !message.trim()}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)', borderRadius: 'var(--radius-lg)', background: 'var(--state-primary)', padding: 'var(--space-12)', fontSize: 'var(--text-body-size)', fontWeight: 700, color: 'var(--text-inverse)', border: 'none', cursor: 'pointer', opacity: (sending || !message.trim()) ? 0.5 : 1, transition: 'background var(--transition-fast)' }}
                    onMouseEnter={e => { if (!sending && message.trim()) e.currentTarget.style.background = 'var(--state-primary-hover)'; }}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--state-primary)')}>
                    {sending ? 'Enviando...' : <><Send size={16} /> Enviar Broadcast</>}
                </button>
            </div>
            {status && (
                <p style={{ marginTop: 'var(--space-16)', textAlign: 'center', fontSize: 'var(--text-caption-size)', fontWeight: 600, color: status.type === 'success' ? 'var(--state-success)' : 'var(--state-danger)' }}>
                    {status.type === 'success' ? '✓' : '!'} {status.text}
                </p>
            )}
        </div>
    );
}

/* ── TaxonomySection ── */
function TaxonomySection({ materialTypes, uomCategories, unitsOfMeasure, addMaterialType, updateMaterialType, deleteMaterialType, addUomCategory, updateUomCategory, deleteUomCategory, addUnitOfMeasure, updateUnitOfMeasure, deleteUnitOfMeasure }: any) {
    const [activeSubTab, setActiveSubTab] = useState<'types' | 'categories' | 'units'>('types');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [formData, setFormData] = useState<any>({});

    const handleSave = async () => {
        try {
            if (activeSubTab === 'types') { if (editingItem) await updateMaterialType(editingItem.id, formData.name); else await addMaterialType(formData.name); }
            else if (activeSubTab === 'categories') { if (editingItem) await updateUomCategory(editingItem.id, formData.name, formData.key); else await addUomCategory(formData.name, formData.key); }
            else if (activeSubTab === 'units') {
                if (!formData.name || !formData.symbol || !formData.category_id) { alert('Por favor completa todos los campos obligatorios.'); return; }
                const factor = parseFloat(formData.conversion_factor);
                if (isNaN(factor) || factor <= 0) { alert('El factor de conversión debe ser un número positivo.'); return; }
                const cleanData = { ...formData, conversion_factor: factor };
                if (editingItem) await updateUnitOfMeasure(editingItem.id, cleanData); else await addUnitOfMeasure(cleanData);
            }
            setIsAddModalOpen(false); setEditingItem(null); setFormData({});
        } catch (err) { alert('Error al guardar: ' + (err as any).message); }
    };

    const handleEdit = (item: any) => { setEditingItem(item); setFormData(item); setIsAddModalOpen(true); };
    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este elemento?')) return;
        try {
            if (activeSubTab === 'types') await deleteMaterialType(id);
            else if (activeSubTab === 'categories') await deleteUomCategory(id);
            else if (activeSubTab === 'units') await deleteUnitOfMeasure(id);
        } catch (err) { alert('Error al eliminar: ' + (err as any).message); }
    };

    const subTabs = [{ id: 'types', label: 'Tipos de Material', icon: Layers }, { id: 'categories', label: 'Categorías UOM', icon: TrendingUp }, { id: 'units', label: 'Unidades de Medida', icon: Zap }];
    const inputStyle: React.CSSProperties = { width: '100%', borderRadius: 'var(--radius-lg)', background: 'var(--surface-page)', border: 'none', padding: 'var(--space-12) var(--space-16)', fontSize: 'var(--text-body-size)', color: 'var(--text-primary)', outline: 'none', boxShadow: '0 0 0 1px var(--border-color-default)', transition: 'box-shadow var(--transition-fast)' };
    const focusHandlers = { onFocus: (e: any) => (e.target.style.boxShadow = '0 0 0 2px var(--state-primary)'), onBlur: (e: any) => (e.target.style.boxShadow = '0 0 0 1px var(--border-color-default)') };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-16)' }}>
                <div style={{ display: 'flex', padding: 'var(--space-4)', background: 'var(--surface-muted)', borderRadius: 'var(--radius-lg)', border: 'var(--border-default)', overflowX: 'auto' }}>
                    {subTabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveSubTab(tab.id as any)}
                            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', padding: 'var(--space-8) var(--space-16)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-small-size)', fontWeight: 700, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background var(--transition-fast)', background: activeSubTab === tab.id ? 'var(--surface-card)' : 'transparent', color: activeSubTab === tab.id ? 'var(--state-primary)' : 'var(--text-muted)', boxShadow: activeSubTab === tab.id ? 'var(--shadow-sm)' : 'none' }}>
                            <tab.icon size={16} /> {tab.label}
                        </button>
                    ))}
                </div>
                <Button variant="primary" icon={<Plus size={18} />} onClick={() => { setEditingItem(null); setFormData({}); setIsAddModalOpen(true); }}>
                    Añadir {activeSubTab === 'types' ? 'Tipo' : activeSubTab === 'categories' ? 'Categoría' : 'Unidad'}
                </Button>
            </div>

            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead style={{ borderBottom: 'var(--border-default)' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: 'var(--space-16)', ...label }}>Nombre</th>
                                {activeSubTab === 'categories' && <th style={{ textAlign: 'left', padding: 'var(--space-16)', ...label }}>Key</th>}
                                {activeSubTab === 'units' && (<><th style={{ textAlign: 'left', padding: 'var(--space-16)', ...label }}>Símbolo</th><th style={{ textAlign: 'left', padding: 'var(--space-16)', ...label }}>Factor</th><th style={{ textAlign: 'left', padding: 'var(--space-16)', ...label }}>Categoría</th></>)}
                                <th style={{ textAlign: 'right', padding: 'var(--space-16)', ...label }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(activeSubTab === 'types' ? materialTypes : activeSubTab === 'categories' ? uomCategories : unitsOfMeasure).map((item: any, i: number) => (
                                <tr key={item.id} style={{ borderTop: i > 0 ? 'var(--border-default)' : 'none' }}>
                                    <td style={{ padding: 'var(--space-16)' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-small-size)' }}>{item.name}</span>
                                        {activeSubTab === 'units' && item.is_base && <span style={{ marginLeft: 'var(--space-8)', padding: '2px var(--space-6)', background: 'var(--surface-primary-soft)', color: 'var(--state-primary)', borderRadius: 'var(--radius-sm)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, border: '1px solid rgba(37,99,235,0.2)' }}>BASE</span>}
                                    </td>
                                    {activeSubTab === 'categories' && <td style={{ padding: 'var(--space-16)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>{item.key}</td>}
                                    {activeSubTab === 'units' && (<><td style={{ padding: 'var(--space-16)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>{item.symbol}</td><td style={{ padding: 'var(--space-16)', color: 'var(--text-secondary)', fontSize: 'var(--text-small-size)' }}>{item.conversion_factor}</td><td style={{ padding: 'var(--space-16)', color: 'var(--text-muted)', fontSize: 'var(--text-caption-size)' }}>{uomCategories.find((c: any) => c.id === item.category_id)?.name || 'N/A'}</td></>)}
                                    <td style={{ padding: 'var(--space-16)', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-8)' }}>
                                            <button onClick={() => handleEdit(item)} style={{ padding: 'var(--space-8)', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-md)', transition: 'background var(--transition-fast), color var(--transition-fast)' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-primary-soft)'; e.currentTarget.style.color = 'var(--state-primary)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}><MoreHorizontal size={18} /></button>
                                            <button onClick={() => handleDelete(item.id)} style={{ padding: 'var(--space-8)', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-md)', transition: 'background var(--transition-fast), color var(--transition-fast)' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-danger-soft)'; e.currentTarget.style.color = 'var(--state-danger)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}><AlertTriangle size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isAddModalOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)' as any, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-16)', background: 'var(--surface-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setIsAddModalOpen(false)}>
                    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-xl)', width: '100%', maxWidth: '32rem', overflow: 'hidden', border: 'var(--border-default)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: 'var(--space-24)', borderBottom: 'var(--border-default)', background: 'var(--surface-page)' }}>
                            <h2 style={sectionTitle}>{editingItem ? 'Editar' : 'Nueva'} {activeSubTab === 'types' ? 'Tipo de Material' : activeSubTab === 'categories' ? 'Categoría UOM' : 'Unidad de Medida'}</h2>
                        </div>
                        <div style={{ padding: 'var(--space-32)', display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
                            <div><label style={{ ...label, display: 'block', marginBottom: 'var(--space-8)' }}>Nombre</label><input type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} style={inputStyle} {...focusHandlers} /></div>
                            {activeSubTab === 'categories' && <div><label style={{ ...label, display: 'block', marginBottom: 'var(--space-8)' }}>Key (Identificador técnico)</label><input type="text" value={formData.key || ''} onChange={e => setFormData({ ...formData, key: e.target.value })} style={inputStyle} {...focusHandlers} /></div>}
                            {activeSubTab === 'units' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-16)' }}>
                                    <div><label style={{ ...label, display: 'block', marginBottom: 'var(--space-8)' }}>Símbolo</label><input type="text" value={formData.symbol || ''} onChange={e => setFormData({ ...formData, symbol: e.target.value })} style={inputStyle} {...focusHandlers} /></div>
                                    <div><label style={{ ...label, display: 'block', marginBottom: 'var(--space-8)' }}>Factor (Base=1)</label><input type="number" value={formData.conversion_factor || ''} onChange={e => setFormData({ ...formData, conversion_factor: parseFloat(e.target.value) })} style={{ ...inputStyle, opacity: formData.is_base ? 0.5 : 1 }} disabled={formData.is_base} {...focusHandlers} /></div>
                                    <div style={{ gridColumn: '1 / -1' }}><label style={{ ...label, display: 'block', marginBottom: 'var(--space-8)' }}>Categoría</label><select value={formData.category_id || ''} onChange={e => setFormData({ ...formData, category_id: e.target.value })} style={inputStyle}><option value="">Seleccionar Categoría...</option>{uomCategories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                                    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 'var(--space-12)', padding: 'var(--space-8) 0' }}>
                                        <input type="checkbox" id="is_base" checked={formData.is_base || false} onChange={e => { const isChecked = e.target.checked; setFormData({ ...formData, is_base: isChecked, ...(isChecked ? { conversion_factor: 1 } : {}) }); }} style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--state-primary)', cursor: 'pointer' }} />
                                        <label htmlFor="is_base" style={{ fontSize: 'var(--text-small-size)', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' }}>Es Unidad Base (Factor = 1)</label>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div style={{ padding: 'var(--space-24)', background: 'var(--surface-page)', borderTop: 'var(--border-default)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-12)' }}>
                            <button onClick={() => setIsAddModalOpen(false)} style={{ padding: 'var(--space-10) var(--space-24)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-small-size)', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', transition: 'background var(--transition-fast)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-muted)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>Cancelar</button>
                            <button onClick={handleSave} style={{ padding: 'var(--space-10) var(--space-32)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-small-size)', fontWeight: 700, color: 'var(--text-inverse)', background: 'var(--state-primary)', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-md)', transition: 'background var(--transition-fast)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--state-primary-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--state-primary)')}>Guardar Cambios</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── PlatformAdmin principal ── */
export default function PlatformAdmin() {
    const { user, enterCompanyAsFounder, refreshAuth } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedTab = searchParams.get('tab');
    const activeTab: 'overview' | 'tenants' | 'billing' | 'ops' | 'taxonomies' =
        requestedTab === 'tenants' || requestedTab === 'billing' || requestedTab === 'ops' || requestedTab === 'taxonomies' ? requestedTab : 'overview';

    const { materialTypes, uomCategories, unitsOfMeasure, addMaterialType, updateMaterialType, deleteMaterialType, addUomCategory, updateUomCategory, deleteUomCategory, addUnitOfMeasure, updateUnitOfMeasure, deleteUnitOfMeasure, loadUomMetadata } = useStore();

    const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
    const [growthData, setGrowthData] = useState<GrowthPoint[]>([]);
    const [planData, setPlanData] = useState<any[]>([]);
    const [vipTenants, setVipTenants] = useState<VIPStatus[]>([]);
    const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetric[]>([]);
    const [waterfallData, setWaterfallData] = useState<MRRWaterfallPoint[]>([]);
    const [cohortData, setCohortData] = useState<CohortPoint[]>([]);
    const [billingEvents, setBillingEvents] = useState<BillingEvent[]>([]);
    const [dateRange, setDateRange] = useState('last-30');
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [planFilter, setPlanFilter] = useState('all');
    const [segmentFilter, setSegmentFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [allCompanies, setAllCompanies] = useState<Company[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [fetchingTenants, setFetchingTenants] = useState(false);

    const changeTab = (tab: typeof activeTab) => setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('tab', tab); return next; }, { replace: true });

    useEffect(() => { loadData(); }, [activeTab, dateRange, startDate, endDate, planFilter, segmentFilter]);
    useEffect(() => { if (activeTab === 'taxonomies') loadUomMetadata(); }, [activeTab]);

    const fetchAllTenants = async () => {
        setFetchingTenants(true);
        try { const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false }); if (data) setAllCompanies(data); }
        catch (err) { console.error('Error fetching all tenants:', err); }
        finally { setFetchingTenants(false); }
    };

    const loadData = async () => {
        setLoading(true);
        const filters = { dateRange, startDate, endDate, plan: planFilter, segment: segmentFilter };
        try {
            const [m, g, p, v, revIntel, waterfall, cohorts, events] = await Promise.all([
                adminStatsService.getPlatformSummary(), adminStatsService.getGrowthData(), adminStatsService.getPlanDistribution(), adminStatsService.getVIPTenants(5),
                adminStatsService.getRevenueIntelligence(filters), adminStatsService.getMRRWaterfall(filters), adminStatsService.getCohortRetention(filters), adminStatsService.getBillingEvents(10, filters),
            ]);
            setMetrics(m); setGrowthData(g); setPlanData(p); setVipTenants(v);
            setRevenueMetrics(revIntel); setWaterfallData(waterfall); setCohortData(cohorts); setBillingEvents(events);
            fetchAllTenants();
        } catch (err) { console.error('Error loading admin stats:', err); }
        finally { setLoading(false); }
    };

    const handleEdit = (company: Company) => { setSelectedCompany(company); setIsEditModalOpen(true); };
    const handleCreateSuccess = () => { setIsCreateModalOpen(false); fetchAllTenants(); refreshAuth(); };
    const handleEditSuccess = () => { setIsEditModalOpen(false); setSelectedCompany(null); fetchAllTenants(); };
    const handleTenantAccess = async (companyId: string) => { try { await enterCompanyAsFounder(companyId); navigate('/dashboard'); } catch (err) { console.error('Error accessing tenant:', err); } };

    const filteredCompanies = React.useMemo(() => {
        if (!searchTerm.trim()) return allCompanies;
        const q = searchTerm.toLowerCase();
        return allCompanies.filter(c => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q) || (c.subscription_tier || '').toLowerCase().includes(q));
    }, [allCompanies, searchTerm]);

    const tenantConfig: EntityConfig<Company> = {
        name: 'Environment', pluralName: 'Environments', rowIdKey: 'id' as keyof Company,
        fields: [
            {
                key: 'name' as keyof Company, label: 'Environment', type: 'text',
                render: (c) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface-muted)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, border: 'var(--border-default)' }}>{c.name[0]}</div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-small-size)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.slug}</div>
                        </div>
                    </div>
                )
            },
            {
                key: 'subscription_tier' as keyof Company, label: 'Plan', type: 'text',
                render: (c) => <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'capitalize', color: 'var(--text-secondary)', padding: 'var(--space-4) var(--space-8)', background: 'var(--surface-page)', borderRadius: 'var(--radius-md)', border: 'var(--border-default)' }}>{c.subscription_tier || 'Demo'}</span>
            },
            {
                key: 'seat_count' as keyof Company, label: 'Usage', type: 'text',
                render: (c) => { const pct = Math.min(100, ((c.seat_count || 0) / (c.seat_limit || 1)) * 100); return (<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}><div style={{ height: '0.375rem', width: '4rem', borderRadius: 'var(--radius-full)', background: 'var(--surface-muted)', overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 'var(--radius-full)', background: pct > 85 ? 'var(--state-danger)' : 'var(--state-primary)', width: `${pct}%` }} /></div><span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--text-muted)' }}>{c.seat_count || 0}/{c.seat_limit || 1}</span></div>); }
            },
            {
                key: 'subscription_status' as keyof Company, label: 'Status', type: 'badge',
                render: (c) => { const status = getStatusDisplay(c.subscription_status); return (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-6)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4) var(--space-10)', fontSize: 'var(--text-caption-size)', fontWeight: 700, color: status.color.includes('emerald') ? 'var(--state-success)' : status.color.includes('amber') ? 'var(--state-warning)' : status.color.includes('red') ? 'var(--state-danger)' : 'var(--text-secondary)', border: 'var(--border-default)', boxShadow: 'var(--shadow-sm)' }}><span style={{ width: '0.375rem', height: '0.375rem', borderRadius: '50%', background: 'currentColor' }} />{status.label}</span>); }
            },
        ],
        actions: [
            { id: 'access', label: 'Acceder', icon: <ExternalLink size={16} />, onClick: (c) => handleTenantAccess(c.id) },
            { id: 'edit', label: 'Editar', icon: <MoreHorizontal size={16} />, onClick: (c) => handleEdit(c) },
        ],
    };

    if (!user?.is_super_admin) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', textAlign: 'center', padding: 'var(--space-32)' }}>
                <ShieldCheck size={48} style={{ color: 'var(--state-danger)', opacity: 0.2, marginBottom: 'var(--space-16)' }} />
                <h2 style={sectionTitle}>Acceso Restringido</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-8)', maxWidth: '20rem' }}>Solo el Fundador de BETO OS tiene acceso al Control Center.</p>
                <button onClick={() => navigate('/dashboard')} style={{ marginTop: 'var(--space-24)', fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--state-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Volver al Dashboard</button>
            </div>
        );
    }

    return (
        <PageContainer style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-32)', paddingBottom: 'var(--space-48)' }}>
            <UniversalPageHeader
                title="Consola de Plataforma"
                breadcrumbs={<><span>BETO OS</span><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Platform Control</span></>}
                metadata={[<span key="1" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-6)' }}><Clock size={14} /> Actualizado en tiempo real</span>]}
                status={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-6)', color: 'var(--state-success)', fontWeight: 700 }}><Activity size={14} /> System Health: Healthy</span>}
                actions={<CommandPalette />}
            />

            {/* Overview */}
            {activeTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) 22rem', gap: 'var(--space-32)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-32)', minWidth: 0 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-24)' }}>
                            {[
                                { label: 'MRR actual', value: `$${metrics?.totalMRR.toLocaleString()}`, sub: 'Ingreso recurrente mensual estabilizado.', delta: '+15.2%', positive: true },
                                { label: 'Tenants activos', value: `${metrics?.activeTenants || 0}`, sub: 'Empresas facturando o usando la plataforma.', delta: `+${metrics?.newTenantsMonth || 0}`, positive: true },
                                { label: 'Churn mensual', value: `${metrics?.churnRate || 0}%`, sub: 'Salida neta de clientes durante el mes.', delta: (metrics?.churnRate || 0) <= 3 ? 'Saludable' : 'Atender', positive: (metrics?.churnRate || 0) <= 3 },
                                { label: 'LTV estimado', value: `$${Math.round(metrics?.ltv || 0).toLocaleString()}`, sub: 'Valor total proyectado por cuenta activa.', delta: 'Estable', positive: true },
                            ].map(m => (
                                <div key={m.label} style={card}>
                                    <p style={label}>{m.label}</p>
                                    <div style={{ marginTop: 'var(--space-16)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-16)' }}>
                                        <div>
                                            <div style={{ fontSize: 'var(--text-h2-size)', fontWeight: 900, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
                                            <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 'var(--space-8)' }}>{m.sub}</p>
                                        </div>
                                        <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 600, color: m.positive ? 'var(--state-success)' : 'var(--state-danger)' }}>{m.delta}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={card}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-16)', marginBottom: 'var(--space-40)' }}>
                                <div>
                                    <h3 style={sectionTitle}>Performance de plataforma</h3>
                                    <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>Evolución de MRR real frente al comportamiento proyectado.</p>
                                </div>
                            </div>
                            <MainGrowthChart data={growthData} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-32)' }}>
                            <div style={card}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-32)' }}>
                                    <div><h3 style={sectionTitle}>Top tenants</h3><p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>Cuentas con mejor desempeño.</p></div>
                                    <button onClick={() => changeTab('tenants')} style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--state-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Ver todos</button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                                    {vipTenants.map(tenant => (
                                        <div key={tenant.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-16)', padding: 'var(--space-12)', borderRadius: 'var(--radius-lg)', transition: 'background var(--transition-fast)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-page)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', minWidth: 0 }}>
                                                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface-page)', border: 'var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>{tenant.name[0]}</div>
                                                <div style={{ minWidth: 0 }}>
                                                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-body-size)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenant.name}</p>
                                                    <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>{tenant.plan} · {Math.round(tenant.usage)}% uso</p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-16)', flexShrink: 0 }}>
                                                <div style={{ textAlign: 'right' }}>
                                                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-body-size)' }}>${tenant.mrr}</p>
                                                    <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>MRR</p>
                                                </div>
                                                <button onClick={() => handleTenantAccess(tenant.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-6)', padding: 'var(--space-8) var(--space-12)', borderRadius: 'var(--radius-lg)', border: 'var(--border-default)', fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--text-primary)', background: 'var(--surface-card)', cursor: 'pointer', transition: 'background var(--transition-fast)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-page)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-card)')}>Entrar <ExternalLink size={12} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={card}>
                                <div style={{ marginBottom: 'var(--space-32)' }}>
                                    <h3 style={sectionTitle}>Distribución de planes</h3>
                                    <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>Mezcla actual entre tiers contratados.</p>
                                </div>
                                <PlanDonutChart data={planData} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)', minWidth: 0 }}>
                        <div style={card}>
                            <div style={{ marginBottom: 'var(--space-24)' }}><h3 style={sectionTitle}>Señales clave</h3><p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>Estado resumido para decisiones rápidas.</p></div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                                {[
                                    { label: 'System health', value: (metrics?.systemHealth || 'healthy') === 'healthy' ? 'Healthy' : 'Atender', positive: (metrics?.systemHealth || 'healthy') === 'healthy' },
                                    { label: 'Seats activos', value: `${metrics?.activeSeats || 0}`, sub: `Utilización ${metrics?.seatUtilization || 0}%`, positive: true },
                                    { label: 'Nuevos tenants', value: `+${metrics?.newTenantsMonth || 0}`, sub: 'Altas registradas este mes.', positive: true },
                                ].map(s => (
                                    <div key={s.label} style={inset}>
                                        <p style={label}>{s.label}</p>
                                        <p style={{ fontSize: 'var(--text-h3-size)', fontWeight: 600, color: s.positive ? 'var(--text-primary)' : 'var(--state-danger)', marginTop: 'var(--space-4)' }}>{s.value}</p>
                                        {s.sub && <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>{s.sub}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={card}>
                            <div style={{ marginBottom: 'var(--space-20)' }}><h3 style={sectionTitle}>Actividad reciente</h3><p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>Eventos y movimientos relevantes.</p></div>
                            <ActivityFeed />
                        </div>
                    </div>
                </div>
            )}

            {/* Billing */}
            {activeTab === 'billing' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-32)' }}>
                    <GlobalFilterBar dateRange={dateRange} onDateRangeChange={setDateRange} startDate={startDate} onStartDateChange={date => { setStartDate(date); if (new Date(date) > new Date(endDate)) setEndDate(date); }} endDate={endDate} onEndDateChange={date => { setEndDate(date); if (new Date(date) < new Date(startDate)) setStartDate(date); }} plan={planFilter} onPlanChange={setPlanFilter} segment={segmentFilter} onSegmentChange={setSegmentFilter} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--space-24)' }}>
                        {revenueMetrics.map((m, idx) => <RevenueKpiCard key={idx} metric={m} />)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '8fr 4fr', gap: 'var(--space-32)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-32)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-32)' }}>
                                <MRRWaterfallChart data={waterfallData} />
                                <CohortHeatmap data={cohortData} />
                            </div>
                            <BillingEventTable events={billingEvents} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-32)' }}>
                            <AIInsightsPanel metrics={metrics} loading={loading} />
                            <div style={card}>
                                <h3 style={{ ...label, marginBottom: 'var(--space-24)' }}>Acciones Rápidas</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
                                    {['Suscripción Manual', 'Facturación Masiva', 'Webhooks de Facturación'].map(action => (
                                        <button key={action} onClick={() => alert(`Acción: ${action}`)}
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-16)', borderRadius: 'var(--radius-xl)', background: 'var(--surface-page)', border: 'var(--border-default)', fontSize: 'var(--text-small-size)', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', transition: 'border-color var(--transition-fast), color var(--transition-fast)' }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-color-primary)'; e.currentTarget.style.color = 'var(--state-primary)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color-default)'; e.currentTarget.style.color = 'var(--text-primary)'; }}>
                                            {action} <ArrowUpRight size={16} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Ops */}
            {activeTab === 'ops' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-32)', maxWidth: '62rem' }}>
                    <BroadcastConsole />
                    <div style={card}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', marginBottom: 'var(--space-32)' }}>
                            <div style={{ borderRadius: 'var(--radius-xl)', background: 'var(--surface-success-soft)', padding: 'var(--space-12)', color: 'var(--state-success)' }}><Zap size={24} /></div>
                            <div>
                                <h2 style={sectionTitle}>Cluster Health</h2>
                                <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>Estado crítico de infraestructura</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-20)' }}>
                            {[
                                { name: 'Supabase Main DB', uptime: '99.98%', ping: '12ms' },
                                { name: 'Auth Node (Gemini)', uptime: '100%', ping: '8ms' },
                                { name: 'Realtime WebSocket', uptime: '99.95%', ping: '42ms' },
                                { name: 'Stripe API Gateway', uptime: '100%', ping: '110ms' },
                            ].map(s => (
                                <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-16)', borderRadius: 'var(--radius-xl)', background: 'var(--surface-page)', border: 'var(--border-default)', transition: 'background var(--transition-fast), box-shadow var(--transition-fast)' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-card)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-page)'; e.currentTarget.style.boxShadow = 'none'; }}>
                                    <div>
                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-small-size)' }}>{s.name}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', marginTop: 'var(--space-4)' }}>
                                            <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Uptime: {s.uptime}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>·</span>
                                            <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--state-primary)', textTransform: 'uppercase' }}>{s.ping}</span>
                                        </div>
                                    </div>
                                    <span style={{ padding: 'var(--space-4) var(--space-12)', background: 'var(--surface-card)', border: 'var(--border-default)', fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--state-success)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>Optimal</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Taxonomies */}
            {activeTab === 'taxonomies' && (
                <TaxonomySection materialTypes={materialTypes} uomCategories={uomCategories} unitsOfMeasure={unitsOfMeasure} addMaterialType={addMaterialType} updateMaterialType={updateMaterialType} deleteMaterialType={deleteMaterialType} addUomCategory={addUomCategory} updateUomCategory={updateUomCategory} deleteUomCategory={deleteUomCategory} addUnitOfMeasure={addUnitOfMeasure} updateUnitOfMeasure={updateUnitOfMeasure} deleteUnitOfMeasure={deleteUnitOfMeasure} />
            )}

            {/* Tenants */}
            {activeTab === 'tenants' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-16)' }}>
                        <div>
                            <h2 style={sectionTitle}>Gestión de Empresas</h2>
                            <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>Semáforo de engagement en tiempo real</p>
                        </div>
                        <Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)} icon={<Plus size={16} />}>Nueva Empresa</Button>
                    </div>
                    <TenantEngagementTable onAccessTenant={handleTenantAccess} onEditTenant={handleEdit} />
                    <CreateTenantModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSuccess={handleCreateSuccess} />
                    {selectedCompany && <EditTenantModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} company={selectedCompany} onSuccess={handleEditSuccess} />}
                </div>
            )}
        </PageContainer>
    );
}
