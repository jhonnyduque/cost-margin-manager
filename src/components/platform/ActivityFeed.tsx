import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { adminStatsService } from '@/services/adminStatsService';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, UserPlus, AlertCircle, CreditCard, Box, Zap, Megaphone } from 'lucide-react';
import { typography } from '@/design/typography';

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
                    const formattedEvent = {
                        id: log.id,
                        created_at: log.created_at,
                        event_key: `${log.resource_type?.toUpperCase() || 'SYSTEM'}.${log.action?.toUpperCase() || 'EVENT'}`,
                        source_module: log.resource_type,
                        payload: { message: `Acción ${log.action} en ${log.resource_type}` },
                    };
                    setEvents(prev => [formattedEvent, ...prev].slice(0, 15));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
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
        if (key.includes('INVENTORY')) return <Box size={14} className="text-amber-500" />;
        if (key.includes('BILLING')) return <CreditCard size={14} className="text-red-500" />;
        if (key.includes('TEAM')) return <UserPlus size={14} className="text-blue-500" />;
        if (key.includes('SYSTEM')) return <Zap size={14} className="text-indigo-500" />;
        if (key.includes('NOTICE')) return <Megaphone size={14} className="text-emerald-500" />;
        return <Activity size={14} className="text-slate-500" />;
    };

    const handleEventClick = (event: any) => {
        if (event.event_key.includes('BILLING')) navigate('/platform/billing');
        else if (event.event_key.includes('TEAM')) navigate('/platform/users');
        else navigate('/platform/environments');
    };

    if (loading) {
        return (
            <div className="space-y-4 p-2">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-slate-100" />
                        <div className="flex-1 space-y-2 py-1">
                            <div className="h-2 bg-slate-100 rounded w-3/4" />
                            <div className="h-2 bg-slate-50 rounded w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Activity size={32} className="text-slate-100 mb-2" />
                    <p className={`${typography.uiLabel} font-semibold text-slate-500 uppercase tracking-widest`}>No hay actividad</p>
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
                            className="group relative flex gap-3 pb-5 border-l-2 border-slate-50 ml-2 pl-4 last:pb-0 last:border-l-0 cursor-pointer hover:border-indigo-200 transition-all"
                        >
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center group-hover:border-indigo-400 group-hover:scale-110 transition-all z-10 shadow-sm">
                                {getEventIcon(event.event_key)}
                            </div>
                            <div className="flex-1 min-w-0">
                                {/* Línea A: Título (Identificador del Evento o Título Personalizado) */}
                                <p className={`${typography.uiLabel} font-bold text-slate-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors block leading-tight`}>
                                    {event.payload?.title || event.event_key.split('.').pop()?.replace(/_/g, ' ')}
                                </p>

                                {/* Línea B: Tiempo (Notificación) */}
                                <p className={`${typography.text.tiny} text-slate-400 font-bold mt-0.5 uppercase tracking-widest`}>
                                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: es })}
                                </p>

                                {/* Línea C: Mensaje (Contenido) */}
                                <p className={`${typography.text.micro} text-slate-500 mt-1 ${isExpanded ? '' : 'line-clamp-2'} leading-relaxed`}>
                                    {message}
                                    {event.companies?.name && (
                                        <span className={`inline-flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded ${typography.text.tiny} font-bold text-slate-400 ml-1.5 border border-slate-100 uppercase`}>
                                            {event.companies.name}
                                        </span>
                                    )}
                                </p>

                                {/* Línea D: Ver más (Expandir) */}
                                {isLong && (
                                    <button
                                        onClick={(e) => toggleExpand(event.id, e)}
                                        className={`${typography.text.tiny} font-black text-indigo-500 mt-2 uppercase tracking-tighter hover:text-indigo-700 transition-colors`}
                                    >
                                        {isExpanded ? '... ver menos' : 'ver más...'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
            <button className={`w-full py-3 mt-4 ${typography.uiLabel} font-black text-slate-500 uppercase tracking-widest hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all border border-dashed border-slate-200`}>
                Ver todos los logs
            </button>
        </div>
    );
}
