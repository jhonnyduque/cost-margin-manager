import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Calculator, LogIn, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { tokens } from '@/design/design-tokens';
import { Card } from '@/components/ui/Card';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ✅ dejamos refreshAuth
    const { user, isLoading: authLoading, refreshAuth } = useAuth();

    // Loading sesión
    if (authLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: tokens.colors.bg }}>
                <div className="animate-spin text-blue-600 text-4xl">⟳</div>
            </div>
        );
    }

    // ✅ Redirect automático cuando AuthProvider carga usuario
    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            console.log('[Login] Sign in success');

            // 🔥 IMPORTANTE:
            // despierta AuthProvider para cargar user + empresa
            await refreshAuth();

        } catch (err: any) {
            console.error('[Login] error:', err);
            setError(err.message || 'Credenciales inválidas.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: tokens.colors.bg }}>
            <div className="w-full max-w-md">
                <Card className="p-10 text-center">

                    <div className="mb-8 inline-flex items-center justify-center">
                        <div
                            style={{
                                width: '56px',
                                height: '56px',
                                backgroundColor: tokens.colors.brand,
                                borderRadius: tokens.radius.md,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: tokens.colors.surface
                            }}
                        >
                            <Calculator size={28} />
                        </div>
                    </div>

                    <h1 style={{
                        fontSize: tokens.typography.titleLg.fontSize,
                        fontWeight: tokens.typography.titleLg.fontWeight,
                        color: tokens.colors.text.primary,
                        marginBottom: tokens.spacing.xs
                    }}>
                        Bienvenido de nuevo
                    </h1>

                    <p style={{
                        fontSize: tokens.typography.body.fontSize,
                        color: tokens.colors.text.secondary,
                        marginBottom: tokens.spacing.xl
                    }}>
                        Ingresa tus credenciales para continuar
                    </p>

                    <form onSubmit={handleLogin} className="space-y-6 text-left">

                        <Input
                            label="Email"
                            type="email"
                            placeholder="hola@empresa.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full"
                        />

                        <Input
                            label="Contraseña"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full"
                        />

                        {error && (
                            <div style={{
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: `1px solid ${tokens.colors.error}`,
                                padding: tokens.spacing.md,
                                borderRadius: tokens.radius.md,
                                display: 'flex',
                                alignItems: 'start',
                                gap: tokens.spacing.sm
                            }}>
                                <AlertCircle size={16} color={tokens.colors.error} style={{ marginTop: '2px' }} />
                                <p style={{
                                    fontSize: tokens.typography.caption.fontSize,
                                    fontWeight: 700,
                                    color: '#DC2626'
                                }}>
                                    {error}
                                </p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full justify-center"
                            isLoading={loading}
                            icon={<LogIn size={18} />}
                            style={{ height: '48px', fontSize: '1rem' }}
                        >
                            Iniciar Sesión
                        </Button>

                    </form>
                </Card>

                <p
                    className="mt-8 text-center"
                    style={{
                        fontSize: tokens.typography.body.fontSize,
                        color: tokens.colors.text.secondary
                    }}
                >
                    ¿No tienes una cuenta?
                    <span style={{
                        color: tokens.colors.brand,
                        fontWeight: 700,
                        cursor: 'pointer'
                    }}>
                        {' '}Contacta a tu administrador
                    </span>
                </p>

            </div>
        </div>
    );
};

export default Login;