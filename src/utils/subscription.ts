import { SubscriptionStatus } from '@/types';

export type SuspensionLevel = 'none' | 'read_only' | 'blocked';

/**
 * Determina el nivel de acceso basado en estado y periodo de gracia.
 * Lógica espejo de DB public.get_suspension_level
 */
export function getSuspensionLevel(
    status: SubscriptionStatus,
    gracePeriodEndsAt?: string | null
): SuspensionLevel {

    if (status === 'trialing' || status === 'active') {
        return 'none';
    }

    if (status === 'past_due') {
        // Si hay fecha de gracia y es futura => Acceso permitido (con warning)
        if (gracePeriodEndsAt && new Date(gracePeriodEndsAt) > new Date()) {
            return 'none';
        }
        // Gracia expirada => Read Only
        return 'read_only';
    }

    if (status === 'canceled' || status === 'unpaid') {
        return 'blocked';
    }

    return 'blocked';
}

/**
 * Retorna true si está en periodo de gracia activo
 */
export function isInGracePeriod(status: SubscriptionStatus, graceEnd?: string | null): boolean {
    return status === 'past_due' && !!graceEnd && new Date(graceEnd) > new Date();
}
