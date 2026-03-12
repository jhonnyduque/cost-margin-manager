import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Layers, Users, CreditCard, Menu, Factory, Beaker } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

/**
 * MobileBottomNav — compact icon-only mobile navigation
 * 
 * SuperAdmin: Home | Entornos | Equipo | Billing | Más
 * Tenant:     Home | Productos | Producción | Materias Primas | Más
 */

interface NavItem {
    label: string;
    path: string;
    icon: React.FC<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
    {
        label: 'Home',
        path: '/control-center',
        icon: LayoutDashboard,
    },
    {
        label: 'Entornos',
        path: '/platform/environments',
        icon: Layers,
    },
    {
        label: 'Equipo',
        path: '/platform/users',
        icon: Users,
    },
    {
        label: 'Billing',
        path: '/platform/billing',
        icon: CreditCard,
    },
    {
        label: 'Más',
        path: '/mas',
        icon: Menu,
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
        label: 'Producción',
        path: '/produccion',
        icon: Factory,
    },
    {
        label: 'Materias Primas',
        path: '/materias-primas',
        icon: Beaker,
    },
    {
        label: 'Más',
        path: '/mas',
        icon: Menu,
    },
];

export const MobileBottomNav: React.FC = () => {
    const { user } = useAuth();
    const location = useLocation();

    const items = user?.is_super_admin ? NAV_ITEMS : TENANT_NAV_ITEMS;

    return (
        <nav
            className="
                fixed bottom-0 left-0 right-0 z-50
                bg-white/95 backdrop-blur border-t border-slate-200
                safe-area-bottom lg:hidden
            "
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            aria-label="Navegación principal móvil"
        >
            <div className="flex items-center justify-around h-16 px-2">
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path ||
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
