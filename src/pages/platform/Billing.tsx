import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { CreditCard, ArrowRight, CheckCircle, Building2, Calendar, Zap, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function Billing() {
    const { currentCompany, user } = useAuth();
    const navigate = useNavigate();
    const [subscription, setSubscription] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [companies, setCompanies] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, [currentCompany, user]);

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

    const planNames: Record<string, string> = {
        demo: 'Demo',
        starter: 'Starter',
        growth: 'Growth',
        scale: 'Scale',
        enterprise: 'Enterprise'
    };

    const planColors: Record<string, string> = {
        demo: 'bg-gray-100 text-gray-700',
        starter: 'bg-blue-50 text-blue-700',
        growth: 'bg-indigo-50 text-indigo-700',
        scale: 'bg-purple-50 text-purple-700',
        enterprise: 'bg-amber-50 text-amber-700'
    };

    const statusConfig: Record<string, { color: string; dot: string }> = {
        active: { color: 'text-emerald-700 bg-emerald-50', dot: 'bg-emerald-500' },
        trialing: { color: 'text-blue-700 bg-blue-50', dot: 'bg-blue-500' },
        canceled: { color: 'text-red-700 bg-red-50', dot: 'bg-red-500' },
        past_due: { color: 'text-orange-700 bg-orange-50', dot: 'bg-orange-500' },
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <div className="animate-spin text-indigo-600 text-4xl">⟳</div>
                <span className="ml-3 text-gray-600">Cargando...</span>
            </div>
        );
    }

    // =============================================
    // SUPER ADMIN VIEW
    // =============================================
    if (user?.is_super_admin) {
        return (
            <div className="animate-in fade-in space-y-6 lg:space-y-8 duration-700">
                <header>
                    <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-gray-900">
                        Facturación
                    </h1>
                    <p className="mt-1 text-sm lg:text-base font-medium text-gray-500">
                        Gestión de suscripciones de todas las empresas
                    </p>
                </header>

                {/* ========== MOBILE: Cards ========== */}
                <div className="space-y-3 md:hidden">
                    {companies.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
                            <Building2 size={48} className="mx-auto mb-3 text-gray-300" />
                            <p className="font-medium text-gray-500">No hay empresas registradas</p>
                        </div>
                    ) : (
                        companies.map((company) => {
                            const status = statusConfig[company.subscription_status] || statusConfig.active;
                            const planColor = planColors[company.subscription_tier] || planColors.demo;

                            return (
                                <button
                                    key={company.id}
                                    onClick={() => navigate(`/platform/billing/checkout?company=${company.id}`)}
                                    className="w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all active:scale-[0.98] text-left"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        {/* Left: Company info */}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 flex-shrink-0">
                                                    <Building2 size={16} className="text-indigo-600" />
                                                </div>
                                                <h3 className="font-bold text-gray-900 truncate">{company.name}</h3>
                                            </div>
                                            <p className="text-xs text-gray-400 ml-10">{company.slug}</p>
                                        </div>

                                        {/* Right: Arrow */}
                                        <ChevronRight size={18} className="text-gray-300 flex-shrink-0 mt-1" />
                                    </div>

                                    {/* Badges row */}
                                    <div className="flex items-center gap-2 mt-3 ml-10">
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${planColor}`}>
                                            <Zap size={10} />
                                            {planNames[company.subscription_tier] || 'N/A'}
                                        </span>
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${status.color}`}>
                                            <span className={`size-1.5 rounded-full ${status.dot}`} />
                                            {company.subscription_status || 'N/A'}
                                        </span>
                                    </div>

                                    {/* Renewal date */}
                                    {company.current_period_end && (
                                        <div className="flex items-center gap-1.5 mt-2.5 ml-10">
                                            <Calendar size={12} className="text-gray-400" />
                                            <span className="text-xs text-gray-400">
                                                Renueva: {new Date(company.current_period_end).toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* ========== DESKTOP: Table ========== */}
                <div className="hidden md:block rounded-2xl border border-gray-200 bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-gray-100 bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                                        Empresa
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                                        Plan
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                                        Estado
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                                        Renovación
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {companies.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            <Building2 size={48} className="mx-auto mb-3 opacity-20" />
                                            <p className="font-medium">No hay empresas registradas</p>
                                        </td>
                                    </tr>
                                ) : (
                                    companies.map((company) => (
                                        <tr key={company.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{company.name}</div>
                                                <div className="text-xs text-gray-500">{company.slug}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${planColors[company.subscription_tier] || planColors.demo}`}>
                                                    {planNames[company.subscription_tier] || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${(statusConfig[company.subscription_status] || statusConfig.active).color}`}>
                                                    <span className={`size-1.5 rounded-full ${(statusConfig[company.subscription_status] || statusConfig.active).dot}`} />
                                                    {company.subscription_status || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {company.current_period_end
                                                    ? new Date(company.current_period_end).toLocaleDateString()
                                                    : '—'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button
                                                    onClick={() => navigate(`/platform/billing/checkout?company=${company.id}`)}
                                                    variant="outline"
                                                    size="sm"
                                                    icon={<ArrowRight size={14} />}
                                                >
                                                    Gestionar
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // =============================================
    // TENANT/USER VIEW
    // =============================================
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
                {/* Plan Actual */}
                <Card className="p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-gray-900">Plan Actual</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {subscription?.subscription_tier
                                    ? planNames[subscription.subscription_tier] || 'N/A'
                                    : 'Sin plan activo'}
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
                        <Button
                            onClick={() => navigate('/platform/billing/checkout')}
                            variant="outline"
                            className="w-full"
                            icon={<ArrowRight size={18} />}
                        >
                            Cambiar Plan
                        </Button>
                    </div>
                </Card>

                {/* Método de Pago */}
                <Card className="p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-gray-900">Método de Pago</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {subscription?.stripe_subscription_id
                                    ? 'Tarjeta registrada'
                                    : 'No registrada'}
                            </p>
                        </div>
                        <div className="flex size-12 items-center justify-center rounded-full bg-indigo-100">
                            <CreditCard size={24} className="text-indigo-600" />
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-6">
                        <Button
                            onClick={() => navigate('/platform/billing/portal')}
                            variant="outline"
                            className="w-full"
                        >
                            Gestionar Pago
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}