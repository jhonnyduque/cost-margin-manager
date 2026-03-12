import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight, Check, Building2, Users, BadgeCheck,
    Sparkles, ChevronDown, RefreshCw, Loader2, TrendingDown
} from 'lucide-react';
import { subscriptionConfig, PlanKey } from '@/platform/subscription.config';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { typography as typeTokens } from '@/design/design-tokens';

// ── Planes sincronizados con BillingCheckout ─────────────────────────────────
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

// SVG icons inline para el ticker — sin dependencia de lucide en el render del ticker
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

// ── Stat counter hook ────────────────────────────────────────────────────────
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

// ── Component ────────────────────────────────────────────────────────────────
const Explore: React.FC = () => {
    const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
    const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
    const [statsActive, setStatsActive] = useState(false);
    const statsRef = useRef<HTMLDivElement>(null);

    // Simulator
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

    const fmt = (n: number) =>
        new Intl.NumberFormat('es-CL').format(Math.round(n));

    return (
        <>
            <style>{`
                @keyframes ticker {
                    from { transform: translateX(0); }
                    to   { transform: translateX(-50%); }
                }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .anim-fadeup { animation: fadeUp 0.6s cubic-bezier(.16,1,.3,1) both; }
                .anim-delay-1 { animation-delay: 0.1s; }
                .anim-delay-2 { animation-delay: 0.22s; }
                .anim-delay-3 { animation-delay: 0.36s; }

                .slider-track {
                    height: 4px;
                    border-radius: 9999px;
                    appearance: none;
                    cursor: pointer;
                    outline: none;
                    width: 100%;
                }
                .slider-track::-webkit-slider-thumb {
                    appearance: none;
                    width: 18px; height: 18px;
                    border-radius: 50%;
                    background: #6366f1;
                    border: 2px solid #fff;
                    cursor: pointer;
                    box-shadow: 0 1px 4px rgba(99,102,241,0.3);
                    transition: all 0.15s;
                }
                .slider-track::-webkit-slider-thumb:hover {
                    transform: scale(1.15);
                    box-shadow: 0 0 0 6px rgba(99,102,241,0.12);
                }
            `}</style>

            <div className="min-h-screen bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900">

                {/* ── Ticker ──────────────────────────────────────────────── */}
                <div className="bg-indigo-600 py-2.5 overflow-hidden">
                    <div style={{ animation: 'ticker 50s linear infinite', whiteSpace: 'nowrap' }}
                        className="flex w-max">
                        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
                            <span key={i}
                                className="inline-flex items-center gap-2 mx-8 text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">
                                <span className="text-white/30 font-light">·</span>
                                <svg
                                    width="13" height="13" viewBox="0 0 24 24"
                                    fill="none" stroke="currentColor"
                                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                    className="text-white/60 flex-shrink-0"
                                    dangerouslySetInnerHTML={{ __html: item.icon }}
                                />
                                {item.label}
                            </span>
                        ))}
                    </div>
                </div>

                {/* ── Nav ─────────────────────────────────────────────────── */}
                <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-4 sm:px-6 py-3">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <span className="text-xl font-black tracking-tighter text-slate-900">
                            BETO<span className="text-indigo-600">OS</span>
                        </span>
                        <div className="flex items-center gap-4 sm:gap-6">
                            <a href="#planes"
                                className="hidden sm:block text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
                                Precios
                            </a>
                            <Button variant="secondary" size="sm"
                                onClick={() => window.location.href = '/login'}>
                                Iniciar sesión
                            </Button>
                        </div>
                    </div>
                </nav>

                {/* ── Hero + Simulador ────────────────────────────────────── */}
                {/* 
                    DECISIÓN DE DISEÑO: El simulador es el gancho principal.
                    Se muestra inmediatamente debajo del H1, dentro de la misma 
                    sección hero, para que el usuario interactúe antes de hacer scroll.
                */}
                <section className="relative py-16 sm:py-20 md:py-28 px-4 sm:px-6 overflow-hidden">
                    {/* BG decoration */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-80
                        bg-gradient-to-b from-indigo-50/60 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

                    <div className="max-w-5xl mx-auto">
                        {/* Hero text — centrado, compacto */}
                        <div className="text-center mb-12 sm:mb-16 anim-fadeup">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50
                                border border-indigo-100 rounded-full mb-6">
                                <Sparkles size={12} className="text-indigo-600" />
                                <span className="text-xs font-bold text-indigo-700 tracking-wide">
                                    Gestión de inventario con FIFO automático
                                </span>
                            </div>

                            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900
                                tracking-tight leading-[1.08] mb-5">
                                El precio de tus materiales<br className="hidden sm:block" />
                                <span className="text-indigo-600"> cambia. ¿Lo sabes?</span>
                            </h1>

                            <p className="text-base sm:text-lg text-slate-500 max-w-2xl mx-auto
                                leading-relaxed font-normal mb-8">
                                Cada lote que compras tiene un costo diferente. BETO OS lo rastrea
                                con FIFO automático y te dice cuánto te está costando
                                cada unidad <em>hoy</em> — para cualquier negocio con inventario.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                                <Button variant="primary" size="lg"
                                    onClick={() => document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' })}
                                    icon={<ArrowRight />}
                                    className="w-full sm:w-auto">
                                    Ver planes
                                </Button>
                                <Button variant="secondary" size="lg"
                                    onClick={() => window.location.href = '/login'}
                                    className="w-full sm:w-auto">
                                    Ya tengo cuenta
                                </Button>
                            </div>
                        </div>

                        {/* ── Simulador — inline con hero ─────────────────── */}
                        <div className="anim-fadeup anim-delay-2">
                            <Card noPadding className="overflow-hidden border-slate-200/80 shadow-xl shadow-slate-200/60">
                                <div className="grid grid-cols-1 lg:grid-cols-2">
                                    {/* Left — inputs */}
                                    <div className="p-6 sm:p-8 md:p-10 border-b lg:border-b-0 lg:border-r border-slate-100 bg-white">
                                        <div className="flex items-center gap-3 mb-8">
                                            <div className="p-2 bg-indigo-50 rounded-lg">
                                                <RefreshCw size={16} className="text-indigo-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-0.5">
                                                    Demo Interactivo
                                                </p>
                                                <h3 className="text-base font-bold text-slate-900">Simula tu escenario</h3>
                                            </div>
                                        </div>

                                        <div className="space-y-7">
                                            {[
                                                { label: 'Precio de venta por unidad', val: sellPrice, set: setSellPrice, min: 5, max: 500, step: 1, prefix: '$' },
                                                { label: 'Costo del lote anterior', val: costOld, set: setCostOld, min: 1, max: 490, step: 1, prefix: '$' },
                                                { label: 'Costo del lote nuevo', val: costNew, set: setCostNew, min: 1, max: 490, step: 1, prefix: '$' },
                                                { label: 'Unidades vendidas al mes', val: units, set: setUnits, min: 10, max: 10000, step: 10, prefix: '', suffix: ' un.' },
                                            ].map((s) => {
                                                const pct = ((s.val - s.min) / (s.max - s.min)) * 100;
                                                return (
                                                    <div key={s.label}>
                                                        <div className="flex justify-between items-baseline mb-3">
                                                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                                {s.label}
                                                            </label>
                                                            <span className="text-sm font-black text-slate-900 tabular-nums bg-slate-50 px-2 py-0.5 rounded-md">
                                                                {s.prefix}{fmt(s.val)}{s.suffix || ''}
                                                            </span>
                                                        </div>
                                                        <input
                                                            type="range" min={s.min} max={s.max} step={s.step}
                                                            value={s.val}
                                                            onChange={e => s.set(Number(e.target.value))}
                                                            className="slider-track"
                                                            style={{
                                                                background: `linear-gradient(to right, #6366f1 ${pct}%, #e2e8f0 ${pct}%)`
                                                            }}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Right — results */}
                                    <div className="p-6 sm:p-8 md:p-10 bg-slate-50/50 flex flex-col gap-5">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 mb-1">
                                                Resultado FIFO
                                            </p>
                                            <h3 className="text-base font-bold text-slate-900">
                                                Lo que BETO OS detecta
                                            </h3>
                                        </div>

                                        {/* Metric grid */}
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                {
                                                    label: 'Margen lote anterior',
                                                    val: `${marginOld.toFixed(1)}%`,
                                                    color: marginOld > 15 ? 'text-emerald-600' : 'text-amber-600'
                                                },
                                                {
                                                    label: 'Margen lote nuevo',
                                                    val: `${marginNew.toFixed(1)}%`,
                                                    color: marginNew > 15 ? 'text-emerald-600' : 'text-red-600'
                                                },
                                                {
                                                    label: 'Caída de margen',
                                                    val: `${Math.abs(drift).toFixed(1)}pp`,
                                                    color: 'text-slate-900'
                                                },
                                                {
                                                    label: 'Riesgo mensual est.',
                                                    val: `$${fmt(monthlyImpact)}`,
                                                    color: 'text-red-600'
                                                },
                                            ].map(m => (
                                                <div key={m.label}
                                                    className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                                                        {m.label}
                                                    </p>
                                                    <p className={`text-xl font-black tabular-nums ${m.color}`}>
                                                        {m.val}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Alert box */}
                                        <div className="flex-1 flex flex-col justify-end">
                                            <div className="p-5 bg-indigo-600 rounded-2xl text-white">
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-0.5 p-1.5 bg-white/20 rounded-lg flex-shrink-0">
                                                        <TrendingDown size={15} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold mb-1">
                                                            BETO OS lo detecta automáticamente
                                                        </p>
                                                        <p className="text-xs text-indigo-100 leading-relaxed">
                                                            Al registrar el nuevo lote, el sistema calcula el impacto
                                                            en tu margen y te sugiere el precio de venta correcto
                                                            antes de que vendas a pérdida.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <Button variant="primary" fullWidth
                                                onClick={() => document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' })}
                                                icon={<ArrowRight />}
                                                className="mt-3">
                                                Quiero esto para mi negocio
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </section>

                {/* ── Stats ───────────────────────────────────────────────── */}
                <div ref={statsRef}
                    className="bg-white border-y border-slate-200/60 py-14 sm:py-20 px-4 sm:px-6">
                    <div className="max-w-3xl mx-auto grid grid-cols-3 gap-8 text-center">
                        {[
                            { val: `${c1}%`, label: 'Reducción de errores', sub: 'en cálculo de costos' },
                            { val: `${c2} min`, label: 'Para empezar', sub: 'sin instalación' },
                            { val: `${c3}.9%`, label: 'Disponibilidad', sub: 'en la nube' },
                        ].map((s, i) => (
                            <div key={i}>
                                <div className="text-3xl sm:text-4xl font-black text-slate-900 tabular-nums mb-1">
                                    {s.val}
                                </div>
                                <p className="text-xs font-bold text-slate-700 mb-0.5">{s.label}</p>
                                <p className="text-[10px] text-slate-400 font-medium">{s.sub}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Capacidades ─────────────────────────────────────────── */}
                <section className="py-16 sm:py-24 px-4 sm:px-6 bg-white border-b border-slate-200/60">
                    <div className="max-w-5xl mx-auto">
                        <div className="text-center mb-12">
                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
                                Por qué BETO OS
                            </h2>
                            <p className="text-sm text-slate-500 max-w-lg mx-auto">
                                Diseñado para cualquier negocio que compra, transforma o vende productos con inventario.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {[
                                {
                                    icon: <RefreshCw size={18} className="text-indigo-600" />,
                                    title: 'FIFO automático',
                                    body: 'Cada compra crea un lote con su costo real. Cuando vendes, el sistema aplica FIFO automáticamente — sin que tengas que hacer nada.'
                                },
                                {
                                    icon: <Sparkles size={18} className="text-indigo-600" />,
                                    title: 'Alertas de margen',
                                    body: 'Si el precio de un insumo sube, BETO OS lo detecta y te avisa antes de que empieces a vender con el margen equivocado.'
                                },
                                {
                                    icon: <Check size={18} className="text-indigo-600" />,
                                    title: 'Trazabilidad completa',
                                    body: 'Sabe qué compraste, a qué precio, cuándo llegó y cuánto queda. Kardex automático sin hojas de cálculo.'
                                },
                            ].map((c, i) => (
                                <div key={i}
                                    className="group p-6 sm:p-7 border border-slate-100 bg-slate-50/50
                                        rounded-2xl hover:bg-white hover:border-indigo-100 hover:shadow-lg
                                        transition-all duration-300">
                                    <div className="p-2.5 bg-white border border-slate-100 rounded-xl
                                        w-fit mb-5 shadow-sm group-hover:border-indigo-100 transition-colors">
                                        {c.icon}
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900 mb-2">{c.title}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed">{c.body}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Planes ──────────────────────────────────────────────── */}
                <section id="planes" className="py-16 sm:py-24 md:py-28 px-4 sm:px-6 bg-slate-50">
                    <div className="max-w-[1300px] mx-auto">
                        <div className="text-center mb-12 sm:mb-16">
                            <p className="text-xs font-bold text-indigo-600 mb-3 tracking-[0.2em] uppercase">
                                Precios
                            </p>
                            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900
                                tracking-tight leading-none mb-4">
                                Simple. Transparente.
                            </h2>
                            <p className="text-base text-slate-500 max-w-md mx-auto">
                                Escala cuando estés listo. Sin permanencia mínima.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5">
                            {plans.map((plan) => {
                                const isSelected = selectedPlan === plan.key;
                                const isPlanLoading = loadingPlan === plan.key;

                                return (
                                    <Card
                                        key={plan.key}
                                        noPadding
                                        onClick={() => setSelectedPlan(plan.key)}
                                        className={`group relative flex flex-col cursor-pointer
                                            transition-all duration-300 h-full !overflow-visible
                                            ${isSelected
                                                ? 'ring-2 ring-indigo-600 border-indigo-200 scale-[1.03] shadow-2xl z-10'
                                                : 'hover:border-slate-300 hover:shadow-xl hover:scale-[1.01]'
                                            }`}
                                    >
                                        {/* Badge */}
                                        {(plan.recommended || isSelected) && (
                                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                                                <span className="inline-flex items-center gap-1 bg-indigo-600 text-white
                                                    text-[9px] font-black uppercase tracking-widest px-3 py-1
                                                    rounded-full shadow-md whitespace-nowrap">
                                                    {isSelected
                                                        ? <><Check size={8} /> Seleccionado</>
                                                        : 'Más Popular'}
                                                </span>
                                            </div>
                                        )}

                                        {/* Header */}
                                        <div className="p-5 sm:p-6 border-b border-slate-100">
                                            <h3 className="text-[10px] font-black text-slate-400
                                                uppercase tracking-[0.2em] mb-3">
                                                {plan.name}
                                            </h3>
                                            <div className="flex items-baseline gap-1 mb-3">
                                                {plan.price === null ? (
                                                    <span className="text-xl font-black text-slate-900">A medida</span>
                                                ) : plan.price === 0 ? (
                                                    <span className="text-2xl font-black text-slate-900">Gratis</span>
                                                ) : (
                                                    <>
                                                        <span className="text-2xl font-black text-slate-900 tabular-nums">
                                                            €{plan.price}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400">/mes</span>
                                                    </>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-500 leading-snug mb-3">
                                                {plan.description}
                                            </p>
                                            <div className="flex items-center gap-1.5 text-slate-400">
                                                <Users size={11} />
                                                <span className="text-[10px] font-bold">
                                                    {plan.seatLimit >= 999
                                                        ? 'Usuarios ilimitados'
                                                        : `Hasta ${plan.seatLimit} usuarios`}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Features */}
                                        <div className="p-5 sm:p-6 flex-1 bg-slate-50/40">
                                            <ul className="space-y-2.5">
                                                {plan.features.map((f, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <Check size={11} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                                                        <span className="text-[11px] text-slate-600 font-medium leading-snug">
                                                            {f}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* CTA */}
                                        <div className="p-4 sm:p-5">
                                            <Button
                                                variant={isSelected || plan.recommended ? 'primary' : 'secondary'}
                                                fullWidth
                                                isLoading={isPlanLoading}
                                                onClick={(e) => { e.stopPropagation(); handleActivate(plan); }}
                                                icon={plan.key !== 'enterprise' ? <ArrowRight /> : <Building2 />}
                                            >
                                                {plan.key === 'enterprise'
                                                    ? 'Contactar'
                                                    : plan.price === 0
                                                        ? 'Probar gratis'
                                                        : 'Comenzar'}
                                            </Button>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>

                        {/* Trust badges */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 bg-white
                            border border-slate-200/80 rounded-2xl p-5 sm:p-6">
                            {[
                                { icon: '⚡', title: 'Setup en 3 minutos', sub: 'Sin instalación. Desde el navegador.' },
                                { icon: '🔒', title: 'Sin tarjeta al inicio', sub: 'Demo completamente gratis.' },
                                { icon: '↩', title: 'Cancela cuando quieras', sub: 'Sin permanencia. Sin letra pequeña.' },
                            ].map(t => (
                                <div key={t.title} className="flex items-center gap-3">
                                    <span className="text-xl">{t.icon}</span>
                                    <div>
                                        <p className="text-xs font-bold text-slate-900">{t.title}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{t.sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Final CTA ───────────────────────────────────────────── */}
                <section className="py-16 sm:py-24 px-4 sm:px-6 bg-white border-t border-slate-100">
                    <div className="max-w-3xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50
                            border border-indigo-100 rounded-full mb-6">
                            <Sparkles size={12} className="text-indigo-600" />
                            <span className="text-xs font-bold text-indigo-700">
                                Para cualquier negocio con inventario
                            </span>
                        </div>

                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900
                            tracking-tight leading-[1.1] mb-5">
                            Toma el control de tus costos.<br />
                            <span className="text-indigo-600">Empieza hoy.</span>
                        </h2>

                        <p className="text-base text-slate-500 max-w-xl mx-auto mb-8 leading-relaxed">
                            No importa qué vendes ni cuánto produces.
                            Si tienes inventario, BETO OS tiene algo para ti.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                            <Button variant="primary" size="lg"
                                onClick={() => document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' })}
                                icon={<ArrowRight />}
                                className="w-full sm:w-auto">
                                Elegir mi plan
                            </Button>
                            <Button variant="secondary" size="lg"
                                onClick={() => window.location.href = '/login'}
                                className="w-full sm:w-auto">
                                Ya tengo cuenta
                            </Button>
                        </div>
                    </div>
                </section>

                {/* ── Footer ──────────────────────────────────────────────── */}
                <footer className="py-8 px-4 sm:px-6 bg-slate-50 border-t border-slate-200/60">
                    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between
                        items-center gap-4 text-slate-500">
                        <span className="text-base font-black text-slate-900">
                            BETO<span className="text-indigo-600">OS</span>
                        </span>
                        <p className="text-[11px] font-medium">
                            © {new Date().getFullYear()} BETO OS. Todos los derechos reservados.
                        </p>
                        <div className="flex gap-6">
                            <Link to="/login"
                                className="text-[11px] font-bold hover:text-slate-900 transition-colors uppercase tracking-widest">
                                Login
                            </Link>
                            <a href="mailto:sales@beto.com"
                                className="text-[11px] font-bold hover:text-slate-900 transition-colors uppercase tracking-widest">
                                Contacto
                            </a>
                        </div>
                    </div>
                </footer>

            </div>
        </>
    );
};

export default Explore;