/**
 * Shared subscription configuration
 * Single source of truth for plan/status display across Billing, Environments, etc.
 */

export const statusConfig: Record<string, { color: string; dot: string; label: string }> = {
    active: { color: 'text-emerald-700 bg-emerald-50 ring-emerald-200', dot: 'bg-emerald-500', label: 'Activo' },
    trialing: { color: 'text-blue-700 bg-blue-50 ring-blue-200', dot: 'bg-blue-500', label: 'Trial' },
    canceled: { color: 'text-red-700 bg-red-50 ring-red-200', dot: 'bg-red-500', label: 'Cancelado' },
    past_due: { color: 'text-orange-700 bg-orange-50 ring-orange-200', dot: 'bg-orange-500', label: 'Vencido' },
    inactive: { color: 'text-gray-700 bg-gray-50 ring-gray-200', dot: 'bg-gray-400', label: 'Inactivo' },
};

export const planConfig: Record<string, { color: string; bg: string }> = {
    demo: { color: 'text-gray-700', bg: 'bg-gray-100' },
    starter: { color: 'text-blue-700', bg: 'bg-blue-50' },
    growth: { color: 'text-indigo-700', bg: 'bg-indigo-50' },
    scale: { color: 'text-purple-700', bg: 'bg-purple-50' },
    enterprise: { color: 'text-amber-700', bg: 'bg-amber-50' },
};

export const getPlanDisplay = (tier: string | null | undefined) => {
    const key = (tier || 'demo').toLowerCase();
    return {
        label: (tier || 'Demo').charAt(0).toUpperCase() + (tier || 'demo').slice(1),
        ...(planConfig[key] || planConfig.demo),
    };
};

export const getStatusDisplay = (status: string | null | undefined) => {
    const key = (status || 'inactive').toLowerCase();
    return statusConfig[key] || statusConfig.inactive;
};