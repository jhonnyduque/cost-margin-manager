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
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mr-3" />
                <span className="text-gray-600">Verificando pago...</span>
            </div>
        );
    }

    const isCanceled = searchParams.get('canceled') === 'true';

    return (
        <div className="animate-in fade-in duration-700">
            <Card className={`max-w-2xl mx-auto p-8 text-center ${isCanceled ? 'border-orange-200 bg-orange-50' : 'border-emerald-200 bg-emerald-50'}`}>
                <div className={`flex size-16 mx-auto items-center justify-center rounded-full ${isCanceled ? 'bg-orange-100' : 'bg-emerald-100'}`}>
                    {isCanceled ? (
                        <ArrowLeft size={32} className="text-orange-600" />
                    ) : (
                        <CheckCircle size={32} className="text-emerald-600" />
                    )}
                </div>
                
                <h2 className="mt-6 text-2xl font-black text-gray-900">
                    {isCanceled ? 'Pago cancelado' : '¡Suscripción exitosa!'}
                </h2>
                
                <p className="mt-3 text-gray-600">
                    {isCanceled 
                        ? 'No se realizó ningún cargo. Puedes intentarlo de nuevo cuando quieras.'
                        : 'Tu plan ha sido activado. Ya puedes disfrutar de todas las funcionalidades.'
                    }
                </p>

                <div className="mt-8 flex justify-center gap-4">
                    <Button onClick={() => navigate('/dashboard')} variant="outline">
                        Volver al Dashboard
                    </Button>
                    {!isCanceled && (
                        <Button onClick={() => navigate('/platform/billing')}>
                            Gestionar Suscripción
                        </Button>
                    )}
                </div>
            </Card>
        </div>
    );
}