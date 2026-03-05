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
import { colors, typography } from '@/design/design-tokens';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Badge } from '@/components/ui/Badge';

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

    const handleBulkPrint = (ids: string[]) => {
        const selected = companies.filter(c => ids.includes(c.id));
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const rows = selected.map(c => {
            const plan = getPlanDisplay(c.subscription_tier);
            const status = getStatusDisplay(c.subscription_status);
            return `<tr>
                <td style="padding:12px;border-bottom:1px solid #eee;font-weight:600">${c.name}</td>
                <td style="padding:12px;border-bottom:1px solid #eee">${plan.label}</td>
                <td style="padding:12px;border-bottom:1px solid #eee">${status.label}</td>
                <td style="padding:12px;border-bottom:1px solid #eee">${c.current_period_end ? new Date(c.current_period_end).toLocaleDateString() : '—'}</td>
            </tr>`;
        }).join('');

        printWindow.document.write(`
            <html><head><title>Facturación — BETO OS</title>
            <style>body{font-family:system-ui;padding:2rem}table{width:100%;border-collapse:collapse}th{text-align:left;padding:12px;border-bottom:2px solid #333;text-transform:uppercase;font-size:12px;letter-spacing:1px}</style>
            </head><body>
            <h1>Control de Suscripciones</h1>
            <p style="color:#666">Corte de Reporte: ${new Date().toLocaleString()}</p>
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
        a.download = `billing_audit_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const billingConfig: EntityConfig<BillingCompany> = {
        name: 'Suscripción',
        pluralName: 'Suscripciones',
        rowIdKey: 'id' as keyof BillingCompany,
        fields: [
            {
                key: 'name',
                label: 'Empresa',
                type: 'text',
                render: (c: BillingCompany) => (
                    <div className="flex items-center gap-3">
                        <div className={`flex size-10 items-center justify-center rounded-xl ${colors.bgBrandSubtle} ${colors.brand} border shadow-sm`}>
                            <Building2 size={18} />
                        </div>
                        <div className="min-w-0">
                            <div className={`${typography.text.body} font-black ${colors.textPrimary} truncate`}>{c.name}</div>
                            <div className={`${typography.text.caption} ${colors.textMuted} truncate uppercase font-bold tracking-tight`}>{c.slug}</div>
                        </div>
                    </div>
                )
            },
            {
                key: 'subscription_tier',
                label: 'Plan',
                type: 'badge',
                render: (c: BillingCompany) => {
                    const plan = getPlanDisplay(c.subscription_tier);
                    return <Badge variant={c.subscription_tier === 'pro' ? 'info' : 'neutral'}>{plan.label.toUpperCase()}</Badge>;
                }
            },
            {
                key: 'subscription_status',
                label: 'Estado',
                type: 'badge',
                render: (c: BillingCompany) => {
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
            },
            {
                key: 'current_period_end',
                label: 'Vencimiento',
                type: 'date',
                render: (c: BillingCompany) => (
                    <span className={`${typography.text.caption} font-bold ${colors.textSecondary}`}>
                        {c.current_period_end ? new Date(c.current_period_end).toLocaleDateString() : 'SIN FECHA'}
                    </span>
                )
            }
        ],
        actions: [
            { id: 'manage', label: 'Gestionar', icon: <ArrowRight size={18} />, onClick: (c: any) => navigate(`/platform/billing/checkout?company=${c.id}`) },
            { id: 'view', label: 'Audit', icon: <Eye size={18} />, onClick: (c: any) => navigate(`/platform/billing/checkout?company=${c.id}`) }
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
                        <span className={`${typography.text.body} ${colors.textMuted} font-bold animate-pulse`}>SINCRONIZANDO FACTURACIÓN...</span>
                    </div>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title={user?.is_super_admin ? 'Gobernanza de Cuentas' : 'Facturación y Suscripción'}
                    breadcrumbs={
                        <>
                            <span>BETO OS</span>
                            <span>/</span>
                            <span>Platform Control</span>
                            <span>/</span>
                            <span className={colors.textPrimary}>Billing</span>
                        </>
                    }
                    metadata={[
                        <span key="1">{user?.is_super_admin ? 'Supervisión de suscripciones' : 'Plan y métodos de pago'}</span>,
                        user?.is_super_admin ? <span key="2">{filteredCompanies.length} empresas registradas</span> : <span key="2">{subscription ? 'Suscripción activa' : 'Sin suscripción'}</span>
                    ]}
                />

                {user?.is_super_admin ? (
                    <>
                        <div className="flex flex-wrap items-center gap-3 pt-6 mt-6 border-t border-slate-100 mb-6">
                            <div className="relative flex-1 min-w-[300px]">
                                <Search size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${colors.textMuted}`} />
                                <input
                                    type="text"
                                    placeholder="Buscar empresa, plan, estado..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className={`w-full h-10 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl ${typography.text.body} transition-all focus:ring-2 focus:ring-indigo-500 focus:bg-white`}
                                />
                            </div>
                            <Button variant="secondary" onClick={() => handleBulkPrint(filteredCompanies.map(c => c.id))} icon={<Printer />}>
                                REPORTAR
                            </Button>
                            <Button variant="secondary" onClick={() => handleBulkExport(filteredCompanies.map(c => c.id))} icon={<Download />}>
                                EXPORTAR
                            </Button>
                        </div>
                        <Card noPadding className="overflow-hidden">
                            <EntityList
                                config={billingConfig as any}
                                items={filteredCompanies}
                                loading={loading}
                                emptyMessage="No hay registros de facturación"
                            />
                        </Card>
                    </>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                        {/* TENANT PLAN CARD */}
                        <Card>
                            <Card.Header
                                title="Plan Activo"
                                description="Tu nivel de servicio actual en BETO OS."
                                icon={<Zap className="text-indigo-600" size={20} />}
                            />
                            <Card.Content className="pt-4">
                                <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                    <div className="size-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                        <Zap className="text-indigo-600" />
                                    </div>
                                    <div>
                                        <div className={`${typography.text.title} text-indigo-900 leading-none`}>
                                            {getPlanDisplay(subscription?.subscription_tier).label.toUpperCase()}
                                        </div>
                                        <div className={`${typography.text.caption} text-indigo-600 font-bold mt-1`}>
                                            {subscription?.current_period_end
                                                ? `RENOVACIÓN: ${new Date(subscription.current_period_end).toLocaleDateString()}`
                                                : 'SINSCRIPCIÓN ACTIVA'}
                                        </div>
                                    </div>
                                    <div className="ml-auto">
                                        <div className="size-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                            <CheckCircle className="text-emerald-600 size-5" />
                                        </div>
                                    </div>
                                </div>
                            </Card.Content>
                            <Card.Footer className="bg-slate-50/50">
                                <Button className="w-full" variant="primary" onClick={() => navigate('/platform/billing/checkout')} icon={<ArrowRight />}>
                                    UPGRADE / CAMBIAR PLAN
                                </Button>
                            </Card.Footer>
                        </Card>

                        {/* PAYMENT METHOD CARD */}
                        <Card>
                            <Card.Header
                                title="Método de Pago"
                                description="Tarjeta vinculada para cargos recurrentes."
                                icon={<CreditCard className="text-indigo-600" size={20} />}
                            />
                            <Card.Content className="pt-4">
                                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                    <div className="size-12 rounded-xl bg-white flex items-center justify-center shadow-sm border border-slate-100">
                                        <CreditCard className="text-slate-600" />
                                    </div>
                                    <div>
                                        <div className={`${typography.text.body} font-black text-slate-800`}>
                                            {subscription?.stripe_subscription_id ? 'TARJETA REGISTRADA' : 'SIN MÉTODO DE PAGO'}
                                        </div>
                                        <div className={`${typography.text.caption} text-slate-400 font-bold`}>
                                            SISTEMA DE PAGOS STRIPE
                                        </div>
                                    </div>
                                </div>
                            </Card.Content>
                            <Card.Footer className="bg-slate-50/50">
                                <Button className="w-full" variant="secondary" onClick={() => navigate('/platform/billing/portal')}>
                                    GESTIONAR EN STRIPE PORTAL
                                </Button>
                            </Card.Footer>
                        </Card>
                    </div>
                )}
            </SectionBlock>
        </PageContainer>
    );
}
