import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { MODULES } from '../../platform/modules.registry';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '../../platform/useSubscription';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
    const { user, userRole } = useAuth();
    const { enabledModules } = useSubscription();

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

    return (
        <aside
            className={`
                fixed left-0 top-0 z-[60] h-screen ${colors.bgSurface} ${colors.textSecondary} transition-all duration-300 border-r ${colors.borderStandard}
                ${collapsed ? 'w-16' : 'w-64'}
            `}
            aria-label="Menú lateral de navegación"
        >
            {/* Header */}
            <div className={`flex h-16 items-center px-3 border-b ${colors.borderSubtle} ${collapsed ? 'justify-center' : 'justify-end'}`}>
                {collapsed ? (
                    <button
                        onClick={onToggle}
                        className={`flex items-center justify-center p-1.5 ${radius.md} ${colors.bgMain} hover:bg-slate-100 border ${colors.borderSubtle} hover:border-slate-300 ${colors.textMuted} transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                        title="Expandir menú (Ctrl + B)"
                        aria-label="Expandir menú lateral"
                        aria-expanded={false}
                        aria-controls="sidebar-navigation"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button
                        onClick={onToggle}
                        className={`flex items-center justify-center p-1.5 ${radius.md} ${colors.bgMain} hover:bg-slate-100 border ${colors.borderSubtle} hover:border-slate-300 ${colors.textMuted} transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                        title="Ocultar menú (Ctrl + B)"
                        aria-label="Ocultar menú lateral"
                        aria-expanded={true}
                        aria-controls="sidebar-navigation"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav
                id="sidebar-navigation"
                className={`${spacing.pSm} ${spacing.sm} mt-4`}
            >
                {Object.values(MODULES).map((module) => {
                    const mod = module as any;

                    // Super Admin: solo módulos de plataforma
                    if (user?.is_super_admin) {
                        if (mod.tenantOnly) return null;
                        if (!mod.superAdminOnly) return null;
                    }

                    // Tenant: comingSoon siempre visible, resto filtrado por plan y permisos
                    if (!user?.is_super_admin) {
                        if (mod.superAdminOnly) return null;
                        if (mod.id === 'settings' || mod.id === 'analytics') return null;
                        if (mod.id === 'billing' && !['owner', 'admin', 'manager'].includes(userRole || '')) {
                            return null;
                        }
                        if (!mod.comingSoon) {
                            const isEnabled = enabledModules.includes('*') || enabledModules.includes(mod.id);
                            if (!isEnabled) return null;
                        }
                    }

                    const Icon = mod.icon;

                    return (
                        <NavLink
                            key={mod.id}
                            to={mod.comingSoon ? '#' : mod.path}
                            onClick={mod.comingSoon ? (e: React.MouseEvent) => e.preventDefault() : undefined}
                            className={({ isActive }) => `
                                flex items-center gap-3 ${spacing.pxMd} py-2 ${radius.xl} transition-all duration-200
                                ${mod.comingSoon
                                    ? 'opacity-40 cursor-not-allowed'
                                    : isActive
                                        ? `${colors.bgBrandSubtle} text-indigo-700 ${shadows.sm}`
                                        : `${colors.textMuted} hover:${colors.bgMain} hover:${colors.textPrimary}`}
                                ${collapsed ? 'justify-center mx-1' : ''}
                            `}
                            title={collapsed ? mod.name : undefined}
                        >
                            <Icon size={20} className="flex-shrink-0" />
                            {!collapsed && (
                                <span className={`${typography.body} font-medium truncate flex-1`}>
                                    {mod.name}
                                </span>
                            )}
                            {!collapsed && mod.comingSoon && (
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md flex-shrink-0">
                                    Pronto
                                </span>
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Más */}
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
                    title={collapsed ? 'Más' : undefined}
                >
                    <Menu size={20} className="flex-shrink-0" />
                    {!collapsed && <span className={`${typography.body} font-medium truncate`}>Más</span>}
                </NavLink>
            </div>

            {/* Footer / Version */}
            {!collapsed && (
                <div className={`absolute bottom-4 left-0 w-full ${spacing.pxLg} text-center`}>
                    <span className={`${typography.uiLabel} ${colors.textMuted}`}>v11.0.0</span>
                </div>
            )}
        </aside>
    );
};