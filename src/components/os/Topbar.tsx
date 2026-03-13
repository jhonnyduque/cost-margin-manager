import React, { useState, useRef, useEffect } from 'react';
import {
    Bell,
    ChevronDown,
    ChevronRight,
    Settings,
    LogOut,
    Layout,
    Hexagon,
    CheckCheck,
    Info,
    AlertTriangle,
    AlertOctagon
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types';
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

type NotificationItem = {
    id: string;
    title: string;
    message: string;
    created_at: string;
    read_at?: string | null;
    action_url?: string | null;
    type?: string | null;
    priority?: string | null;
};

// ============================================================================
// ✅ HELPERS PARA USER INFO (Eliminan "User" y "U" genéricos)
// ============================================================================

/**
 * Obtiene iniciales profesionales para el avatar:
 * - Si hay full_name: "Juan Pérez" → "JP"
 * - Si hay email: "juan@empresa.com" → "JU" 
 * - Fallback seguro: nunca muestra "U" solo
 */
const getUserInitials = (user: any): string => {
    const fullName = user?.user_metadata?.full_name;
    const email = user?.email || '';

    if (fullName && fullName.trim()) {
        const names = fullName.trim().split(/\s+/).filter(Boolean);
        if (names.length >= 2) {
            // Primera letra del primer nombre + primera del apellido
            return (names[0][0] + names[names.length - 1][0]).toUpperCase();
        }
        // Nombre solo: primeras 2 letras
        return names[0].slice(0, 2).toUpperCase();
    }

    if (email) {
        const emailName = email.split('@')[0];
        if (emailName.length >= 2) {
            return (emailName[0] + emailName[1]).toUpperCase();
        }
        return emailName[0].toUpperCase();
    }

    return 'US'; // Fallback más profesional que "U"
};

/**
 * Obtiene texto para mostrar en el topbar:
 * - Prioriza full_name si existe
 * - Fallback a email (sin dominio si es largo)
 * - Nunca muestra "User" genérico
 */
const getUserDisplayName = (user: any): string => {
    const fullName = user?.user_metadata?.full_name;
    const email = user?.email || '';

    if (fullName && fullName.trim()) {
        return fullName.trim();
    }

    if (email) {
        const [name, domain] = email.split('@');
        // Si el nombre del email es razonable, mostrarlo
        if (name && name.length <= 20 && !/^[0-9]+$/.test(name)) {
            return name;
        }
        // Si es muy largo o numérico, mostrar email completo truncado
        return email.length > 24 ? `${email.slice(0, 21)}...` : email;
    }

    return 'Invitado'; // Mejor que "User"
};

/**
 * Obtiene label de rol para badge
 */
const ROLE_LABELS: Record<UserRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    manager: 'Manager',
    operator: 'Operator',
    viewer: 'Viewer',
    super_admin: 'Super Admin',
};

const getUserRoleLabel = (
    user: any,
    mode: string,
    userRole: UserRole | null
): string => {
    if (user?.is_super_admin) return ROLE_LABELS.super_admin;
    if (mode === 'platform') return 'Platform';
    if (userRole) return ROLE_LABELS[userRole] || userRole;
    return 'Member';
};

// ============================================================================
// MAPPINGS Y UTILIDADES EXISTENTES
// ============================================================================

const PLATFORM_SECTIONS: Record<string, string> = {
    '/platform/environments': 'Entornos',
    '/platform/users': 'Usuarios',
    '/platform/billing': 'Finanzas',
    '/settings': 'Settings',
    '/mas': 'Más',
};

const PLATFORM_TABS: Record<string, string> = {
    overview: 'Resumen',
    tenants: 'Empresas',
    billing: 'Finanzas',
    ops: 'Operaciones',
    taxonomies: 'Taxonomías',
};

const getSectionName = (pathname: string, search: string): string | null => {
    if (pathname === '/control-center') {
        const activeTab = new URLSearchParams(search).get('tab') || 'overview';
        return PLATFORM_TABS[activeTab] || 'Resumen';
    }

    for (const [route, name] of Object.entries(PLATFORM_SECTIONS)) {
        if (pathname === route || pathname.startsWith(route + '/')) return name;
    }
    return null;
};

const getNotificationIcon = (note: NotificationItem) => {
    const title = `${note.title || ''} ${note.message || ''}`.toLowerCase();
    const type = (note.type || '').toLowerCase();
    const priority = (note.priority || '').toLowerCase();

    if (priority === 'critical' || type.includes('critical') || title.includes('crítico') || title.includes('urgent')) {
        return <AlertOctagon size={14} className="text-red-600" />;
    }

    if (priority === 'warning' || type.includes('warning') || title.includes('alerta') || title.includes('warning')) {
        return <AlertTriangle size={14} className="text-amber-500" />;
    }

    if (type.includes('success') || title.includes('completado') || title.includes('aprobado') || title.includes('éxito')) {
        return <CheckCheck size={14} className="text-emerald-600" />;
    }

    return <Info size={14} className="text-indigo-600" />;
};

const getNotificationIconBg = (note: NotificationItem) => {
    const title = `${note.title || ''} ${note.message || ''}`.toLowerCase();
    const type = (note.type || '').toLowerCase();
    const priority = (note.priority || '').toLowerCase();

    if (priority === 'critical' || type.includes('critical') || title.includes('crítico') || title.includes('urgent')) {
        return 'bg-red-50 border-red-100';
    }

    if (priority === 'warning' || type.includes('warning') || title.includes('alerta') || title.includes('warning')) {
        return 'bg-amber-50 border-amber-100';
    }

    if (type.includes('success') || title.includes('completado') || title.includes('aprobado') || title.includes('éxito')) {
        return 'bg-emerald-50 border-emerald-100';
    }

    return 'bg-indigo-50 border-indigo-100';
};

const formatRelativeTime = (date: string) => {
    const raw = formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
    return raw.replace(/^alrededor de /i, '').toLowerCase();
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export const Topbar: React.FC<TopbarProps> = ({ sidebarCollapsed = false }) => {
    const { user, currentCompany, userRole, mode, exitImpersonation, setIsSigningOut, resetState } = useAuth();
    const logout = useStore(state => state.logout);
    const navigate = useNavigate();
    const location = useLocation();

    const [menuOpen, setMenuOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

    const menuRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);

    const sectionName = getSectionName(location.pathname, location.search);

    // ✅ Calcular user info una vez por render
    const userInitials = getUserInitials(user);
    const userDisplayName = getUserDisplayName(user);
    const userRoleLabel = getUserRoleLabel(user, mode, userRole);

    useEffect(() => {
        const loadInitialData = async () => {
            if (!user) return;

            try {
                const [list, count] = await Promise.all([
                    notificationService.getNotifications(12),
                    notificationService.getUnreadCount()
                ]);

                setNotifications(list);
                setUnreadCount(count);
            } catch (err) {
                console.error('Error loading notifications:', err);
            }
        };

        loadInitialData();

        const subscription = notificationService.subscribeToNotifications(
            user.id,
            (newNote: NotificationItem) => {
                setNotifications(prev => {
                    if (prev.some(n => n.id === newNote.id)) return prev;
                    return [newNote, ...prev].slice(0, 12);
                });
                setUnreadCount(prev => prev + 1);
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [user]);

    useEffect(() => {
        setMenuOpen(false);
        setNotificationsOpen(false);
        setExpandedNoteId(null);
    }, [location.pathname]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }

            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
                setNotificationsOpen(false);
                setExpandedNoteId(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setMenuOpen(false);
                setNotificationsOpen(false);
                setExpandedNoteId(null);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

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

    const handleOpenNotifications = () => {
        setNotificationsOpen(prev => !prev);
        setMenuOpen(false);
    };

    const handleMarkAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead();
            setNotifications(prev =>
                prev.map(n => ({
                    ...n,
                    read_at: n.read_at || new Date().toISOString(),
                }))
            );
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const handleNotificationClick = async (note: NotificationItem) => {
        try {
            if (!note.read_at) {
                await notificationService.markAsRead(note.id);
                setUnreadCount(prev => Math.max(0, prev - 1));
                setNotifications(prev =>
                    prev.map(n =>
                        n.id === note.id
                            ? { ...n, read_at: new Date().toISOString() }
                            : n
                    )
                );
            }

            const isLong = note.message.length > 85;

            if (note.action_url) {
                navigate(note.action_url);
                setNotificationsOpen(false);
                setExpandedNoteId(null);
                return;
            }

            if (isLong) {
                setExpandedNoteId(prev => (prev === note.id ? null : note.id));
            }
        } catch (error) {
            console.error('Error interacting with notification:', error);
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
                            {sectionName && (
                                <>
                                    <ChevronRight size={14} className={`${colors.textMuted} flex-shrink-0 opacity-40`} />
                                    <span className={`${typography.bodySm} font-semibold ${colors.textPrimary} truncate`}>
                                        {sectionName}
                                    </span>
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
                                <span
                                    className={`
                                        inline-flex ${radius.pill} ${colors.bgMain} ${spacing.pxSm}
                                        py-0.5 ${typography.caption} font-medium ${colors.textSecondary}
                                        border ${colors.borderStandard}
                                    `}
                                >
                                    {currentCompany.subscription_status}
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-4">
                {/* Notifications */}
                <div className="relative" ref={notificationsRef}>
                    <button
                        onClick={handleOpenNotifications}
                        aria-label="Abrir notificaciones"
                        className={`
                            relative h-11 w-11 ${radius.pill} transition-all flex items-center justify-center
                            ${notificationsOpen
                                ? `${colors.bgBrandSubtle} text-indigo-600 shadow-sm`
                                : `${colors.textSecondary} hover:${colors.bgMain} hover:${colors.textPrimary}`
                            }
                        `}
                    >
                        <Bell size={22} />

                        {unreadCount > 0 && (
                            <div className="absolute top-[8px] right-[8px] pointer-events-none">
                                <span
                                    className="absolute inset-0 h-2.5 w-2.5 bg-[#ff3040] rounded-full animate-ping opacity-70"
                                    aria-hidden="true"
                                />
                                <span
                                    className="relative block h-2.5 w-2.5 bg-[#ff3040] border-2 border-white rounded-full shadow-sm"
                                    aria-hidden="true"
                                />
                            </div>
                        )}
                    </button>

                    {notificationsOpen && (
                        <div
                            className={`
                                absolute mt-2 origin-top-right
                                ${radius.xl} border ${colors.borderSubtle} ${colors.bgSurface}
                                ${shadows.xl} ring-1 ring-black/5 z-50 overflow-hidden
                                right-0 w-[calc(100vw-1rem)]
                                sm:w-[380px]
                                max-w-[calc(100vw-1rem)]
                            `}
                        >
                            <div className="flex flex-col">
                                {/* Header */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
                                    <div className="min-w-0">
                                        <h3 className="text-[15px] font-semibold text-slate-900 leading-none">
                                            Notificaciones
                                        </h3>
                                        <p className="text-[11px] text-slate-500 mt-1">
                                            {unreadCount > 0
                                                ? `${unreadCount} pendiente${unreadCount > 1 ? 's' : ''}`
                                                : 'Todo al día'}
                                        </p>
                                    </div>

                                    {unreadCount > 0 && (
                                        <button
                                            onClick={handleMarkAllAsRead}
                                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                                        >
                                            <CheckCheck size={12} />
                                            marcar todas
                                        </button>
                                    )}
                                </div>

                                {/* List */}
                                <div className="max-h-[252px] overflow-y-auto overscroll-contain">
                                    {notifications.length > 0 ? (
                                        <div className="divide-y divide-slate-100">
                                            {notifications.map((note) => {
                                                const isUnread = !note.read_at;
                                                const isExpanded = expandedNoteId === note.id;
                                                const isLong = note.message.length > 85;

                                                return (
                                                    <div
                                                        key={note.id}
                                                        onClick={() => handleNotificationClick(note)}
                                                        className={`
                                                            group cursor-pointer transition-colors
                                                            ${isUnread ? 'bg-indigo-50/30' : 'bg-white'}
                                                            hover:bg-slate-50
                                                        `}
                                                    >
                                                        <div className="flex gap-3 px-4 py-3">
                                                            {/* Icon */}
                                                            <div
                                                                className={`
                                                                    mt-0.5 h-8 w-8 rounded-full border flex items-center justify-center flex-shrink-0
                                                                    ${getNotificationIconBg(note)}
                                                                `}
                                                            >
                                                                {getNotificationIcon(note)}
                                                            </div>

                                                            {/* Content */}
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <p
                                                                            className={`
                                                                                text-[13px] leading-4
                                                                                ${isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}
                                                                            `}
                                                                        >
                                                                            {note.title}
                                                                        </p>

                                                                        <p className="text-[11px] text-slate-500 mt-1">
                                                                            {formatRelativeTime(note.created_at)}
                                                                        </p>
                                                                    </div>

                                                                    {isUnread && (
                                                                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500 flex-shrink-0" />
                                                                    )}
                                                                </div>

                                                                <p
                                                                    className={`
                                                                        text-[12px] leading-5 text-slate-600 mt-1.5 pr-1
                                                                        ${isExpanded ? 'line-clamp-none' : 'line-clamp-2'}
                                                                    `}
                                                                >
                                                                    {note.message}
                                                                </p>

                                                                {(isLong || note.action_url) && (
                                                                    <div className="flex items-center gap-3 mt-2">
                                                                        {isLong && !note.action_url && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setExpandedNoteId(prev => prev === note.id ? null : note.id);
                                                                                }}
                                                                                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
                                                                            >
                                                                                {isExpanded ? 'ver menos' : 'ver más'}
                                                                            </button>
                                                                        )}

                                                                        {note.action_url && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    navigate(note.action_url as string);
                                                                                    setNotificationsOpen(false);
                                                                                    setExpandedNoteId(null);
                                                                                }}
                                                                                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
                                                                            >
                                                                                ir al detalle
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="px-6 py-10 text-center">
                                            <div className="mx-auto h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                                <Bell size={16} className="text-slate-400" />
                                            </div>
                                            <p className="text-[13px] font-medium text-slate-700">
                                                No tienes notificaciones
                                            </p>
                                            <p className="text-[11px] text-slate-500 mt-1">
                                                Cuando ocurra algo importante, aparecerá aquí.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="border-t border-slate-100 bg-slate-50/70 p-2">
                                    <button
                                        onClick={() => {
                                            navigate('/settings?tab=notifications');
                                            setNotificationsOpen(false);
                                            setExpandedNoteId(null);
                                        }}
                                        className={`
                                            w-full flex items-center justify-center gap-2 py-2.5
                                            ${radius.md} text-[12px] font-semibold
                                            ${colors.textSecondary} hover:bg-white hover:${colors.textPrimary}
                                            border border-transparent hover:border-slate-200 transition-all
                                        `}
                                    >
                                        <Settings size={14} />
                                        gestionar preferencias
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ✅ USER MENU - IMPLEMENTACIÓN PROFESIONAL */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className={`
                            flex items-center gap-2 ${radius.pill} border ${colors.borderStandard}
                            ${colors.bgMain} py-1 pl-1 pr-2 sm:pr-3 hover:bg-slate-100
                            transition-colors min-h-[40px]
                        `}
                    >
                        {/* Avatar con iniciales inteligentes */}
                        <div
                            className={`
                                h-8 w-8 ${radius.pill} ${colors.bgBrandSubtle}
                                flex items-center justify-center text-indigo-600
                                ${typography.uiLabel} font-semibold flex-shrink-0
                            `}
                            aria-label={`Perfil de ${userDisplayName}`}
                        >
                            {userInitials}
                        </div>

                        {/* Texto visible solo en desktop */}
                        <div className="hidden md:block text-left min-w-0">
                            <p className={`text-sm font-medium ${colors.textPrimary} truncate max-w-[120px]`}>
                                {userDisplayName}
                            </p>
                            {/* Badge de rol compacto */}
                            <span className={`
                                inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium
                                ${user?.is_super_admin
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-slate-100 text-slate-600'}
                            `}>
                                {userRoleLabel}
                            </span>
                        </div>

                        <ChevronDown size={14} className={`${colors.textMuted} hidden sm:block flex-shrink-0`} />
                    </button>

                    {menuOpen && (
                        <div
                            className={`
                                absolute right-0 mt-2 w-56 origin-top-right ${radius.lg}
                                border ${colors.borderSubtle} ${colors.bgSurface}
                                ${shadows.lg} ring-1 ring-black ring-opacity-5 py-1 z-50
                            `}
                        >
                            {/* Header del dropdown con info completa */}
                            <div className={`px-4 py-3 border-b ${colors.borderSubtle}`}>
                                <p className={`${typography.bodySm} font-medium ${colors.textPrimary} truncate`}>
                                    {user?.email}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className={`${typography.caption} ${colors.textSecondary} truncate`}>
                                        {userDisplayName}
                                    </p>
                                    <span className={`
                                        inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold
                                        ${user?.is_super_admin
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'bg-slate-100 text-slate-600'}
                                    `}>
                                        {userRoleLabel}
                                    </span>
                                </div>
                            </div>

                            <div className={`lg:hidden px-4 py-2 border-b ${colors.borderSubtle}`}>
                                <p className={`${typography.text.caption} ${colors.textMuted}`}>
                                    {mode === 'platform' ? 'Platform Control' : currentCompany?.name || ''}
                                </p>
                            </div>

                            <div className="py-1">
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
                                    className={`
                                        flex w-full items-center gap-2 px-4 py-2.5
                                        ${typography.bodySm} text-red-600 hover:${colors.bgDanger}
                                    `}
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



