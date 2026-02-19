import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import {
    Plus,
    Building2,
    Users,
    Search,
    ArrowRight,
    ShieldCheck,
    Globe,
    Mail,
    Loader2,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';

export default function PlatformAdmin() {
    const { user, enterCompanyAsFounder } = useAuth();
    const [companies, setCompanies] = useState<any[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Form states
    const [companyName, setCompanyName] = useState('');
    const [companySlug, setCompanySlug] = useState('');
    const [adminEmail, setAdminEmail] = useState('');

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            setLoading(true);
            const [companiesRes, metricsRes] = await Promise.all([
                supabase
                    .from('companies')
                    .select('*')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('platform_metrics')
                    .select('*')
                    .single()
            ]);

            if (companiesRes.error) throw companiesRes.error;
            if (metricsRes.error) throw metricsRes.error;

            setCompanies(companiesRes.data || []);
            setMetrics(metricsRes.data);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleProvision = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatusMessage(null);

        try {
            // Llamar a la Edge Function (BETA: beto-create-company)
            const { data, error } = await supabase.functions.invoke('beto-create-company', {
                body: {
                    company_name: companyName,
                    company_slug: companySlug,
                    admin_email: adminEmail
                }
            });

            if (error) throw error;

            setStatusMessage({
                type: 'success',
                text: `Tenant provisionado con éxito: ${adminEmail}. El ID de empresa es ${data.company_id}.`
            });

            // Limpiar form y refrescar lista
            setCompanyName('');
            setCompanySlug('');
            setAdminEmail('');
            setShowForm(false);
            fetchCompanies();
        } catch (err: any) {
            console.error('Provisioning error:', err);
            setStatusMessage({
                type: 'error',
                text: err.message || 'Error al provisionar el tenant.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] p-8 md:p-12 animate-in fade-in duration-700">
            <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <ShieldCheck size={24} />
                        </div>
                        <span className="font-black text-blue-600 tracking-widest text-sm uppercase">Panel de Plataforma</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Control Maestro BETO</h1>
                    <p className="text-slate-500 font-medium mt-2">Gestión global de tenants y provisión de servicios.</p>
                </div>

                <button
                    onClick={() => setShowForm(!showForm)}
                    className="group bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 transition-all shadow-xl shadow-slate-200 active:scale-95"
                >
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                    Provisionar Nuevo Tenant
                </button>
            </header>

            <main className="max-w-7xl mx-auto space-y-12">

                {/* METRICS SUMMARY BAR */}
                <section className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {[
                        { label: 'Total Tenants', value: metrics?.total_tenants || 0, icon: Building2, color: 'blue' },
                        { label: 'Activos', value: metrics?.active_tenants || 0, icon: CheckCircle2, color: 'emerald' },
                        { label: 'Suspendidos', value: metrics?.suspended_tenants || 0, icon: AlertCircle, color: 'red' },
                        { label: 'MRR Est.', value: `$${metrics?.mrr_estimate || 0}`, icon: Globe, color: 'indigo' }
                    ].map((stat, i) => (
                        <div key={i} className="bg-white rounded-3xl p-8 border border-white shadow-[0_8px_32px_-12px_rgba(0,0,0,0.04)] relative overflow-hidden group">
                            <div className={`absolute top-0 right-0 w-16 h-16 bg-${stat.color}-50 rounded-bl-full opacity-40 transform translate-x-4 -translate-y-4`}></div>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl flex items-center justify-center`}>
                                    <stat.icon size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                                    <p className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </section>

                {statusMessage && (
                    <div className={`p-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-500 ${statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                        }`}>
                        {statusMessage.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                        <p className="font-bold">{statusMessage.text}</p>
                    </div>
                )}

                {showForm && (
                    <section className="bg-white rounded-[2.5rem] p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] border border-white relative overflow-hidden animate-in zoom-in-95 duration-500">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full opacity-50"></div>
                        <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
                            <Building2 className="text-blue-600" /> Detalle de Provisión
                        </h2>

                        <form onSubmit={handleProvision} className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Nombre Comercial</label>
                                <input
                                    type="text"
                                    required
                                    value={companyName}
                                    onChange={e => setCompanyName(e.target.value)}
                                    placeholder="Ej: Manufactura Norte"
                                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">ID / Slug único</label>
                                <input
                                    type="text"
                                    required
                                    value={companySlug}
                                    onChange={e => setCompanySlug(e.target.value)}
                                    placeholder="ej-slug-empresa"
                                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-blue-500 font-bold transition-all lowercase"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Email del Administrador</label>
                                <input
                                    type="email"
                                    required
                                    value={adminEmail}
                                    onChange={e => setAdminEmail(e.target.value)}
                                    placeholder="admin@empresa.com"
                                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                                />
                            </div>

                            <div className="md:col-span-3 flex justify-end items-center gap-6 pt-4 border-t border-slate-50">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="text-slate-400 font-black hover:text-slate-900 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={isSubmitting}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-blue-100 flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                                    Ejecutar Provisión
                                </button>
                            </div>
                        </form>
                    </section>
                )}

                <section>
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                            Tenants Activos <span className="text-slate-300 font-medium text-lg italic ml-2">{companies.length}</span>
                        </h2>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar empresa..."
                                className="bg-white border-none rounded-2xl pl-12 pr-6 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500 transition-all w-64"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {loading ? (
                            Array(6).fill(0).map((_, i) => (
                                <div key={i} className="bg-white h-48 rounded-[2.5rem] animate-pulse border border-slate-50"></div>
                            ))
                        ) : companies.map(company => (
                            <div key={company.id} className="group bg-white rounded-[2.5rem] p-8 border border-white shadow-[0_16px_32px_-12px_rgba(0,0,0,0.04)] hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] transition-all duration-500 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full opacity-20 transform translate-x-12 -translate-y-12 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-700"></div>

                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors duration-500">
                                        <Building2 size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">{company.name}</h3>
                                        <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                            <Globe size={10} />
                                            {company.slug}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400 font-black tracking-widest text-[10px] uppercase">Plan</span>
                                        <span className={`font-black uppercase text-[10px] tracking-widest px-3 py-1 rounded-full ${company.subscription_tier === 'premium' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-500'
                                            }`}>
                                            {company.subscription_tier}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400 font-black tracking-widest text-[10px] uppercase">Estado</span>
                                        <span className="text-emerald-500 font-black tracking-widest text-[10px] uppercase flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                            {company.subscription_status}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex -space-x-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => enterCompanyAsFounder(company.id)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        Entrar <ArrowRight size={12} />
                                    </button>
                                    <button className="text-slate-400 hover:text-slate-900 transition-colors">
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
