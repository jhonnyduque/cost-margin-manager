import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { subscriptionConfig, PlanKey } from '@/platform/subscription.config';
import { Check, Loader2, ArrowRight, Building2, Users, Zap, BadgeCheck, CalendarClock, ExternalLink, AlertTriangle } from 'lucide-react';

const planToPriceId = Object.entries(subscriptionConfig.priceToPlan).reduce(
    (acc, [priceId, planKey]) => ({ ...acc, [planKey]: priceId }),
    {} as Record<PlanKey, string>
);

const VALID_PLAN_KEYS: PlanKey[] = ['demo', 'starter', 'growth', 'scale', 'enterprise'];

interface Plan { key: PlanKey; name: string; price: number | null; description: string; features: string[]; seatLimit: number; recommended?: boolean; stripePriceId: string; }
interface SubscriptionStatus { has_subscription: boolean; plan_key: string | null; status: string | null; current_period_end: number | null; cancel_at_period_end: boolean; portal_url: string | null; }

const plans: Plan[] = [
    { key: 'demo', name: 'Demo', price: 0, description: 'Perfecto para probar la plataforma', features: ['Hasta 3 usuarios', 'Gestión de costos básica', 'Soporte por email', 'Actualizaciones mensuales'], seatLimit: 3, stripePriceId: planToPriceId['demo'] || import.meta.env.VITE_STRIPE_PRICE_DEMO || '' },
    { key: 'starter', name: 'Starter', price: 5, description: 'Para equipos pequeños que comienzan', features: ['Hasta 4 usuarios', 'Gestión completa de costos', 'Productos y materias primas', 'Inventario básico', 'Soporte prioritario', 'Actualizaciones semanales'], seatLimit: 4, stripePriceId: planToPriceId['starter'] || import.meta.env.VITE_STRIPE_PRICE_STARTER || '' },
    { key: 'growth', name: 'Growth', price: 9, description: 'Para equipos en crecimiento', features: ['Hasta 10 usuarios', 'Todas las funcionalidades', 'Módulos ilimitados', 'Capacidades avanzadas', 'Soporte prioritario 24/7', 'Actualizaciones diarias', 'Reportes avanzados'], seatLimit: 10, recommended: true, stripePriceId: planToPriceId['growth'] || import.meta.env.VITE_STRIPE_PRICE_GROWTH || '' },
    { key: 'scale', name: 'Scale', price: 15, description: 'Para empresas establecidas', features: ['Hasta 25 usuarios', 'Todas las funcionalidades', 'Módulos ilimitados', 'Capacidades avanzadas', 'Soporte dedicado', 'Actualizaciones en tiempo real', 'Reportes avanzados', 'API access'], seatLimit: 25, stripePriceId: planToPriceId['scale'] || import.meta.env.VITE_STRIPE_PRICE_SCALE || '' },
    { key: 'enterprise', name: 'Enterprise', price: null, description: 'Solución personalizada para grandes empresas', features: ['Usuarios ilimitados', 'Todas las funcionalidades', 'Módulos ilimitados', 'Capacidades avanzadas', 'Soporte dedicado 24/7', 'Actualizaciones en tiempo real', 'Reportes avanzados', 'API access', 'SSO integration', 'Audit logs completos'], seatLimit: 999, stripePriceId: planToPriceId['enterprise'] || import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE || '' },
];

function formatRenewalDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}
function getDaysUntilRenewal(timestamp: number): number {
    return Math.max(0, Math.ceil((timestamp * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
}

export default function BillingCheckout() {
    const { user, currentCompany } = useAuth();
    const navigate = useNavigate();

    const [loadingPlanKey, setLoadingPlanKey] = useState<PlanKey | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
    const [subLoading, setSubLoading] = useState(true);
    const [portalLoading, setPortalLoading] = useState(false);

    const currentPlanKey = currentCompany?.subscription_tier as PlanKey | undefined;
    const companyId = currentCompany?.id ?? new URLSearchParams(window.location.search).get('company') ?? undefined;

    useEffect(() => {
        if (!companyId) { setSubLoading(false); return; }
        (async () => {
            setSubLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) { setSubLoading(false); return; }
                const functionsUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1';
                const res = await fetch(`${functionsUrl}/get-subscription-status`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY }, body: JSON.stringify({ company_id: companyId }) });
                if (res.ok) setSubStatus(await res.json());
            } catch (err) { console.error('[BillingCheckout] Failed to fetch subscription status:', err); }
            finally { setSubLoading(false); }
        })();
    }, [companyId]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('success') === 'true') { setSuccessMessage('¡Suscripción activada con éxito! Tu plan ya está activo.'); window.history.replaceState({}, document.title, window.location.pathname); }
        if (params.get('canceled') === 'true') { setError('Pago cancelado. Puedes intentarlo de nuevo cuando quieras.'); window.history.replaceState({}, document.title, window.location.pathname); }
        if (params.get('already_active') === 'true') { setSuccessMessage('Ya tienes este plan activo.'); window.history.replaceState({}, document.title, window.location.pathname); }
    }, []);

    const handleSubscribe = async (plan: Plan) => {
        if (plan.key === 'demo') { navigate('/dashboard'); return; }
        if (!VALID_PLAN_KEYS.includes(plan.key)) { setError('Plan no válido.'); return; }
        if (!plan.stripePriceId) { setError(`El plan ${plan.name} no está configurado correctamente.`); return; }
        if (!companyId) { setError('No se pudo identificar la empresa. Recarga la página.'); return; }
        setLoadingPlanKey(plan.key); setError(null); setSuccessMessage(null);
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) throw new Error('Sesión expirada. Por favor, inicia sesión de nuevo.');
            const functionsUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1';
            const response = await fetch(`${functionsUrl}/create-checkout-session`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY }, body: JSON.stringify({ price_id: plan.stripePriceId, company_id: companyId, plan_key: plan.key }) });
            if (!response.ok) { const errBody = await response.json().catch(() => ({})); throw new Error(errBody?.message || errBody?.error || 'Error al crear sesión de checkout'); }
            const data = await response.json();
            if (!data?.url) throw new Error('No se recibió URL de checkout');
            window.location.href = data.url;
        } catch (err: any) { setError(err.message || 'Error al procesar la suscripción.'); }
        finally { setLoadingPlanKey(null); }
    };

    const handleOpenPortal = async () => {
        if (!companyId) return;
        setPortalLoading(true); setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sesión expirada.');
            const functionsUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1';
            const res = await fetch(`${functionsUrl}/create-portal-session`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY }, body: JSON.stringify({ company_id: companyId }) });
            if (!res.ok) { const errBody = await res.json().catch(() => ({})); throw new Error(errBody?.error || 'No se pudo abrir el portal.'); }
            const { url } = await res.json();
            if (!url) throw new Error('No se recibió URL del portal.');
            window.location.href = url;
        } catch (err: any) { setError(err.message || 'Error al abrir el portal de facturación.'); }
        finally { setPortalLoading(false); }
    };

    const isCurrentPlan = (planKey: PlanKey) => currentPlanKey === planKey;
    const isLoading = (planKey: PlanKey) => loadingPlanKey === planKey;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-32)' }}>

            {/* Header */}
            <header>
                <h1 style={{ fontSize: 'var(--text-h1-size)', fontWeight: 700, color: 'var(--text-primary)' }}>Planes y Suscripción</h1>
                <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-body-size)', color: 'var(--text-muted)' }}>
                    {currentPlanKey ? `Estás en el plan ${plans.find(p => p.key === currentPlanKey)?.name ?? currentPlanKey}. Puedes cambiarlo cuando quieras.` : 'Elige el plan que mejor se adapte a tu equipo.'}
                </p>
            </header>

            {/* Estado suscripción */}
            {subLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', background: 'var(--surface-page)', padding: 'var(--space-20)' }}>
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 'var(--text-small-size)', color: 'var(--text-muted)' }}>Cargando estado de suscripción...</span>
                </div>
            ) : subStatus?.has_subscription && subStatus.current_period_end ? (() => {
                const daysLeft = getDaysUntilRenewal(subStatus.current_period_end);
                const renewalDate = formatRenewalDate(subStatus.current_period_end);
                const isExpiring = daysLeft <= 7;
                const isCanceling = subStatus.cancel_at_period_end;
                const bg = isCanceling ? 'var(--surface-warning-soft)' : isExpiring ? '#fff7ed' : 'var(--surface-primary-soft)';
                const borderColor = isCanceling ? 'var(--border-color-warning)' : isExpiring ? '#fed7aa' : 'var(--border-color-primary)';
                const textColor = isCanceling ? 'var(--state-warning)' : isExpiring ? '#c2410c' : 'var(--state-primary)';
                return (
                    <div style={{ borderRadius: 'var(--radius-xl)', border: `1px solid ${borderColor}`, background: bg, padding: 'var(--space-20)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-16)' }}>
                                <div style={{ width: '2.5rem', height: '2.5rem', flexShrink: 0, borderRadius: '50%', background: `${textColor}22`, color: textColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {isCanceling ? <AlertTriangle size={18} /> : <CalendarClock size={18} />}
                                </div>
                                <div>
                                    <p style={{ fontWeight: 700, color: textColor, fontSize: 'var(--text-body-size)' }}>
                                        {isCanceling ? `Suscripción cancelada — acceso hasta el ${renewalDate}` : isExpiring ? `Renovación en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}` : `Próxima renovación: ${renewalDate}`}
                                    </p>
                                    <p style={{ fontSize: 'var(--text-small-size)', color: textColor, opacity: 0.8, marginTop: 'var(--space-2)' }}>
                                        {isCanceling ? `Tu plan seguirá activo por ${daysLeft} día${daysLeft !== 1 ? 's' : ''} más. Puedes reactivarlo desde el portal.` : isExpiring ? `Se renovará automáticamente el ${renewalDate}.` : 'Tu suscripción se renueva automáticamente cada mes.'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={handleOpenPortal} disabled={portalLoading}
                                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-8)', borderRadius: 'var(--radius-lg)', border: `1px solid ${borderColor}`, background: 'var(--surface-card)', color: textColor, padding: 'var(--space-8) var(--space-16)', fontSize: 'var(--text-small-size)', fontWeight: 700, cursor: 'pointer', transition: 'box-shadow var(--transition-fast)', opacity: portalLoading ? 0.6 : 1 }}>
                                {portalLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ExternalLink size={14} />}
                                {portalLoading ? 'Abriendo...' : 'Gestionar suscripción'}
                            </button>
                        </div>
                    </div>
                );
            })() : null}

            {/* Banner éxito */}
            {successMessage && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-16)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-color-success)', background: 'var(--surface-success-soft)', padding: 'var(--space-16)', color: 'var(--state-success)' }}>
                    <div style={{ width: '2.5rem', height: '2.5rem', flexShrink: 0, borderRadius: '50%', background: 'rgba(22,163,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}><Check size={18} /></div>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700 }}>¡Éxito!</p>
                        <p style={{ fontSize: 'var(--text-small-size)' }}>{successMessage}</p>
                    </div>
                    <button onClick={() => setSuccessMessage(null)} style={{ padding: 'var(--space-4)', opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
            )}

            {/* Banner error */}
            {error && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-16)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-color-danger)', background: 'var(--surface-danger-soft)', padding: 'var(--space-16)', color: 'var(--state-danger)' }}>
                    <div style={{ width: '2.5rem', height: '2.5rem', flexShrink: 0, borderRadius: '50%', background: 'rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>!</div>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700 }}>Error al procesar</p>
                        <p style={{ fontSize: 'var(--text-small-size)' }}>{error}</p>
                    </div>
                    <button onClick={() => setError(null)} style={{ padding: 'var(--space-4)', opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
            )}

            {/* Plans grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: 'var(--space-24)' }}>
                {plans.map(plan => {
                    const isCurrent = isCurrentPlan(plan.key);
                    const isPlanLoading = isLoading(plan.key);
                    const isRecommended = plan.recommended && !isCurrent;
                    const borderColor = isRecommended ? 'var(--border-color-primary)' : isCurrent ? 'var(--border-color-success)' : 'var(--border-color-default)';
                    const ring = isRecommended ? '0 0 0 2px var(--state-primary)' : isCurrent ? '0 0 0 2px var(--state-success)' : 'none';

                    return (
                        <div key={plan.key} style={{ position: 'relative', display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-2xl)', border: `1px solid ${borderColor}`, background: 'var(--surface-card)', boxShadow: isRecommended ? `var(--shadow-xl), ${ring}` : isCurrent ? ring : 'var(--shadow-sm)', transition: 'box-shadow var(--transition-fast)' }}>
                            {/* Pill */}
                            {(isCurrent || isRecommended) && (
                                <div style={{ position: 'absolute', top: '-0.75rem', left: '50%', transform: 'translateX(-50%)' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)', borderRadius: 'var(--radius-full)', background: isCurrent ? 'var(--state-success)' : 'var(--state-primary)', padding: 'var(--space-2) var(--space-12)', fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--text-inverse)', whiteSpace: 'nowrap' }}>
                                        {isCurrent ? <><BadgeCheck size={12} /> Tu plan actual</> : 'Más Popular'}
                                    </span>
                                </div>
                            )}

                            {/* Plan header */}
                            <div style={{ padding: 'var(--space-24)' }}>
                                <h3 style={{ fontSize: 'var(--text-h3-size)', fontWeight: 700, color: 'var(--text-primary)' }}>{plan.name}</h3>
                                <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>{plan.description}</p>
                                <div style={{ marginTop: 'var(--space-16)', display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)' }}>
                                    {plan.price === null ? (
                                        <span style={{ fontSize: 'var(--text-h2-size)', fontWeight: 900, color: 'var(--text-primary)' }}>A medida</span>
                                    ) : plan.price === 0 ? (
                                        <span style={{ fontSize: 'var(--text-h2-size)', fontWeight: 900, color: 'var(--text-primary)' }}>Gratis</span>
                                    ) : (
                                        <><span style={{ fontSize: 'var(--text-h2-size)', fontWeight: 900, color: 'var(--text-primary)' }}>€{plan.price}</span><span style={{ color: 'var(--text-muted)' }}>/mes</span></>
                                    )}
                                </div>
                                <div style={{ marginTop: 'var(--space-12)', display: 'flex', alignItems: 'center', gap: 'var(--space-8)', fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>
                                    <Users size={14} />
                                    <span>{plan.seatLimit >= 999 ? 'Usuarios ilimitados' : `Hasta ${plan.seatLimit} usuarios`}</span>
                                </div>
                            </div>

                            {/* Features */}
                            <div style={{ flex: 1, borderTop: 'var(--border-default)', padding: 'var(--space-16) var(--space-24)' }}>
                                <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-10)' }}>
                                    {plan.features.map((feature, i) => (
                                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-8)', fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>
                                            <Check size={14} style={{ marginTop: 2, flexShrink: 0, color: 'var(--state-success)' }} />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* CTA */}
                            <div style={{ borderTop: 'var(--border-default)', padding: 'var(--space-24)' }}>
                                {isCurrent ? (
                                    <button disabled style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)', borderRadius: 'var(--radius-xl)', background: 'var(--surface-success-soft)', padding: 'var(--space-12)', fontWeight: 700, color: 'var(--state-success)', border: 'none', cursor: 'not-allowed' }}>
                                        <BadgeCheck size={18} /> Plan Activo
                                    </button>
                                ) : plan.key === 'enterprise' ? (
                                    <button onClick={() => window.location.href = 'mailto:sales@beto.com?subject=Solicitud%20Plan%20Enterprise'}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)', borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', background: 'var(--surface-card)', padding: 'var(--space-12)', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', transition: 'background var(--transition-fast)' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-page)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-card)')}>
                                        <Building2 size={18} /> Contactar Ventas
                                    </button>
                                ) : (
                                    <button onClick={() => handleSubscribe(plan)} disabled={isPlanLoading}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-12)', fontWeight: 700, border: 'none', cursor: isPlanLoading ? 'not-allowed' : 'pointer', opacity: isPlanLoading ? 0.5 : 1, background: isRecommended ? 'var(--state-primary)' : 'var(--slate-900)', color: 'var(--text-inverse)', boxShadow: isRecommended ? 'var(--shadow-md)' : 'none', transition: 'background var(--transition-fast)' }}
                                        onMouseEnter={e => { if (!isPlanLoading) e.currentTarget.style.background = isRecommended ? 'var(--state-primary-hover)' : '#1e293b'; }}
                                        onMouseLeave={e => (e.currentTarget.style.background = isRecommended ? 'var(--state-primary)' : 'var(--slate-900)')}>
                                        {isPlanLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowRight size={18} />}
                                        {isPlanLoading ? 'Procesando...' : plan.price === 0 ? 'Comenzar Gratis' : currentPlanKey ? 'Cambiar Plan' : 'Suscribirse'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Trust badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-16)', borderRadius: 'var(--radius-xl)', background: 'var(--surface-page)', padding: 'var(--space-24)' }}>
                {[
                    { icon: Zap, title: 'Setup Instantáneo', sub: 'Comienza en menos de 5 minutos' },
                    { icon: Check, title: 'Sin Tarjeta Requerida', sub: 'Prueba gratis sin compromiso' },
                    { icon: Building2, title: 'Soporte Dedicado', sub: 'Estamos aquí para ayudarte' },
                ].map(badge => (
                    <div key={badge.title} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', flexShrink: 0, borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', color: 'var(--state-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
                            <badge.icon size={20} />
                        </div>
                        <div>
                            <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-body-size)' }}>{badge.title}</p>
                            <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>{badge.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}