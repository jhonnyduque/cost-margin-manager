import React, { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, ChevronRight, Settings, LogOut, Layout, Hexagon, X, CheckSquare, Info, AlertTriangle, AlertOctagon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store';
import { supabase } from '@/services/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { notificationService } from '@/services/notificationService';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface TopbarProps {
    sidebarCollapsed?: boolean;
}

/** Map platform routes to human-readable section names */
const PLATFORM_SECTIONS: Record<string, string> = {
    '/control-center': 'Control Center',
    '/platform/environments': 'Environments',
    '/platform/users': 'Equipo',
    '/platform/billing': 'Facturación',
    '/settings': 'Settings',
    '/more': 'Más',
};

const getSectionName = (pathname: string): string | null => {
    for (const [route, name] of Object.entries(PLATFORM_SECTIONS)) {
        if (pathname === route || pathname.startsWith(route + '/')) return name;
    }
    return null;
};

export const Topbar: React.FC<TopbarProps> = ({ sidebarCollapsed = false }) => {
    const { user, currentCompany, mode, exitImpersonation, setIsSigningOut, resetState } = useAuth();
    const logout = useStore(state => state.logout);
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);

    const sectionName = getSectionName(location.pathname);

    // Cargar notificaciones iniciales
    useEffect(() => {
        const loadInitialData = async () => {
            if (!user) return;
            try {
                const [list, count] = await Promise.all([
                    notificationService.getNotifications(8),
                    notificationService.getUnreadCount()
                ]);
                setNotifications(list);
                setUnreadCount(count);
            } catch (err) {
                console.error('Error loading notifications:', err);
            }
        };

        loadInitialData();

        // Suscripción Realtime
        const subscription = notificationService.subscribeToNotifications((newNote) => {
            setNotifications(prev => [newNote, ...prev].slice(0, 8));
            setUnreadCount(prev => prev + 1);
            // Opcional: Sonido o Toast aquí
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [user]);

    useEffect(() => {
        setMenuOpen(false);
        setNotificationsOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) setNotificationsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!menuOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [menuOpen]);

    const handleLogout = async () => {
        setIsSigningOut(true);
        try {
            await supabase.auth.signOut();
            logout();
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
                fixed top-0 right-0 z-50 flex h-16 w-full items-center justify-between
                border-b border-slate-200 bg-white
                px-4 sm:px-6
                transition-all duration-300
                ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}
            `}
        >
            {/* Left side */}
            <div className="flex items-center gap-2 min-w-0">
                {/* Mobile: Brand */}
                <div className="lg:hidden flex items-center gap-2">
                    <Hexagon className="h-5 w-5 text-indigo-500 fill-indigo-500/20 flex-shrink-0" />
                    <span className="font-bold text-sm tracking-tight text-slate-800">BETO OS</span>
                </div>

                {/* Desktop: Branding + Breadcrumb */}
                <div className="hidden lg:flex items-center gap-2 min-w-0">
                    <Hexagon className="h-5 w-5 text-indigo-500 fill-indigo-500/20 flex-shrink-0" />
                    <span className="font-bold text-sm tracking-tight text-slate-800">BETO OS</span>

                    {mode === 'platform' && (
                        <>
                            <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                            <span className="text-sm text-slate-500 font-medium">Platform Control</span>
                            {sectionName && sectionName !== 'Control Center' && (
                                <>
                                    <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                                    <span className="text-sm font-semibold text-slate-800 truncate">{sectionName}</span>
                                </>
                            )}
                        </>
                    )}

                    {mode === 'company' && (
                        <>
                            <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                            <span className="text-sm font-semibold text-slate-800 truncate">
                                {currentCompany?.name || 'Loading...'}
                            </span>
                            {currentCompany?.subscription_status && (
                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200">
                                    {currentCompany.subscription_status}
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-4">
                <div className="relative" ref={notificationsRef}>
                    <button
                        onClick={() => setNotificationsOpen(!notificationsOpen)}
                        className={`
                            relative rounded-full p-2 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center
                            ${notificationsOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}
                        `}
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="absolute right-2 top-2 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center border-2 border-white">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {notificationsOpen && (
                        <div className="absolute right-0 mt-2 w-80 sm:w-96 origin-top-right rounded-xl border border-slate-100 bg-white shadow-xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50 bg-slate-50/50">
                                <h3 className="text-sm font-semibold text-slate-800">Notificaciones</h3>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={async () => {
                                            await notificationService.markAllAsRead();
                                            setUnreadCount(0);
                                            setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
                                        }}
                                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                                    >
                                        Marcar todas como leídas
                                    </button>
                                )}
                            </div>

                            <div className="max-h-[400px] overflow-y-auto">
                                {notifications.length > 0 ? (
                                    <div className="divide-y divide-slate-50">
                                        {notifications.map((note) => (
                                            <div
                                                key={note.id}
                                                onClick={async () => {
                                                    if (!note.read_at) {
                                                        await notificationService.markAsRead(note.id);
                                                        setUnreadCount(prev => Math.max(0, prev - 1));
                                                        setNotifications(prev => prev.map(n => n.id === note.id ? { ...n, read_at: new Date().toISOString() } : n));
                                                    }
                                                    if (note.action_url) navigate(note.action_url);
                                                    setNotificationsOpen(false);
                                                }}
                                                className={`
                                                    group flex gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer
                                                    ${!note.read_at ? 'bg-indigo-50/30' : ''}
                                                `}
                                            >
                                                <div className={`
                                                    mt-0.5 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0
                                                    ${note.level === 'error' ? 'bg-red-100 text-red-600' :
                                                        note.level === 'warning' ? 'bg-amber-100 text-amber-600' :
                                                            'bg-blue-100 text-blue-600'}
                                                `}>
                                                    {note.level === 'error' ? <AlertOctagon size={16} /> :
                                                        note.level === 'warning' ? <AlertTriangle size={16} /> :
                                                            <Info size={16} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className={`text-[13px] leading-snug ${!note.read_at ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                                            {note.title}
                                                        </p>
                                                        <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap mt-0.5">
                                                            {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: es })}
                                                        </span>
                                                    </div>
                                                    <p className="text-[12px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                                        {note.message}
                                                    </p>
                                                </div>
                                                {!note.read_at && (
                                                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 text-slate-300">
                                            <Bell size={24} />
                                        </div>
                                        <p className="text-sm font-medium text-slate-900">No hay notificaciones</p>
                                        <p className="text-xs text-slate-500 mt-1">Te avisaremos cuando pase algo importante.</p>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-slate-50 p-2 bg-slate-50/30">
                                <button
                                    onClick={() => { navigate('/settings/notifications'); setNotificationsOpen(false); }}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium text-slate-600 hover:bg-white hover:text-indigo-600 transition-all border border-transparent hover:border-slate-200 shadow-sm"
                                >
                                    <Settings size={14} />
                                    Gestionar preferencias
                                </button>
                            </div>
                        </div>
                    )}
                </div>

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

                            <div className="lg:hidden px-4 py-2 border-b border-slate-50">
                                <p className="text-xs text-slate-400">
                                    {mode === 'platform' ? 'Platform Control' : currentCompany?.name || ''}
                                </p>
                            </div>

                            <div className="py-1">
                                {user?.is_super_admin && mode === 'company' && (
                                    <button
                                        onClick={() => { handleSwitchToPlatform(); setMenuOpen(false); }}
                                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50"
                                    >
                                        <Layout size={16} />
                                        Back to Platform
                                    </button>
                                )}
                                <button
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"
                                    onClick={() => { navigate('/settings'); setMenuOpen(false); }}
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