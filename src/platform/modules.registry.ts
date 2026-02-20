import { LayoutDashboard, Layers, Users, CreditCard, Bot, BarChart3, Settings } from 'lucide-react';

export const MODULES = {
    control_center: {
        id: 'control_center',
        name: 'Control Center',
        path: '/control-center',
        icon: LayoutDashboard,
        requiredCapability: 'configure_system'
    },
    environments: {
        id: 'environments',
        name: 'Environments',
        path: '/platform/environments',
        icon: Layers,
        requiredCapability: 'manage_tenants'
    },
    users: {
        id: 'users',
        name: 'Users',
        path: '/platform/users',
        icon: Users,
        requiredCapability: 'view_team'
    },
    billing: {
        id: 'billing',
        name: 'Billing',
        path: '/platform/billing',
        icon: CreditCard,
        requiredCapability: 'view_costs'
    },
    ai_consultant: {
        id: 'ai_consultant',
        name: 'AI Consultants',
        path: '/ai',
        icon: Bot,
        requiredCapability: 'view_products' // Placeholder, adjust as needed
    },
    analytics: {
        id: 'analytics',
        name: 'Analytics',
        path: '/analytics',
        icon: BarChart3,
        requiredCapability: 'view_costs'
    },
    settings: {
        id: 'settings',
        name: 'System Settings',
        path: '/settings',
        icon: Settings,
        requiredCapability: 'configure_system' // Or generic for settings
    }
} as const;

export type ModuleKey = keyof typeof MODULES;
