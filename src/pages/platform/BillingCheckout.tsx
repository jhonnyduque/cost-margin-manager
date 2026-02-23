import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { subscriptionConfig, PlanKey } from '@/platform/subscription.config';
import { Check, Loader2, ArrowRight, Building2, Users, Zap, BadgeCheck } from 'lucide-react';

// ✅ Mapa inverso planKey → priceId, construido una sola vez fuera del componente
const planToPriceId = Object.entries(subscriptionConfig.priceToPlan).reduce(
    (acc, [priceId, planKey]) => ({ ...acc, [planKey]: priceId }),
    {} as Record<PlanKey, string>
);

// ✅ Claves válidas para validación en frontend
const VALID_PLAN_KEYS: PlanKey[] = ['demo', 'starter', 'growth', 'scale', 'enterprise'];

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
        key: 'demo',
        name: 'Demo',
        price: 0,
        description: 'Perfecto para probar la plataforma',
        features: [
            'Hasta 3 usuarios',
            'Gestión de costos básica',
            'Soporte por email',
            'Actualizaciones mensuales'
        ],
        seatLimit: 3,
        stripePriceId: planToPriceId['demo'] || import.meta.env.VITE_STRIPE_PRICE_DEMO || ''
    },
    {
        key: 'starter',
        name: 'Starter',
        price: 5,
        description: 'Para equipos pequeños que comienzan',
        features: [
            'Hasta 4 usuarios',
            'Gestión completa de costos',
            'Productos y materias primas',
            'Inventario básico',
            'Soporte prioritario',
            'Actualizaciones semanales'
        ],
        seatLimit: 4,
        stripePriceId: planToPriceId['starter'] || import.meta.env.VITE_STRIPE_PRICE_STARTER || ''
    },
    {
        key: 'growth',
        name: 'Growth',
        price: 9,
        description: 'Para equipos en crecimiento',
        features: [
            'Hasta 10 usuarios',
            'Todas las funcionalidades',
            'Módulos ilimitados',
            'Capacidades avanzadas',
            'Soporte prioritario 24/7',
            'Actualizaciones diarias',
            'Reportes avanzados'
        ],
        seatLimit: 10,
        recommended: true,
        stripePriceId: planToPriceId['growth'] || import.meta.env.VITE_STRIPE_PRICE_GROWTH || ''
    },
    {
        key: 'scale',
        name: 'Scale',
        price: 15,
        description: 'Para empresas establecidas',
        features: [
            'Hasta 25 usuarios',
            'Todas las funcionalidades',
            'Módulos ilimitados',
            'Capacidades avanzadas',
            'Soporte dedicado',
            'Actualizaciones en tiempo real',
            'Reportes avanzados',
            'API access'
        ],
        seatLimit: 25,
        stripePriceId: planToPriceId['scale'] || import.meta.env.VITE_STRIPE_PRICE_SCALE || ''
    },
    {
        key: 'enterprise',
        name: 'Enterprise',
        price: null,
        description: 'Solución personalizada para grandes empresas',
        features: [
            'Usuarios ilimitados',
            'Todas las funcionalidades',
            'Módulos ilimitados',
            'Capacidades avanzadas',
            'Soporte dedicado 24/7',
            'Actualizaciones en tiempo real',
            'Reportes avanzados',
            'API access',
            'SSO integration',
            'Audit logs completos'
        ],
        seatLimit: 999,
        stripePriceId: planToPriceId['enterprise'] || import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE || ''
    }
];

export default function BillingCheckout() {
    const { user, currentCompany } = useAuth();
    const navigate = useNavigate();
    const [loadingPlanKey, setLoadingPlanKey] = useState<PlanKey | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const currentPlanKey = currentCompany?.subscription_tier as PlanKey | undefined;

    // ✅ Obtener company_id desde currentCompany o desde la URL
    // SuperAdmin tiene currentCompany = null pero la URL contiene ?company=uuid
    const companyId = currentCompany?.id
        ?? new URLSearchParams(window.location.search).get('company')
        ?? undefined;

    // Manejar retorno de Stripe con query params
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const success = params.get('success');
        const canceled = params.get('canceled');

        if (success === 'true') {
            setSuccessMessage('¡Suscripción activada con éxito! Tu plan ya está activo.');
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (canceled === 'true') {
            setError('Pago cancelado. Puedes intentarlo de nuevo cuando quieras.');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const handleSubscribe = async (plan: Plan) => {
        if (plan.key === 'demo') {
            navigate('/dashboard');
            return;
        }

        if (!VALID_PLAN_KEYS.includes(plan.key)) {
            setError('Plan no válido.');
            return;
        }

        if (!plan.stripePriceId) {
            setError(`El plan ${plan.name} no está configurado correctamente.`);
            return;
        }

        if (!companyId) {
            setError('No se pudo identificar la empresa. Recarga la página e inténtalo de nuevo.');
            return;
        }

        setLoadingPlanKey(plan.key);
        setError(null);
        setSuccessMessage(null);

        try {
            console.log('[BillingCheckout] Creating checkout session for plan:', plan.key, '| company:', companyId);

            // ✅ getSession() sin rotación de token
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session) {
                console.error('[BillingCheckout] No active session:', sessionError);
                throw new Error('Sesión expirada. Por favor, inicia sesión de nuevo.');
            }

            console.log('[BillingCheckout] Session validated, user:', session.user.id);

            // ✅ Fetch directo para garantizar control total del Authorization header
            // supabase.functions.invoke puede sobreescribir el header con el anon key
            const functionsUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1';
            const response = await fetch(`${functionsUrl}/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    price_id: plan.stripePriceId,
                    company_id: companyId,
                    plan_key: plan.key
                })
            });

            if (!response.ok) {
                const errBody = await response.json().catch(() => ({}));
                console.error('[BillingCheckout] Edge Function error:', errBody);
                throw new Error(errBody?.message || errBody?.error || 'Error al crear sesión de checkout');
            }

            const data = await response.json();

            if (!data?.url) {
                throw new Error('No se recibió URL de checkout');
            }

            console.log('[BillingCheckout] Redirecting to Stripe:', data.url);
            window.location.href = data.url;

        } catch (err: any) {
            console.error('[BillingCheckout] Subscription error:', err);
            setError(err.message || 'Error al procesar la suscripción. Inténtalo de nuevo.');
        } finally {
            setLoadingPlanKey(null);
        }
    };

    const handleContactSales = () => {
        window.location.href = 'mailto:sales@beto.com?subject=Solicitud%20Plan%20Enterprise';
    };

    const isCurrentPlan = (planKey: PlanKey) => currentPlanKey === planKey;
    const isLoading = (planKey: PlanKey) => loadingPlanKey === planKey;

    return (
        <div className="animate-in fade-in space-y-8 duration-700">
            {/* Header */}
            <header>
                <h1 className="text-3xl font-black tracking-tight text-gray-900">
                    Planes y Suscripción
                </h1>
                <p className="mt-1 font-medium text-gray-500">
                    {currentPlanKey
                        ? `Estás en el plan ${plans.find(p => p.key === currentPlanKey)?.name ?? currentPlanKey}. Puedes cambiarlo cuando quieras.`
                        : 'Elige el plan que mejor se adapte a tu equipo.'}
                </p>
            </header>

            {/* Banner éxito */}
            {successMessage && (
                <div className="animate-in slide-in-from-top-4 flex items-start gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-700">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold">
                        <Check size={18} />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold">¡Éxito!</p>
                        <p className="text-sm">{successMessage}</p>
                    </div>
                    <button
                        onClick={() => setSuccessMessage(null)}
                        className="p-1 opacity-50 hover:opacity-100"
                        aria-label="Cerrar mensaje de éxito"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Banner error */}
            {error && (
                <div className="animate-in slide-in-from-top-4 flex items-start gap-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold">!</div>
                    <div className="flex-1">
                        <p className="font-bold">Error al procesar</p>
                        <p className="text-sm">{error}</p>
                    </div>
                    <button
                        onClick={() => setError(null)}
                        className="p-1 opacity-50 hover:opacity-100"
                        aria-label="Cerrar mensaje de error"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Plans Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 xl:grid-cols-5">
                {plans.map((plan) => {
                    const isCurrent = isCurrentPlan(plan.key);
                    const isPlanLoading = isLoading(plan.key);

                    return (
                        <div
                            key={plan.key}
                            className={`relative flex flex-col rounded-3xl border bg-white transition-shadow ${plan.recommended
                                ? 'border-indigo-200 shadow-xl ring-2 ring-indigo-600'
                                : isCurrent
                                    ? 'border-emerald-200 ring-2 ring-emerald-500'
                                    : 'border-gray-200 shadow-sm hover:shadow-md'
                                }`}
                        >
                            {isCurrent && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                                        <BadgeCheck size={12} />
                                        Tu plan actual
                                    </span>
                                </div>
                            )}

                            {plan.recommended && !isCurrent && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">
                                        Más Popular
                                    </span>
                                </div>
                            )}

                            {/* Plan Header */}
                            <div className="p-6">
                                <h3 className="text-xl font-black text-gray-900">{plan.name}</h3>
                                <p className="mt-1 text-sm text-gray-500">{plan.description}</p>

                                <div className="mt-4 flex items-baseline gap-1">
                                    {plan.price === null ? (
                                        <span className="text-2xl font-black text-gray-900">A medida</span>
                                    ) : plan.price === 0 ? (
                                        <span className="text-4xl font-black text-gray-900">Gratis</span>
                                    ) : (
                                        <>
                                            <span className="text-4xl font-black text-gray-900">€{plan.price}</span>
                                            <span className="text-gray-500">/mes</span>
                                        </>
                                    )}
                                </div>

                                <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                                    <Users size={14} />
                                    <span>
                                        {plan.seatLimit >= 999
                                            ? 'Usuarios ilimitados'
                                            : `Hasta ${plan.seatLimit} usuarios`}
                                    </span>
                                </div>
                            </div>

                            {/* Features */}
                            <div className="flex-1 border-t border-gray-100 px-6 py-4">
                                <ul className="space-y-2.5">
                                    {plan.features.map((feature, index) => (
                                        <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                                            <Check size={14} className="mt-0.5 shrink-0 text-green-600" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* CTA */}
                            <div className="border-t border-gray-100 p-6">
                                {isCurrent ? (
                                    <button
                                        disabled
                                        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 font-bold text-emerald-700"
                                        aria-label={`Plan ${plan.name} ya está activo`}
                                    >
                                        <BadgeCheck size={18} />
                                        Plan Activo
                                    </button>
                                ) : plan.key === 'enterprise' ? (
                                    <button
                                        onClick={handleContactSales}
                                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-700 transition-all hover:bg-gray-50 active:scale-95"
                                        aria-label="Contactar ventas para plan Enterprise"
                                    >
                                        <Building2 size={18} />
                                        Contactar Ventas
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleSubscribe(plan)}
                                        disabled={isPlanLoading}
                                        className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${plan.recommended
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700'
                                            : 'bg-gray-900 text-white hover:bg-gray-800'
                                            }`}
                                        aria-label={
                                            isPlanLoading
                                                ? 'Procesando suscripción'
                                                : `Suscribirse al plan ${plan.name}`
                                        }
                                    >
                                        {isPlanLoading ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <ArrowRight size={18} />
                                        )}
                                        {isPlanLoading
                                            ? 'Procesando...'
                                            : plan.price === 0
                                                ? 'Comenzar Gratis'
                                                : currentPlanKey
                                                    ? 'Cambiar Plan'
                                                    : 'Suscribirse'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-1 gap-4 rounded-2xl bg-gray-50 p-6 lg:grid-cols-3">
                <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
                        <Zap size={20} />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">Setup Instantáneo</p>
                        <p className="text-xs text-gray-500">Comienza en menos de 5 minutos</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
                        <Check size={20} />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">Sin Tarjeta Requerida</p>
                        <p className="text-xs text-gray-500">Prueba gratis sin compromiso</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
                        <Building2 size={20} />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">Soporte Dedicado</p>
                        <p className="text-xs text-gray-500">Estamos aquí para ayudarte</p>
                    </div>
                </div>
            </div>
        </div>
    );
}