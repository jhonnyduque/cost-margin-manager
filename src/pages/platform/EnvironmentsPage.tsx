import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Layers, ExternalLink, MoreHorizontal, Users, Zap, Printer, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { Company } from '@/types';
import { CreateTenantModal } from '../../components/CreateTenantModal';
import EditTenantModal from '../../components/EditTenantModal';
import { EntityList } from '@/components/entity/EntityList';
import { EntityConfig } from '@/components/entity/types';
import { getStatusDisplay } from '@/config/subscription.config';

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

    // ── Bulk Actions ──────────────────────────────
    const handleBulkPrint = (ids: string[]) => {
        const selected = companies.filter(c => ids.includes(c.id));
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const rows = selected.map(c => {
            const status = getStatusDisplay(c.subscription_status);
            return `<tr>
                <td style="padding:8px;border-bottom:1px solid #eee">${c.name}</td>
                <td style="padding:8px;border-bottom:1px solid #eee">${c.slug}</td>
                <td style="padding:8px;border-bottom:1px solid #eee">${c.subscription_tier || 'Demo'}</td>
                <td style="padding:8px;border-bottom:1px solid #eee">${status.label}</td>
                <td style="padding:8px;border-bottom:1px solid #eee">${c.seat_count || 0}/${c.seat_limit || 1}</td>
            </tr>`;
        }).join('');

        printWindow.document.write(`
            <html><head><title>Environments — BETO OS</title>
            <style>body{font-family:system-ui;padding:2rem}table{width:100%;border-collapse:collapse}th{text-align:left;padding:8px;border-bottom:2px solid #333;font-size:12px;text-transform:uppercase}</style>
            </head><body>
            <h1 style="font-size:1.5rem">Reporte de Environments</h1>
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
        a.download = `environments_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── EntityConfig ──────────────────────────────
    const envConfig: EntityConfig<Company> = {
        name: 'Environment',
        pluralName: 'Environments',
        rowIdKey: 'id' as keyof Company,
        fields: [
            {
                key: 'name' as keyof Company,
                label: 'Environment Name',
                type: 'text',
                render: (c) => (
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 flex-shrink-0">
                            <Layers size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{c.name}</div>
                            <div className="text-xs text-slate-400 font-mono truncate">{c.slug}</div>
                        </div>
                    </div>
                )
            },
            {
                key: 'subscription_tier' as keyof Company,
                label: 'Plan',
                type: 'text',
                render: (c) => (
                    <span className="text-sm capitalize text-slate-700">
                        {c.stripe_price_id ? 'Professional' : (c.subscription_tier || 'Demo')}
                    </span>
                )
            },
            {
                key: 'seat_count' as keyof Company,
                label: 'Usage (Seats)',
                type: 'text',
                render: (c) => {
                    const seatPercent = Math.min(100, ((c.seat_count || 0) / (c.seat_limit || 1)) * 100);
                    const barColor = seatPercent > 85 ? 'bg-orange-500' : 'bg-indigo-500';
                    return (
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${seatPercent}%` }} />
                            </div>
                            <span className="text-xs text-slate-500">{c.seat_count || 0}/{c.seat_limit || 1}</span>
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
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${status.color}`}>
                            <span className={`size-1.5 rounded-full ${status.dot}`} />
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
                icon: <ExternalLink size={18} />,
                onClick: (c) => handleAccess(c.id)
            },
            {
                id: 'edit',
                label: 'Editar',
                icon: <MoreHorizontal size={18} />,
                onClick: (c) => handleEdit(c)
            }
        ],
        bulkActions: [
            { label: 'Imprimir', onClick: handleBulkPrint },
            { label: 'Exportar CSV', onClick: handleBulkExport }
        ]
    };

    return (
        <div className="animate-in fade-in space-y-5 lg:space-y-6 duration-700">
            {/* Header */}
            <header className="space-y-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900">Environments</h1>
                    <p className="mt-1 text-sm lg:text-base font-medium text-slate-500">
                        Manage your deployed instances and subscriptions · {filteredCompanies.length} environments
                    </p>
                </div>

                {/* Search + Create + Quick Actions */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 min-w-0">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search environments..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-xl bg-white pl-9 pr-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                        />
                    </div>
                    <button
                        onClick={() => handleBulkPrint(companies.map(c => c.id))}
                        className="flex items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all h-10 w-10 flex-shrink-0"
                        title="Imprimir todo"
                    >
                        <Printer size={18} />
                    </button>
                    <button
                        onClick={() => handleBulkExport(companies.map(c => c.id))}
                        className="flex items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all h-10 w-10 flex-shrink-0"
                        title="Exportar CSV"
                    >
                        <Download size={18} />
                    </button>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all h-10 w-10 sm:w-auto sm:px-4 flex-shrink-0"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline text-sm">New Environment</span>
                    </button>
                </div>
            </header>

            <EntityList
                config={envConfig}
                items={filteredCompanies}
                loading={loading}
                emptyMessage="No environments found."
            />

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
    );
};