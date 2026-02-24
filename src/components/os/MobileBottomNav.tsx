import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Layers, Users, CreditCard, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

/**
 * MobileBottomNav — v2.3 Control Center Edition
 * 
 * 4 fixed tabs matching the proposal:
 * Home | Entornos | Equipo | Billing
 * 
 * Follows iOS/Android bottom nav patterns:
 * - Fixed bottom
 * - 44px+ touch targets
 * - Active state with brand color
 * - Safe area padding for notched devices
 */

interface NavItem {
    label: string;
    path: string;
    icon: React.FC<{ size?: number; className?: string }>;
    /** Only show for super admin */
    superAdminOnly?: boolean;
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
];

// For non-super-admin (tenant) users, different nav
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
        label: 'Equipo',
        path: '/equipo',
        icon: Users,
    },
    {
        label: 'Settings',
        path: '/settings',
        icon: Settings,
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
                bg-white border-t border-slate-200
                safe-area-bottom
            "
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
            <div className="flex items-stretch justify-around h-16">
                {items.map((item) => {
                    const Icon = item.icon;
                    // Check if current path starts with the nav item path
                    const isActive = location.pathname === item.path ||
                        (item.path !== '/' && location.pathname.startsWith(item.path));

                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={`
                                flex flex-col items-center justify-center flex-1
                                min-h-[44px] min-w-[44px]
                                transition-colors duration-200
                                ${isActive
                                    ? 'text-indigo-600'
                                    : 'text-slate-400 active:text-slate-600'
                                }
                            `}
                        >
                            <Icon
                                size={22}
                                className={`
                                    transition-transform duration-200
                                    ${isActive ? 'scale-110' : ''}
                                `}
                            />
                            <span
                                className={`
                                    text-[11px] mt-1 font-medium leading-none
                                    ${isActive ? 'text-indigo-600' : 'text-slate-400'}
                                `}
                            >
                                {item.label}
                            </span>
                            {/* Active indicator dot */}
                            {isActive && (
                                <div className="w-1 h-1 rounded-full bg-indigo-600 mt-0.5" />
                            )}
                        </NavLink>
                    );
                })}
            </div>
        </nav>
    );
};