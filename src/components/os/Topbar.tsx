import React, { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, User, Settings, LogOut, Layout } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store';
import { supabase } from '@/services/supabase';
import { useNavigate } from 'react-router-dom';

export const Topbar: React.FC = () => {
    const { user, currentCompany, mode, exitImpersonation, setIsSigningOut } = useAuth();
    const logout = useStore(state => state.logout);
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        setIsSigningOut(true);
        logout(); // Limpiar store inmediatamente
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            navigate('/login', { replace: true });
        }
    };

    const handleSwitchToPlatform = () => {
        if (mode === 'company') {
            exitImpersonation();
            navigate('/control-center');
        }
    };

    return (
        <header className="fixed top-0 right-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6 pl-20 lg:pl-64 transition-all duration-300">
            {/* Left Side: Breadcrumbs or Active Context */}
            <div className="flex items-center gap-4">
                {/* Placeholder for Breadcrumbs */}
                <h1 className="text-lg font-semibold text-slate-800">
                    {mode === 'platform' ? 'Platform Control' : currentCompany?.name || 'Loading...'}
                </h1>
                {mode === 'company' && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 border border-slate-200">
                        {currentCompany?.subscription_status || 'Unknown'}
                    </span>
                )}
            </div>

            {/* Right Side: Actions */}
            <div className="flex items-center gap-4">
                {/* Environment Switcher (Placeholder / Global) */}

                {/* Notifications */}
                <button className="relative rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                    <Bell size={20} />
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                </button>

                {/* Profile Menu */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-3 hover:bg-slate-100 transition-colors"
                    >
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                            {user?.user_metadata?.full_name?.charAt(0) || 'U'}
                        </div>
                        <div className="hidden md:block text-left">
                            <p className="text-sm font-medium text-slate-700 max-w-[100px] truncate">
                                {user?.user_metadata?.full_name || 'User'}
                            </p>
                        </div>
                        <ChevronDown size={14} className="text-slate-400" />
                    </button>

                    {/* Dropdown */}
                    {menuOpen && (
                        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg border border-slate-100 bg-white shadow-lg ring-1 ring-black ring-opacity-5 py-1">
                            <div className="px-4 py-3 border-b border-slate-50">
                                <p className="text-sm font-medium text-slate-900 truncate">{user?.email}</p>
                                <p className="text-xs text-slate-500 truncate mt-1">
                                    {user?.is_super_admin ? 'Super Admin' : 'User'}
                                </p>
                            </div>

                            <div className="py-1">
                                <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600" onClick={() => setMenuOpen(false)}>
                                    <User size={16} />
                                    Profile
                                </button>

                                {user?.is_super_admin && mode === 'company' && (
                                    <button
                                        onClick={() => {
                                            handleSwitchToPlatform();
                                            setMenuOpen(false);
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-amber-600 hover:bg-amber-50"
                                    >
                                        <Layout size={16} />
                                        Back to Platform
                                    </button>
                                )}

                                <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600" onClick={() => navigate('/settings')}>
                                    <Settings size={16} />
                                    Settings
                                </button>
                            </div>

                            <div className="py-1 border-t border-slate-50">
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                    <LogOut size={16} />
                                    Logout
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};
