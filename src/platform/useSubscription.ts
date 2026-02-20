import { useAuth } from '@/hooks/useAuth';
import { subscriptionConfig, PlanKey } from './subscription.config';
import { capabilities } from './capabilities.config';

export function useSubscription() {
    const { currentCompany } = useAuth();

    // 1. Get raw company data
    const stripePriceId = currentCompany?.stripe_price_id;
    const status = currentCompany?.subscription_status || 'trialing'; // Default safer than 'active'
    const currentPeriodEndAt = currentCompany?.current_period_end_at;

    // 2. Resolve Plan Key
    let planKey: PlanKey = 'demo'; // Default fallback (SAFE BOOT)

    if (stripePriceId && subscriptionConfig.priceToPlan[stripePriceId]) {
        planKey = subscriptionConfig.priceToPlan[stripePriceId];
    }
    // Manual/Legacy tier fallback
    else if (currentCompany?.subscription_tier && (currentCompany.subscription_tier in subscriptionConfig.plans)) {
        planKey = currentCompany.subscription_tier as PlanKey;
    }

    // SAFETY CHECK: If for any reason planKey is invalid (shouldn't happen due to init), force demo
    if (!subscriptionConfig.plans[planKey]) {
        console.warn('[BETO OS] Invalid Plan Key resolved, falling back to DEMO');
        planKey = 'demo';
    }

    // 3. Status Enforcement
    const isActive = ['active', 'trialing'].includes(status);
    // If no company context (e.g. loading), we might default to restricted safely
    const isRestricted = !isActive || !currentCompany;

    // 4. Resolve Effective Plan (Demo if restricted)
    const effectivePlanKey = isRestricted ? 'demo' : planKey;
    const activePlan = subscriptionConfig.plans[effectivePlanKey];

    // BOOT GUARD: activePlan should never be undefined due to safe defaults
    if (!activePlan) {
        // This is a catastrophic theoretical state, return explicit demo hardcoded if needed
        // But with Typescript and const config, this should be unreachable if 'demo' exists.
        return {
            status: 'error',
            periodEnd: null,
            planKey: 'demo',
            planLabel: 'Safe Mode',
            seatLimitEffective: 1,
            seatLimitFromPlan: 1,
            enabledModules: ['cost-manager'],
            allowedCapabilities: ['view_costs'],
            isActive: false,
            isRestricted: true
        };
    }

    // 5. Resolve Seats
    // company.seat_limit is authoritative override. Fallback to plan limit.
    const seatLimitFromPlan = activePlan.seat_limit;
    const seatLimitEffective = currentCompany?.seat_limit ?? seatLimitFromPlan;

    // 6. Expand Wildcards ('*')
    // Modules
    let enabledModules: string[] = [];
    const planModules = activePlan.enabledModules as readonly string[];
    if (planModules.includes('*')) {
        enabledModules = ['*'];
    } else {
        enabledModules = [...planModules];
    }

    // Capabilities
    let allowedCapabilities: string[] = [];
    const planCapabilities = activePlan.allowedCapabilities as readonly string[];
    if (planCapabilities.includes('*')) {
        allowedCapabilities = ['*'];
    } else {
        allowedCapabilities = [...planCapabilities];
    }

    // Expand capabilities here if we want to be nice to consumers, but spec says "If allowedCapabilities contains '*' => ALL_CAPABILITIES" in useCapabilities.
    // So returning '*' is fine.

    return {
        status,
        periodEnd: currentPeriodEndAt,
        planKey,
        planLabel: subscriptionConfig.plans[planKey].label,
        seatLimitEffective,
        seatLimitFromPlan,
        enabledModules,
        allowedCapabilities,
        isActive,
        isRestricted,
        // Helpers
        // isPlan: (check: PlanKey) => planKey === check
    };
}
