import React, { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, User, Settings, LogOut, Layout, Hexagon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store';
import { supabase } from '@/services/supabase';
import { useNavigate } from 'react-router-dom';

interface TopbarProps {
    sidebarCollapsed?: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({ sidebarCollapsed = false }) => {
    const { user, currentCompany, mode, exitImpersonation, setIsSigningOut, resetState } = useAuth();
    const logout = useStore(state => state.logout);
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

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
        console.log('[Topbar] Logout requested');
        setIsSigningOut(true);

        try {
            await supabase.auth.signOut();
            logout();
            console.log('[Topbar] Forcing resetState after signOut');
            resetState();
        } catch (error) {
            console.error('Logout error:', error);
            resetState();
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
        <header
            className={`
                fixed top-0 right-0 z-50 flex h-14 lg:h-16 w-full items-center justify-between
                border-b border-slate-200 bg-white
                px-4 sm:px-6
                transition-all duration-300
                ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-[17rem]'}
            `}
        >
            {/* Left side */}
            <div className="flex items-center gap-3 min-w-0">
                {/* Mobile: Show brand icon */}
                <div className="lg:hidden flex items-center gap-2">
                    <Hexagon className="h-5 w-5 text-indigo-500 fill-indigo-500/20 flex-shrink-0" />
                    <span className="font-bold text-sm tracking-tight text-slate-800">BETO OS</span>
                </div>

                {/* Desktop: Show page title */}
                <h1 className="hidden lg:block text-lg font-semibold text-slate-800 truncate">
                    {mode === 'platform' ? 'Platform Control' : currentCompany?.name || 'Loading...'}
                </h1>
                {mode === 'company' && (
                    <span className="hidden sm:inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 border border-slate-200">
                        {currentCompany?.subscription_status || 'Unknown'}
                    </span>
                )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-4">
                {/* Notification bell */}
                <button className="relative rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center">
                    <Bell size={20} />
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                </button>

                {/* Avatar / User Menu (Command Center on mobile per v2.3) */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-2 sm:pr-3 hover:bg-slate-100 transition-colors min-h-[40px]"
                    >
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                            {user?.user_metadata?.full_name?.charAt(0) || 'U'}
                        </div>
                        <div className="hidden md:block text-left">
                            <p className="text-sm font-medium text-slate-700 max-w-[100px] truncate">
                                {user?.user_metadata?.full_name || 'User'}
                            </p>
                        </div>
                        <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
                    </button>

                    {menuOpen && (
                        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg border border-slate-100 bg-white shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-50">
                            <div className="px-4 py-3 border-b border-slate-50">
                                <p className="text-sm font-medium text-slate-900 truncate">{user?.email}</p>
                                <p className="text-xs text-slate-500 truncate mt-1">
                                    {user?.is_super_admin ? 'Super Admin' : 'User'}
                                </p>
                            </div>

                            {/* Mobile: Show page context */}
                            <div className="lg:hidden px-4 py-2 border-b border-slate-50">
                                <p className="text-xs text-slate-400">
                                    {mode === 'platform' ? 'Platform Control' : currentCompany?.name || ''}
                                </p>
                            </div>

                            <div className="py-1">
                                <button
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    <User size={16} />
                                    Profile
                                </button>

                                {user?.is_super_admin && mode === 'company' && (
                                    <button
                                        onClick={() => {
                                            handleSwitchToPlatform();
                                            setMenuOpen(false);
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50"
                                    >
                                        <Layout size={16} />
                                        Back to Platform
                                    </button>
                                )}

                                <button
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"
                                    onClick={() => {
                                        navigate('/settings');
                                        setMenuOpen(false);
                                    }}
                                >
                                    <Settings size={16} />
                                    Settings
                                </button>
                            </div>

                            <div className="py-1 border-t border-slate-50">
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
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