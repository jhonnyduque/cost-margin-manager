import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Menu, LayoutDashboard, Globe, CreditCard, Zap, Tags, Layers, Users } from 'lucide-react';
import { MODULES } from '../../platform/modules.registry';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '../../platform/useSubscription';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

const SUPER_ADMIN_NAV = [
    { id: 'overview', name: 'Resumen', path: '/control-center?tab=overview', icon: LayoutDashboard },
    { id: 'tenants', name: 'Empresas', path: '/control-center?tab=tenants', icon: Globe },
    { id: 'billing', name: 'Finanzas', path: '/control-center?tab=billing', icon: CreditCard },
    { id: 'ops', name: 'Operaciones', path: '/control-center?tab=ops', icon: Zap },
    { id: 'taxonomies', name: 'Taxonomias', path: '/control-center?tab=taxonomies', icon: Tags },
    { id: 'environments', name: 'Entornos', path: '/platform/environments', icon: Layers },
    { id: 'users', name: 'Usuarios', path: '/platform/users', icon: Users },
] as const;

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
    const { user, userRole } = useAuth();
    const { enabledModules } = useSubscription();
    const location = useLocation();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            ) {
                return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                onToggle();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onToggle]);

    const renderNavItem = (item: { id: string; name: string; path: string; icon: React.ComponentType<{ size?: number; className?: string }> }, isActive: boolean, isDisabled = false) => {
        const Icon = item.icon;
        return (
            <NavLink
                key={item.id}
                to={isDisabled ? '#' : item.path}
                onClick={isDisabled ? (e: React.MouseEvent) => e.preventDefault() : undefined}
                className={`
                    flex items-center gap-3 ${spacing.pxMd} py-2 ${radius.xl} transition-all duration-200
                    ${isDisabled
                        ? 'opacity-40 cursor-not-allowed'
                        : isActive
                            ? `${colors.bgBrandSubtle} text-indigo-700 ${shadows.sm}`
                            : `${colors.textMuted} hover:${colors.bgMain} hover:${colors.textPrimary}`}
                    ${collapsed ? 'justify-center mx-1' : ''}
                `}
                title={collapsed ? item.name : undefined}
            >
                <Icon size={20} className="flex-shrink-0" />
                {!collapsed && (
                    <span className={`${typography.body} font-medium truncate flex-1`}>
                        {item.name}
                    </span>
                )}
            </NavLink>
        );
    };

    return (
        <aside
            className={`
                fixed left-0 top-0 z-[60] h-screen ${colors.bgSurface} ${colors.textSecondary} transition-all duration-300 border-r ${colors.borderStandard}
                ${collapsed ? 'w-16' : 'w-64'}
            `}
            aria-label="Menu lateral de navegacion"
        >
            <div className={`flex h-16 items-center px-3 border-b ${colors.borderSubtle} ${collapsed ? 'justify-center' : 'justify-end'}`}>
                {collapsed ? (
                    <button
                        onClick={onToggle}
                        className={`flex items-center justify-center p-1.5 ${radius.md} ${colors.bgMain} hover:bg-slate-100 border ${colors.borderSubtle} hover:border-slate-300 ${colors.textMuted} transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                        title="Expandir menu (Ctrl + B)"
                        aria-label="Expandir menu lateral"
                        aria-expanded={false}
                        aria-controls="sidebar-navigation"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button
                        onClick={onToggle}
                        className={`flex items-center justify-center p-1.5 ${radius.md} ${colors.bgMain} hover:bg-slate-100 border ${colors.borderSubtle} hover:border-slate-300 ${colors.textMuted} transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                        title="Ocultar menu (Ctrl + B)"
                        aria-label="Ocultar menu lateral"
                        aria-expanded={true}
                        aria-controls="sidebar-navigation"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                )}
            </div>

            <nav id="sidebar-navigation" className={`${spacing.pSm} ${spacing.sm} mt-4`}>
                {user?.is_super_admin ? (
                    SUPER_ADMIN_NAV.map((item) => {
                        const itemUrl = new URL(item.path, 'http://localhost');
                        const targetTab = itemUrl.searchParams.get('tab');
                        const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                        const isActive = itemUrl.pathname === '/control-center'
                            ? location.pathname === '/control-center' && currentTab === targetTab
                            : location.pathname === itemUrl.pathname;

                        return renderNavItem(item, isActive);
                    })
                ) : (
                    Object.values(MODULES).map((module) => {
                        const mod = module as any;
                        if (mod.superAdminOnly) return null;
                        if (mod.id === 'settings' || mod.id === 'analytics') return null;
                        if (mod.id === 'billing' && !['owner', 'admin', 'manager'].includes(userRole || '')) {
                            return null;
                        }
                        if (!mod.comingSoon) {
                            const isEnabled = enabledModules.includes('*') || enabledModules.includes(mod.id);
                            if (!isEnabled) return null;
                        }

                        return renderNavItem(mod, location.pathname === mod.path, !!mod.comingSoon);
                    })
                )}
            </nav>

            <div className={`absolute bottom-12 left-0 w-full ${spacing.pSm} border-t ${colors.borderSubtle} pt-3`}>
                <NavLink
                    to="/mas"
                    className={({ isActive }) => `
                        flex items-center gap-3 ${spacing.pxMd} py-2 ${radius.xl} transition-all duration-200
                        ${isActive
                            ? `${colors.bgBrandSubtle} text-indigo-700 ${shadows.sm}`
                            : `${colors.textMuted} hover:${colors.bgMain} hover:${colors.textPrimary}`}
                        ${collapsed ? 'justify-center mx-1' : ''}
                    `}
                    title={collapsed ? 'Mas' : undefined}
                >
                    <Menu size={20} className="flex-shrink-0" />
                    {!collapsed && <span className={`${typography.body} font-medium truncate`}>Mas</span>}
                </NavLink>
            </div>

            {!collapsed && (
                <div className={`absolute bottom-4 left-0 w-full ${spacing.pxLg} text-center`}>
                    <span className={`${typography.uiLabel} ${colors.textMuted}`}>v11.0.0</span>
                </div>
            )}
        </aside>
    );
};
