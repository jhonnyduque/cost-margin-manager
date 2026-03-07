import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Hexagon, Menu } from 'lucide-react';
import { MODULES } from '../../platform/modules.registry';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '../../platform/useSubscription';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
    const { user } = useAuth();
    const { enabledModules } = useSubscription();

    // ✅ Atajo de teclado: Ctrl/Cmd + B (con protección de inputs)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;

            // ❗ No interferir si el usuario está escribiendo
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
                fixed left-0 top-0 z-40 h-screen ${colors.bgSurface} ${colors.textSecondary} transition-all duration-300 border-r ${colors.borderStandard}
                ${collapsed ? 'w-16' : 'w-64'}
            `}
            aria-label="Menú lateral de navegación"
        >
            {/* Header / Brand */}
            <div className={`flex h-16 items-center justify-between ${spacing.pxLg} border-b ${colors.borderSubtle}`}>
                {!collapsed && (
                    <div className="flex items-center gap-2 font-bold tracking-tight">
                        <Hexagon className="h-6 w-6 text-indigo-500 fill-indigo-500/10 flex-shrink-0" />
                        <span className={`${typography.sectionTitle} truncate`}>BETO OS</span>
                    </div>
                )}
                {collapsed && (
                    <div className="mx-auto">
                        <Hexagon className="h-6 w-6 text-indigo-500 fill-indigo-500/20" />
                    </div>
                )}

                {/* ✅ Botón de toggle MEJORADO: más visible + accesible */}
                <button
                    onClick={onToggle}
                    className={`
                        flex items-center justify-center
                        p-1.5 ${radius.md}
                        ${colors.bgMain} hover:bg-slate-100
                        border ${colors.borderSubtle} hover:border-slate-300
                        ${colors.textMuted} hover:${colors.textPrimary}
                        transition-all duration-200
                        ${collapsed ? 'mx-auto' : 'ml-auto'}
                        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                    `}
                    title={`${collapsed ? 'Expandir' : 'Ocultar'} menú (Ctrl + B)`}
                    aria-label={`${collapsed ? 'Expandir' : 'Ocultar'} menú lateral`}
                    aria-expanded={!collapsed}
                    aria-controls="sidebar-navigation"
                >
                    {collapsed ? (
                        <ChevronRight className="w-4 h-4" />
                    ) : (
                        <ChevronLeft className="w-4 h-4" />
                    )}
                </button>
            </div>

            {/* Navigation */}
            <nav
                id="sidebar-navigation"
                className={`${spacing.pSm} ${spacing.sm} mt-4`}
            >
                {Object.values(MODULES).map((module) => {
                    const mod = module as any;

                    // Super Admin: mostrar solo módulos de plataforma (superAdminOnly)
                    if (user?.is_super_admin) {
                        if (mod.tenantOnly) return null;
                        if (!mod.superAdminOnly) return null;
                    }

                    // Tenant: mostrar solo módulos habilitados por su plan
                    if (!user?.is_super_admin) {
                        if (mod.superAdminOnly) return null;
                        const isEnabled = enabledModules.includes('*') || enabledModules.includes(mod.id);
                        if (!isEnabled) return null;
                    }

                    const Icon = mod.icon;

                    return (
                        <NavLink
                            key={mod.id}
                            to={mod.path}
                            className={({ isActive }) => `
                                flex items-center gap-3 ${spacing.pxMd} py-2 ${radius.xl} transition-all duration-200
                                ${isActive
                                    ? `${colors.bgBrandSubtle} text-indigo-700 ${shadows.sm}`
                                    : `${colors.textMuted} hover:${colors.bgMain} hover:${colors.textPrimary}`}
                                ${collapsed ? 'justify-center mx-1' : ''}
                            `}
                            title={collapsed ? mod.name : undefined}
                        >
                            <Icon size={20} className="flex-shrink-0" />
                            {!collapsed && <span className={`${typography.body} font-medium truncate`}>{mod.name}</span>}
                        </NavLink>
                    );
                })}
            </nav>

            {/* ── Más — legal, ayuda, estado del sistema ── */}
            <div className={`absolute bottom-12 left-0 w-full ${spacing.pSm} border-t ${colors.borderSubtle} pt-3`}>
                <NavLink
                    to="/more"
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

            {/* ── Más — legal, ayuda, estado del sistema ── */}
            <div className={`absolute bottom-12 left-0 w-full ${spacing.pSm} border-t ${colors.borderSubtle} pt-3`}>
                <NavLink
                    to="/more"
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