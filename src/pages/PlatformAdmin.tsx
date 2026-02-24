import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { Company } from '@/types';
import { Server, Users, AlertTriangle, Layers, CreditCard, UserPlus, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function PlatformAdmin() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        const { data } = await supabase.from('companies').select('id, name, slug, seat_count, seat_limit, subscription_status, subscription_tier');
        if (data) setCompanies(data);
        setLoading(false);
    };

    if (!user?.is_super_admin) {
        return <div className="p-8 text-center text-red-500">Access Denied: Restricted to Platform Founder.</div>;
    }

    // Real computed metrics
    const totalEnvironments = companies.length;
    const totalUsers = companies.reduce((acc, c) => acc + (c.seat_count || 0), 0);
    const alertCompanies = companies.filter(c => !['active', 'trialing'].includes(c.subscription_status || ''));
    const nearCapacity = companies.filter(c => {
        const usage = (c.seat_count || 0) / (c.seat_limit || 1);
        return usage >= 0.85;
    });
    const needsAttention = [...alertCompanies, ...nearCapacity.filter(c => !alertCompanies.find(a => a.id === c.id))];

    // Tier distribution
    const tierCounts: Record<string, number> = {};
    companies.forEach(c => {
        const tier = c.subscription_tier || 'demo';
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'Admin';

    return (
        <div className="animate-in fade-in space-y-6 lg:space-y-8 duration-500">
            {/* Greeting Header */}
            <div>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
                    {greeting}, {userName} 👋
                </h1>
                <p className="mt-1 text-sm lg:text-base text-slate-500">
                    Resumen de tu plataforma · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
            </div>

            {/* KPI Cards - clickable */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
                <button
                    onClick={() => navigate('/platform/environments')}
                    className="rounded-xl border border-slate-200 bg-white p-4 lg:p-6 shadow-sm text-left transition-all hover:border-indigo-200 hover:shadow-md active:scale-[0.98]"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs lg:text-sm font-medium text-slate-500">Entornos</span>
                        <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                            <Server size={16} />
                        </div>
                    </div>
                    <p className="mt-2 text-2xl lg:text-3xl font-bold text-slate-900">{loading ? '-' : totalEnvironments}</p>
                    <p className="text-xs text-indigo-500 font-medium mt-1">Ver todos →</p>
                </button>

                <button
                    onClick={() => navigate('/platform/users')}
                    className="rounded-xl border border-slate-200 bg-white p-4 lg:p-6 shadow-sm text-left transition-all hover:border-indigo-200 hover:shadow-md active:scale-[0.98]"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs lg:text-sm font-medium text-slate-500">Seats Asignados</span>
                        <div className="rounded-full bg-emerald-50 p-2 text-emerald-600">
                            <Users size={16} />
                        </div>
                    </div>
                    <p className="mt-2 text-2xl lg:text-3xl font-bold text-slate-900">{loading ? '-' : totalUsers}</p>
                    <p className="text-xs text-indigo-500 font-medium mt-1">Ver equipo →</p>
                </button>

                <button
                    onClick={() => navigate('/platform/billing')}
                    className="rounded-xl border border-slate-200 bg-white p-4 lg:p-6 shadow-sm text-left transition-all hover:border-indigo-200 hover:shadow-md active:scale-[0.98]"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs lg:text-sm font-medium text-slate-500">Planes Activos</span>
                        <div className="rounded-full bg-indigo-50 p-2 text-indigo-600">
                            <CreditCard size={16} />
                        </div>
                    </div>
                    <p className="mt-2 text-2xl lg:text-3xl font-bold text-slate-900">
                        {loading ? '-' : companies.filter(c => ['active', 'trialing'].includes(c.subscription_status || '')).length}
                    </p>
                    <p className="text-xs text-indigo-500 font-medium mt-1">Ver billing →</p>
                </button>

                <div className="rounded-xl border border-slate-200 bg-white p-4 lg:p-6 shadow-sm text-left">
                    <div className="flex items-center justify-between">
                        <span className="text-xs lg:text-sm font-medium text-slate-500">Alertas</span>
                        <div className={`rounded-full p-2 ${needsAttention.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            <AlertTriangle size={16} />
                        </div>
                    </div>
                    <p className="mt-2 text-2xl lg:text-3xl font-bold text-slate-900">{loading ? '-' : needsAttention.length}</p>
                    <p className={`text-xs font-medium mt-1 ${needsAttention.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {needsAttention.length > 0 ? 'Requiere atención' : '✓ Todo en orden'}
                    </p>
                </div>
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Acciones Rápidas</h2>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => navigate('/platform/environments')}
                        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
                    >
                        <Layers size={16} />
                        Nuevo Entorno
                    </button>
                    <button
                        onClick={() => navigate('/platform/users')}
                        className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
                    >
                        <UserPlus size={16} />
                        Invitar Usuario
                    </button>
                    <button
                        onClick={() => navigate('/platform/billing')}
                        className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
                    >
                        <CreditCard size={16} />
                        Ver Billing
                    </button>
                </div>
            </div>

            {/* Needs Attention */}
            {needsAttention.length > 0 && (
                <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Requiere Atención</h2>
                    <div className="space-y-2">
                        {needsAttention.map(company => {
                            const seatUsage = (company.seat_count || 0) / (company.seat_limit || 1);
                            const isSubscriptionIssue = !['active', 'trialing'].includes(company.subscription_status || '');
                            const isSeatIssue = seatUsage >= 0.85;

                            return (
                                <button
                                    key={company.id}
                                    onClick={() => navigate('/platform/environments')}
                                    className="w-full flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 lg:p-4 text-left hover:bg-slate-50 active:scale-[0.99] transition-all"
                                >
                                    <div className={`rounded-full p-2 flex-shrink-0 ${isSubscriptionIssue ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                                        <AlertTriangle size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-sm text-slate-900 truncate">{company.name}</p>
                                        <p className="text-xs text-slate-500">
                                            {isSubscriptionIssue && `Suscripción: ${company.subscription_status}`}
                                            {isSubscriptionIssue && isSeatIssue && ' · '}
                                            {isSeatIssue && `Seats: ${company.seat_count}/${company.seat_limit} (${Math.round(seatUsage * 100)}%)`}
                                        </p>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Tier Distribution */}
            {Object.keys(tierCounts).length > 0 && (
                <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Distribución por Plan</h2>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 lg:p-6">
                        <div className="flex flex-wrap gap-4">
                            {Object.entries(tierCounts).map(([tier, count]) => (
                                <div key={tier} className="flex items-center gap-2">
                                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 capitalize">
                                        {tier}
                                    </span>
                                    <span className="text-sm font-bold text-slate-900">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}