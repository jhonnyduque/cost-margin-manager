import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Globe, CreditCard, Zap, Tags, Menu, Factory, Beaker, Layers } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
    label: string;
    path: string;
    icon: React.FC<{ size?: number; className?: string }>;
}

const SUPER_ADMIN_NAV_ITEMS: NavItem[] = [
    {
        label: 'Resumen',
        path: '/control-center?tab=overview',
        icon: LayoutDashboard,
    },
    {
        label: 'Empresas',
        path: '/control-center?tab=tenants',
        icon: Globe,
    },
    {
        label: 'Finanzas',
        path: '/control-center?tab=billing',
        icon: CreditCard,
    },
    {
        label: 'Operaciones',
        path: '/control-center?tab=ops',
        icon: Zap,
    },
    {
        label: 'Taxonomias',
        path: '/control-center?tab=taxonomies',
        icon: Tags,
    },
];

const TENANT_NAV_ITEMS: NavItem[] = [
    {
        label: 'Home',
        path: '/dashboard',
        icon: LayoutDashboard,
    },
    {
        label: 'Productos',
        path: '/productos',
        icon: Layers,
    },
    {
        label: 'Produccion',
        path: '/produccion',
        icon: Factory,
    },
    {
        label: 'Materias Primas',
        path: '/materias-primas',
        icon: Beaker,
    },
    {
        label: 'Mas',
        path: '/mas',
        icon: Menu,
    },
];

export const MobileBottomNav: React.FC = () => {
    const { user } = useAuth();
    const location = useLocation();

    const items = user?.is_super_admin ? SUPER_ADMIN_NAV_ITEMS : TENANT_NAV_ITEMS;
    const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';

    return (
        <nav
            className="
                fixed bottom-0 left-0 right-0 z-50
                bg-white/95 backdrop-blur border-t border-slate-200
                safe-area-bottom lg:hidden
            "
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            aria-label="Navegacion principal movil"
        >
            <div className="flex items-center justify-around h-16 px-2">
                {items.map((item) => {
                    const Icon = item.icon;
                    const itemUrl = new URL(item.path, 'http://localhost');
                    const targetTab = itemUrl.searchParams.get('tab');
                    const isActive = user?.is_super_admin
                        ? itemUrl.pathname === '/control-center'
                            ? location.pathname === '/control-center' && currentTab === targetTab
                            : location.pathname === itemUrl.pathname
                        : location.pathname === item.path ||
                          (item.path !== '/' && item.path !== '/mas' && location.pathname.startsWith(item.path));

                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            aria-label={item.label}
                            title={item.label}
                            className={`
                                relative flex items-center justify-center w-12 h-12 rounded-2xl
                                transition-all duration-200
                                ${isActive
                                    ? 'text-indigo-600 bg-indigo-50'
                                    : 'text-slate-500 active:text-slate-600 active:bg-slate-100'
                                }
                            `}
                        >
                            <Icon
                                size={22}
                                className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}
                            />
                            {isActive && (
                                <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-indigo-600" />
                            )}
                        </NavLink>
                    );
                })}
            </div>
        </nav>
    );
};
