import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Layers, ExternalLink, MoreHorizontal, Printer, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { Company } from '@/types';
import { CreateTenantModal } from '../../components/CreateTenantModal';
import EditTenantModal from '../../components/EditTenantModal';
import { EntityList } from '@/components/entity/EntityList';
import { EntityConfig } from '@/components/entity/types';
import { getStatusDisplay } from '@/config/subscription.config';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export const EnvironmentsPage: React.FC = () => {
    const { user, userCompanies, refreshAuth, enterCompanyAsFounder } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => { fetchEnvironments(); }, [user]);

    const fetchEnvironments = async () => {
        setLoading(true);
        if (user?.is_super_admin) {
            const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
            if (data) setCompanies(data);
        } else {
            setCompanies(userCompanies);
        }
        setLoading(false);
    };

    const handleAccess = async (companyId: string) => {
        if (user?.is_super_admin) { await enterCompanyAsFounder(companyId); navigate('/dashboard'); }
    };

    const handleEdit = (company: Company) => { setSelectedCompany(company); setIsEditModalOpen(true); };

    const handleCreateSuccess = () => { setIsCreateModalOpen(false); fetchEnvironments(); refreshAuth(); };
    const handleEditSuccess = () => { setIsEditModalOpen(false); setSelectedCompany(null); fetchEnvironments(); };

    const filteredCompanies = useMemo(() => {
        if (!searchTerm.trim()) return companies;
        const q = searchTerm.toLowerCase();
        return companies.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.slug.toLowerCase().includes(q) ||
            (c.subscription_tier || '').toLowerCase().includes(q) ||
            (c.subscription_status || '').toLowerCase().includes(q)
        );
    }, [companies, searchTerm]);

    const handleBulkPrint = (ids: string[]) => {
        const selected = companies.filter(c => ids.includes(c.id));
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const rows = selected.map(c => {
            const status = getStatusDisplay(c.subscription_status);
            return `<tr><td style="padding:12px;border-bottom:1px solid #eee;font-weight:600">${c.name}</td><td style="padding:12px;border-bottom:1px solid #eee;font-family:monospace">${c.slug}</td><td style="padding:12px;border-bottom:1px solid #eee">${c.subscription_tier || 'Demo'}</td><td style="padding:12px;border-bottom:1px solid #eee">${status.label}</td><td style="padding:12px;border-bottom:1px solid #eee">${c.seat_count || 0}/${c.seat_limit || 1}</td></tr>`;
        }).join('');
        printWindow.document.write(`<html><head><title>Environments — BETO OS</title><style>body{font-family:system-ui;padding:2rem}table{width:100%;border-collapse:collapse}th{text-align:left;padding:12px;border-bottom:2px solid #333;text-transform:uppercase;font-size:12px;letter-spacing:1px}</style></head><body><h1>Auditoría de Entornos</h1><p style="color:#666">Generado: ${new Date().toLocaleString()}</p><table><thead><tr><th>Nombre</th><th>Slug</th><th>Plan</th><th>Estado</th><th>Seats</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
        printWindow.document.close(); printWindow.print();
    };

    const handleBulkExport = (ids: string[]) => {
        const selected = companies.filter(c => ids.includes(c.id));
        const headers = ['Nombre', 'Slug', 'Plan', 'Estado', 'Seats Usados', 'Seat Limit'];
        const csvRows = [headers.join(','), ...selected.map(c => [`"${c.name}"`, c.slug, c.subscription_tier || 'Demo', c.subscription_status || 'N/A', c.seat_count || 0, c.seat_limit || 1].join(','))];
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `env_audit_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    };

    const envConfig: EntityConfig<Company> = {
        name: 'Environment', pluralName: 'Environments', rowIdKey: 'id' as keyof Company,
        fields: [
            {
                key: 'name', label: 'Environment', type: 'text',
                render: (c: Company) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface-primary-soft)', color: 'var(--state-primary)', border: '1px solid rgba(37,99,235,0.15)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Layers size={18} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--text-body-size)', fontWeight: 900, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                            <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.slug}</div>
                        </div>
                    </div>
                )
            },
            {
                key: 'subscription_tier', label: 'Tier', type: 'text',
                render: (c: Company) => <Badge variant={c.subscription_tier === 'pro' ? 'info' : 'neutral'}>{(c.subscription_tier || 'DEMO').toUpperCase()}</Badge>
            },
            {
                key: 'seat_count', label: 'Usage (Seats)', type: 'text',
                render: (c: Company) => {
                    const pct = Math.min(100, ((c.seat_count || 0) / (c.seat_limit || 1)) * 100);
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', minWidth: '7rem' }}>
                            <div style={{ flex: 1, height: '0.5rem', borderRadius: 'var(--radius-full)', background: 'var(--surface-muted)', overflow: 'hidden', border: 'var(--border-default)' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: pct > 85 ? 'var(--state-danger)' : 'var(--state-primary)', borderRadius: 'var(--radius-full)', transition: 'width var(--transition-base)' }} />
                            </div>
                            <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--text-secondary)', minWidth: '2.5rem', textAlign: 'right' }}>{c.seat_count || 0}/{c.seat_limit || 1}</span>
                        </div>
                    );
                }
            },
            {
                key: 'subscription_status', label: 'Status', type: 'badge',
                render: (c: Company) => {
                    const status = getStatusDisplay(c.subscription_status);
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                            <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: status.dot.includes('emerald') ? 'var(--state-success)' : status.dot.includes('amber') ? 'var(--state-warning)' : status.dot.includes('red') ? 'var(--state-danger)' : 'var(--text-muted)' }} />
                            <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 900, color: status.color.includes('emerald') ? 'var(--state-success)' : status.color.includes('amber') ? 'var(--state-warning)' : status.color.includes('red') ? 'var(--state-danger)' : 'var(--text-secondary)' }}>{status.label.toUpperCase()}</span>
                        </div>
                    );
                }
            },
        ],
        actions: [
            { id: 'access', label: 'Acceder', icon: <ExternalLink size={18} />, onClick: (c: any) => handleAccess(c.id) },
            { id: 'edit', label: 'Editar', icon: <MoreHorizontal size={18} />, onClick: (c: any) => handleEdit(c) },
        ],
        bulkActions: [
            { label: 'Imprimir', onClick: handleBulkPrint },
            { label: 'Exportar CSV', onClick: handleBulkExport },
        ],
    };

    if (loading) {
        return (
            <PageContainer>
                <div style={{ display: 'flex', height: '24rem', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-16)' }}>
                        <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', border: '4px solid rgba(37,99,235,0.2)', borderTopColor: 'var(--state-primary)', animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: 'var(--text-body-size)', color: 'var(--text-muted)', fontWeight: 700 }}>CARGANDO ENTORNOS...</span>
                    </div>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Gestión de Entornos"
                    breadcrumbs={<><span>BETO OS</span><span>/</span><span>Platform Control</span><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Environments</span></>}
                    metadata={[<span key="1">Supervisa y accede a tus instancias desplegadas</span>, <span key="2">{filteredCompanies.length} entornos registrados</span>]}
                    actions={<Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)} icon={<Plus size={16} />}>NUEVO ENTORNO</Button>}
                />

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-12)', paddingTop: 'var(--space-24)', marginTop: 'var(--space-24)', borderTop: 'var(--border-default)', marginBottom: 'var(--space-24)' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '18rem' }}>
                        <Search size={16} style={{ position: 'absolute', left: 'var(--space-16)', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input type="text" placeholder="Buscar por nombre, slug o plan..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input" style={{ paddingLeft: 'var(--space-40)', width: '100%' }} />
                    </div>
                    <Button variant="secondary" onClick={() => handleBulkPrint(companies.map(c => c.id))} icon={<Printer />}>REPORTAR</Button>
                    <Button variant="secondary" onClick={() => handleBulkExport(companies.map(c => c.id))} icon={<Download />}>EXPORTAR</Button>
                </div>

                <Card noPadding style={{ overflow: 'hidden' }}>
                    <EntityList config={envConfig as any} items={filteredCompanies} loading={loading} emptyMessage="No se encontraron entornos." />
                </Card>
            </SectionBlock>

            <CreateTenantModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSuccess={handleCreateSuccess} />
            {selectedCompany && <EditTenantModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} company={selectedCompany} onSuccess={handleEditSuccess} />}
        </PageContainer>
    );
};