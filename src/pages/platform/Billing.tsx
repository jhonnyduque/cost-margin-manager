import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { CreditCard, ArrowRight, Building2, Search, Printer, Download, Eye, Loader2, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EntityList } from '@/components/entity/EntityList';
import { EntityConfig } from '@/components/entity/types';
import { getPlanDisplay, getStatusDisplay } from '@/config/subscription.config';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Badge } from '@/components/ui/Badge';

interface BillingCompany {
    id: string; name: string; slug: string; subscription_status: string;
    subscription_tier: string; current_period_end: string | null;
    stripe_subscription_id: string | null; cancel_at_period_end: boolean;
}

interface SubscriptionStatusSummary {
    has_subscription: boolean; plan_key: string | null; status: string | null;
    current_period_end: number | null; cancel_at_period_end: boolean;
    stripe_subscription_id: string | null; stripe_price_id: string | null;
    payment_method_brand: string | null; payment_method_last4: string | null;
    payment_method_exp_month: number | null; payment_method_exp_year: number | null;
}

function formatCardBrand(brand: string | null | undefined) {
    if (!brand) return 'Tarjeta';
    const labels: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover', diners: 'Diners Club', jcb: 'JCB', unionpay: 'UnionPay' };
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
    return Math.max(0, Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24)));
}

function getRenewalLegend(daysRemaining: number | null, cancelAtPeriodEnd: boolean) {
    if (daysRemaining == null) return cancelAtPeriodEnd ? 'Sin fecha de finalización' : 'Sin fecha de renovación';
    if (daysRemaining === 0) return cancelAtPeriodEnd ? 'Finaliza hoy' : 'Renueva hoy';
    if (daysRemaining === 1) return cancelAtPeriodEnd ? 'Finaliza mañana' : 'Renueva mañana';
    return cancelAtPeriodEnd ? `Finaliza en ${daysRemaining} días` : `Renueva en ${daysRemaining} días`;
}

function getRenewalBadgeVariant(daysRemaining: number | null, cancelAtPeriodEnd: boolean): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
    if (cancelAtPeriodEnd) return daysRemaining != null && daysRemaining <= 3 ? 'danger' : 'warning';
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
                const { data } = await supabase.from('companies').select('id, name, slug, subscription_status, subscription_tier, current_period_end, stripe_subscription_id').order('created_at', { ascending: false });
                setCompanies(data || []);
            } else if (currentCompany) {
                const { data } = await supabase.from('companies').select('subscription_status, subscription_tier, current_period_end, stripe_subscription_id, cancel_at_period_end').eq('id', currentCompany.id).single();
                let nextSubscription = data || null;
                const { data: sessionData } = await supabase.auth.getSession();
                const session = sessionData?.session;
                if (session) {
                    const functionsUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1';
                    const statusRes = await fetch(`${functionsUrl}/get-subscription-status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
                        body: JSON.stringify({ company_id: currentCompany.id }),
                    });
                    if (statusRes.ok) {
                        const stripeStatus: SubscriptionStatusSummary = await statusRes.json();
                        nextSubscription = { ...nextSubscription, subscription_status: stripeStatus.status ?? nextSubscription?.subscription_status ?? null, subscription_tier: stripeStatus.plan_key ?? nextSubscription?.subscription_tier ?? null, current_period_end: stripeStatus.current_period_end ? new Date(stripeStatus.current_period_end * 1000).toISOString() : nextSubscription?.current_period_end ?? null, stripe_subscription_id: stripeStatus.stripe_subscription_id ?? nextSubscription?.stripe_subscription_id ?? null, cancel_at_period_end: stripeStatus.cancel_at_period_end ?? nextSubscription?.cancel_at_period_end ?? false, payment_method_brand: stripeStatus.payment_method_brand, payment_method_last4: stripeStatus.payment_method_last4, payment_method_exp_month: stripeStatus.payment_method_exp_month, payment_method_exp_year: stripeStatus.payment_method_exp_year };
                    }
                }
                setSubscription(nextSubscription);
            }
        } catch (error) { console.error('Error loading billing data:', error); }
        finally { setLoading(false); }
    };

    const handleOpenPortal = async () => {
        if (!currentCompany?.id) return;
        setPortalLoading(true); setPortalError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sesión expirada. Por favor inicia sesión de nuevo.');
            const functionsUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1';
            const res = await fetch(`${functionsUrl}/create-portal-session`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY }, body: JSON.stringify({ company_id: currentCompany.id }) });
            if (!res.ok) { const errBody = await res.json().catch(() => ({})); throw new Error(errBody?.error || 'No se pudo abrir el portal.'); }
            const { url } = await res.json();
            if (!url) throw new Error('No se recibió URL del portal.');
            window.location.href = url;
        } catch (err: any) { setPortalError(err.message || 'Error al abrir el portal de facturación.'); }
        finally { setPortalLoading(false); }
    };

    const filteredCompanies = useMemo(() => {
        if (!searchTerm.trim()) return companies;
        const q = searchTerm.toLowerCase();
        return companies.filter(c => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q) || (c.subscription_tier || '').toLowerCase().includes(q) || (c.subscription_status || '').toLowerCase().includes(q));
    }, [companies, searchTerm]);

    const handleBulkPrint = (ids: string[]) => {
        const selected = companies.filter(c => ids.includes(c.id));
        const printWindow = window.open('', '_blank'); if (!printWindow) return;
        const rows = selected.map(c => { const plan = getPlanDisplay(c.subscription_tier); const status = getStatusDisplay(c.subscription_status); return `<tr><td style="padding:12px;border-bottom:1px solid #eee;font-weight:600">${c.name}</td><td style="padding:12px;border-bottom:1px solid #eee">${plan.label}</td><td style="padding:12px;border-bottom:1px solid #eee">${status.label}</td><td style="padding:12px;border-bottom:1px solid #eee">${c.current_period_end ? new Date(c.current_period_end).toLocaleDateString() : '—'}</td></tr>`; }).join('');
        printWindow.document.write(`<html><head><title>Facturación — BETO OS</title><style>body{font-family:system-ui;padding:2rem}table{width:100%;border-collapse:collapse}th{text-align:left;padding:12px;border-bottom:2px solid #333;text-transform:uppercase;font-size:12px;letter-spacing:1px}</style></head><body><h1>Control de Suscripciones</h1><p style="color:#666">Corte de Reporte: ${new Date().toLocaleString()}</p><table><thead><tr><th>Empresa</th><th>Plan</th><th>Estado</th><th>Renovación</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
        printWindow.document.close(); printWindow.print();
    };

    const handleBulkExport = (ids: string[]) => {
        const selected = companies.filter(c => ids.includes(c.id));
        const headers = ['Empresa', 'Slug', 'Plan', 'Estado', 'Renovación', 'Stripe ID'];
        const csvRows = [headers.join(','), ...selected.map(c => [`"${c.name}"`, c.slug, c.subscription_tier || 'N/A', c.subscription_status || 'N/A', c.current_period_end ? new Date(c.current_period_end).toLocaleDateString() : '—', c.stripe_subscription_id || '—'].join(','))];
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `billing_audit_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    };

    const billingConfig: EntityConfig<BillingCompany> = {
        name: 'Suscripción', pluralName: 'Suscripciones', rowIdKey: 'id' as keyof BillingCompany,
        fields: [
            {
                key: 'name', label: 'Empresa', type: 'text',
                render: (c: BillingCompany) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface-primary-soft)', color: 'var(--state-primary)', border: '1px solid rgba(37,99,235,0.15)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Building2 size={18} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--text-body-size)', fontWeight: 900, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                            <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.slug}</div>
                        </div>
                    </div>
                )
            },
            { key: 'subscription_tier', label: 'Plan', type: 'badge', render: (c: BillingCompany) => { const plan = getPlanDisplay(c.subscription_tier); return <Badge variant={c.subscription_tier === 'pro' ? 'info' : 'neutral'}>{plan.label.toUpperCase()}</Badge>; } },
            {
                key: 'subscription_status', label: 'Estado', type: 'badge',
                render: (c: BillingCompany) => { const status = getStatusDisplay(c.subscription_status); return (<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}><div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: status.dot.includes('emerald') ? 'var(--state-success)' : status.dot.includes('amber') ? 'var(--state-warning)' : status.dot.includes('red') ? 'var(--state-danger)' : 'var(--text-muted)' }} /><span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 900, color: status.color.includes('emerald') ? 'var(--state-success)' : status.color.includes('amber') ? 'var(--state-warning)' : status.color.includes('red') ? 'var(--state-danger)' : 'var(--text-secondary)' }}>{status.label.toUpperCase()}</span></div>); }
            },
            { key: 'current_period_end', label: 'Vencimiento', type: 'date', render: (c: BillingCompany) => (<span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--text-secondary)' }}>{c.current_period_end ? new Date(c.current_period_end).toLocaleDateString() : 'SIN FECHA'}</span>) },
        ],
        actions: [
            { id: 'manage', label: 'Gestionar', icon: <ArrowRight size={18} />, onClick: (c: any) => navigate(`/platform/billing/checkout?company=${c.id}`) },
            { id: 'view', label: 'Audit', icon: <Eye size={18} />, onClick: (c: any) => navigate(`/platform/billing/checkout?company=${c.id}`) },
        ],
        bulkActions: [{ label: 'Imprimir', onClick: handleBulkPrint }, { label: 'Exportar CSV', onClick: handleBulkExport }],
    };

    const hasRegisteredCard = Boolean(subscription?.payment_method_last4 || subscription?.stripe_subscription_id);
    const cardBrandLabel = formatCardBrand(subscription?.payment_method_brand);
    const cardExpiry = formatCardExpiry(subscription?.payment_method_exp_month, subscription?.payment_method_exp_year);
    const renewalDays = getDaysUntil(subscription?.current_period_end);
    const renewalLegend = getRenewalLegend(renewalDays, Boolean(subscription?.cancel_at_period_end));
    const renewalDateLabel = subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'SIN FECHA';
    const statusLabel = subscription?.subscription_status ? getStatusDisplay(subscription.subscription_status).label.toUpperCase() : 'SIN ESTADO';
    const planLabel = getPlanDisplay(subscription?.subscription_tier).label.toUpperCase();

    if (loading) {
        return (
            <PageContainer>
                <div style={{ display: 'flex', height: '24rem', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-16)' }}>
                        <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', border: '4px solid rgba(37,99,235,0.2)', borderTopColor: 'var(--state-primary)', animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: 'var(--text-body-size)', color: 'var(--text-muted)', fontWeight: 700 }}>SINCRONIZANDO FACTURACIÓN...</span>
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
                    breadcrumbs={<><span>BETO OS</span><span>/</span><span>Platform Control</span><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Billing</span></>}
                    metadata={[<span key="1">{user?.is_super_admin ? 'Supervisión de suscripciones' : 'Plan y métodos de pago'}</span>, user?.is_super_admin ? <span key="2">{filteredCompanies.length} empresas registradas</span> : <span key="2">{subscription ? 'Suscripción activa' : 'Sin suscripción'}</span>]}
                />

                {user?.is_super_admin ? (
                    <>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-12)', paddingTop: 'var(--space-24)', marginTop: 'var(--space-24)', borderTop: 'var(--border-default)', marginBottom: 'var(--space-24)' }}>
                            <div style={{ position: 'relative', flex: 1, minWidth: '18rem' }}>
                                <Search size={16} style={{ position: 'absolute', left: 'var(--space-16)', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input type="text" placeholder="Buscar empresa, plan, estado..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input" style={{ paddingLeft: 'var(--space-40)', width: '100%' }} />
                            </div>
                            <Button variant="secondary" onClick={() => handleBulkPrint(filteredCompanies.map(c => c.id))} icon={<Printer />}>REPORTAR</Button>
                            <Button variant="secondary" onClick={() => handleBulkExport(filteredCompanies.map(c => c.id))} icon={<Download />}>EXPORTAR</Button>
                        </div>
                        <Card noPadding style={{ overflow: 'hidden' }}>
                            <EntityList config={billingConfig as any} items={filteredCompanies} loading={loading} emptyMessage="No hay registros de facturación" />
                        </Card>
                    </>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(22rem, 0.8fr)', gap: 'var(--space-32)', paddingTop: 'var(--space-24)', borderTop: 'var(--border-default)' }}>
                        {/* Plan summary */}
                        <Card>
                            <Card.Header title="Resumen del Plan" description="Estado contractual y próxima renovación de tu cuenta." icon={<Building2 style={{ color: 'var(--text-muted)' }} size={20} />} />
                            <Card.Content style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-20)', paddingTop: 'var(--space-16)' }}>
                                <div style={{ borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', background: 'var(--surface-card)', padding: 'var(--space-20)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                                        <div>
                                            <p style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>Plan contratado</p>
                                            <h2 style={{ fontSize: 'var(--text-h2-size)', fontWeight: 700, color: 'var(--text-primary)' }}>{planLabel}</h2>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-8)' }}>
                                            <Badge variant="success">{statusLabel}</Badge>
                                            <Badge variant={subscription?.cancel_at_period_end ? 'warning' : 'info'}>{subscription?.cancel_at_period_end ? 'FINALIZA AL CIERRE' : 'AUTO-RENOVACIÓN'}</Badge>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-16)' }}>
                                    <div style={{ borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', background: 'var(--surface-page)', padding: 'var(--space-20)' }}>
                                        <p style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{subscription?.cancel_at_period_end ? 'Finalización' : 'Próxima renovación'}</p>
                                        <div style={{ marginTop: 'var(--space-8)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>
                                                <CalendarDays size={16} style={{ color: 'var(--text-muted)' }} />
                                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-body-size)' }}>{renewalDateLabel}</span>
                                            </div>
                                            <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>{renewalLegend}</p>
                                        </div>
                                    </div>
                                    <div style={{ borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', background: 'var(--surface-page)', padding: 'var(--space-20)' }}>
                                        <p style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Condición del servicio</p>
                                        <div style={{ marginTop: 'var(--space-8)' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-body-size)', marginBottom: 'var(--space-4)' }}>{subscription?.cancel_at_period_end ? 'Acceso activo hasta el cierre' : 'Cobro automático habilitado'}</div>
                                            <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', lineHeight: 1.5 }}>{subscription?.cancel_at_period_end ? 'No se realizarán nuevos cobros después de la fecha indicada.' : 'Tu suscripción seguirá vigente mientras el método de pago permanezca válido.'}</p>
                                        </div>
                                    </div>
                                </div>
                            </Card.Content>
                            <Card.Footer style={{ background: 'var(--surface-page)' }}>
                                <Button style={{ width: '100%' }} variant="primary" onClick={() => navigate('/platform/billing/checkout')} icon={<ArrowRight />}>UPGRADE / CAMBIAR PLAN</Button>
                            </Card.Footer>
                        </Card>

                        {/* Payment method */}
                        <Card>
                            <Card.Header title="Método de Pago" description="Tarjeta vinculada para cargos recurrentes." icon={<CreditCard style={{ color: 'var(--text-muted)' }} size={20} />} />
                            <Card.Content style={{ paddingTop: 'var(--space-16)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-16)', padding: 'var(--space-16)', background: 'var(--surface-page)', borderRadius: 'var(--radius-xl)', border: 'var(--border-default)' }}>
                                        <div style={{ width: '3rem', height: '3rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', border: 'var(--border-default)' }}>
                                            <CreditCard style={{ color: 'var(--text-secondary)' }} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-body-size)' }}>
                                                {hasRegisteredCard ? (subscription?.payment_method_last4 ? `${cardBrandLabel} terminada en ${subscription.payment_method_last4}` : 'TARJETA REGISTRADA') : 'SIN MÉTODO DE PAGO'}
                                            </div>
                                            <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', fontWeight: 700 }}>
                                                {hasRegisteredCard ? (cardExpiry ? `VENCE ${cardExpiry} · SISTEMA DE PAGOS STRIPE` : 'SISTEMA DE PAGOS STRIPE') : 'SISTEMA DE PAGOS STRIPE'}
                                            </div>
                                        </div>
                                    </div>
                                    {portalError && (
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-12)', padding: 'var(--space-12)', background: 'var(--surface-danger-soft)', border: '1px solid var(--border-color-danger)', borderRadius: 'var(--radius-lg)' }}>
                                            <div style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0, borderRadius: '50%', background: 'rgba(220,38,38,0.15)', color: 'var(--state-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.75rem' }}>!</div>
                                            <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--state-danger)' }}>{portalError}</p>
                                        </div>
                                    )}
                                </div>
                            </Card.Content>
                            <Card.Footer style={{ background: 'var(--surface-page)' }}>
                                <Button style={{ width: '100%' }} variant="secondary" onClick={handleOpenPortal} disabled={portalLoading} icon={portalLoading ? <Loader2 style={{ animation: 'spin 1s linear infinite' }} size={16} /> : undefined}>
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