import React, { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, ChevronRight, Settings, LogOut, Layout, Hexagon, X, CheckSquare, Info, AlertTriangle, AlertOctagon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store';
import { supabase } from '@/services/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { es } from 'date-fns/locale';
import { formatDistanceToNow } from 'date-fns';
import { notificationService } from '@/services/notificationService';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';

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
                border-b ${colors.borderStandard} ${colors.bgSurface}
                ${spacing.pxLg}
                transition-all duration-300
                ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}
            `}
        >
            {/* Left side */}
            <div className="flex items-center gap-2 min-w-0">
                {/* Mobile: Brand */}
                <div className="lg:hidden flex items-center gap-2">
                    <Hexagon className="h-5 w-5 text-indigo-500 fill-indigo-500/10 flex-shrink-0" />
                    <span className={`${typography.uiLabel} ${colors.textPrimary}`}>BETO OS</span>
                </div>

                {/* Desktop: Branding + Breadcrumb */}
                <div className="hidden lg:flex items-center gap-2 min-w-0">
                    <Hexagon className="h-5 w-5 text-indigo-500 fill-indigo-500/10 flex-shrink-0" />
                    <span className={`${typography.uiLabel} ${colors.textPrimary}`}>BETO OS</span>

                    {mode === 'platform' && (
                        <>
                            <ChevronRight size={14} className={`${colors.textMuted} flex-shrink-0 opacity-40`} />
                            <span className={`${typography.bodySm} ${colors.textSecondary} font-medium`}>Platform Control</span>
                            {sectionName && sectionName !== 'Control Center' && (
                                <>
                                    <ChevronRight size={14} className={`${colors.textMuted} flex-shrink-0 opacity-40`} />
                                    <span className={`${typography.bodySm} font-semibold ${colors.textPrimary} truncate`}>{sectionName}</span>
                                </>
                            )}
                        </>
                    )}

                    {mode === 'company' && (
                        <>
                            <ChevronRight size={14} className={`${colors.textMuted} flex-shrink-0 opacity-40`} />
                            <span className={`${typography.bodySm} font-semibold ${colors.textPrimary} truncate`}>
                                {currentCompany?.name || 'Loading...'}
                            </span>
                            {currentCompany?.subscription_status && (
                                <span className={`inline-flex ${radius.pill} ${colors.bgMain} ${spacing.pxSm} py-0.5 ${typography.caption} font-medium ${colors.textSecondary} border ${colors.borderStandard}`}>
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
                            relative ${radius.pill} p-2 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center
                            ${notificationsOpen ? `${colors.bgBrandSubtle} text-indigo-600` : `${colors.textSecondary} hover:${colors.bgMain} hover:${colors.textPrimary}`}
                        `}
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className={`absolute right-2 top-2 h-4 w-4 ${radius.pill} bg-red-500 ${typography.text.caption} font-bold text-white flex items-center justify-center border-2 ${colors.bgSurface}`}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {notificationsOpen && (
                        <div className={`absolute right-0 mt-2 w-80 sm:w-96 origin-top-right ${radius.xl} border ${colors.borderSubtle} ${colors.bgSurface} ${shadows.xl} ring-1 ring-black ring-opacity-5 z-50 overflow-hidden`}>
                            <div className={`flex items-center justify-between ${spacing.pxLg} py-3 border-b ${colors.bgMain}`}>
                                <h3 className={`${typography.bodySm} font-semibold ${colors.textPrimary}`}>Notificaciones</h3>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={async () => {
                                            await notificationService.markAllAsRead();
                                            setUnreadCount(0);
                                            setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
                                        }}
                                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
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
                                                    group flex gap-3 ${spacing.pxLg} py-3 hover:${colors.bgMain} transition-colors cursor-pointer
                                                    ${!note.read_at ? `${colors.bgBrandSubtle}/30` : ''}
                                                `}
                                            >
                                                <div className={`
                                                    mt-0.5 h-8 w-8 ${radius.pill} flex items-center justify-center flex-shrink-0
                                                    ${note.level === 'error' ? `${colors.bgDanger} ${colors.statusDanger}` :
                                                        note.level === 'warning' ? `${colors.bgWarning} ${colors.statusWarning}` :
                                                            `${colors.bgInfo} ${colors.statusInfo}`}
                                                `}>
                                                    {note.level === 'error' ? <AlertOctagon size={16} /> :
                                                        note.level === 'warning' ? <AlertTriangle size={16} /> :
                                                            <Info size={16} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className={`${typography.bodySm} leading-snug ${!note.read_at ? `font-bold ${colors.textPrimary}` : `font-medium ${colors.textSecondary}`}`}>
                                                            {note.title}
                                                        </p>
                                                        <span className={`${typography.caption} font-medium ${colors.textMuted} whitespace-nowrap mt-0.5`}>
                                                            {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: es })}
                                                        </span>
                                                    </div>
                                                    <p className={`${typography.caption} ${colors.textSecondary} mt-1 line-clamp-2 leading-relaxed`}>
                                                        {note.message}
                                                    </p>
                                                </div>
                                                {!note.read_at && (
                                                    <div className={`mt-1.5 h-1.5 w-1.5 ${radius.pill} ${colors.bgBrand} flex-shrink-0`} />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-10 ${spacing.pxLg} text-center">
                                        <div className={`h-12 w-12 ${radius.pill} ${colors.bgMain} flex items-center justify-center mb-3 ${colors.textMuted} opacity-30`}>
                                            <Bell size={24} />
                                        </div>
                                        <p className={`text-sm font-medium ${colors.textPrimary}`}>No hay notificaciones</p>
                                        <p className={`${typography.caption} ${colors.textSecondary} mt-1`}>Te avisaremos cuando pase algo importante.</p>
                                    </div>
                                )}
                            </div>

                            <div className={`border-t ${colors.borderSubtle} ${spacing.pSm} ${colors.bgMain}`}>
                                <button
                                    onClick={() => { navigate('/settings/notifications'); setNotificationsOpen(false); }}
                                    className={`flex w-full items-center justify-center gap-2 ${radius.md} py-2 ${typography.caption} font-medium ${colors.textSecondary} hover:${colors.bgSurface} hover:text-indigo-600 transition-all border border-transparent hover:${colors.borderStandard} ${shadows.sm}`}
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
                        className={`flex items-center gap-2 ${radius.pill} border ${colors.borderStandard} ${colors.bgMain} py-1 pl-1 pr-2 sm:pr-3 hover:bg-slate-100 transition-colors min-h-[40px]`}
                    >
                        <div className={`h-8 w-8 ${radius.pill} ${colors.bgBrandSubtle} flex items-center justify-center text-indigo-600 ${typography.uiLabel} flex-shrink-0`}>
                            {user?.user_metadata?.full_name?.charAt(0) || 'U'}
                        </div>
                        <div className="hidden md:block text-left">
                            <p className={`text-sm font-medium ${colors.textSecondary} max-w-[100px] truncate`}>
                                {user?.user_metadata?.full_name || 'User'}
                            </p>
                        </div>
                        <ChevronDown size={14} className={`${colors.textMuted} hidden sm:block`} />
                    </button>

                    {menuOpen && (
                        <div className={`absolute right-0 mt-2 w-56 origin-top-right ${radius.lg} border ${colors.borderSubtle} ${colors.bgSurface} ${shadows.lg} ring-1 ring-black ring-opacity-5 py-1 z-50`}>
                            <div className={`px-4 py-3 border-b ${colors.borderSubtle}`}>
                                <p className={`${typography.bodySm} font-medium ${colors.textPrimary} truncate`}>{user?.email}</p>
                                <p className={`${typography.caption} ${colors.textSecondary} truncate mt-1`}>
                                    {user?.is_super_admin ? 'Super Admin' : 'User'}
                                </p>
                            </div>

                            <div className={`lg:hidden px-4 py-2 border-b ${colors.borderSubtle}`}>
                                <p className={`${typography.text.caption} ${colors.textMuted}`}>
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
                                    className={`flex w-full items-center gap-2 px-4 py-2.5 ${typography.bodySm} text-red-600 hover:${colors.bgDanger}`}
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