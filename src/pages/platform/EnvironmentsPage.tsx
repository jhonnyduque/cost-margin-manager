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
import { colors, typography } from '@/design/design-tokens';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
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
            const { data } = await supabase
                .from('companies')
                .select('*')
                .order('created_at', { ascending: false });
            if (data) setCompanies(data);
        } else {
            setCompanies(userCompanies);
        }
        setLoading(false);
    };

    const handleAccess = async (companyId: string) => {
        if (user?.is_super_admin) {
            await enterCompanyAsFounder(companyId);
            navigate('/dashboard');
        }
    };

    const handleEdit = (company: Company) => {
        setSelectedCompany(company);
        setIsEditModalOpen(true);
    };

    const handleCreateSuccess = () => {
        setIsCreateModalOpen(false);
        fetchEnvironments();
        refreshAuth();
    };

    const handleEditSuccess = () => {
        setIsEditModalOpen(false);
        setSelectedCompany(null);
        fetchEnvironments();
    };

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
            return `<tr>
                <td style="padding:12px;border-bottom:1px solid #eee;font-weight:600">${c.name}</td>
                <td style="padding:12px;border-bottom:1px solid #eee;font-family:monospace">${c.slug}</td>
                <td style="padding:12px;border-bottom:1px solid #eee">${c.subscription_tier || 'Demo'}</td>
                <td style="padding:12px;border-bottom:1px solid #eee">${status.label}</td>
                <td style="padding:12px;border-bottom:1px solid #eee">${c.seat_count || 0}/${c.seat_limit || 1}</td>
            </tr>`;
        }).join('');

        printWindow.document.write(`
            <html><head><title>Environments — BETO OS</title>
            <style>body{font-family:system-ui;padding:2rem}table{width:100%;border-collapse:collapse}th{text-align:left;padding:12px;border-bottom:2px solid #333;text-transform:uppercase;font-size:12px;letter-spacing:1px}</style>
            </head><body>
            <h1>Auditoría de Entornos</h1>
            <p style="color:#666">Generado: ${new Date().toLocaleString()}</p>
            <table><thead><tr><th>Nombre</th><th>Slug</th><th>Plan</th><th>Estado</th><th>Seats</th></tr></thead>
            <tbody>${rows}</tbody></table>
            </body></html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    const handleBulkExport = (ids: string[]) => {
        const selected = companies.filter(c => ids.includes(c.id));
        const headers = ['Nombre', 'Slug', 'Plan', 'Estado', 'Seats Usados', 'Seat Limit'];
        const csvRows = [
            headers.join(','),
            ...selected.map(c => [
                `"${c.name}"`, c.slug, c.subscription_tier || 'Demo',
                c.subscription_status || 'N/A',
                c.seat_count || 0, c.seat_limit || 1
            ].join(','))
        ];
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `env_audit_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const envConfig: EntityConfig<Company> = {
        name: 'Environment',
        pluralName: 'Environments',
        rowIdKey: 'id' as keyof Company,
        fields: [
            {
                key: 'name',
                label: 'Environment',
                type: 'text',
                render: (c: Company) => (
                    <div className="flex items-center gap-3">
                        <div className={`flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm`}>
                            <Layers size={18} />
                        </div>
                        <div className="min-w-0">
                            <div className={`${typography.text.body} font-black ${colors.textPrimary} truncate`}>{c.name}</div>
                            <div className={`${typography.text.caption} ${colors.textMuted} font-mono truncate uppercase tracking-tight`}>{c.slug}</div>
                        </div>
                    </div>
                )
            },
            {
                key: 'subscription_tier',
                label: 'Tier',
                type: 'text',
                render: (c: Company) => (
                    <Badge variant={c.subscription_tier === 'pro' ? 'info' : 'neutral'}>
                        {(c.subscription_tier || 'DEMO').toUpperCase()}
                    </Badge>
                )
            },
            {
                key: 'seat_count',
                label: 'Usage (Seats)',
                type: 'text',
                render: (c: Company) => {
                    const seatPercent = Math.min(100, ((c.seat_count || 0) / (c.seat_limit || 1)) * 100);
                    const barColor = seatPercent > 85 ? 'bg-rose-500' : 'bg-indigo-600';
                    return (
                        <div className="flex items-center gap-3 min-w-[120px]">
                            <div className={`h-2 flex-1 rounded-full bg-slate-100 overflow-hidden border border-slate-200`}>
                                <div className={`h-full transition-all duration-500 ${barColor}`} style={{ width: `${seatPercent}%` }} />
                            </div>
                            <span className={`${typography.text.caption} font-bold ${colors.textSecondary} min-w-[40px] text-right`}>
                                {c.seat_count || 0}/{c.seat_limit || 1}
                            </span>
                        </div>
                    );
                }
            },
            {
                key: 'subscription_status',
                label: 'Status',
                type: 'badge',
                render: (c: Company) => {
                    const status = getStatusDisplay(c.subscription_status);
                    return (
                        <div className="flex items-center gap-2">
                            <div className={`size-2 rounded-full ${status.dot.replace('bg-', 'bg-')}`} />
                            <span className={`${typography.text.caption} font-black ${status.color.replace('text-', 'text-')}`}>
                                {status.label.toUpperCase()}
                            </span>
                        </div>
                    );
                }
            }
        ],
        actions: [
            { id: 'access', label: 'Acceder', icon: <ExternalLink size={18} />, onClick: (c: any) => handleAccess(c.id) },
            { id: 'edit', label: 'Editar', icon: <MoreHorizontal size={18} />, onClick: (c: any) => handleEdit(c) }
        ],
        bulkActions: [
            { label: 'Imprimir', onClick: handleBulkPrint },
            { label: 'Exportar CSV', onClick: handleBulkExport }
        ]
    };

    if (loading) {
        return (
            <PageContainer>
                <div className="flex h-96 items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="size-12 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
                        <span className={`${typography.text.body} ${colors.textMuted} font-bold animate-pulse`}>CARGANDO ENTORNOS...</span>
                    </div>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <SectionBlock>
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <h1 className={`${typography.text.title} ${colors.textPrimary} tracking-tight`}>
                            Gestión de Entornos
                        </h1>
                        <p className={`${typography.text.body} ${colors.textSecondary} max-w-lg`}>
                            Supervisa y accede a tus instancias desplegadas. {filteredCompanies.length} entornos registrados.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="primary" onClick={() => setIsCreateModalOpen(true)} icon={<Plus />}>
                            NUEVO ENTORNO
                        </Button>
                    </div>
                </header>

                <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-slate-100">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${colors.textMuted}`} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, slug o plan..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl ${typography.text.body} transition-all focus:ring-2 focus:ring-indigo-500 focus:bg-white`}
                        />
                    </div>
                    <Button variant="secondary" onClick={() => handleBulkPrint(companies.map(c => c.id))} icon={<Printer />}>
                        REPORTAR
                    </Button>
                    <Button variant="secondary" onClick={() => handleBulkExport(companies.map(c => c.id))} icon={<Download />}>
                        EXPORTAR
                    </Button>
                </div>

                <Card noPadding className="overflow-hidden">
                    <EntityList
                        config={envConfig as any}
                        items={filteredCompanies}
                        loading={loading}
                        emptyMessage="No se encontraron entornos."
                    />
                </Card>
            </SectionBlock>

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
        </PageContainer>
    );
};
