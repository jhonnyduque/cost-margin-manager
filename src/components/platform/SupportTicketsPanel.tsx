import React, { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { MessageSquare, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface SupportTicket {
    id: string;
    user_name: string;
    user_email: string;
    subject: string;
    message: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority: string;
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string | null;
    resolved_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    open: { label: 'Abierto', color: 'var(--state-warning)', bg: 'var(--surface-warning-soft)', icon: <AlertCircle size={12} /> },
    in_progress: { label: 'En Progreso', color: 'var(--state-primary)', bg: 'var(--surface-primary-soft)', icon: <Clock size={12} /> },
    resolved: { label: 'Resuelto', color: 'var(--state-success)', bg: 'var(--surface-success-soft)', icon: <CheckCircle size={12} /> },
    closed: { label: 'Cerrado', color: 'var(--text-muted)', bg: 'var(--surface-muted)', icon: <CheckCircle size={12} /> },
};

const card: React.CSSProperties = {
    borderRadius: 'var(--radius-2xl)', border: 'var(--border-default)',
    background: 'var(--surface-card)', padding: 'var(--space-24)', boxShadow: 'var(--shadow-sm)',
};

const label: React.CSSProperties = {
    fontSize: 'var(--text-caption-size)', fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text-muted)',
};

export function SupportTicketsPanel() {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('support_tickets')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);
            if (data) setTickets(data);
        } catch (err) {
            console.error('Error fetching support tickets:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (ticketId: string, newStatus: string) => {
        try {
            const updates: any = {
                status: newStatus,
                updated_at: new Date().toISOString(),
            };
            if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();

            await supabase.from('support_tickets').update(updates).eq('id', ticketId);
            setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ...updates } : t));
        } catch (err) {
            console.error('Error updating ticket:', err);
        }
    };

    useEffect(() => { fetchTickets(); }, []);

    const openCount = tickets.filter(t => t.status === 'open').length;
    const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;

    return (
        <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', marginBottom: 'var(--space-24)' }}>
                <div style={{ borderRadius: 'var(--radius-lg)', background: 'var(--surface-warning-soft)', padding: 'var(--space-10)', color: 'var(--state-warning)' }}>
                    <MessageSquare size={20} />
                </div>
                <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: 'var(--text-body-size)', fontWeight: 700, color: 'var(--text-primary)' }}>Tickets de Soporte</h2>
                    <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>
                        {openCount > 0 ? `${openCount} abierto${openCount > 1 ? 's' : ''}` : 'Sin tickets abiertos'}
                        {inProgressCount > 0 && ` · ${inProgressCount} en progreso`}
                    </p>
                </div>
                <button onClick={fetchTickets} style={{ padding: 'var(--space-8) var(--space-12)', borderRadius: 'var(--radius-lg)', border: 'var(--border-default)', background: 'var(--surface-card)', fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Actualizar
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-32)', color: 'var(--text-muted)' }}>
                    <Loader2 size={20} className="animate-spin" />
                </div>
            ) : tickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-24)', color: 'var(--text-muted)' }}>
                    <MessageSquare size={24} style={{ opacity: 0.3, margin: '0 auto var(--space-8)' }} />
                    <p style={{ fontSize: 'var(--text-small-size)', fontWeight: 600 }}>No hay tickets de soporte</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
                    {tickets.map(ticket => {
                        const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                        const isExpanded = expandedId === ticket.id;

                        return (
                            <div key={ticket.id}
                                style={{ borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', background: 'var(--surface-page)', overflow: 'hidden', transition: 'box-shadow var(--transition-fast)' }}>
                                {/* Header row */}
                                <button onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-12)', padding: 'var(--space-12) var(--space-16)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>
                                            <span style={{ fontWeight: 700, fontSize: 'var(--text-small-size)', color: 'var(--text-primary)' }}>{ticket.user_name}</span>
                                            <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>
                                                {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: es })}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap' }}>
                                            {ticket.message}
                                        </p>
                                    </div>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4) var(--space-8)', borderRadius: 'var(--radius-md)', fontSize: '10px', fontWeight: 700, color: statusCfg.color, background: statusCfg.bg, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                        {statusCfg.icon} {statusCfg.label}
                                    </span>
                                </button>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div style={{ padding: '0 var(--space-16) var(--space-16)', borderTop: 'var(--border-default)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-8)', marginTop: 'var(--space-12)', marginBottom: 'var(--space-12)' }}>
                                            <div><span style={label}>Email</span><p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-primary)', marginTop: 'var(--space-4)' }}>{ticket.user_email}</p></div>
                                            <div><span style={label}>Empresa</span><p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-primary)', marginTop: 'var(--space-4)' }}>{ticket.metadata?.company_name || 'N/A'}</p></div>
                                            <div><span style={label}>Plan</span><p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-primary)', marginTop: 'var(--space-4)' }}>{ticket.metadata?.plan || 'N/A'}</p></div>
                                            <div><span style={label}>Página</span><p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-primary)', marginTop: 'var(--space-4)' }}>{ticket.metadata?.page || 'N/A'}</p></div>
                                        </div>

                                        <p style={{ fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-12)' }}>
                                            {ticket.message}
                                        </p>

                                        {/* Status actions */}
                                        <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
                                            {ticket.status === 'open' && (
                                                <button onClick={() => updateStatus(ticket.id, 'in_progress')}
                                                    style={{ padding: 'var(--space-6) var(--space-12)', borderRadius: 'var(--radius-md)', border: 'var(--border-default)', background: 'var(--surface-card)', fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--state-primary)', cursor: 'pointer' }}>
                                                    Marcar En Progreso
                                                </button>
                                            )}
                                            {(ticket.status === 'open' || ticket.status === 'in_progress') && (
                                                <button onClick={() => updateStatus(ticket.id, 'resolved')}
                                                    style={{ padding: 'var(--space-6) var(--space-12)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--state-success)', fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--text-inverse)', cursor: 'pointer' }}>
                                                    Resolver
                                                </button>
                                            )}
                                            {ticket.status === 'resolved' && (
                                                <button onClick={() => updateStatus(ticket.id, 'closed')}
                                                    style={{ padding: 'var(--space-6) var(--space-12)', borderRadius: 'var(--radius-md)', border: 'var(--border-default)', background: 'var(--surface-muted)', fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                                    Cerrar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
