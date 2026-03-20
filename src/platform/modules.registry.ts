import {
    LayoutDashboard, Layers, Users, CreditCard, Bot, BarChart3,
    Settings, Package, Boxes, Contact2, Truck,
    Factory, ShoppingCart, Building2
} from 'lucide-react';

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
    production: {
        id: 'production',
        name: 'Producción',
        path: '/produccion',
        icon: Factory,
        requiredCapability: 'view_products',
        tenantOnly: true,
        comingSoon: false
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
        name: 'Stock',
        path: '/stock',
        icon: Boxes,
        requiredCapability: 'view_products',
        tenantOnly: true
    },
    raw_materials: {
        id: 'raw_materials',
        name: 'Materias Primas',
        path: '/materias-primas',
        icon: Layers,                          // ← Beaker → Layers
        requiredCapability: 'view_raw_materials',
        tenantOnly: true
    },
    purchases: {
        id: 'purchases',
        name: 'Compras',
        path: '/compras',
        icon: ShoppingCart,
        requiredCapability: 'view_raw_materials',
        tenantOnly: true
    },
    suppliers: {
        id: 'suppliers',
        name: 'Proveedores',
        path: '/proveedores',
        icon: Building2,
        requiredCapability: 'view_raw_materials',
        tenantOnly: true,
    },
    clients: {
        id: 'clients',
        name: 'Clientes',
        path: '/clientes',
        icon: Contact2,
        requiredCapability: 'view_team',
        tenantOnly: true,
        hiddenFromSidebar: true
    },
    dispatches: {
        id: 'dispatches',
        name: 'Despachos',
        path: '/despachos',
        icon: Truck,
        requiredCapability: 'view_products',
        tenantOnly: true,
        hiddenFromSidebar: true
    },
    settings: {
        id: 'settings',
        name: 'Settings',
        path: '/settings',
        icon: Settings,
        requiredCapability: 'configure_system',
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
        name: 'Facturación',
        path: '/platform/billing',
        icon: CreditCard,
        requiredCapability: 'view_costs',
        hiddenFromSidebar: true
    },

    // ── Shared Modules ──
    ai_consultant: {
        id: 'ai_consultant',
        name: 'AI Consultants',
        path: '/ai',
        icon: Bot,
        requiredCapability: 'view_products',
        hiddenFromSidebar: true
    },
    analytics: {
        id: 'analytics',
        name: 'Analytics',
        path: '/analytics',
        icon: BarChart3,
        requiredCapability: 'view_costs'
    },
} as const;

export type ModuleKey = keyof typeof MODULES;