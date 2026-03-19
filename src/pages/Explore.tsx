import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight, Check, Building2, Users, BadgeCheck,
    Sparkles, ChevronDown, RefreshCw, Loader2, TrendingDown
} from 'lucide-react';
import { subscriptionConfig, PlanKey } from '@/platform/subscription.config';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Explore es una landing page pública — usa clases Tailwind y CSS vars directamente.
// No consume tokens de diseño como clases. Colores de marca inline via CSS vars.

const planToPriceId = Object.entries(subscriptionConfig.priceToPlan).reduce(
    (acc, [priceId, planKey]) => ({ ...acc, [planKey]: priceId }),
    {} as Record<PlanKey, string>
);

interface Plan {
    key: PlanKey;
    name: string;
    price: number | null;
    description: string;
    features: string[];
    seatLimit: number;
    recommended?: boolean;
    stripePriceId: string;
}

const plans: Plan[] = [
    {
        key: 'demo', name: 'Demo', price: 0,
        description: 'Explora sin compromiso',
        features: ['Hasta 3 usuarios', 'Gestión de costos básica', 'Soporte por email'],
        seatLimit: 3,
        stripePriceId: planToPriceId['demo'] || import.meta.env.VITE_STRIPE_PRICE_DEMO || ''
    },
    {
        key: 'starter', name: 'Starter', price: 5,
        description: 'Para equipos que arrancan',
        features: ['Hasta 4 usuarios', 'Costos + inventario completo', 'Productos y materias primas', 'Soporte prioritario'],
        seatLimit: 4,
        stripePriceId: planToPriceId['starter'] || import.meta.env.VITE_STRIPE_PRICE_STARTER || ''
    },
    {
        key: 'growth', name: 'Growth', price: 9,
        description: 'El favorito de equipos en escala',
        features: ['Hasta 10 usuarios', 'Todos los módulos', 'FIFO + trazabilidad completa', 'Soporte 24/7', 'Reportes avanzados'],
        seatLimit: 10,
        recommended: true,
        stripePriceId: planToPriceId['growth'] || import.meta.env.VITE_STRIPE_PRICE_GROWTH || ''
    },
    {
        key: 'scale', name: 'Scale', price: 15,
        description: 'Operaciones establecidas',
        features: ['Hasta 25 usuarios', 'Todos los módulos', 'API access', 'Soporte dedicado', 'Actualizaciones en tiempo real'],
        seatLimit: 25,
        stripePriceId: planToPriceId['scale'] || import.meta.env.VITE_STRIPE_PRICE_SCALE || ''
    },
    {
        key: 'enterprise', name: 'Enterprise', price: null,
        description: 'Solución a medida',
        features: ['Usuarios ilimitados', 'Todos los módulos', 'SSO + API', 'Audit logs completos', 'Consultoría incluida'],
        seatLimit: 999,
        stripePriceId: planToPriceId['enterprise'] || import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE || ''
    }
];

const TICKER_ITEMS: { label: string; icon: string }[] = [
    { label: 'FIFO Automático', icon: '<path d="M4 6h16M4 12h16M4 18h7"/><path d="m15 15 3 3 3-3"/><path d="M18 12v6"/>' },
    { label: 'Trazabilidad de Lotes', icon: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>' },
    { label: 'Costos en Tiempo Real', icon: '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="3"/>' },
    { label: 'Control de Márgenes', icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' },
    { label: 'Inventario Inteligente', icon: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>' },
    { label: 'Órdenes de Compra', icon: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>' },
    { label: 'Gestión de Proveedores', icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
    { label: 'Despachos', icon: '<path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19"/><path d="M15 6h2l5 5v5h-2"/><path d="M3 14h13"/><circle cx="7.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/>' },
    { label: 'Multi-Tenant', icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/>' },
];

function useCounter(target: number, duration = 1800, active = false) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!active) return;
        let startTime: number | null = null;
        const step = (ts: number) => {
            if (!startTime) startTime = ts;
            const progress = Math.min((ts - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            setVal(Math.floor(ease * target));
            if (progress < 1) requestAnimationFrame(step);
            else setVal(target);
        };
        requestAnimationFrame(step);
    }, [active, target, duration]);
    return val;
}

const Explore: React.FC = () => {
    const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
    const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
    const [statsActive, setStatsActive] = useState(false);
    const statsRef = useRef<HTMLDivElement>(null);

    const [sellPrice, setSellPrice] = useState(25);
    const [costOld, setCostOld] = useState(12);
    const [costNew, setCostNew] = useState(18);
    const [units, setUnits] = useState(500);

    const marginOld = ((sellPrice - costOld) / sellPrice) * 100;
    const marginNew = ((sellPrice - costNew) / sellPrice) * 100;
    const drift = marginOld - marginNew;
    const monthlyImpact = Math.abs((drift / 100) * sellPrice * units * 0.4);

    const c1 = useCounter(47, 1600, statsActive);
    const c2 = useCounter(3, 1400, statsActive);
    const c3 = useCounter(99, 1800, statsActive);

    useEffect(() => {
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setStatsActive(true); },
            { threshold: 0.3 }
        );
        if (statsRef.current) obs.observe(statsRef.current);
        return () => obs.disconnect();
    }, []);

    const handleActivate = (plan: Plan) => {
        if (plan.key === 'enterprise') {
            window.location.href = 'mailto:sales@beto.com?subject=Solicitud%20Plan%20Enterprise';
            return;
        }
        setLoadingPlan(plan.key);
        window.location.href = `/register?plan=${plan.key}&price=${plan.stripePriceId}`;
    };

    const fmt = (n: number) => new Intl.NumberFormat('es-CL').format(Math.round(n));

    return (
        <>
            <style>{`
                @keyframes ticker {
                    0%   { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .ticker-track { animation: ticker 28s linear infinite; }
                .ticker-track:hover { animation-play-state: paused; }
            `}</style>

            <div style={{ minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'var(--font-sans)' }}>

                {/* Hero */}
                <section style={{ padding: 'var(--space-64) var(--space-24)', maxWidth: '80rem', margin: '0 auto', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-8)', padding: 'var(--space-4) var(--space-12)', background: 'var(--surface-primary-soft)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 'var(--radius-pill)', marginBottom: 'var(--space-24)' }}>
                        <Sparkles size={12} style={{ color: 'var(--state-primary)' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--state-primary)' }}>Para cualquier negocio con inventario</span>
                    </div>
                    <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 'var(--space-24)' }}>
                        Toma el control de<br />tus costos e inventario
                    </h1>
                    <p style={{ fontSize: 'var(--text-body-size)', color: 'var(--text-secondary)', maxWidth: '36rem', margin: '0 auto var(--space-32)', lineHeight: 1.6 }}>
                        BETO OS es el sistema operativo para negocios con inventario. FIFO automático, trazabilidad de lotes, control de márgenes en tiempo real.
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--space-12)', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Button variant="primary" onClick={() => document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' })} icon={<ArrowRight />}>
                            Ver planes
                        </Button>
                        <Button variant="secondary" onClick={() => window.location.href = '/login'}>
                            Ya tengo cuenta
                        </Button>
                    </div>
                </section>

                {/* Ticker */}
                <div style={{ overflow: 'hidden', borderTop: 'var(--border-default)', borderBottom: 'var(--border-default)', background: 'var(--surface-card)', padding: 'var(--space-12) 0' }}>
                    <div className="ticker-track" style={{ display: 'flex', gap: 'var(--space-32)', width: 'max-content' }}>
                        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', whiteSpace: 'nowrap' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--state-primary)', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: item.icon }} />
                                <span style={{ fontSize: 'var(--text-small-size)', fontWeight: 600, color: 'var(--text-secondary)' }}>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stats */}
                <div ref={statsRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-24)', maxWidth: '48rem', margin: 'var(--space-48) auto', padding: '0 var(--space-24)' }}>
                    {[
                        { value: `${c1}%`, label: 'Reducción en errores de inventario' },
                        { value: `${c2}min`, label: 'Setup inicial promedio' },
                        { value: `${c3}%`, label: 'Uptime garantizado' },
                    ].map(stat => (
                        <div key={stat.label} className="card" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--text-display-size)', fontWeight: 900, color: 'var(--state-primary)', letterSpacing: '-0.02em' }}>{stat.value}</div>
                            <p className="text-small text-muted">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Simulator */}
                <section style={{ maxWidth: '48rem', margin: '0 auto', padding: 'var(--space-48) var(--space-24)' }}>
                    <div className="card">
                        <h2 style={{ fontSize: 'var(--text-h2-size)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-24)' }}>
                            Simulador de margen
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-16)', marginBottom: 'var(--space-24)' }}>
                            {[
                                { label: 'Precio de venta', value: sellPrice, setter: setSellPrice },
                                { label: 'Costo anterior', value: costOld, setter: setCostOld },
                                { label: 'Costo nuevo', value: costNew, setter: setCostNew },
                                { label: 'Unidades/mes', value: units, setter: setUnits },
                            ].map(field => (
                                <div key={field.label} className="field">
                                    <label className="field-label">{field.label}</label>
                                    <input type="number" className="input" value={field.value}
                                        onChange={e => field.setter(Number(e.target.value))} />
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-12)' }}>
                            <div className="metric-card">
                                <div className="metric-label">Margen anterior</div>
                                <div className="metric-value" style={{ fontSize: 'var(--text-h2-size)', color: 'var(--state-success)' }}>{marginOld.toFixed(1)}%</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Margen nuevo</div>
                                <div className="metric-value" style={{ fontSize: 'var(--text-h2-size)', color: marginNew < 10 ? 'var(--state-danger)' : 'var(--state-warning)' }}>{marginNew.toFixed(1)}%</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Impacto mensual</div>
                                <div className="metric-value" style={{ fontSize: 'var(--text-h2-size)', color: 'var(--state-danger)' }}>-${fmt(monthlyImpact)}</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Planes */}
                <section id="planes" style={{ maxWidth: '80rem', margin: '0 auto', padding: 'var(--space-48) var(--space-24)' }}>
                    <h2 style={{ fontSize: 'var(--text-h1-size)', fontWeight: 900, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 'var(--space-48)' }}>
                        Elige tu plan
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-16)' }}>
                        {plans.map(plan => {
                            const isSelected = selectedPlan === plan.key;
                            const isPlanLoading = loadingPlan === plan.key;
                            return (
                                <Card key={plan.key}
                                    style={plan.recommended ? { border: '2px solid var(--state-primary)', cursor: 'pointer' } : { cursor: 'pointer' }}
                                    onClick={() => setSelectedPlan(plan.key)}
                                >
                                    {plan.recommended && (
                                        <span className="badge badge-info" style={{ marginBottom: 'var(--space-8)' }}>Más popular</span>
                                    )}
                                    <div>
                                        <h3 style={{ marginBottom: 'var(--space-4)' }}>{plan.name}</h3>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                                            {plan.price === null ? (
                                                <span style={{ fontSize: 'var(--text-h2-size)', fontWeight: 900 }}>A medida</span>
                                            ) : plan.price === 0 ? (
                                                <span style={{ fontSize: 'var(--text-h2-size)', fontWeight: 900 }}>Gratis</span>
                                            ) : (
                                                <>
                                                    <span style={{ fontSize: 'var(--text-h2-size)', fontWeight: 900 }}>€{plan.price}</span>
                                                    <span className="text-small text-muted">/mes</span>
                                                </>
                                            )}
                                        </div>
                                        <p className="text-small text-muted" style={{ marginBottom: 'var(--space-8)' }}>{plan.description}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                            <Users size={11} style={{ color: 'var(--text-muted)' }} />
                                            <span className="text-small text-muted">
                                                {plan.seatLimit >= 999 ? 'Usuarios ilimitados' : `Hasta ${plan.seatLimit} usuarios`}
                                            </span>
                                        </div>
                                    </div>
                                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', listStyle: 'none', padding: 0, margin: 0 }}>
                                        {plan.features.map((f, i) => (
                                            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-8)' }}>
                                                <Check size={12} style={{ color: 'var(--state-primary)', marginTop: 2, flexShrink: 0 }} />
                                                <span className="text-small" style={{ color: 'var(--text-secondary)' }}>{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <Button
                                        variant={isSelected || plan.recommended ? 'primary' : 'secondary'}
                                        isLoading={isPlanLoading}
                                        onClick={(e) => { e.stopPropagation(); handleActivate(plan); }}
                                        icon={plan.key !== 'enterprise' ? <ArrowRight /> : <Building2 />}
                                        style={{ width: '100%' }}
                                    >
                                        {plan.key === 'enterprise' ? 'Contactar' : plan.price === 0 ? 'Probar gratis' : 'Comenzar'}
                                    </Button>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Trust badges */}
                    <div className="card" style={{ marginTop: 'var(--space-32)', flexDirection: 'row', flexWrap: 'wrap', gap: 'var(--space-24)' }}>
                        {[
                            { icon: '⚡', title: 'Setup en 3 minutos', sub: 'Sin instalación. Desde el navegador.' },
                            { icon: '🔒', title: 'Sin tarjeta al inicio', sub: 'Demo completamente gratis.' },
                            { icon: '↩', title: 'Cancela cuando quieras', sub: 'Sin permanencia. Sin letra pequeña.' },
                        ].map(t => (
                            <div key={t.title} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                                <span style={{ fontSize: '1.25rem' }}>{t.icon}</span>
                                <div>
                                    <p style={{ fontSize: 'var(--text-small-size)', fontWeight: 700, color: 'var(--text-primary)' }}>{t.title}</p>
                                    <p className="text-small text-muted">{t.sub}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Footer */}
                <footer style={{ borderTop: 'var(--border-default)', background: 'var(--surface-page)', padding: 'var(--space-32) var(--space-24)' }}>
                    <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-16)' }}>
                        <span style={{ fontSize: 'var(--text-body-size)', fontWeight: 900, color: 'var(--text-primary)' }}>
                            BETO<span style={{ color: 'var(--state-primary)' }}>OS</span>
                        </span>
                        <p className="text-small text-muted">© {new Date().getFullYear()} BETO OS. Todos los derechos reservados.</p>
                        <div style={{ display: 'flex', gap: 'var(--space-24)' }}>
                            <Link to="/login" className="text-small" style={{ fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Login</Link>
                            <a href="mailto:sales@beto.com" className="text-small" style={{ fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Contacto</a>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
};

export default Explore;
