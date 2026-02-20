import { Capability } from './capabilities.config';

export type PlanKey = 'demo' | 'starter' | 'growth';

// Placeholder Stripe Price IDs - Replace with actual IDs from Stripe Dashboard
const STRIPE_PRICES = {
    DEMO: 'price_demo_id_placeholder',
    STARTER: 'price_starter_id_placeholder',
    GROWTH: 'price_growth_id_placeholder'
};

export const subscriptionConfig = {
    priceToPlan: {
        [STRIPE_PRICES.DEMO]: 'demo',
        [STRIPE_PRICES.STARTER]: 'starter',
        [STRIPE_PRICES.GROWTH]: 'growth'
    } as Record<string, PlanKey>,

    plans: {
        demo: {
            label: 'Demo',
            seat_limit: 1,
            enabledModules: ['cost-manager'],
            allowedCapabilities: ['view_costs'] as Capability[]
        },
        starter: {
            label: 'Starter',
            seat_limit: 3,
            enabledModules: ['cost-manager', 'products', 'inventory', 'team', 'settings'],
            allowedCapabilities: [
                'view_costs', 'edit_costs',
                'view_products', 'edit_products',
                'view_raw_materials', 'edit_raw_materials',
                'view_team', 'manage_team',
                'configure_system'
            ] as Capability[]
        },
        growth: {
            label: 'Growth',
            seat_limit: 10,
            enabledModules: ['*'],
            allowedCapabilities: ['*']
        }
    }
} as const;
