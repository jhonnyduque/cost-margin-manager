import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Layers,
  LogOut,
  Menu,
  Calculator,
  Users,
  Settings as SettingsIcon
} from 'lucide-react';
import ImpersonationBanner from './ImpersonationBanner';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { tokens } from '@/src/design/design-tokens';
import { Button } from '@/src/components/ui/Button';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, mode, exitImpersonation } = useAuth();
  const isSuperAdmin = (user as any)?.is_super_admin;
  const isImpersonating = mode === 'company' && isSuperAdmin;

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/productos', icon: Package, label: 'Productos' },
    { to: '/materias-primas', icon: Layers, label: 'Materias Primas' },
    { to: '/equipo', icon: Users, label: 'Equipo' },
    { to: '/settings', icon: SettingsIcon, label: 'Ajustes' },
  ];

  // Styles derived from tokens
  const sidebarStyle = {
    backgroundColor: tokens.colors.surface,
    borderRight: `1px solid ${tokens.colors.border}`,
  };

  const mainContentStyle = {
    backgroundColor: tokens.colors.bg,
  };

  const linkBaseStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    borderRadius: tokens.radius.md,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: tokens.typography.body.fontWeight,
    textDecoration: 'none',
    transition: 'all 0.2s',
    marginBottom: '2px',
  };

  const linkActiveStyle = {
    backgroundColor: 'rgba(37, 99, 235, 0.08)', // Brand color with opacity
    color: tokens.colors.brand,
    fontWeight: 600,
  };

  const linkInactiveStyle = {
    color: tokens.colors.text.secondary,
    backgroundColor: 'transparent',
  };

  return (
    <div className="flex min-h-screen" style={mainContentStyle}>
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        style={sidebarStyle}
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div
            style={{
              padding: tokens.spacing.lg,
              borderBottom: `1px solid ${tokens.colors.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacing.sm
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: tokens.radius.md,
                backgroundColor: tokens.colors.brand,
                color: tokens.colors.surface,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Calculator size={24} />
            </div>
            <h1
              style={{
                fontSize: tokens.typography.titleMd.fontSize,
                fontWeight: tokens.typography.titleMd.fontWeight,
                color: tokens.colors.text.primary
              }}
            >
              Calculadora
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1" style={{ padding: tokens.spacing.md }}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsMobileMenuOpen(false)}
                style={({ isActive }) => ({
                  ...linkBaseStyle,
                  ...(isActive ? linkActiveStyle : linkInactiveStyle)
                })}
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* User Section / Bottom */}
          <div
            style={{
              padding: tokens.spacing.md,
              borderTop: `1px solid ${tokens.colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: tokens.spacing.sm
            }}
          >
            {isImpersonating && (
              <Button
                variant="primary"
                onClick={exitImpersonation}
                icon={<Calculator size={18} />}
                className="w-full justify-center"
              >
                Volver a Plataforma
              </Button>
            )}

            <button
              onClick={handleLogout}
              style={{
                ...linkBaseStyle,
                color: tokens.colors.text.secondary,
                width: '100%',
                cursor: 'pointer',
                border: 'none',
                background: 'transparent'
              }}
              className="hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={20} />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header (Mobile Only) */}
        <header
          className="md:hidden sticky top-0 z-30 flex items-center justify-between"
          style={{
            height: '64px',
            backgroundColor: tokens.colors.surface,
            borderBottom: `1px solid ${tokens.colors.border}`,
            padding: `0 ${tokens.spacing.lg}`
          }}
        >
          <div className="flex items-center gap-4">
            <button
              style={{ color: tokens.colors.text.secondary }}
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h2
              style={{
                fontSize: tokens.typography.titleMd.fontSize,
                fontWeight: tokens.typography.titleMd.fontWeight,
                color: tokens.colors.text.primary
              }}
            >
              Panel de Control
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: tokens.radius.full,
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: tokens.colors.brand,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700
              }}
            >
              AD
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="relative flex flex-col flex-1">
          <ImpersonationBanner />
          <div className="w-full" style={{ padding: tokens.spacing.xl, maxWidth: '1280px', margin: '0 auto' }}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
