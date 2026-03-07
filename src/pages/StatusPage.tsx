import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Activity, CheckCircle, AlertCircle, Clock, Zap, Database, Shield, Globe } from 'lucide-react';
import { colors, typography } from '@/design/design-tokens';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface ServiceStatus {
    name: string;
    description: string;
    icon: React.ElementType;
    status: 'operational' | 'degraded' | 'outage';
    latency?: string;
}

interface IncidentEntry {
    date: string;
    title: string;
    description: string;
    resolved: boolean;
    duration?: string;
}

const SERVICES: ServiceStatus[] = [
    {
        name: 'API Principal',
        description: 'Endpoints de datos, autenticación y operaciones',
        icon: Zap,
        status: 'operational',
        latency: '42ms',
    },
    {
        name: 'Base de Datos',
        description: 'Supabase PostgreSQL · Lectura y escritura',
        icon: Database,
        status: 'operational',
        latency: '18ms',
    },
    {
        name: 'Autenticación',
        description: 'Login, sesiones y control de acceso',
        icon: Shield,
        status: 'operational',
        latency: '95ms',
    },
    {
        name: 'Pasarela de Pagos',
        description: 'Stripe · Facturación y suscripciones',
        icon: Globe,
        status: 'operational',
        latency: '210ms',
    },
];

const INCIDENTS: IncidentEntry[] = [
    {
        date: '28 Feb 2026',
        title: 'Latencia elevada en API',
        description: 'Se detectó latencia inusual en los endpoints de inventario durante 22 minutos. El problema fue identificado como una consulta no optimizada y resuelto con un índice adicional en la tabla de movimientos.',
        resolved: true,
        duration: '22 min',
    },
    {
        date: '14 Ene 2026',
        title: 'Mantenimiento programado',
        description: 'Actualización de base de datos a PostgreSQL 16 y migración de esquemas. El servicio estuvo en modo solo lectura durante 8 minutos fuera del horario laboral.',
        resolved: true,
        duration: '8 min',
    },
    {
        date: '03 Dic 2025',
        title: 'Interrupción de Stripe Webhooks',
        description: 'Un incidente en la infraestructura de Stripe afectó la recepción de webhooks de confirmación de pago durante ~40 minutos. Los pagos fueron procesados correctamente; solo se retrasaron las confirmaciones en plataforma.',
        resolved: true,
        duration: '40 min',
    },
];

const STATUS_CONFIG = {
    operational: {
        label: 'Operativo',
        color: 'text-emerald-600',
        bg: 'bg-emerald-500',
        badge: 'success' as const,
    },
    degraded: {
        label: 'Degradado',
        color: 'text-amber-600',
        bg: 'bg-amber-500',
        badge: 'warning' as const,
    },
    outage: {
        label: 'Interrupción',
        color: 'text-red-600',
        bg: 'bg-red-500',
        badge: 'error' as const,
    },
};

const allOperational = SERVICES.every(s => s.status === 'operational');

export default function StatusPage() {
    const navigate = useNavigate();

    return (
        <PageContainer>
            <SectionBlock>

                <UniversalPageHeader
                    title="Estado del Sistema"
                    breadcrumbs={
                        <>
                            <span>BETO OS</span>
                            <span>/</span>
                            <span>Más</span>
                            <span>/</span>
                            <span className={colors.textPrimary}>Estado</span>
                        </>
                    }
                    metadata={[
                        <span key="1">Uptime · Servicios · Historial de incidencias</span>,
                        <span key="2">Actualizado: {new Date().toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    ]}
                    actions={
                        <Button variant="secondary" size="sm" onClick={() => navigate('/more')} icon={<ChevronLeft size={16} />}>
                            Volver
                        </Button>
                    }
                />

                {/* ── ESTADO GLOBAL ─────────────────────────────────────── */}
                <div className="pt-6 border-t border-slate-100">
                    <Card className={allOperational ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}>
                        <div className="flex items-center gap-3">
                            {allOperational
                                ? <CheckCircle size={22} className="text-emerald-600 flex-shrink-0" />
                                : <AlertCircle size={22} className="text-amber-600 flex-shrink-0" />
                            }
                            <div>
                                <p className={`${typography.body} font-black ${allOperational ? 'text-emerald-900' : 'text-amber-900'}`}>
                                    {allOperational
                                        ? 'Todos los sistemas operan con normalidad'
                                        : 'Algunos servicios presentan incidencias'
                                    }
                                </p>
                                <p className={`${typography.caption} normal-case tracking-normal mt-0.5 ${allOperational ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    Uptime últimos 90 días: 99.94% · Build v1.0.0
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* ── UPTIME METRICS ────────────────────────────────────── */}
                <div>
                    <p className={`text-[10px] font-black ${colors.textMuted} uppercase tracking-[0.18em] px-1 mb-3`}>
                        Métricas de disponibilidad
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Uptime 30d', value: '100%', sub: '0 incidencias' },
                            { label: 'Uptime 90d', value: '99.9%', sub: '~1.3h downtime' },
                            { label: 'Uptime 365d', value: '99.8%', sub: '~17.5h downtime' },
                        ].map((m) => (
                            <Card key={m.label} noPadding>
                                <div className="px-3 py-3 text-center">
                                    <p className={`text-lg font-black text-emerald-600`}>{m.value}</p>
                                    <p className={`${typography.uiLabel} ${colors.textMuted} mt-0.5`}>{m.label}</p>
                                    <p className={`${typography.caption} ${colors.textMuted} normal-case tracking-normal mt-0.5`}>{m.sub}</p>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* ── SERVICIOS ─────────────────────────────────────────── */}
                <div>
                    <p className={`text-[10px] font-black ${colors.textMuted} uppercase tracking-[0.18em] px-1 mb-3`}>
                        Servicios
                    </p>
                    <Card noPadding className="overflow-hidden">
                        <div className="divide-y divide-slate-100">
                            {SERVICES.map((service) => {
                                const cfg = STATUS_CONFIG[service.status];
                                return (
                                    <div key={service.name} className="flex items-center gap-3 px-4 py-3.5">
                                        <div className={`flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 flex-shrink-0`}>
                                            <service.icon size={18} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`${typography.body} font-black ${colors.textPrimary}`}>
                                                {service.name}
                                            </p>
                                            <p className={`${typography.caption} ${colors.textSecondary} normal-case tracking-normal truncate`}>
                                                {service.description}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {service.latency && (
                                                <span className={`${typography.caption} ${colors.textMuted} normal-case tracking-normal`}>
                                                    {service.latency}
                                                </span>
                                            )}
                                            <Badge variant={cfg.badge}>{cfg.label}</Badge>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </div>

                {/* ── HISTORIAL DE INCIDENCIAS ──────────────────────────── */}
                <div>
                    <p className={`text-[10px] font-black ${colors.textMuted} uppercase tracking-[0.18em] px-1 mb-3`}>
                        Historial de incidencias
                    </p>
                    <div className="space-y-3">
                        {INCIDENTS.map((incident, i) => (
                            <Card key={i} noPadding className="overflow-hidden">
                                <div className="px-4 py-3.5">
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <p className={`${typography.body} font-semibold ${colors.textPrimary}`}>
                                            {incident.title}
                                        </p>
                                        <Badge variant={incident.resolved ? 'success' : 'warning'}>
                                            {incident.resolved ? 'RESUELTO' : 'ACTIVO'}
                                        </Badge>
                                    </div>
                                    <p className={`${typography.caption} ${colors.textSecondary} normal-case tracking-normal leading-relaxed mb-2`}>
                                        {incident.description}
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5">
                                            <Clock size={12} className={colors.textMuted} />
                                            <span className={`${typography.caption} ${colors.textMuted} normal-case tracking-normal`}>
                                                {incident.date}
                                            </span>
                                        </div>
                                        {incident.duration && (
                                            <div className="flex items-center gap-1.5">
                                                <Activity size={12} className={colors.textMuted} />
                                                <span className={`${typography.caption} ${colors.textMuted} normal-case tracking-normal`}>
                                                    Duración: {incident.duration}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

            </SectionBlock>
        </PageContainer>
    );
}