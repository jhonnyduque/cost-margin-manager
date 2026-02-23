import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { CreditCard, ArrowRight, CheckCircle, Building2 } from 'lucide-react';
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
                // SuperAdmin: cargar todas las empresas
                const { data } = await supabase
                    .from('companies')
                    .select('id, name, slug, subscription_status, subscription_tier, current_period_end, stripe_subscription_id')
                    .order('created_at', { ascending: false });

                setCompanies(data || []);
            } else if (currentCompany) {
                // Usuario normal: cargar solo su empresa
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

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <div className="animate-spin text-indigo-600 text-4xl">⟳</div>
                <span className="ml-3 text-gray-600">Cargando...</span>
            </div>
        );
    }

    // Vista para SuperAdmin
    if (user?.is_super_admin) {
        return (
            <div className="animate-in fade-in space-y-8 duration-700">
                <header>
                    <h1 className="text-3xl font-black tracking-tight text-gray-900">
                        Facturación - Platform Admin
                    </h1>
                    <p className="mt-1 font-medium text-gray-500">
                        Gestión de suscripciones de todas las empresas
                    </p>
                </header>

                <div className="rounded-2xl border border-gray-200 bg-white">
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
                                                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                                                    {planNames[company.subscription_tier] || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${company.subscription_status === 'active'
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : company.subscription_status === 'trialing'
                                                        ? 'bg-blue-50 text-blue-700'
                                                        : 'bg-gray-100 text-gray-700'
                                                    }`}>
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

    // Vista para usuario normal (con currentCompany)
    return (
        <div className="animate-in fade-in space-y-8 duration-700">
            <header>
                <h1 className="text-3xl font-black tracking-tight text-gray-900">
                    Facturación y Suscripción
                </h1>
                <p className="mt-1 font-medium text-gray-500">
                    Gestiona tu plan y métodos de pago
                </p>
            </header>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Plan Actual */}
                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Plan Actual</h3>
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
                    <div className="mt-6">
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
                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Método de Pago</h3>
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
                    <div className="mt-6">
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