import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { capabilities, Capability } from './capabilities.config';
import { useSubscription } from './useSubscription';

/**
 * ----------------------------------------
 * BETO OS — Capability Engine
 * ----------------------------------------
 * Authority-based permission resolution.
 * No role logic.
 * Driven by Execution Context & Subscription.
 */

// ----------------------------------------
// Capability Sets
// ----------------------------------------

const ALL_CAPABILITIES = Object.keys(capabilities) as Capability[];

const READ_ONLY_CAPABILITIES: Capability[] = [
    'view_costs',
    'view_products',
    'view_raw_materials',
    'view_team'
];

// ----------------------------------------
// Execution Context
// ----------------------------------------

interface ExecutionContext {
    isSuperAdmin: boolean;
    platformMode: 'platform' | 'company' | null;
    environmentId: string | null;
    userId: string | null;
}

// ----------------------------------------
// Hook
// ----------------------------------------

export function useCapabilities() {
    const { user, mode } = useAuth();
    const { allowedCapabilities } = useSubscription();

    /**
     * Build execution context
     * (BETO OS Runtime State)
     */
    const context: ExecutionContext = {
        isSuperAdmin: (user as any)?.is_super_admin ?? false,
        platformMode: mode as 'platform' | 'company' | null,
        environmentId: user?.user_metadata?.company_id ?? null,
        userId: user?.id ?? null
    };

    /**
     * Capability Resolver
     * BETO OS becomes execution authority
     */
    const resolveCapabilities = (ctx: ExecutionContext): Capability[] => {
        // 🔥 Founder operating platform
        if (ctx.isSuperAdmin && ctx.platformMode === 'platform') {
            return ALL_CAPABILITIES;
        }

        // 🏢 Inside Environment -> Subscription Authority
        if (ctx.platformMode === 'company') {
            // Wildcard Check
            if (allowedCapabilities.includes('*')) {
                return ALL_CAPABILITIES;
            }
            return allowedCapabilities as Capability[];
        }

        // 👁 Safe fallback
        return READ_ONLY_CAPABILITIES;
    };

    /**
     * MEMOIZED CAPABILITY SET
     * Prevent unnecessary recalculations
     */
    const currentCapabilities = useMemo(
        () => resolveCapabilities(context),
        [
            context.isSuperAdmin,
            context.platformMode,
            context.environmentId,
            allowedCapabilities // Add dependency
        ]
    );

    /**
     * Public API
     */
    const can = (capability: Capability): boolean => {
        return currentCapabilities.includes(capability);
    };

    return {
        can
    };
}
