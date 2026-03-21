import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { adminStatsService } from '@/services/adminStatsService';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, UserPlus, AlertCircle, CreditCard, Box, Zap, Megaphone } from 'lucide-react';

export function ActivityFeed() {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedEvents(prev => ({ ...prev, [id]: !prev[id] }));
    };

    useEffect(() => {
        loadEvents();

        const channel = supabase
            .channel('platform_activity_feed')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'audit_logs' },
                (payload) => {
                    const log = payload.new as any;
                    const eventKey = `${log.resource_type?.toUpperCase() || 'SYSTEM'}.${log.action?.toUpperCase() || 'EVENT'}`;
                    const formattedEvent = {
                        id: log.id,
                        created_at: log.created_at,
                        event_key: eventKey,
                        source_module: log.resource_type,
                        payload: { message: `Acción ${log.action} en ${log.resource_type}` },
                    };
                    setEvents(prev => [formattedEvent, ...prev].slice(0, 15));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const loadEvents = async () => {
        try {
            const data = await adminStatsService.getRecentActivity(15);
            setEvents(data);
        } catch (err) {
            console.error('Error loading activity feed:', err);
        } finally {
            setLoading(false);
        }
    };

    const navigate = useNavigate();

    const getEventIcon = (key: string) => {
        if (key.includes('INVENTORY')) return <Box size={14} style={{ color: '#f59e0b' }} />;
        if (key.includes('BILLING')) return <CreditCard size={14} style={{ color: '#ef4444' }} />;
        if (key.includes('TEAM')) return <UserPlus size={14} style={{ color: '#3b82f6' }} />;
        if (key.includes('SYSTEM')) return <Zap size={14} style={{ color: '#6366f1' }} />;
        if (key.includes('NOTICE')) return <Megaphone size={14} style={{ color: '#10b981' }} />;
        return <Activity size={14} style={{ color: '#64748b' }} />;
    };

    const handleEventClick = (event: any) => {
        if (event.event_key.includes('BILLING')) navigate('/platform/billing');
        else if (event.event_key.includes('TEAM')) navigate('/platform/users');
        else navigate('/platform/environments');
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)', padding: 'var(--space-8)' }}>
                {[1, 2, 3].map(i => (
                    <div key={i} style={{ display: 'flex', gap: 'var(--space-12)', alignItems: 'flex-start' }}>
                        <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--surface-muted)' }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', paddingTop: 'var(--space-4)' }}>
                            <div style={{ height: '0.5rem', background: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)', width: '75%' }} />
                            <div style={{ height: '0.5rem', background: 'var(--surface-page)', borderRadius: 'var(--radius-sm)', width: '50%' }} />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
            {events.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-48)', textAlign: 'center' }}>
                    <Activity size={32} style={{ color: 'var(--border-color-default)', marginBottom: 'var(--space-8)' }} />
                    <p style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        No hay actividad
                    </p>
                </div>
            ) : (
                events.map((event) => {
                    const isExpanded = !!expandedEvents[event.id];
                    const message = event.payload?.message || `Evento registrado en ${event.source_module}`;
                    const isLong = message.length > 80;

                    return (
                        <div
                            key={event.id}
                            onClick={() => handleEventClick(event)}
                            style={{ position: 'relative', display: 'flex', gap: 'var(--space-12)', paddingBottom: 'var(--space-20)', paddingLeft: 'var(--space-16)', borderLeft: '2px solid var(--surface-muted)', marginLeft: 'var(--space-8)', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.borderLeftColor = 'var(--border-color-primary)')}
                            onMouseLeave={e => (e.currentTarget.style.borderLeftColor = 'var(--surface-muted)')}
                        >
                            {/* Timeline dot */}
                            <div style={{ position: 'absolute', left: '-0.5625rem', top: 0, width: '1rem', height: '1rem', borderRadius: '50%', background: 'var(--surface-card)', border: '2px solid var(--border-color-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, boxShadow: 'var(--shadow-sm)' }}>
                                {getEventIcon(event.event_key)}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Event title */}
                                <p style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2 }}>
                                    {event.payload?.title || event.event_key.split('.').pop()?.replace(/_/g, ' ')}
                                </p>

                                {/* Timestamp */}
                                <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, marginTop: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: es })}
                                </p>

                                {/* Message */}
                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 'var(--space-4)', lineHeight: 1.5, overflow: isExpanded ? 'visible' : 'hidden', display: '-webkit-box', WebkitLineClamp: isExpanded ? 'unset' : 2, WebkitBoxOrient: 'vertical' as any }}>
                                    {message}
                                    {event.companies?.name && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)', background: 'var(--surface-page)', padding: '1px var(--space-6)', borderRadius: 'var(--radius-xs)', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginLeft: 'var(--space-6)', border: 'var(--border-default)', textTransform: 'uppercase' }}>
                                            {event.companies.name}
                                        </span>
                                    )}
                                </p>

                                {/* Expand toggle */}
                                {isLong && (
                                    <button
                                        onClick={(e) => toggleExpand(event.id, e)}
                                        style={{ fontSize: '10px', fontWeight: 900, color: 'var(--state-primary)', marginTop: 'var(--space-6)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                    >
                                        {isExpanded ? '... ver menos' : 'ver más...'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
            <button
                style={{ width: '100%', padding: 'var(--space-12)', fontSize: 'var(--text-caption-size)', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'transparent', border: '1px dashed var(--border-color-default)', borderRadius: 'var(--radius-xl)', cursor: 'pointer', transition: 'color var(--transition-fast), background var(--transition-fast)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--state-primary)'; e.currentTarget.style.background = 'var(--surface-page)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
            >
                Ver todos los logs
            </button>
        </div>
    );
}