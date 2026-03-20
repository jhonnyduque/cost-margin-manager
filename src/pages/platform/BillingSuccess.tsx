import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function BillingSuccess() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [verifying, setVerifying] = React.useState(true);

    useEffect(() => {
        const success = searchParams.get('success');
        const sessionId = searchParams.get('session_id');
        if (success === 'true' && sessionId) {
            console.log('[BillingSuccess] Payment verified:', sessionId);
            setTimeout(() => setVerifying(false), 1500);
        } else {
            setVerifying(false);
        }
    }, [searchParams]);

    if (verifying) {
        return (
            <div style={{ display: 'flex', height: '24rem', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 style={{ width: '2rem', height: '2rem', color: 'var(--state-primary)', marginRight: 'var(--space-12)', animation: 'spin 1s linear infinite' }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body-size)' }}>Verificando pago...</span>
            </div>
        );
    }

    const isCanceled = searchParams.get('canceled') === 'true';

    return (
        <div style={{ animation: 'fadeIn 0.7s ease' }}>
            <Card style={{
                maxWidth: '42rem', margin: '0 auto', padding: 'var(--space-32)', textAlign: 'center',
                background: isCanceled ? 'var(--surface-warning-soft)' : 'var(--surface-success-soft)',
                borderColor: isCanceled ? 'var(--border-color-warning)' : 'var(--border-color-success)',
            }}>
                <div style={{
                    width: '4rem', height: '4rem', margin: '0 auto',
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isCanceled ? 'rgba(245,158,11,0.15)' : 'rgba(22,163,74,0.15)',
                }}>
                    {isCanceled
                        ? <ArrowLeft size={32} style={{ color: 'var(--state-warning)' }} />
                        : <CheckCircle size={32} style={{ color: 'var(--state-success)' }} />
                    }
                </div>

                <h2 style={{ marginTop: 'var(--space-24)', fontSize: 'var(--text-h1-size)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {isCanceled ? 'Pago cancelado' : '¡Suscripción exitosa!'}
                </h2>

                <p style={{ marginTop: 'var(--space-12)', color: 'var(--text-secondary)', fontSize: 'var(--text-body-size)', lineHeight: 1.6 }}>
                    {isCanceled
                        ? 'No se realizó ningún cargo. Puedes intentarlo de nuevo cuando quieras.'
                        : 'Tu plan ha sido activado. Ya puedes disfrutar de todas las funcionalidades.'
                    }
                </p>

                <div style={{ marginTop: 'var(--space-32)', display: 'flex', justifyContent: 'center', gap: 'var(--space-12)' }}>
                    <Button onClick={() => navigate('/dashboard')} variant="secondary">
                        Volver al Dashboard
                    </Button>
                    {!isCanceled && (
                        <Button onClick={() => navigate('/platform/billing')} variant="primary">
                            Gestionar Suscripción
                        </Button>
                    )}
                </div>
            </Card>

            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
    );
}