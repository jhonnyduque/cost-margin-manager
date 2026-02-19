import { useAuth } from '../hooks/useAuth';
import { isInGracePeriod, getSuspensionLevel } from '../utils/subscription';

export function SubscriptionBanner() {
    const { currentCompany } = useAuth();
    if (!currentCompany) return null;

    const { subscription_status: status, grace_period_ends_at, trial_ends_at } = currentCompany;

    const calculateDaysLeft = (dateString: string | null) => {
        if (!dateString) return 0;
        const diff = new Date(dateString).getTime() - Date.now();
        return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
    };

    const suspensionLevel = getSuspensionLevel(status, grace_period_ends_at);

    // Caso 1: Gracia Activa
    if (isInGracePeriod(status, grace_period_ends_at)) {
        const daysLeft = calculateDaysLeft(grace_period_ends_at);

        return (
            <div className="bg-orange-500 text-white p-2 text-center text-sm font-medium">
                ⚠️ No pudimos procesar tu último pago.
                Tienes {daysLeft} días para actualizar tu método antes de perder acceso.
                <button className="ml-3 underline font-semibold">
                    Actualizar pago
                </button>
            </div>
        );
    }

    // Caso 2: Trial por vencer
    if (status === 'trialing' && trial_ends_at) {
        const daysLeft = calculateDaysLeft(trial_ends_at);

        if (daysLeft <= 3 && daysLeft > 0) {
            return (
                <div className="bg-yellow-500 text-black p-2 text-center text-sm font-medium">
                    ⏳ Tu prueba termina en {daysLeft} días.
                    <button className="ml-3 underline font-semibold">
                        Suscribirme ahora
                    </button>
                </div>
            );
        }
    }

    // Caso 3: Bloqueado
    if (suspensionLevel === 'blocked') {
        return (
            <div className="bg-red-600 text-white p-2 text-center text-sm font-bold">
                ⛔ Cuenta suspendida.
                <button className="ml-3 underline">
                    Reactivar ahora
                </button>
            </div>
        );
    }

    return null;
}
