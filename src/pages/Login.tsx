import React, { useState, useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/Button';

/**
 * ARCHIVO DE REFERENCIA ORIGINAL:
 * c:\Users\Beto\Documents\APP\designfolio-new\components\auth\LoginForm.tsx
 * 
 * Lógica aplicada: Réplica 1:1 de clases de Designfolio con escalado 
 * uniforme a 48px (h-12) para inputs y botones.
 */

const PANEL_VARIANTS = [
    {
        image: '/login-bg-1.png',
        headline: 'Controla tus\nmárgenes reales.',
        subtitle: 'Visibilidad total sobre costos, inventario y rentabilidad. Decisiones informadas, negocio protegido.',
    },
    {
        image: '/login-bg-2.png',
        headline: 'Tu inventario,\nsiempre en orden.',
        subtitle: 'Gestión FIFO automática, trazabilidad de lotes y alertas de stock en tiempo real.',
    },
    {
        image: '/login-bg-3.png',
        headline: 'Costos claros,\nprecios inteligentes.',
        subtitle: 'Cálculo preciso de costos de producción con sugerencias de precios basadas en datos reales.',
    },
    {
        image: '/login-bg-4.png',
        headline: 'Protege tu\nrentabilidad.',
        subtitle: 'Motor de protección activa que detecta riesgos antes de que impacten tu operación.',
    },
] as const;

const Login: React.FC = () => {
    const [mode, setMode] = useState<'login' | 'forgot'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const { user, isLoading: authLoading, refreshAuth } = useAuth();

    const panel = useMemo(
        () => PANEL_VARIANTS[Math.floor(Math.random() * PANEL_VARIANTS.length)],
        []
    );

    if (authLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="animate-spin text-gray-400 text-2xl">⟳</div>
            </div>
        );
    }

    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;
            await refreshAuth();
        } catch (err: any) {
            setError(err.message || 'Credenciales inválidas.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (resetError) throw resetError;
            setSuccess('Se han enviado las instrucciones a tu email.');
        } catch (err: any) {
            setError(err.message || 'Error al enviar instrucciones.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/dashboard`,
            },
        });
    };

    return (
        <div className="min-h-screen flex">
            {/* ── Left Panel ────────────────────────────────────────────────── */}
            <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col justify-between relative overflow-hidden text-white">
                <img src={panel.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/40" />
                <div className="relative z-10 p-10 flex flex-col justify-between h-full">
                    <div>
                        <span className="text-2xl font-black tracking-tight">
                            BETO<span className="opacity-60 ml-1">OS</span>
                        </span>
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-3xl font-black leading-tight whitespace-pre-line">{panel.headline}</h1>
                        <p className="text-base opacity-70 max-w-sm leading-relaxed">{panel.subtitle}</p>
                    </div>
                    <p className="text-xs opacity-30">© {new Date().getFullYear()} BETO OS. Gestión inteligente.</p>
                </div>
            </div>

            {/* ── Right Panel ───────────────────────────────────────────────── */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-white">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden mb-8">
                        <span className="text-2xl font-bold tracking-tight text-gray-900">
                            BETO<span className="text-gray-400 ml-1">OS</span>
                        </span>
                    </div>

                    {mode === 'login' ? (
                        <>
                            <h2 className="text-2xl font-bold text-gray-900">Iniciar sesión</h2>
                            <p className="mt-2 text-sm text-gray-500">Ingresa a tu cuenta para acceder a tu plataforma.</p>

                            {error && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-3">
                                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                                    <p className="font-medium">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleLogin} className="mt-6 space-y-4">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                                    <input
                                        id="email"
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="mt-1 block w-full h-12 rounded-lg border border-gray-300 px-4 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition-colors"
                                        placeholder="tu@email.com"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">Contraseña</label>
                                    <input
                                        id="password"
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="mt-1 block w-full h-12 rounded-lg border border-gray-300 px-4 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition-colors"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={remember}
                                            onChange={(e) => setRemember(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                                        />
                                        <span className="text-sm text-gray-600">Recordarme</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => { setMode('forgot'); setError(null); setSuccess(null); }}
                                        className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </div>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={loading}
                                    isLoading={loading}
                                    className="w-full !h-12 !bg-gray-900 hover:!bg-gray-800 focus:ring-2 focus:ring-gray-900 !rounded-lg !text-sm !font-bold !normal-case !tracking-normal"
                                >
                                    Iniciar sesión
                                </Button>
                            </form>

                            <div className="my-6 flex items-center gap-3">
                                <div className="flex-1 h-px bg-gray-200" />
                                <span className="text-xs text-gray-400 uppercase">o continúa con</span>
                                <div className="flex-1 h-px bg-gray-200" />
                            </div>

                            <Button
                                variant="secondary"
                                onClick={handleGoogle}
                                className="w-full !h-12 !border-gray-300 !rounded-lg !text-gray-700 hover:!bg-gray-50 !text-sm !font-bold !normal-case !tracking-normal"
                                icon={
                                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                }
                            >
                                Google
                            </Button>
                        </>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold text-gray-900">¿Olvidaste tu contraseña?</h2>
                            <p className="mt-2 text-sm text-gray-500">Ingresa tu email y te enviaremos instrucciones para restaurarla.</p>

                            {error && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-3">
                                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                                    <p className="font-medium">{error}</p>
                                </div>
                            )}

                            {success && (
                                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-start gap-3">
                                    <p className="font-medium">{success}</p>
                                </div>
                            )}

                            <form onSubmit={handleForgotPassword} className="mt-6 space-y-4">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                                    <input
                                        id="email"
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="mt-1 block w-full h-12 rounded-lg border border-gray-300 px-4 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition-colors"
                                        placeholder="tu@email.com"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={loading || !!success}
                                    isLoading={loading}
                                    className="w-full !h-12 !bg-gray-900 hover:!bg-gray-800 focus:ring-2 focus:ring-gray-900 !rounded-lg !text-sm !font-bold !normal-case !tracking-normal"
                                >
                                    Enviar instrucciones
                                </Button>

                                <button
                                    type="button"
                                    onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
                                    className="w-full text-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                                >
                                    Volver al inicio de sesión
                                </button>
                            </form>
                        </>
                    )}

                    <p className="mt-6 text-center text-sm text-gray-500">
                        ¿No tienes cuenta?{' '}
                        <Link 
                            to="/explore"
                            className="font-medium text-gray-900 hover:underline"
                        >
                            Crear cuenta
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;