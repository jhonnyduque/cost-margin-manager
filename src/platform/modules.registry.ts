import { LayoutDashboard, Layers, Users, CreditCard, Bot, BarChart3, Settings, Package, Beaker, Boxes } from 'lucide-react';

export const MODULES = {
    // ── Tenant Modules (company users) ──
    dashboard: {
        id: 'dashboard',
        name: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        requiredCapability: 'view_costs',
        tenantOnly: true
    },
    products: {
        id: 'products',
        name: 'Productos',
        path: '/productos',
        icon: Package,
        requiredCapability: 'view_products',
        tenantOnly: true
    },
    finished_goods: {
        id: 'finished_goods',
        name: 'Inventario',
        path: '/inventario',
        icon: Boxes,
        requiredCapability: 'view_products',
        tenantOnly: true
    },
    raw_materials: {
        id: 'raw_materials',
        name: 'Materias Primas',
        path: '/materias-primas',
        icon: Beaker,
        requiredCapability: 'view_raw_materials',
        tenantOnly: true
    },
    team: {
        id: 'team',
        name: 'Equipo',
        path: '/equipo',
        icon: Users,
        requiredCapability: 'view_team',
        tenantOnly: true
    },

    // ── Super Admin Modules (platform) ──
    control_center: {
        id: 'control_center',
        name: 'Control Center',
        path: '/control-center',
        icon: LayoutDashboard,
        requiredCapability: 'configure_system',
        superAdminOnly: true
    },
    environments: {
        id: 'environments',
        name: 'Environments',
        path: '/platform/environments',
        icon: Layers,
        requiredCapability: 'manage_tenants',
        superAdminOnly: true
    },
    users: {
        id: 'users',
        name: 'Users',
        path: '/platform/users',
        icon: Users,
        requiredCapability: 'view_team',
        superAdminOnly: true
    },
    billing: {
        id: 'billing',
        name: 'Billing',
        path: '/platform/billing',
        icon: CreditCard,
        requiredCapability: 'view_costs',
        superAdminOnly: true
    },

    // ── Shared Modules ──
    ai_consultant: {
        id: 'ai_consultant',
        name: 'AI Consultants',
        path: '/ai',
        icon: Bot,
        requiredCapability: 'view_products'
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
        name: 'Settings',
        path: '/settings',
        icon: Settings,
        requiredCapability: 'configure_system'
    }
} as const;

export type ModuleKey = keyof typeof MODULES;

