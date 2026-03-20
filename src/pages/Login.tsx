import React, { useState, useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';

/**
 * Login — gobernado por global.css v4
 * Panel izquierdo: dark branding con imagen de fondo
 * Panel derecho: formulario limpio sobre fondo blanco
 * Tokens: var(--font-sans), var(--text-*), var(--radius-*), var(--transition-fast)
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

/* ── Estilos del formulario — todos via CSS vars ── */
const fieldStyle: React.CSSProperties = {
    width: '100%',
    height: '3rem',
    padding: '0 var(--space-16)',
    border: '1px solid var(--border-color-default)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--surface-card)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-body-size)',
    outline: 'none',
    transition: `border-color var(--transition-fast), box-shadow var(--transition-fast)`,
    fontFamily: 'var(--font-sans)',
};

const fieldFocusStyle: React.CSSProperties = {
    borderColor: 'var(--border-color-strong)',
    boxShadow: '0 0 0 3px rgba(15,23,42,0.08)',
};

const primaryBtnStyle: React.CSSProperties = {
    width: '100%',
    height: '3rem',
    background: 'var(--state-primary)',
    color: 'var(--text-inverse)',
    border: 'none',
    borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--text-body-size)',
    fontWeight: 700,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    transition: `background var(--transition-fast), box-shadow var(--transition-fast)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-8)',
    boxShadow: 'var(--elevation-button-primary)',
};

const secondaryBtnStyle: React.CSSProperties = {
    width: '100%',
    height: '3rem',
    background: 'var(--surface-card)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color-default)',
    borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--text-body-size)',
    fontWeight: 700,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    transition: `background var(--transition-fast)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-8)',
};

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
            <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-page)' }}>
                <div style={{ fontSize: '1.5rem', color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }}>⟳</div>
            </div>
        );
    }

    if (user) return <Navigate to="/dashboard" replace />;

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError(null); setSuccess(null);
        try {
            const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
            if (authError) throw authError;
            await refreshAuth();
        } catch (err: any) {
            setError(err.message || 'Credenciales inválidas.');
        } finally { setLoading(false); }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError(null); setSuccess(null);
        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (resetError) throw resetError;
            setSuccess('Se han enviado las instrucciones a tu email.');
        } catch (err: any) {
            setError(err.message || 'Error al enviar instrucciones.');
        } finally { setLoading(false); }
    };

    const handleGoogle = async () => {
        await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/dashboard` } });
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'var(--font-sans)' }}>

            {/* ── Panel izquierdo — branding oscuro ── */}
            <div style={{ display: 'none', width: '30rem', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', color: '#ffffff' }}
                className="lg-flex">
                <img src={panel.image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
                <div style={{ position: 'relative', zIndex: 1, padding: 'var(--space-40)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                    <div>
                        <span style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
                            BETO<span style={{ opacity: 0.55, marginLeft: 4 }}>OS</span>
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 900, lineHeight: 1.15, whiteSpace: 'pre-line', margin: 0 }}>
                            {panel.headline}
                        </h1>
                        <p style={{ fontSize: 'var(--text-body-size)', opacity: 0.7, maxWidth: '22rem', lineHeight: 1.6, margin: 0 }}>
                            {panel.subtitle}
                        </p>
                    </div>
                    <p style={{ fontSize: 'var(--text-caption-size)', opacity: 0.3, margin: 0 }}>
                        © {new Date().getFullYear()} BETO OS. Gestión inteligente.
                    </p>
                </div>
            </div>

            {/* ── Panel derecho — formulario ── */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-24)', background: '#ffffff' }}>
                <div style={{ width: '100%', maxWidth: '26rem' }}>

                    {/* Logo móvil */}
                    <div style={{ marginBottom: 'var(--space-32)', display: 'block' }} className="lg-hide">
                        <span style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                            BETO<span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>OS</span>
                        </span>
                    </div>

                    {mode === 'login' ? (
                        <>
                            <h2 style={{ fontSize: 'var(--text-h1-size)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Iniciar sesión</h2>
                            <p style={{ marginTop: 'var(--space-8)', fontSize: 'var(--text-small-size)', color: 'var(--text-muted)', marginBottom: 0 }}>
                                Ingresa a tu cuenta para acceder a tu plataforma.
                            </p>

                            {error && (
                                <div style={{ marginTop: 'var(--space-16)', padding: 'var(--space-12) var(--space-16)', background: 'var(--surface-danger-soft)', border: '1px solid var(--border-color-danger)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-small-size)', color: 'var(--state-danger)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-12)' }}>
                                    <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                                    <p style={{ margin: 0, fontWeight: 500 }}>{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleLogin} style={{ marginTop: 'var(--space-24)', display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                                <div>
                                    <label htmlFor="email" style={{ display: 'block', fontSize: 'var(--text-small-size)', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>Email</label>
                                    <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                        style={fieldStyle} placeholder="tu@email.com"
                                        onFocus={e => Object.assign(e.target.style, fieldFocusStyle)}
                                        onBlur={e => { e.target.style.borderColor = 'var(--border-color-default)'; e.target.style.boxShadow = 'none'; }} />
                                </div>
                                <div>
                                    <label htmlFor="password" style={{ display: 'block', fontSize: 'var(--text-small-size)', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>Contraseña</label>
                                    <input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)}
                                        style={fieldStyle} placeholder="••••••••"
                                        onFocus={e => Object.assign(e.target.style, fieldFocusStyle)}
                                        onBlur={e => { e.target.style.borderColor = 'var(--border-color-default)'; e.target.style.boxShadow = 'none'; }} />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                                            style={{ width: '1rem', height: '1rem', accentColor: 'var(--slate-900)', cursor: 'pointer' }} />
                                        <span style={{ fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)' }}>Recordarme</span>
                                    </label>
                                    <button type="button" onClick={() => { setMode('forgot'); setError(null); setSuccess(null); }}
                                        style={{ fontSize: 'var(--text-small-size)', fontWeight: 500, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', transition: `color var(--transition-fast)` }}
                                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </div>

                                <button type="submit" disabled={loading} style={{ ...primaryBtnStyle, opacity: loading ? 0.7 : 1 }}
                                    onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--state-primary-hover)'; }}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--state-primary)')}>
                                    {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                                </button>
                            </form>

                            {/* Divider */}
                            <div style={{ margin: 'var(--space-24) 0', display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                                <div style={{ flex: 1, height: '1px', background: 'var(--border-color-default)' }} />
                                <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>o continúa con</span>
                                <div style={{ flex: 1, height: '1px', background: 'var(--border-color-default)' }} />
                            </div>

                            <button onClick={handleGoogle} style={secondaryBtnStyle}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-page)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-card)')}>
                                <svg width="16" height="16" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Google
                            </button>
                        </>
                    ) : (
                        <>
                            <h2 style={{ fontSize: 'var(--text-h1-size)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>¿Olvidaste tu contraseña?</h2>
                            <p style={{ marginTop: 'var(--space-8)', fontSize: 'var(--text-small-size)', color: 'var(--text-muted)', marginBottom: 0 }}>
                                Ingresa tu email y te enviaremos instrucciones para restaurarla.
                            </p>

                            {error && (
                                <div style={{ marginTop: 'var(--space-16)', padding: 'var(--space-12) var(--space-16)', background: 'var(--surface-danger-soft)', border: '1px solid var(--border-color-danger)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-small-size)', color: 'var(--state-danger)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-12)' }}>
                                    <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                                    <p style={{ margin: 0, fontWeight: 500 }}>{error}</p>
                                </div>
                            )}

                            {success && (
                                <div style={{ marginTop: 'var(--space-16)', padding: 'var(--space-12) var(--space-16)', background: 'var(--surface-success-soft)', border: '1px solid var(--border-color-success)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-small-size)', color: 'var(--state-success)' }}>
                                    <p style={{ margin: 0, fontWeight: 500 }}>{success}</p>
                                </div>
                            )}

                            <form onSubmit={handleForgotPassword} style={{ marginTop: 'var(--space-24)', display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                                <div>
                                    <label htmlFor="email" style={{ display: 'block', fontSize: 'var(--text-small-size)', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>Email</label>
                                    <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                        style={fieldStyle} placeholder="tu@email.com"
                                        onFocus={e => Object.assign(e.target.style, fieldFocusStyle)}
                                        onBlur={e => { e.target.style.borderColor = 'var(--border-color-default)'; e.target.style.boxShadow = 'none'; }} />
                                </div>

                                <button type="submit" disabled={loading || !!success} style={{ ...primaryBtnStyle, opacity: (loading || !!success) ? 0.7 : 1 }}>
                                    {loading ? 'Enviando...' : 'Enviar instrucciones'}
                                </button>

                                <button type="button" onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
                                    style={{ width: '100%', textAlign: 'center', fontSize: 'var(--text-small-size)', fontWeight: 500, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', transition: `color var(--transition-fast)` }}
                                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                                    Volver al inicio de sesión
                                </button>
                            </form>
                        </>
                    )}

                    <p style={{ marginTop: 'var(--space-24)', textAlign: 'center', fontSize: 'var(--text-small-size)', color: 'var(--text-muted)' }}>
                        ¿No tienes cuenta?{' '}
                        <Link to="/explore" style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'underline', textUnderlineOffset: '0.15em' }}>
                            Crear cuenta
                        </Link>
                    </p>
                </div>
            </div>

            {/* Responsive — el panel izquierdo solo aparece en desktop */}
            <style>{`
                @media (min-width: 64rem) {
                    .lg-flex { display: flex !important; }
                    .lg-hide { display: none !important; }
                }
            `}</style>
        </div>
    );
};

export default Login;