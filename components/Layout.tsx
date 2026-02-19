
import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Layers,
  LogOut,
  Menu,
  X,
  Calculator,
  Users // New Icon
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

import { supabase } from '../services/supabase';

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      // No necesitamos navegar manualmente, App.tsx detectará el cambio de sesión
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/productos', icon: Package, label: 'Productos' },
    { to: '/materias-primas', icon: Layers, label: 'Materias Primas' },
    { to: '/equipo', icon: Users, label: 'Equipo' }, // New Item
  ];

  const activeClass = "bg-blue-50 text-blue-600 font-medium";
  const inactiveClass = "text-gray-500 hover:bg-gray-100 transition-all duration-200";

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
              <Calculator size={24} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Calculadora</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm
                  ${isActive ? activeClass : inactiveClass}
                `}
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User Section / Bottom */}
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all"
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
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 md:px-8 justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              className="p-2 md:hidden text-gray-500"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-semibold text-gray-800 hidden md:block">
              Panel de Control
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
              AD
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
