import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Bell, CheckCheck, Info, AlertTriangle, AlertOctagon, Settings as SettingsIcon, Smartphone, Mail, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { notificationService } from '@/services/notificationService';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { isToday, isYesterday, format, subDays, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';

interface NotificationItem {
    id: string; title: string; message: string; created_at: string;
    read_at?: string | null; action_url?: string | null;
    type?: string | null; priority?: string | null;
}

interface Preference {
    event_key: string;
    in_app_enabled: boolean;
    email_enabled: boolean;
}

type RangeFilter = '30' | '90' | 'ytd' | '12m' | 'all';

const RANGE_OPTIONS: { value: RangeFilter; label: string }[] = [
    { value: '30', label: 'Últimos 30 días' },
    { value: '90', label: 'Últimos 90 días' },
    { value: 'ytd', label: 'Año a la fecha' },
    { value: '12m', label: 'Últimos 12 meses' },
    { value: 'all', label: 'Todo' },
];

const parseDateSafe = (value?: string) => {
    const d = new Date(value || '');
    return isNaN(d.getTime()) ? null : d;
};

const getNotificationVisual = (note: NotificationItem) => {
    const text = `${note.title || ''} ${note.message || ''}`.toLowerCase();
    const type = (note.type || '').toLowerCase();
    const priority = (note.priority || '').toLowerCase();

    if (priority === 'critical' || type.includes('critical') || text.includes('crítico') || text.includes('urgent'))
        return { color: 'var(--state-danger)', background: 'var(--surface-danger-soft)', icon: <AlertOctagon size={16} style={{ color: 'var(--state-danger)' }} /> };
    if (priority === 'warning' || type.includes('warning') || text.includes('alerta') || text.includes('warning'))
        return { color: 'var(--state-warning)', background: 'var(--surface-warning-soft)', icon: <AlertTriangle size={16} style={{ color: 'var(--state-warning)' }} /> };
    if (type.includes('success') || text.includes('completado') || text.includes('aprobado') || text.includes('éxito'))
        return { color: 'var(--state-success)', background: 'var(--surface-success-soft)', icon: <CheckCheck size={16} style={{ color: 'var(--state-success)' }} /> };
    return { color: 'var(--state-info)', background: 'var(--surface-info-soft)', icon: <Info size={16} style={{ color: 'var(--state-info)' }} /> };
};

export default function NotificationsPage() {
    const { user, currentCompany } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
    const [showSettings, setShowSettings] = useState(false);
    const [preferences, setPreferences] = useState<Preference[]>([]);
    const [savingPrefs, setSavingPrefs] = useState(false);
    const [channelAvailability, setChannelAvailability] = useState<any>(null);
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const [rangeFilter, setRangeFilter] = useState<RangeFilter>('30');
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        if (!user) return;
        loadNotifications();
        loadPreferences();
        notificationService.getChannelAvailability().then(setChannelAvailability);

        const sub = notificationService.subscribeToNotifications(user.id, currentCompany?.id, (newNote) => {
            setNotifications(prev => prev.some(n => n.id === newNote.id) ? prev : [newNote, ...prev]);
        });
        return () => sub.unsubscribe();
    }, [user, currentCompany?.id]);

    const loadNotifications = async () => {
        try {
            setLoading(true);
            const data = await notificationService.getNotifications({ limit: 100, companyId: currentCompany?.id });
            setNotifications(data as NotificationItem[]);
        } catch (err) {
            console.error('Error loading notifications:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadPreferences = async () => {
        try {
            const data = await notificationService.getUserPreferences();
            setPreferences(data as Preference[]);
        } catch (err) {
            console.error('Error loading preferences:', err);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead(currentCompany?.id);
            setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
        } catch (err) { console.error('Error marking all as read:', err); }
    };

    const handleRecordClick = async (note: NotificationItem) => {
        if (!note.read_at) {
            try {
                await notificationService.markAsRead(note.id);
                setNotifications(prev => prev.map(n => n.id === note.id ? { ...n, read_at: new Date().toISOString() } : n));
            } catch (err) { console.error('Error marking notification as read:', err); }
        }
        if (note.action_url) navigate(note.action_url);
    };

    const togglePreference = async (key: string, field: 'in_app_enabled' | 'email_enabled') => {
        setSavingPrefs(true);
        try {
            const current = preferences.find(p => p.event_key === key) || { event_key: key, in_app_enabled: true, email_enabled: false };
            const nextVal = !current[field];
            const updated = { ...current, [field]: nextVal };

            await notificationService.updateUserPreferences(key, updated.in_app_enabled, updated.email_enabled);
            setPreferences(prev => {
                const existing = prev.find(p => p.event_key === key);
                if (existing) return prev.map(p => p.event_key === key ? updated : p);
                return [...prev, updated];
            });
            toast.success('Preferencia actualizada exitosamente');
        } catch (err) {
            console.error('Error updating preference:', err);
            toast.error('Error al sincronizar preferencias');
        } finally {
            setSavingPrefs(false);
        }
    };

    const filtered = useMemo(() => {
        const base = activeTab === 'all' ? notifications : notifications.filter(n => !n.read_at);

        const now = new Date();
        let threshold: Date | null = null;
        if (rangeFilter === '30') threshold = subDays(now, 30);
        else if (rangeFilter === '90') threshold = subDays(now, 90);
        else if (rangeFilter === '12m') threshold = subDays(now, 365);
        else if (rangeFilter === 'ytd') threshold = startOfYear(now);

        if (!threshold) return base;

        return base.filter(n => {
            const d = parseDateSafe(n.created_at);
            if (!d) return true; // conservar registros con fecha inválida
            return d >= threshold;
        });
    }, [notifications, activeTab, rangeFilter]);

    const grouped = useMemo(() => {
        const sorted = [...filtered].sort((a, b) => {
            const dA = parseDateSafe(a.created_at);
            const dB = parseDateSafe(b.created_at);
            const tA = dA ? dA.getTime() : -Infinity;
            const tB = dB ? dB.getTime() : -Infinity;
            return tB - tA;
        });
        const map: Record<string, NotificationItem[]> = {};
        sorted.forEach(note => {
            const date = parseDateSafe(note.created_at);
            let label: string;
            if (!date) {
                label = 'Sin fecha';
            } else if (isToday(date)) label = 'Hoy';
            else if (isYesterday(date)) label = 'Ayer';
            else label = format(date, "dd MMM yyyy", { locale: es });
            if (!map[label]) map[label] = [];
            map[label].push(note);
        });
        return Object.entries(map);
    }, [filtered]);

    const categories = notificationService.getNotificationCategories();
    // Deep link highlight
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const targetId = params.get('id');
        if (!targetId) return;
        const el = itemRefs.current[targetId];
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightId(targetId);
            const timer = setTimeout(() => setHighlightId(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [location.search, notifications]);

    return (
        <div style={{ maxWidth: '48rem', margin: '0 auto', padding: 'var(--space-32) var(--space-20)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-32)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--text-h2-size)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Notificaciones</h1>
                    <p style={{ fontSize: 'var(--text-body-size)', color: 'var(--text-secondary)', marginTop: 'var(--space-4)' }}>Mantente al día con las alertas y mensajes del sistema.</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-12)' }}>
                    <button onClick={() => setShowSettings(true)} style={{ width: '3rem', height: '3rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface-page)', border: 'var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <SettingsIcon size={20} />
                    </button>
                    <div style={{ width: '3rem', height: '3rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--state-primary)' }}>
                        <Bell size={24} />
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-24)', borderBottom: 'var(--border-default)', paddingBottom: 'var(--space-12)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-24)' }}>
                    <button onClick={() => setActiveTab('all')} style={{ background: 'transparent', border: 'none', padding: 0, fontWeight: activeTab === 'all' ? 700 : 500, color: activeTab === 'all' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 'var(--text-small-size)', cursor: 'pointer', position: 'relative' }}>
                        Todas
                        {activeTab === 'all' && <div style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '2px', background: 'var(--text-primary)', borderRadius: '2px' }} />}
                    </button>
                    <button onClick={() => setActiveTab('unread')} style={{ background: 'transparent', border: 'none', padding: 0, fontWeight: activeTab === 'unread' ? 700 : 500, color: activeTab === 'unread' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 'var(--text-small-size)', cursor: 'pointer', position: 'relative' }}>
                        No leídas
                        {activeTab === 'unread' && <div style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '2px', background: 'var(--text-primary)', borderRadius: '2px' }} />}
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                    <select
                        value={rangeFilter}
                        onChange={e => setRangeFilter(e.target.value as RangeFilter)}
                        aria-label="Filtrar rango de fechas"
                        style={{
                            appearance: 'none',
                            padding: '0.45rem 2.25rem 0.45rem 0.75rem',
                            borderRadius: 'var(--radius-lg)',
                            border: 'var(--border-default)',
                            background: 'var(--surface-page)',
                            color: 'var(--text-secondary)',
                            fontSize: 'var(--text-small-size)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            position: 'relative'
                        }}
                    >
                        {RANGE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    {filtered.some(n => !n.read_at) && (
                        <button onClick={handleMarkAllAsRead} style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-8)', fontSize: 'var(--text-small-size)', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <CheckCheck size={16} /> Marcar todas
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-48)' }}><p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Cargando notificaciones...</p></div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-48)', background: 'var(--surface-page)', borderRadius: 'var(--radius-2xl)', border: 'var(--border-default)' }}>
                    <div style={{ margin: '0 auto var(--space-16)', width: '3rem', height: '3rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bell size={24} style={{ color: 'var(--text-muted)' }} /></div>
                    <p style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {activeTab === 'unread' ? 'No tienes notificaciones sin leer' : 'Aún no tienes notificaciones'}
                    </p>
                    <p style={{ fontSize: 'var(--text-small-size)', color: 'var(--text-muted)' }}>
                        {activeTab === 'unread'
                            ? 'Estás al día con todos tus avisos.'
                            : 'Cuando haya actividad relevante en tu cuenta, aparecerá aquí.'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-32)' }}>
                    {grouped.map(([groupName, notes]) => {
                        if (notes.length === 0) return null;
                        return (
                            <div key={groupName}>
                                <h3 style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--space-16)' }}>{groupName}</h3>
                                <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-2xl)', border: 'var(--border-default)', overflow: 'hidden' }}>
                                    {notes.map((note, index) => {
                                        const isUnread = !note.read_at;
                                        const visual = getNotificationVisual(note);
                                        return (
                                            <div
                                                key={note.id}
                                                ref={el => { itemRefs.current[note.id] = el; }}
                                                onClick={() => handleRecordClick(note)}
                                                style={{
                                                    display: 'flex',
                                                    gap: 'var(--space-16)',
                                                    padding: 'var(--space-20)',
                                                    borderTop: index > 0 ? 'var(--border-default)' : 'none',
                                                    background: highlightId === note.id ? 'var(--surface-primary-soft)' : (isUnread ? 'var(--surface-page)' : 'transparent'),
                                                    cursor: 'pointer',
                                                    transition: 'background var(--transition-fast)'
                                                }}
                                                onMouseEnter={e => { if (!isUnread && highlightId !== note.id) e.currentTarget.style.background = 'var(--surface-page)'; }}
                                                onMouseLeave={e => { if (!isUnread && highlightId !== note.id) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-xl)', background: visual.background, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                                                    {visual.icon}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-16)' }}>
                                                        <h4 style={{ fontSize: 'var(--text-small-size)', fontWeight: isUnread ? 700 : 600, color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{note.title}</h4>
                                                    <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                        {(() => {
                                                            const d = new Date(note.created_at || '');
                                                            return isNaN(d.getTime()) ? '--:--' : format(d, 'HH:mm');
                                                        })()}
                                                    </span>
                                                    </div>
                                                    <p style={{ fontSize: 'var(--text-small-size)', lineHeight: 1.5, color: 'var(--text-secondary)', marginTop: 'var(--space-4)' }}>{note.message}</p>
                                                    {note.action_url && (
                                                        <span style={{ display: 'inline-block', marginTop: 'var(--space-12)', fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--state-primary)' }}>Ver detalles &rarr;</span>
                                                    )}
                                                </div>
                                                {isUnread && <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '999px', background: 'var(--state-primary)', alignSelf: 'center', flexShrink: 0 }} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showSettings && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-20)' }}>
                    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-3xl)', width: '100%', maxWidth: '34rem', maxHeight: 'max-content', boxShadow: 'var(--shadow-2xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-24)', borderBottom: 'var(--border-default)', background: 'var(--surface-page)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                                <div style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--state-primary)' }}><SettingsIcon size={16} /></div>
                                <h2 style={{ fontSize: 'var(--text-h4-size)', fontWeight: 700, color: 'var(--text-primary)' }}>Preferencias</h2>
                            </div>
                            <button onClick={() => setShowSettings(false)} style={{ padding: 'var(--space-8) var(--space-20)', borderRadius: 'var(--radius-lg)', background: 'var(--text-primary)', color: 'white', border: 'none', fontWeight: 600, fontSize: 'var(--text-small-size)', cursor: 'pointer' }}>Listo</button>
                        </div>
                        <div style={{ padding: 'var(--space-20) var(--space-24) var(--space-24)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-20)', padding: '0 var(--space-12) var(--space-8)', marginBottom: 'var(--space-4)' }}>
                                <div title="In-app" style={{ width: '2.5rem', display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><Smartphone size={16} /></div>
                                <div title="Email" style={{ width: '2.5rem', display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><Mail size={16} /></div>
                                <div title="WhatsApp" style={{ width: '2.5rem', display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><MessageSquare size={16} /></div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-2xl)', overflow: 'hidden', background: 'var(--surface-page)' }}>
                                {categories.map((cat, index) => {
                                    const pref = preferences.find(p => p.event_key === cat.key) || { in_app_enabled: true, email_enabled: false };
                                    const isCritical = cat.isCritical;
                                    
                                    return (
                                        <div key={cat.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-12) var(--space-20)', borderTop: index === 0 ? 'none' : 'var(--border-default)', background: isCritical ? 'var(--surface-primary-soft)' : 'transparent', transition: 'all 0.2s' }}>
                                            <div style={{ flex: 1, paddingRight: 'var(--space-24)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                                                    <p style={{ fontSize: 'var(--text-small-size)', fontWeight: 700, color: 'var(--text-primary)' }}>{cat.label}</p>
                                                    {isCritical && <div style={{ background: 'var(--state-primary)', color: 'white', fontSize: '9px', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>SISTEMA</div>}
                                                </div>
                                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{cat.description}</p>
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--space-20)' }} title={isCritical ? "Notificaciones críticas del sistema (no pueden desactivarse para garantizar la operatividad)." : ""}>
                                                <div onClick={() => !isCritical && togglePreference(cat.key, 'in_app_enabled')} style={{ width: '2.5rem', height: '1.2rem', borderRadius: '999px', background: (pref.in_app_enabled || isCritical) ? 'var(--state-primary)' : '#94A3B8', position: 'relative', cursor: isCritical ? 'not-allowed' : 'pointer', transition: 'background 0.2s', border: '1px solid rgba(0,0,0,0.1)', opacity: isCritical ? 0.8 : 1 }}>
                                                    <div style={{ position: 'absolute', top: '2px', left: (pref.in_app_enabled || isCritical) ? '22px' : '2px', width: '14px', height: '14px', borderRadius: '50%', background: 'white', transition: 'left 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                                </div>
                                                <div 
                                                    onClick={() => !isCritical && channelAvailability?.email?.available && togglePreference(cat.key, 'email_enabled')} 
                                                    style={{ 
                                                        width: '2.5rem', 
                                                        height: '1.2rem', 
                                                        borderRadius: '999px', 
                                                        background: (pref.email_enabled || isCritical) ? 'var(--state-primary)' : '#94A3B8', 
                                                        position: 'relative', 
                                                        cursor: (isCritical || !channelAvailability?.email?.available) ? 'not-allowed' : 'pointer', 
                                                        transition: 'background 0.2s', 
                                                        border: '1px solid rgba(0,0,0,0.1)', 
                                                        opacity: (isCritical || !channelAvailability?.email?.available) ? 0.6 : 1 
                                                    }}
                                                    title={!channelAvailability?.email?.available ? channelAvailability?.email?.message : ''}
                                                >
                                                    <div style={{ position: 'absolute', top: '2px', left: (pref.email_enabled || isCritical) ? '22px' : '2px', width: '14px', height: '14px', borderRadius: '50%', background: 'white', transition: 'left 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                                </div>
                                                <div style={{ width: '2.5rem', height: '1.2rem', borderRadius: '999px', background: 'var(--surface-muted-strong, #CBD5E1)', position: 'relative', cursor: 'not-allowed', opacity: 0.6, border: '1px solid var(--border-default)' }} title={channelAvailability?.whatsapp?.message}>
                                                    <div style={{ position: 'absolute', top: '2px', left: '2px', width: '14px', height: '14px', borderRadius: '50%', background: '#F1F5F9' }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
