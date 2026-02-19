
import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Calculator, Mail, Lock, LogIn, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const { user, isLoading } = useAuth();

    // Redirigir si ya está logueado
    if (!isLoading && user) {
        return <Navigate to="/" replace />;
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            // Optional: If we have a session, we can force a short wait or navigate
            // but the AuthProvider should handle the redirect via 'user' state.
            // Adding a small delay to allow AuthProvider to transition to isLoading=true
            console.log('Login success, waiting for AuthProvider...');
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'Credenciales inválidas o error de conexión.');
            setLoading(false); // Only reset loading on error
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

            <div className="max-w-md w-full relative z-10">
                <div className="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-white p-10 md:p-12 text-center">
                    <div className="mb-10 inline-flex items-center justify-center">
                        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200">
                            <Calculator size={28} />
                        </div>
                    </div>

                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">
                        Bienvenido de nuevo
                    </h1>
                    <p className="text-slate-500 font-medium mb-10">
                        Ingresa tus credenciales para continuar
                    </p>

                    <form onSubmit={handleLogin} className="space-y-6 text-left">
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    required
                                    type="email"
                                    placeholder="hola@empresa.com"
                                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all placeholder:text-slate-300"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    required
                                    type="password"
                                    placeholder="••••••••"
                                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all placeholder:text-slate-300"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                                <p className="text-xs font-bold text-red-700 leading-tight">{error}</p>
                            </div>
                        )}

                        <button
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black text-base shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    Log In <LogIn size={18} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center mt-8 text-slate-400 font-medium text-sm">
                    ¿No tienes una cuenta? <span className="text-blue-600 font-bold cursor-pointer hover:underline">Contacta a tu administrador</span>
                </p>
            </div>
        </div>
    );
};

export default Login;
