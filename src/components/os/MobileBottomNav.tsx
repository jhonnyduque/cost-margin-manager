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
    { label: 'Resumen', path: '/control-center?tab=overview', icon: LayoutDashboard },
    { label: 'Empresas', path: '/control-center?tab=tenants', icon: Globe },
    { label: 'Finanzas', path: '/control-center?tab=billing', icon: CreditCard },
    { label: 'Operaciones', path: '/control-center?tab=ops', icon: Zap },
    { label: 'Taxonomias', path: '/control-center?tab=taxonomies', icon: Tags },
];

const TENANT_NAV_ITEMS: NavItem[] = [
    { label: 'Home', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Productos', path: '/productos', icon: Layers },
    { label: 'Produccion', path: '/produccion', icon: Factory },
    { label: 'Materias Primas', path: '/materias-primas', icon: Beaker },
    { label: 'Mas', path: '/mas', icon: Menu },
];

export const MobileBottomNav: React.FC = () => {
    const { user } = useAuth();
    const location = useLocation();

    const items = user?.is_super_admin ? SUPER_ADMIN_NAV_ITEMS : TENANT_NAV_ITEMS;
    const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';

    return (
        <nav
            style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                zIndex: 'var(--z-topbar)' as any,
                background: 'rgba(255,255,255,0.96)',
                backdropFilter: 'blur(12px)',
                borderTop: 'var(--border-default)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
            aria-label="Navegacion principal movil"
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: '4rem', padding: '0 var(--space-8)' }}>
                {items.map(item => {
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
                            style={{
                                position: 'relative',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '3rem', height: '3rem',
                                borderRadius: 'var(--radius-xl)',
                                color: isActive ? 'var(--state-primary)' : 'var(--text-muted)',
                                background: isActive ? 'var(--surface-primary-soft)' : 'transparent',
                                transition: 'color var(--transition-fast), background var(--transition-fast)',
                                textDecoration: 'none',
                            }}
                        >
                            <Icon
                                size={22}
                                style={{ transform: isActive ? 'scale(1.1)' : 'scale(1)', transition: 'transform var(--transition-fast)' }}
                            />
                            {isActive && (
                                <div style={{ position: 'absolute', bottom: '0.375rem', width: '0.25rem', height: '0.25rem', borderRadius: '50%', background: 'var(--state-primary)' }} />
                            )}
                        </NavLink>
                    );
                })}
            </div>
        </nav>
    );
};