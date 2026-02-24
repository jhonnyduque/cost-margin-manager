import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import {
    CreditCard, ArrowRight, CheckCircle, Building2,
    Zap, Search, Printer, Download, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EntityList } from '@/components/entity/EntityList';
import { EntityConfig } from '@/components/entity/types';
import { getPlanDisplay, getStatusDisplay } from '@/config/subscription.config';

interface BillingCompany {
    id: string;
    name: string;
    slug: string;
    subscription_status: string;
    subscription_tier: string;
    current_period_end: string | null;
    stripe_subscription_id: string | null;
}

export default function Billing() {
    const { currentCompany, user } = useAuth();
    const navigate = useNavigate();
    const [subscription, setSubscription] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [companies, setCompanies] = useState<BillingCompany[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => { loadData(); }, [currentCompany, user]);

    const loadData = async () => {
        try {
            if (user?.is_super_admin) {
                const { data } = await supabase
                    .from('companies')
                    .select('id, name, slug, subscription_status, subscription_tier, current_period_end, stripe_subscription_id')
                    .order('created_at', { ascending: false });
                setCompanies(data || []);
            } else if (currentCompany) {
                const { data } = await supabase
                    .from('companies')
                    .select('subscription_status, subscription_tier, current_period_end, stripe_subscription_id')
                    .eq('id', currentCompany.id)
                    .single();
                setSubscription(data);
            }
        } catch (error) {
            console.error('Error loading billing data:', error);
        } finally {
            setLoading(false);
        }
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
            const plan = getPlanDisplay(c.subscription_tier);
            const status = getStatusDisplay(c.subscription_status);
            return `<tr>
                <td style="padding:8px;border-bottom:1px solid #eee">${c.name}</td>
                <td style="padding:8px;border-bottom:1px solid #eee">${plan.label}</td>
                <td style="padding:8px;border-bottom:1px solid #eee">${status.label}</td>
                <td style="padding:8px;border-bottom:1px solid #eee">${c.current_period_end ? new Date(c.current_period_end).toLocaleDateString() : '—'}</td>
            </tr>`;
        }).join('');

        printWindow.document.write(`
            <html><head><title>Facturación — BETO OS</title>
            <style>body{font-family:system-ui;padding:2rem}table{width:100%;border-collapse:collapse}th{text-align:left;padding:8px;border-bottom:2px solid #333;font-size:12px;text-transform:uppercase}</style>
            </head><body>
            <h1 style="font-size:1.5rem">Reporte de Facturación</h1>
            <p style="color:#666">Generado: ${new Date().toLocaleString()}</p>
            <table><thead><tr><th>Empresa</th><th>Plan</th><th>Estado</th><th>Renovación</th></tr></thead>
            <tbody>${rows}</tbody></table>
            </body></html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    const handleBulkExport = (ids: string[]) => {
        const selected = companies.filter(c => ids.includes(c.id));
        const headers = ['Empresa', 'Slug', 'Plan', 'Estado', 'Renovación', 'Stripe ID'];
        const csvRows = [
            headers.join(','),
            ...selected.map(c => [
                `"${c.name}"`, c.slug, c.subscription_tier || 'N/A',
                c.subscription_status || 'N/A',
                c.current_period_end ? new Date(c.current_period_end).toLocaleDateString() : '—',
                c.stripe_subscription_id || '—'
            ].join(','))
        ];
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facturacion_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── EntityConfig ──────────────────────────────
    const billingConfig: EntityConfig<BillingCompany> = {
        name: 'Suscripción',
        pluralName: 'Suscripciones',
        rowIdKey: 'id' as keyof BillingCompany,
        fields: [
            {
                key: 'name' as keyof BillingCompany,
                label: 'Empresa',
                type: 'text',
                render: (c) => (
                    <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 flex-shrink-0">
                            <Building2 size={16} className="text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-gray-900 truncate">{c.name}</div>
                            <div className="text-xs text-gray-500 truncate">{c.slug}</div>
                        </div>
                    </div>
                )
            },
            {
                key: 'subscription_tier' as keyof BillingCompany,
                label: 'Plan',
                type: 'badge',
                render: (c) => {
                    const plan = getPlanDisplay(c.subscription_tier);
                    return (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${plan.bg} ${plan.color}`}>
                            <Zap size={10} />
                            {plan.label}
                        </span>
                    );
                }
            },
            {
                key: 'subscription_status' as keyof BillingCompany,
                label: 'Estado',
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
            },
            {
                key: 'current_period_end' as keyof BillingCompany,
                label: 'Renovación',
                type: 'date',
                render: (c) => (
                    <span className="text-sm text-gray-600">
                        {c.current_period_end ? new Date(c.current_period_end).toLocaleDateString() : '—'}
                    </span>
                )
            }
        ],
        actions: [
            {
                id: 'manage',
                label: 'Gestionar',
                icon: <ArrowRight size={18} />,
                onClick: (c) => navigate(`/platform/billing/checkout?company=${c.id}`)
            },
            {
                id: 'view',
                label: 'Ver Detalles',
                icon: <Eye size={18} />,
                onClick: (c) => navigate(`/platform/billing/checkout?company=${c.id}`)
            }
        ],
        bulkActions: [
            { label: 'Imprimir', onClick: handleBulkPrint },
            { label: 'Exportar CSV', onClick: handleBulkExport }
        ]
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <div className="size-10 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
                <span className="ml-3 text-gray-600">Cargando...</span>
            </div>
        );
    }

    // ── SUPER ADMIN VIEW ──────────────────────────
    if (user?.is_super_admin) {
        return (
            <div className="animate-in fade-in space-y-6 lg:space-y-8 duration-700">
                <header className="space-y-4">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-gray-900">Facturación</h1>
                        <p className="mt-1 text-sm lg:text-base font-medium text-gray-500">
                            Gestión de suscripciones de todas las empresas · {filteredCompanies.length} registros
                        </p>
                    </div>

                    {/* Search + Quick Actions */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 min-w-0">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar empresa, plan, estado..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-xl bg-white pl-9 pr-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                            />
                        </div>
                        <button
                            onClick={() => handleBulkPrint(filteredCompanies.map(c => c.id))}
                            className="flex items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all h-10 w-10 flex-shrink-0"
                            title="Imprimir todo"
                        >
                            <Printer size={18} />
                        </button>
                        <button
                            onClick={() => handleBulkExport(filteredCompanies.map(c => c.id))}
                            className="flex items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all h-10 w-10 flex-shrink-0"
                            title="Exportar CSV"
                        >
                            <Download size={18} />
                        </button>
                    </div>
                </header>

                <EntityList
                    config={billingConfig}
                    items={filteredCompanies}
                    loading={loading}
                    emptyMessage="No hay empresas registradas"
                />
            </div>
        );
    }

    // ── TENANT VIEW ───────────────────────────────
    const planDisplay = getPlanDisplay(subscription?.subscription_tier);

    return (
        <div className="animate-in fade-in space-y-6 lg:space-y-8 duration-700">
            <header>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-gray-900">
                    Facturación y Suscripción
                </h1>
                <p className="mt-1 text-sm lg:text-base font-medium text-gray-500">
                    Gestiona tu plan y métodos de pago
                </p>
            </header>

            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
                <Card className="p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-gray-900">Plan Actual</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {subscription?.subscription_tier ? planDisplay.label : 'Sin plan activo'}
                            </p>
                            {subscription?.current_period_end && (
                                <p className="mt-2 text-xs text-gray-400">
                                    Renueva: {new Date(subscription.current_period_end).toLocaleDateString()}
                                </p>
                            )}
                        </div>
                        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100">
                            <CheckCircle size={24} className="text-emerald-600" />
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-6">
                        <Button onClick={() => navigate('/platform/billing/checkout')} variant="outline" className="w-full" icon={<ArrowRight size={18} />}>
                            Cambiar Plan
                        </Button>
                    </div>
                </Card>

                <Card className="p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-gray-900">Método de Pago</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {subscription?.stripe_subscription_id ? 'Tarjeta registrada' : 'No registrada'}
                            </p>
                        </div>
                        <div className="flex size-12 items-center justify-center rounded-full bg-indigo-100">
                            <CreditCard size={24} className="text-indigo-600" />
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-6">
                        <Button onClick={() => navigate('/platform/billing/portal')} variant="outline" className="w-full">
                            Gestionar Pago
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}