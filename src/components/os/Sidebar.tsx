import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    ChevronLeft, ChevronRight, Menu,
    LayoutDashboard, Globe, CreditCard, Zap, Tags, Layers, Users,
} from 'lucide-react';
import { MODULES } from '../../platform/modules.registry';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '../../platform/useSubscription';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

const SUPER_ADMIN_NAV = [
    { id: 'overview', name: 'Resumen', path: '/control-center?tab=overview', icon: LayoutDashboard },
    { id: 'tenants', name: 'Empresas', path: '/control-center?tab=tenants', icon: Globe },
    { id: 'billing', name: 'Finanzas', path: '/control-center?tab=billing', icon: CreditCard },
    { id: 'ops', name: 'Operaciones', path: '/control-center?tab=ops', icon: Zap },
    { id: 'taxonomies', name: 'Taxonomías', path: '/control-center?tab=taxonomies', icon: Tags },
    { id: 'environments', name: 'Entornos', path: '/platform/environments', icon: Layers },
    { id: 'users', name: 'Usuarios', path: '/platform/users', icon: Users },
] as const;

type NavItem = {
    id: string;
    name: string;
    path: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
};

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
    const { user, userRole } = useAuth();
    const { enabledModules } = useSubscription();
    const location = useLocation();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); onToggle(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onToggle]);

    const getNavItemStyle = (isActive: boolean, isDisabled: boolean): React.CSSProperties => ({
        justifyContent: collapsed ? 'center' : 'flex-start',
        paddingLeft: collapsed ? '0' : 'var(--space-12)',
        paddingRight: collapsed ? '0' : 'var(--space-12)',
        marginLeft: collapsed ? 'var(--space-4)' : 0,
        marginRight: collapsed ? 'var(--space-4)' : 0,
        opacity: isDisabled ? 0.4 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
    });

    const toggleBtnStyle: React.CSSProperties = {
        width: '2.25rem', height: '2.25rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--radius-md)',
        border: 'var(--border-default)',
        background: 'var(--surface-card)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast)',
    };

    const renderNavItem = (item: NavItem, isActive: boolean, isDisabled = false) => {
        const Icon = item.icon;
        return (
            <NavLink
                key={item.id}
                to={isDisabled ? '#' : item.path}
                onClick={isDisabled ? (e: React.MouseEvent) => e.preventDefault() : undefined}
                className={`nav-item${isActive ? ' is-active' : ''}`}
                style={getNavItemStyle(isActive, isDisabled)}
                title={collapsed ? item.name : undefined}
                aria-disabled={isDisabled || undefined}
            >
                <Icon size={20} className="flex-shrink-0" />
                {!collapsed && (
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                    </span>
                )}
            </NavLink>
        );
    };

    return (
        <aside
            aria-label="Menú lateral de navegación"
            style={{
                position: 'fixed', left: 0, top: 0, zIndex: 60,
                height: '100vh',
                width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-expanded)',
                background: 'var(--surface-card)',
                color: 'var(--text-secondary)',
                borderRight: 'var(--border-default)',
                transition: 'width var(--transition-slow)',
            }}
        >
            {/* Header / Toggle */}
            <div style={{ height: '4rem', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-end', padding: '0 var(--space-12)', borderBottom: 'var(--border-default)' }}>
                <button
                    type="button"
                    onClick={onToggle}
                    title={collapsed ? 'Expandir menú (Ctrl + B)' : 'Ocultar menú (Ctrl + B)'}
                    aria-label={collapsed ? 'Expandir menú lateral' : 'Ocultar menú lateral'}
                    aria-expanded={!collapsed}
                    aria-controls="sidebar-navigation"
                    style={toggleBtnStyle}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-muted)'; e.currentTarget.style.borderColor = 'var(--border-color-strong)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-card)'; e.currentTarget.style.borderColor = 'var(--border-color-default)'; }}
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {/* Main nav */}
            <nav id="sidebar-navigation" className="side-nav" style={{ padding: 'var(--space-12)', marginTop: 'var(--space-16)' }}>
                {user?.is_super_admin
                    ? SUPER_ADMIN_NAV.map(item => {
                        const itemUrl = new URL(item.path, 'http://localhost');
                        const targetTab = itemUrl.searchParams.get('tab');
                        const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                        const isActive = itemUrl.pathname === '/control-center'
                            ? location.pathname === '/control-center' && currentTab === targetTab
                            : location.pathname === itemUrl.pathname;
                        return renderNavItem(item, isActive);
                    })
                    : Object.values(MODULES).map(module => {
                        const mod = module as any;
                        if (mod.superAdminOnly) return null;
                        if (mod.id === 'settings' || mod.id === 'analytics') return null;
                        if (mod.id === 'billing' && !['owner', 'admin', 'manager'].includes(userRole || '')) return null;
                        if (!mod.comingSoon) {
                            const isEnabled = enabledModules.includes('*') || enabledModules.includes(mod.id);
                            if (!isEnabled) return null;
                        }
                        return renderNavItem(mod, location.pathname === mod.path, !!mod.comingSoon);
                    })}
            </nav>

            {/* Bottom nav */}
            <div style={{ position: 'absolute', left: 0, bottom: '3rem', width: '100%', padding: 'var(--space-12)', borderTop: 'var(--border-default)', paddingTop: 'var(--space-12)' }}>
                <NavLink
                    to="/mas"
                    className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
                    style={({ isActive }) => ({ ...getNavItemStyle(isActive, false), justifyContent: collapsed ? 'center' : 'flex-start' })}
                    title={collapsed ? 'Más' : undefined}
                >
                    <Menu size={20} className="flex-shrink-0" />
                    {!collapsed && (
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Más</span>
                    )}
                </NavLink>
            </div>

            {/* Version */}
            {!collapsed && (
                <div style={{ position: 'absolute', left: 0, bottom: '1rem', width: '100%', padding: '0 var(--space-24)', textAlign: 'center' }}>
                    <span style={{ fontSize: 'var(--text-small-size)', fontWeight: 600, color: 'var(--text-muted)' }}>v11.0.0</span>
                </div>
            )}
        </aside>
    );
};