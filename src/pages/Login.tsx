import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Calculator, LogIn, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors, typography, spacing, radius, shadows, tokens } from '@/design/design-tokens';
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
            <div className={`flex min-h-screen items-center justify-center ${colors.bgMain}`}>
                <div className={`animate-spin ${colors.statusInfo} ${typography.sectionTitle}`}>⟳</div>
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
        <div className={`flex min-h-screen items-center justify-center p-6 ${colors.bgMain}`}>
            <div className="w-full max-w-md">
                <Card className={`${spacing.pLg} text-center ${radius.xl} ${shadows.xl} border ${colors.borderStandard} ${colors.bgSurface}`}>

                    <div className="mb-8 inline-flex items-center justify-center">
                        <div className={`size-14 ${colors.bgBrand} ${radius.lg} flex items-center justify-center text-white`}>
                            <Calculator size={32} />
                        </div>
                    </div>

                    <h1 className={`${typography.sectionTitle} font-bold mb-2 ${colors.textPrimary}`}>
                        Bienvenido de nuevo
                    </h1>

                    <p className={`${typography.body} mb-8 ${colors.textSecondary}`}>
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
                            <div className={`${colors.bgDanger} border border-red-200 ${spacing.pMd} ${radius.lg} flex items-start gap-3`}>
                                <AlertCircle size={18} className={`${colors.statusDanger} mt-0.5`} />
                                <p className={`${typography.caption} font-bold ${colors.statusDanger}`}>
                                    {error}
                                </p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className={`w-full justify-center ${typography.text.body}`}
                            isLoading={loading}
                            icon={<LogIn size={18} />}
                            style={{ height: '48px' }}
                        >
                            Iniciar Sesión
                        </Button>

                    </form>
                </Card>

                <p className={`mt-8 text-center ${typography.body} ${colors.textSecondary}`}>
                    ¿No tienes una cuenta?
                    <span className={`ml-1 cursor-pointer font-bold ${colors.statusInfo}`}>
                        Contacta a tu administrador
                    </span>
                </p>

            </div>
        </div>
    );
};

export default Login;