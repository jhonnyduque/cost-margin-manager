
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Sparkles, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useStore } from '../store';
import { useAuth } from '../hooks/useAuth';

const Onboarding: React.FC = () => {
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const setCurrentCompany = useStore((state) => state.setCurrentCompany);
    const { user, isLoading, resetState } = useAuth();

    // 🛡️ Redirigir si la sesión se pierde mientras está en esta pantalla
    useEffect(() => {
        if (!isLoading && !user) {
            console.log('[Onboarding] Session lost, redirecting to login');
            navigate('/login');
        }
    }, [user, isLoading, navigate]);

    // Auto-generación de slug
    useEffect(() => {
        const generatedSlug = name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
        setSlug(generatedSlug);
    }, [name]);

    const handleLogoutAndRedirect = () => {
        supabase.auth.signOut();
        resetState();
        navigate('/login');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Verificar sesión real en Supabase antes de intentar la creación
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                handleLogoutAndRedirect();
                throw new Error('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
            }

            // 🔹 LLAMADA ATÓMICA VÍA RPC
            // Ejecuta Company Insert + Member Insert + User Update en una sola transacción
            const { data: company, error: rpcError } = await supabase.rpc('create_company_with_owner', {
                company_name: name,
                company_slug: slug
            });

            if (rpcError) {
                if (rpcError.code === '23505') {
                    throw new Error('Este nombre de empresa o identificador ya está en curso. Prueba con otro nombre.');
                }
                throw rpcError;
            }

            // Actualizar Store Local (Sincronización inmediata)
            setCurrentCompany(company.id, 'owner');

            // Éxito!
            navigate('/');

        } catch (err: any) {
            console.error('Error en onboarding:', err);
            setError(err.message || 'Ocurrió un error inesperado al crear tu empresa.');
        } finally {
            setLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-blue-600" size={40} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[120px] opacity-60"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-[120px] opacity-60"></div>

            <div className="max-w-xl w-full relative z-10">
                <div className="bg-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-white p-12 md:p-16">
                    <div className="mb-12 text-center md:text-left">
                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-xl shadow-blue-200 mx-auto md:mx-0">
                            <Building2 size={32} />
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-4">
                            Crea tu espacio de trabajo
                        </h1>
                        <p className="text-slate-500 font-medium text-lg leading-relaxed">
                            Comencemos configurando tu empresa. Solo te tomará un minuto.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                                Nombre de la Empresa
                            </label>
                            <input
                                required
                                type="text"
                                placeholder="Ej. Mi Taller Creativo"
                                className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl text-lg font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all placeholder:text-slate-300"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                Identificador (Slug) <Sparkles size={12} className="text-blue-500" />
                            </label>
                            <div className="relative">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">/</span>
                                <input
                                    readOnly
                                    type="text"
                                    className="w-full pl-10 pr-6 py-5 bg-slate-100/50 border border-slate-100 rounded-2xl text-lg font-mono font-bold text-slate-500 outline-none cursor-default"
                                    value={slug}
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium ml-1">
                                Este será tu identificador único en el sistema.
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-100 p-6 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                                <p className="text-sm font-bold text-red-700 leading-tight">{error}</p>
                            </div>
                        )}

                        <button
                            disabled={loading || !name.trim()}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white py-6 rounded-2xl font-black text-lg shadow-2xl shadow-blue-200 transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={24} />
                            ) : (
                                <>
                                    Crear Empresa <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-10 pt-10 border-t border-slate-50 text-center">
                        <p className="text-slate-400 font-medium text-sm mb-4">¿Ya tienes una empresa configurada?</p>
                        <button
                            type="button"
                            onClick={handleLogoutAndRedirect}
                            className="text-blue-600 font-black text-sm hover:underline flex items-center justify-center gap-2 mx-auto"
                        >
                            Regresar al login e intentar con otra cuenta
                        </button>
                    </div>
                </div>

                <p className="text-center mt-12 text-slate-400 font-medium text-sm">
                    Al continuar, aceptas nuestros términos de servicio y política de privacidad.
                </p>
            </div>
        </div>
    );
};

export default Onboarding;
