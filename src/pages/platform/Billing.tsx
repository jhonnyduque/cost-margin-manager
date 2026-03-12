import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import {
    CreditCard, ArrowRight, Building2,
    Search, Printer, Download, Eye, Loader2, CalendarDays
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
    cancel_at_period_end: boolean;
}

interface SubscriptionStatusSummary {
    has_subscription: boolean;
    plan_key: string | null;
    status: string | null;
    current_period_end: number | null;
    cancel_at_period_end: boolean;
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    payment_method_brand: string | null;
    payment_method_last4: string | null;
    payment_method_exp_month: number | null;
    payment_method_exp_year: number | null;
}

function formatCardBrand(brand: string | null | undefined) {
    if (!brand) return 'Tarjeta';

    const labels: Record<string, string> = {
        visa: 'Visa',
        mastercard: 'Mastercard',
        amex: 'American Express',
        discover: 'Discover',
        diners: 'Diners Club',
        jcb: 'JCB',
        unionpay: 'UnionPay',
    };

    return labels[brand] || `${brand.charAt(0).toUpperCase()}${brand.slice(1)}`;
}

function formatCardExpiry(month: number | null | undefined, year: number | null | undefined) {
    if (!month || !year) return null;
    return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
}

function getDaysUntil(dateValue: string | null | undefined) {
    if (!dateValue) return null;
    const target = new Date(dateValue).getTime();
    if (Number.isNaN(target)) return null;
    const now = Date.now();
    return Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
}

function getRenewalLegend(daysRemaining: number | null, cancelAtPeriodEnd: boolean) {
    if (daysRemaining == null) return cancelAtPeriodEnd ? 'Sin fecha de finalización' : 'Sin fecha de renovación';
    if (daysRemaining === 0) return cancelAtPeriodEnd ? 'Finaliza hoy' : 'Renueva hoy';
    if (daysRemaining === 1) return cancelAtPeriodEnd ? 'Finaliza mañana' : 'Renueva mañana';
    return cancelAtPeriodEnd ? `Finaliza en ${daysRemaining} días` : `Renueva en ${daysRemaining} días`;
}

function getRenewalBadgeVariant(daysRemaining: number | null, cancelAtPeriodEnd: boolean): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
    if (cancelAtPeriodEnd) return daysRemaining != null && daysRemaining <= 3 ? 'error' : 'warning';
    if (daysRemaining != null && daysRemaining <= 3) return 'warning';
    return 'info';
}

export default function Billing() {
    const { currentCompany, user } = useAuth();
    const navigate = useNavigate();
    const [subscription, setSubscription] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [companies, setCompanies] = useState<BillingCompany[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [portalLoading, setPortalLoading] = useState(false);
    const [portalError, setPortalError] = useState<string | null>(null);

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
                    .select('subscription_status, subscription_tier, current_period_end, stripe_subscription_id, cancel_at_period_end')
                    .eq('id', currentCompany.id)
                    .single();

                let nextSubscription = data || null;

                const { data: sessionData } = await supabase.auth.getSession();
                const session = sessionData?.session;
                if (session) {
                    const functionsUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1';
                    const statusRes = await fetch(`${functionsUrl}/get-subscription-status`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`,
                            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                        },
                        body: JSON.stringify({ company_id: currentCompany.id }),
                    });

                    if (statusRes.ok) {
                        const stripeStatus: SubscriptionStatusSummary = await statusRes.json();
                        nextSubscription = {
                            ...nextSubscription,
                            subscription_status: stripeStatus.status ?? nextSubscription?.subscription_status ?? null,
                            subscription_tier: stripeStatus.plan_key ?? nextSubscription?.subscription_tier ?? null,
                            current_period_end: stripeStatus.current_period_end
                                ? new Date(stripeStatus.current_period_end * 1000).toISOString()
                                : nextSubscription?.current_period_end ?? null,
                            stripe_subscription_id: stripeStatus.stripe_subscription_id ?? nextSubscription?.stripe_subscription_id ?? null,
                            cancel_at_period_end: stripeStatus.cancel_at_period_end ?? nextSubscription?.cancel_at_period_end ?? false,
                            payment_method_brand: stripeStatus.payment_method_brand,
                            payment_method_last4: stripeStatus.payment_method_last4,
                            payment_method_exp_month: stripeStatus.payment_method_exp_month,
                            payment_method_exp_year: stripeStatus.payment_method_exp_year,
                        };
                    }
                }

                setSubscription(nextSubscription);
            }
        } catch (error) {
            console.error('Error loading billing data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenPortal = async () => {
        if (!currentCompany?.id) return;
        setPortalLoading(true);
        setPortalError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sesión expirada. Por favor inicia sesión de nuevo.');

            const functionsUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1';
            const res = await fetch(`${functionsUrl}/create-portal-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ company_id: currentCompany.id }),
            });

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(errBody?.error || 'No se pudo abrir el portal.');
            }

            const { url } = await res.json();
            if (!url) throw new Error('No se recibió URL del portal.');

            window.location.href = url;

        } catch (err: any) {
            console.error('[Billing] Portal error:', err);
            setPortalError(err.message || 'Error al abrir el portal de facturación.');
        } finally {
            setPortalLoading(false);
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

    const hasRegisteredCard = Boolean(subscription?.payment_method_last4 || subscription?.stripe_subscription_id);
    const cardBrandLabel = formatCardBrand(subscription?.payment_method_brand);
    const cardExpiry = formatCardExpiry(subscription?.payment_method_exp_month, subscription?.payment_method_exp_year);
    const renewalDays = getDaysUntil(subscription?.current_period_end);
    const renewalLegend = getRenewalLegend(renewalDays, Boolean(subscription?.cancel_at_period_end));
    const renewalBadgeVariant = getRenewalBadgeVariant(renewalDays, Boolean(subscription?.cancel_at_period_end));
    const renewalDateLabel = subscription?.current_period_end
        ? new Date(subscription.current_period_end).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
        : 'SIN FECHA';
    const statusLabel = subscription?.subscription_status
        ? getStatusDisplay(subscription.subscription_status).label.toUpperCase()
        : 'SIN ESTADO';
    const planLabel = getPlanDisplay(subscription?.subscription_tier).label.toUpperCase();

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
                        user?.is_super_admin
                            ? <span key="2">{filteredCompanies.length} empresas registradas</span>
                            : <span key="2">{subscription ? 'Suscripción activa' : 'Sin suscripción'}</span>
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
                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] gap-8 pt-6 border-t border-slate-100">
                        <Card>
                            <Card.Header
                                title="Resumen del Plan"
                                description="Estado contractual y próxima renovación de tu cuenta."
                                icon={<Building2 className="text-slate-500" size={20} />}
                            />
                            <Card.Content className="space-y-5 pt-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="space-y-3">
                                            <div>
                                                <p className={`${typography.text.caption} font-bold uppercase tracking-[0.14em] text-slate-400`}>
                                                    Plan contratado
                                                </p>
                                                <h2 className={`${typography.text.title} text-slate-900`}>{planLabel}</h2>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="success">{statusLabel}</Badge>
                                                <Badge variant={subscription?.cancel_at_period_end ? 'warning' : 'info'}>
                                                    {subscription?.cancel_at_period_end ? 'FINALIZA AL CIERRE' : 'AUTO-RENOVACIÓN'}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 lg:min-w-[220px]">
                                            <p className={`${typography.text.caption} font-bold uppercase tracking-[0.1em] text-slate-400`}>
                                                Estado del ciclo
                                            </p>
                                            <div className="mt-2 flex items-center gap-2">
                                                <CalendarDays size={16} className="text-slate-500" />
                                                <span className={`${typography.text.body} font-semibold text-slate-800`}>{renewalLegend}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                        <p className={`${typography.text.caption} font-bold uppercase tracking-[0.1em] text-slate-400`}>
                                            {subscription?.cancel_at_period_end ? 'Finalización' : 'Próxima renovación'}
                                        </p>
                                        <div className="mt-2">
                                            <div className={`${typography.text.body} font-semibold text-slate-900`}>
                                                {renewalDateLabel}
                                            </div>
                                            <p className={`${typography.text.caption} text-slate-500 mt-2 font-semibold`}>
                                                {subscription?.cancel_at_period_end ? 'Finalización programada' : 'Próximo cobro estimado'}: {renewalLegend.toLowerCase()}
                                            </p>
                                            <p className={`${typography.text.caption} text-slate-400 mt-2 leading-relaxed max-w-[24ch]`}>
                                                Fecha efectiva de
                                                corte para tu ciclo
                                                actual.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                        <p className={`${typography.text.caption} font-bold uppercase tracking-[0.1em] text-slate-400`}>
                                            Condición del servicio
                                        </p>
                                        <div className="mt-2">
                                            <div className={`${typography.text.body} font-semibold text-slate-900`}>
                                                {subscription?.cancel_at_period_end
                                                    ? 'Acceso activo hasta el cierre del periodo'
                                                    : 'Cobro automático habilitado'}
                                            </div>
                                            <p className={`${typography.text.caption} text-slate-400 mt-1 leading-relaxed max-w-[30ch]`}>
                                                {subscription?.cancel_at_period_end
                                                    ? 'No se realizarán nuevos cobros después de la fecha indicada.'
                                                    : 'Tu suscripción seguirá vigente mientras el método de pago permanezca válido.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </Card.Content>
                            <Card.Footer className="bg-slate-50/50">
                                <Button
                                    className="w-full"
                                    variant="primary"
                                    onClick={() => navigate('/platform/billing/checkout')}
                                    icon={<ArrowRight />}
                                >
                                    UPGRADE / CAMBIAR PLAN
                                </Button>
                            </Card.Footer>
                        </Card>

                        <Card>
                            <Card.Header
                                title="Método de Pago"
                                description="Tarjeta vinculada para cargos recurrentes."
                                icon={<CreditCard className="text-slate-500" size={20} />}
                            />
                            <Card.Content className="pt-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                        <div className="size-12 rounded-xl bg-white flex items-center justify-center shadow-sm border border-slate-100">
                                            <CreditCard className="text-slate-600" />
                                        </div>
                                        <div>
                                            <div className={`${typography.text.body} font-semibold text-slate-800`}>
                                                {hasRegisteredCard
                                                    ? subscription?.payment_method_last4
                                                        ? `${cardBrandLabel} terminada en ${subscription.payment_method_last4}`
                                                        : 'TARJETA REGISTRADA'
                                                    : 'SIN MÉTODO DE PAGO'}
                                            </div>
                                            <div className={`${typography.text.caption} text-slate-400 font-bold`}>
                                                {hasRegisteredCard
                                                    ? cardExpiry
                                                        ? `VENCE ${cardExpiry} · SISTEMA DE PAGOS STRIPE`
                                                        : 'SISTEMA DE PAGOS STRIPE'
                                                    : 'SISTEMA DE PAGOS STRIPE'}
                                            </div>
                                        </div>
                                    </div>

                                    {portalError && (
                                        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                                            <div className="size-5 shrink-0 flex items-center justify-center rounded-full bg-red-100 text-red-600 font-black text-xs mt-0.5">!</div>
                                            <p className={`${typography.text.caption} text-red-700`}>{portalError}</p>
                                        </div>
                                    )}
                                </div>
                            </Card.Content>
                            <Card.Footer className="bg-slate-50/50">
                                <Button
                                    className="w-full"
                                    variant="secondary"
                                    onClick={handleOpenPortal}
                                    disabled={portalLoading}
                                    icon={portalLoading ? <Loader2 className="animate-spin" size={16} /> : undefined}
                                >
                                    {portalLoading ? 'ABRIENDO PORTAL...' : 'GESTIONAR EN STRIPE PORTAL'}
                                </Button>
                            </Card.Footer>
                        </Card>
                    </div>
                )}
            </SectionBlock>
        </PageContainer>
    );
}





