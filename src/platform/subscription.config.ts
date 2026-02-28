import { Capability } from './capabilities.config';

export type PlanKey = 'demo' | 'starter' | 'growth' | 'scale' | 'enterprise';

// Placeholder Stripe Price IDs - Replace with actual IDs from Stripe Dashboard
const STRIPE_PRICES = {
    DEMO: 'price_1T3hViHQRK5Aub33w40peU2g',
    STARTER: 'price_1T3hjjHQRK5Aub33UgxAC7sH',
    GROWTH: 'price_1T3hpiHQRK5Aub33FUVUUvX5',
    SCALE: 'price_1T3hsyHQRK5Aub33LatCSft2',
    ENTERPRISE: 'price_1T3huKHQRK5Aub33cmB8mZtO'
};

export const subscriptionConfig = {
    priceToPlan: {
        [STRIPE_PRICES.DEMO]: 'demo',
        [STRIPE_PRICES.STARTER]: 'starter',
        [STRIPE_PRICES.GROWTH]: 'growth',
        [STRIPE_PRICES.SCALE]: 'scale',
        [STRIPE_PRICES.ENTERPRISE]: 'enterprise'
    } as Record<string, PlanKey>,

    plans: {
        demo: {
            label: 'Demo',
            seat_limit: 3,
            enabledModules: ['dashboard'],
            allowedCapabilities: ['view_costs'] as Capability[]
        },
        starter: {
            label: 'Starter',
            seat_limit: 4,
            enabledModules: ['dashboard', 'products', 'finished_goods', 'raw_materials', 'team', 'settings'],
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
        },
        scale: {
            label: 'Scale',
            seat_limit: 25,
            enabledModules: ['*'],
            allowedCapabilities: ['*']
        },
        enterprise: {
            label: 'Enterprise',
            seat_limit: 999,
            enabledModules: ['*'],
            allowedCapabilities: ['*']
        }
    }
} as const;
