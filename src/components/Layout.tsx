import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Layers,
  LogOut,
  Menu,
  Calculator,
  Users,
  Settings as SettingsIcon,
  Cpu, // Use Cpu icon for OS feel
  ChevronRight
} from 'lucide-react';
import ImpersonationBanner from './ImpersonationBanner';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { tokens } from '@/design/design-tokens';
import { Button } from '@/components/ui/Button';
import { platformConfig } from '@/platform/platform.config';
import { modules } from '@/platform/modules.config';
import { useSubscription } from '@/platform/useSubscription';

interface LayoutProps {
  children: React.ReactNode;
}

// Icon mapping helper
const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  Package,
  Layers,
  Users,
  Settings: SettingsIcon,
  Calculator,
  Cpu
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, mode, exitImpersonation } = useAuth();
  const location = useLocation();
  const isSuperAdmin = (user as any)?.is_super_admin;
  const isImpersonating = mode === 'company' && isSuperAdmin;

  // Resolve Active Module
  const activeModule = modules.find(m => m.route === location.pathname) || modules[0];
  const companyName = user?.user_metadata?.company_name || 'Environment';

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

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
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - OS Launcher */}
      <aside
        style={sidebarStyle}
        className={`fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out md:relative md:translate-x-0${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-full flex-col">
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
              {/* OS Identity Icon */}
              <Cpu size={24} />
            </div>
            <div className="flex flex-col">
              <h1
                style={{
                  fontSize: tokens.typography.titleMd.fontSize,
                  fontWeight: tokens.typography.titleMd.fontWeight,
                  color: tokens.colors.text.primary,
                  lineHeight: '1.2'
                }}
              >
                {platformConfig.platformName}
              </h1>
              <span style={{ fontSize: '0.75rem', color: tokens.colors.text.secondary }}>
                {platformConfig.platformMode}
              </span>
            </div>
          </div>

          {/* Module Navigation */}
          <nav className="flex-1" style={{ padding: tokens.spacing.md }}>
            <div className="mb-2 px-3 text-xs font-medium uppercase text-slate-400">
              Modules
            </div>
            {modules.map((module) => {
              const IconComponent = iconMap[module.icon] || LayoutDashboard;
              return (
                <NavLink
                  key={module.id}
                  to={module.route}
                  onClick={() => setIsMobileMenuOpen(false)}
                  style={({ isActive }) => ({
                    ...linkBaseStyle,
                    ...(isActive ? linkActiveStyle : linkInactiveStyle)
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <IconComponent size={20} />
                      {module.name}
                    </>
                  )}
                </NavLink>
              );
            })}
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
                icon={<Cpu size={18} />}
                className="w-full justify-center"
              >
                Volver a {platformConfig.controlCenterLabel}
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
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Top Header (Mobile Only) */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between md:hidden"
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
              {platformConfig.platformName}
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
              {isSuperAdmin ? 'OS' : 'US'}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="relative flex flex-1 flex-col">
          <ImpersonationBanner />

          {/* Context Indicator (Desktop/Global) */}
          <div
            className="hidden items-center gap-2 border-b bg-white px-8 py-2 text-sm text-slate-500 md:flex"
            style={{ borderColor: tokens.colors.border }}
          >
            <span className="font-semibold text-slate-700">{platformConfig.platformName}</span>
            <ChevronRight size={14} />
            <span>Module: <span className="font-medium text-slate-700">{activeModule.name}</span></span>
            <ChevronRight size={14} />
            <span>Environment: <span className="font-medium text-slate-700">{companyName}</span></span>
          </div>

          <div className="w-full" style={{ padding: tokens.spacing.xl, maxWidth: '1280px', margin: '0 auto' }}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
