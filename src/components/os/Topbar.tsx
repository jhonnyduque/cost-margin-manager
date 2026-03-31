import React, { useState, useRef, useEffect } from 'react';
import {
    Bell, ChevronDown, ChevronRight, Settings, LogOut, Layout,
    Hexagon, CheckCheck, Info, AlertTriangle, AlertOctagon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types';
import { useStore } from '@/store';
import { supabase } from '@/services/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { es } from 'date-fns/locale';
import { formatDistanceToNow } from 'date-fns';
import { notificationService } from '@/services/notificationService';

interface TopbarProps { sidebarCollapsed?: boolean; }

type NotificationItem = {
    id: string; title: string; message: string; created_at: string;
    read_at?: string | null; action_url?: string | null;
    type?: string | null; priority?: string | null;
};

/* ── Shared styles — all via CSS vars v4 ── */
const topbarStyle: React.CSSProperties = {
    background: 'var(--surface-card)',
    borderBottom: 'var(--border-default)',
    boxShadow: 'var(--shadow-sm)',
};

const surfaceButtonStyle: React.CSSProperties = {
    background: 'var(--surface-card)',
    border: 'var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-sm)',
    transition: 'all var(--transition-fast)',
};

const dropdownStyle: React.CSSProperties = {
    background: 'var(--surface-card)',
    border: 'var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
};

const dropdownBtnStyle: React.CSSProperties = {
    display: 'flex', width: '100%', alignItems: 'center',
    gap: 'var(--space-8)', padding: 'var(--space-12) var(--space-16)',
    fontSize: 'var(--text-body-size)', fontWeight: 500,
    color: 'var(--text-secondary)', background: 'transparent',
    border: 'none', cursor: 'pointer',
    transition: 'background var(--transition-fast)',
};

const subtleBadgeStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    minHeight: '1.625rem', padding: '0 var(--space-8)',
    borderRadius: '999px', fontSize: 'var(--text-small-size)', fontWeight: 600,
    background: 'var(--surface-muted)', color: 'var(--text-secondary)',
    border: '1px solid var(--border-color-default)', whiteSpace: 'nowrap',
};

/* ── Helpers ── */
const getUserInitials = (user: any): string => {
    const fullName = user?.user_metadata?.full_name;
    const email = user?.email || '';
    if (fullName?.trim()) {
        const names = fullName.trim().split(/\s+/).filter(Boolean);
        return names.length >= 2 ? (names[0][0] + names[names.length - 1][0]).toUpperCase() : names[0].slice(0, 2).toUpperCase();
    }
    if (email) {
        const n = email.split('@')[0];
        return n.length >= 2 ? (n[0] + n[1]).toUpperCase() : n[0].toUpperCase();
    }
    return 'US';
};

const getUserDisplayName = (user: any): string => {
    const fullName = user?.user_metadata?.full_name;
    const email = user?.email || '';
    if (fullName?.trim()) return fullName.trim();
    if (email) {
        const [name] = email.split('@');
        if (name && name.length <= 20 && !/^[0-9]+$/.test(name)) return name;
        return email.length > 24 ? `${email.slice(0, 21)}...` : email;
    }
    return 'Invitado';
};

const ROLE_LABELS: Record<UserRole, string> = {
    owner: 'Owner', admin: 'Admin', manager: 'Manager',
    operator: 'Operator', viewer: 'Viewer', super_admin: 'Super Admin',
};

const getUserRoleLabel = (user: any, mode: string, userRole: UserRole | null): string => {
    if (user?.is_super_admin) return ROLE_LABELS.super_admin;
    if (mode === 'platform') return 'Platform';
    if (userRole) return ROLE_LABELS[userRole] || userRole;
    return 'Member';
};

const PLATFORM_SECTIONS = [
    { match: '/platform/environments', label: 'Entornos', path: '/platform/environments' },
    { match: '/platform/users', label: 'Usuarios', path: '/platform/users' },
    { match: '/platform/billing', label: 'Finanzas', path: '/platform/billing' },
    { match: '/settings', label: 'Settings', path: '/settings' },
    { match: '/mas', label: 'Más', path: '/mas' },
];

const PLATFORM_TABS: Record<string, { label: string; path: string }> = {
    overview: { label: 'Resumen', path: '/control-center?tab=overview' },
    tenants: { label: 'Empresas', path: '/control-center?tab=tenants' },
    billing: { label: 'Finanzas', path: '/control-center?tab=billing' },
    ops: { label: 'Operaciones', path: '/control-center?tab=ops' },
    taxonomies: { label: 'Taxonomías', path: '/control-center?tab=taxonomies' },
};

const COMPANY_SECTIONS = [
    { match: '/dashboard', label: 'Dashboard', path: '/dashboard' },
    { match: '/productos', label: 'Productos', path: '/productos' },
    { match: '/stock', label: 'Stock', path: '/stock' },
    { match: '/materias-primas', label: 'Materias Primas', path: '/materias-primas' },
    { match: '/compras', label: 'Compras', path: '/compras' },
    { match: '/proveedores', label: 'Proveedores', path: '/proveedores' },
    { match: '/clientes', label: 'Clientes', path: '/clientes' },
    { match: '/despachos', label: 'Despachos', path: '/despachos' },
    { match: '/produccion', label: 'Producción', path: '/produccion' },
    { match: '/equipo', label: 'Equipo', path: '/equipo' },
    { match: '/settings', label: 'Settings', path: '/settings' },
    { match: '/mas', label: 'Más', path: '/mas' },
    { match: '/help', label: 'Ayuda', path: '/help' },
    { match: '/status', label: 'Estado', path: '/status' },
];

const getSectionMeta = (pathname: string, search: string) => {
    if (pathname === '/control-center') {
        const activeTab = new URLSearchParams(search).get('tab') || 'overview';
        return PLATFORM_TABS[activeTab] || PLATFORM_TABS.overview;
    }
    for (const item of PLATFORM_SECTIONS) {
        if (pathname === item.match || pathname.startsWith(item.match + '/')) return item;
    }
    for (const item of COMPANY_SECTIONS) {
        if (pathname === item.match || pathname.startsWith(item.match + '/')) return item;
    }
    return null;
};

const getNotificationVisual = (note: NotificationItem) => {
    const text = `${note.title || ''} ${note.message || ''}`.toLowerCase();
    const type = (note.type || '').toLowerCase();
    const priority = (note.priority || '').toLowerCase();

    if (priority === 'critical' || type.includes('critical') || text.includes('crítico') || text.includes('urgent'))
        return { color: 'var(--state-danger)', background: 'var(--surface-danger-soft)', icon: <AlertOctagon size={14} style={{ color: 'var(--state-danger)' }} /> };
    if (priority === 'warning' || type.includes('warning') || text.includes('alerta') || text.includes('warning'))
        return { color: 'var(--state-warning)', background: 'var(--surface-warning-soft)', icon: <AlertTriangle size={14} style={{ color: 'var(--state-warning)' }} /> };
    if (type.includes('success') || text.includes('completado') || text.includes('aprobado') || text.includes('éxito'))
        return { color: 'var(--state-success)', background: 'var(--surface-success-soft)', icon: <CheckCheck size={14} style={{ color: 'var(--state-success)' }} /> };
    return { color: 'var(--state-info)', background: 'var(--surface-info-soft)', icon: <Info size={14} style={{ color: 'var(--state-info)' }} /> };
};

const formatRelativeTime = (date: string) =>
    formatDistanceToNow(new Date(date), { addSuffix: true, locale: es }).replace(/^alrededor de /i, '').toLowerCase();

/* ── Component ── */
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

    const sectionMeta = getSectionMeta(location.pathname, location.search);
    const userInitials = getUserInitials(user);
    const userDisplayName = getUserDisplayName(user);
    const userRoleLabel = getUserRoleLabel(user, mode, userRole);

    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const [list, count] = await Promise.all([
                    notificationService.getNotifications({ limit: 12, companyId: currentCompany?.id }),
                    notificationService.getUnreadCount(currentCompany?.id)
                ]);
                setNotifications(list); setUnreadCount(count);
            } catch (err) { console.error('Error loading notifications:', err); }
        })();
        const subscription = notificationService.subscribeToNotifications(user.id, currentCompany?.id, (newNote: any) => {
            // Evitar duplicados y mantener límite
            setNotifications(prev => {
                const exists = prev.some(n => n.id === newNote.id);
                if (exists) return prev;
                return [newNote, ...prev].slice(0, 12);
            });
            setUnreadCount(prev => prev + 1);
        });
        return () => subscription.unsubscribe();
    }, [user, currentCompany?.id]);

    useEffect(() => { setMenuOpen(false); setNotificationsOpen(false); setExpandedNoteId(null); }, [location.pathname, location.search]);

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) { setNotificationsOpen(false); setExpandedNoteId(null); }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenuOpen(false); setNotificationsOpen(false); setExpandedNoteId(null); } };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    const handleLogout = async () => {
        setIsSigningOut(true);
        try { await supabase.auth.signOut(); logout(); resetState(); }
        catch { resetState(); }
        finally { navigate('/login', { replace: true }); }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead(currentCompany?.id);
            setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
            setUnreadCount(0);
        } catch (err) { console.error('Error marking all as read:', err); }
    };

    const handleNotificationClick = async (note: NotificationItem) => {
        try {
            if (!note.read_at) {
                await notificationService.markAsRead(note.id);
                setUnreadCount(prev => Math.max(0, prev - 1));
                setNotifications(prev => prev.map(n => n.id === note.id ? { ...n, read_at: new Date().toISOString() } : n));
            }
            if (note.action_url) { navigate(note.action_url); setNotificationsOpen(false); setExpandedNoteId(null); return; }
            if (note.message.length > 85) setExpandedNoteId(prev => prev === note.id ? null : note.id);
        } catch (err) { console.error('Error interacting with notification:', err); }
    };

    return (
        <header
            className="fixed top-0 right-0 z-40 h-16"
            style={{
                ...topbarStyle,
                left: sidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-expanded)',
                transition: 'left var(--transition-slow)',
            }}
        >
            <div className="h-full flex items-center justify-between gap-4 px-6">

                {/* Left */}
                <div className="flex items-center gap-2 min-w-0 lg:pl-4">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-2 min-w-0">
                        <div style={{ width: '2rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--surface-primary-soft)', color: 'var(--state-primary)', flexShrink: 0 }}>
                            <Hexagon size={16} />
                        </div>
                        <span style={{ fontSize: 'var(--text-small-size)', fontWeight: 700, color: 'var(--text-primary)' }}>BETO OS</span>
                    </div>

                    {/* Desktop breadcrumb */}
                    <div className="hidden lg:flex items-center gap-2 min-w-0">
                        {mode === 'platform' && (
                            <>
                                <button type="button" onClick={() => navigate('/control-center')} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'var(--text-body-size)', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Platform Control
                                </button>
                                {sectionMeta && (
                                    <>
                                        <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: 0.7 }} />
                                        <span style={{ fontSize: 'var(--text-body-size)', fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sectionMeta.label}</span>
                                    </>
                                )}
                            </>
                        )}

                        {mode === 'company' && (
                            <>
                                <button type="button" onClick={() => navigate('/dashboard')} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'var(--text-body-size)', fontWeight: 700, color: 'var(--text-primary)', maxWidth: '14rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {currentCompany?.name || 'Loading...'}
                                </button>
                                {sectionMeta && (
                                    <>
                                        <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: 0.7 }} />
                                        <span style={{ fontSize: 'var(--text-body-size)', fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sectionMeta.label}</span>
                                    </>
                                )}
                                {user?.is_super_admin && currentCompany?.subscription_status === 'active' && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginLeft: 'var(--space-8)', fontSize: 'var(--text-small-size)', fontWeight: 600, color: 'var(--state-success)', whiteSpace: 'nowrap' }}>
                                        <span className="relative flex h-2 w-2">
                                            <span className="absolute inline-flex h-full w-full rounded-full animate-ping opacity-75" style={{ background: 'var(--state-success)' }} />
                                            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: 'var(--state-success)' }} />
                                        </span>
                                        Activo
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Right */}
                <div className="flex items-center gap-2 sm:gap-3">

                    {/* Notifications */}
                    <div className="relative" ref={notificationsRef}>
                        <button type="button" onClick={() => { setNotificationsOpen(p => !p); setMenuOpen(false); setExpandedNoteId(null); }}
                            aria-label="Abrir notificaciones" aria-haspopup="menu" aria-expanded={notificationsOpen}
                            style={{ width: '2.75rem', height: '2.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-xl)', border: notificationsOpen ? 'var(--border-default)' : '1px solid transparent', background: notificationsOpen ? 'var(--surface-muted)' : 'transparent', boxShadow: notificationsOpen ? 'var(--shadow-sm)' : 'none', transition: 'all var(--transition-fast)', cursor: 'pointer' }}>
                            <Bell size={20} style={{ color: 'var(--text-secondary)' }} />
                            {unreadCount > 0 && (
                                <div className="absolute top-[8px] right-[8px] pointer-events-none">
                                    <span className="animate-ping" style={{ position: 'absolute', inset: 0, width: '0.625rem', height: '0.625rem', borderRadius: '999px', background: 'var(--state-danger)', opacity: 0.7 }} aria-hidden="true" />
                                    <span style={{ position: 'relative', display: 'block', width: '0.625rem', height: '0.625rem', borderRadius: '999px', background: 'var(--state-danger)', border: '2px solid var(--surface-card)', boxShadow: 'var(--shadow-sm)' }} aria-hidden="true" />
                                </div>
                            )}
                        </button>

                        {notificationsOpen && (
                            <div className="absolute right-0 mt-2 origin-top-right w-[calc(100vw-1rem)] sm:w-[380px] max-w-[calc(100vw-1rem)] z-50" style={dropdownStyle}>
                                {/* Header */}
                                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: 'var(--border-default)' }}>
                                    <div className="min-w-0">
                                        <h3 style={{ fontSize: 'var(--text-body-size)', fontWeight: 700, color: 'var(--text-primary)' }}>Notificaciones</h3>
                                        <p style={{ fontSize: 'var(--text-small-size)', color: 'var(--text-muted)', marginTop: 'var(--space-4)' }}>{unreadCount > 0 ? `${unreadCount} pendiente${unreadCount > 1 ? 's' : ''}` : 'Todo al día'}</p>
                                    </div>
                                    {unreadCount > 0 && (
                                        <button type="button" onClick={handleMarkAllAsRead} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)', fontSize: 'var(--text-small-size)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                            <CheckCheck size={12} /> marcar todas
                                        </button>
                                    )}
                                </div>

                                {/* List */}
                                <div className="max-h-[252px] overflow-y-auto overscroll-contain">
                                    {notifications.length > 0 ? (
                                        <div>
                                            {notifications.map((note, index) => {
                                                const isUnread = !note.read_at;
                                                const isExpanded = expandedNoteId === note.id;
                                                const isLong = note.message.length > 85;
                                                const visual = getNotificationVisual(note);
                                                return (
                                                    <div key={note.id} onClick={() => handleNotificationClick(note)}
                                                        style={{ cursor: 'pointer', transition: 'background var(--transition-fast)', background: isUnread ? 'var(--surface-page)' : 'var(--surface-card)', borderTop: index === 0 ? 'none' : 'var(--border-default)' }}>
                                                        <div className="flex gap-3 px-4 py-3">
                                                            <div style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-lg)', background: visual.background, border: 'var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                {visual.icon}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <p style={{ fontSize: 'var(--text-body-size)', lineHeight: 1.35, fontWeight: isUnread ? 700 : 500, color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{note.title}</p>
                                                                        <p style={{ fontSize: 'var(--text-small-size)', color: 'var(--text-muted)', marginTop: 'var(--space-4)' }}>{formatRelativeTime(note.created_at)}</p>
                                                                    </div>
                                                                    {isUnread && <span style={{ width: '0.625rem', height: '0.625rem', borderRadius: '999px', background: 'var(--state-primary)', flexShrink: 0, marginTop: '0.25rem' }} />}
                                                                </div>
                                                                <p className={isExpanded ? 'line-clamp-none' : 'line-clamp-2'} style={{ fontSize: 'var(--text-small-size)', lineHeight: 1.5, color: 'var(--text-secondary)', marginTop: 'var(--space-8)', paddingRight: 'var(--space-4)' }}>{note.message}</p>
                                                                {(isLong || note.action_url) && (
                                                                    <div className="flex items-center gap-3 mt-2">
                                                                        {isLong && !note.action_url && (
                                                                            <button type="button" onClick={e => { e.stopPropagation(); setExpandedNoteId(p => p === note.id ? null : note.id); }} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'var(--text-small-size)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                                                {isExpanded ? 'ver menos' : 'ver más'}
                                                                            </button>
                                                                        )}
                                                                        {note.action_url && (
                                                                            <button type="button" onClick={e => { e.stopPropagation(); navigate(note.action_url as string); setNotificationsOpen(false); setExpandedNoteId(null); }} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'var(--text-small-size)', fontWeight: 600, color: 'var(--text-secondary)' }}>
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
                                            <div className="mx-auto mb-3" style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Bell size={16} style={{ color: 'var(--text-muted)' }} />
                                            </div>
                                            <p style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--text-secondary)' }}>No tienes notificaciones</p>
                                            <p style={{ fontSize: 'var(--text-small-size)', color: 'var(--text-muted)', marginTop: 'var(--space-4)' }}>Cuando ocurra algo importante, aparecerá aquí.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="p-2" style={{ borderTop: 'var(--border-default)', background: 'var(--surface-page)' }}>
                                    <button type="button" onClick={() => { navigate('/notificaciones'); setNotificationsOpen(false); setExpandedNoteId(null); }}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)', minHeight: '2.5rem', borderRadius: 'var(--radius-md)', border: '1px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 'var(--text-small-size)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        Ver todas las notificaciones
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* User menu */}
                    <div className="relative" ref={menuRef}>
                        <button type="button" onClick={() => { setMenuOpen(p => !p); setNotificationsOpen(false); setExpandedNoteId(null); }}
                            aria-haspopup="menu" aria-expanded={menuOpen}
                            className="flex items-center gap-2 min-h-[44px]"
                            style={{ ...surfaceButtonStyle, padding: '0.375rem 0.75rem 0.375rem 0.375rem' }}>
                            <div style={{ width: '2rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--surface-primary-soft)', color: 'var(--state-primary)', fontSize: 'var(--text-small-size)', fontWeight: 700, flexShrink: 0 }} aria-label={`Perfil de ${userDisplayName}`}>
                                {userInitials}
                            </div>
                            <div className="hidden md:block text-left min-w-0">
                                <p style={{ fontSize: 'var(--text-body-size)', fontWeight: 700, color: 'var(--text-primary)', maxWidth: '9.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userDisplayName}</p>
                                <span style={subtleBadgeStyle}>{userRoleLabel}</span>
                            </div>
                            <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        </button>

                        {menuOpen && (
                            <div className="absolute right-0 mt-2 w-56 origin-top-right z-50" style={dropdownStyle}>
                                <div className="px-4 py-3" style={{ borderBottom: 'var(--border-default)' }}>
                                    <p style={{ fontSize: 'var(--text-body-size)', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</p>
                                </div>
                                <div className="py-1">
                                    {user?.is_super_admin && mode === 'company' && (
                                        <button type="button" onClick={() => { exitImpersonation(); navigate('/control-center'); setMenuOpen(false); }} style={dropdownBtnStyle}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-page)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                            <Layout size={16} style={{ color: 'var(--text-muted)' }} /> Back to Platform
                                        </button>
                                    )}
                                    <button type="button" style={dropdownBtnStyle} onClick={() => { navigate('/settings'); setMenuOpen(false); }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-page)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        <Settings size={16} style={{ color: 'var(--text-muted)' }} /> Settings
                                    </button>
                                </div>
                                <div className="py-1" style={{ borderTop: 'var(--border-default)' }}>
                                    <button type="button" onClick={handleLogout} style={dropdownBtnStyle}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-page)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        <LogOut size={16} style={{ color: 'var(--text-muted)' }} /> Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};
