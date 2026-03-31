import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { 
    Lock, 
    Eye, 
    EyeOff, 
    CheckCircle2, 
    AlertCircle,
    ArrowRight,
    ShieldCheck,
    Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { tokens } from '@/design/design-tokens';

const ResetPassword = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [session, setSession] = useState<any>(null);

    useEffect(() => {
        // Check if we have a session (from the recovery/invite link)
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (!session) {
                setError('El enlace ha expirado o no es válido. Por favor, solicita una nueva invitación.');
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password.length < 8) {
            setError('La contraseña debe tener al menos 8 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) throw updateError;

            setIsSuccess(true);
            
            // Redirect after 3 seconds
            setTimeout(() => {
                navigate('/dashboard');
            }, 3000);

        } catch (err: any) {
            console.error('Error resetting password:', err);
            setError(err.message || 'Error al actualizar la contraseña.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className={`min-h-screen flex items-center justify-center p-4 bg-slate-50`}>
                <Card className="w-full max-w-md p-8 text-center animate-in fade-in zoom-in duration-300">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={32} />
                    </div>
                    <h1 className={`text-2xl font-bold mb-2 ${tokens.colors.textPrimary}`}>
                        ¡Contraseña Establecida!
                    </h1>
                    <p className={`text-slate-600 mb-8`}>
                        Tu cuenta ha sido activada correctamente. Te redirigiremos a tu panel de control en unos segundos.
                    </p>
                    <Loader2 className="animate-spin text-slate-400 mx-auto" />
                </Card>
            </div>
        );
    }

    return (
        <div className={`min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50`}>
            {/* Brand Logo / Section */}
            <div className="mb-8 text-center">
                <div className={`w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-indigo-200`}>
                    <ShieldCheck size={24} />
                </div>
                <h1 className={`text-2xl font-bold ${tokens.colors.textPrimary}`}>
                    BETO OS
                </h1>
                <p className="text-slate-500 text-sm">Cost Margin Manager Platform</p>
            </div>

            <Card className="w-full max-w-md p-8 shadow-xl border-slate-200">
                <div className="mb-8">
                    <h2 className={`text-xl font-bold ${tokens.colors.textPrimary}`}>
                        Bienvenido a su empresa
                    </h2>
                    <p className={`text-sm mt-1 text-slate-500`}>
                        Para completar el acceso, por favor establezca su nueva contraseña de seguridad.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-100 p-4 rounded-lg flex items-center gap-3 mb-6 animate-in slide-in-from-top-2">
                        <AlertCircle size={18} className="text-red-500 shrink-0" />
                        <span className="text-sm font-medium text-red-600">
                            {error}
                        </span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div className="relative">
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                label="Nueva Contraseña"
                                placeholder="Mínimo 8 caracteres"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={!session && !error}
                                icon={<Lock size={18} className="text-slate-400" />}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        <Input
                            type="password"
                            label="Confirmar Contraseña"
                            placeholder="Repite tu contraseña"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            disabled={!session && !error}
                            icon={<Lock size={18} className="text-slate-400" />}
                        />
                    </div>

                    <div className="pt-2">
                        <Button
                            type="submit"
                            className="w-full h-11"
                            isLoading={isSubmitting}
                            disabled={!session}
                            icon={<ArrowRight size={18} />}
                        >
                            Activar Cuenta
                        </Button>
                    </div>

                    <p className="text-center text-xs text-slate-400">
                        Al activar su cuenta, acepta nuestros términos de servicio y políticas de seguridad.
                    </p>
                </form>
            </Card>

            <footer className="mt-8 text-slate-400 text-sm">
                Powered by BETO OS
            </footer>
        </div>
    );
};

export default ResetPassword;
