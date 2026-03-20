import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Activity, CheckCircle, AlertCircle, Clock, Zap, Database, Shield, Globe } from 'lucide-react';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface ServiceStatus { name: string; description: string; icon: React.ElementType; status: 'operational' | 'degraded' | 'outage'; latency?: string; }
interface IncidentEntry { date: string; title: string; description: string; resolved: boolean; duration?: string; }

const SERVICES: ServiceStatus[] = [
    { name: 'API Principal', description: 'Endpoints de datos, autenticación y operaciones', icon: Zap, status: 'operational', latency: '42ms' },
    { name: 'Base de Datos', description: 'Supabase PostgreSQL · Lectura y escritura', icon: Database, status: 'operational', latency: '18ms' },
    { name: 'Autenticación', description: 'Login, sesiones y control de acceso', icon: Shield, status: 'operational', latency: '95ms' },
    { name: 'Pasarela de Pagos', description: 'Stripe · Facturación y suscripciones', icon: Globe, status: 'operational', latency: '210ms' },
];

const INCIDENTS: IncidentEntry[] = [
    { date: '28 Feb 2026', title: 'Latencia elevada en API', description: 'Se detectó latencia inusual en los endpoints de inventario durante 22 minutos. El problema fue identificado como una consulta no optimizada y resuelto con un índice adicional en la tabla de movimientos.', resolved: true, duration: '22 min' },
    { date: '14 Ene 2026', title: 'Mantenimiento programado', description: 'Actualización de base de datos a PostgreSQL 16 y migración de esquemas. El servicio estuvo en modo solo lectura durante 8 minutos fuera del horario laboral.', resolved: true, duration: '8 min' },
    { date: '03 Dic 2025', title: 'Interrupción de Stripe Webhooks', description: 'Un incidente en la infraestructura de Stripe afectó la recepción de webhooks de confirmación de pago durante ~40 minutos. Los pagos fueron procesados correctamente; solo se retrasaron las confirmaciones en plataforma.', resolved: true, duration: '40 min' },
];

const STATUS_CONFIG = {
    operational: { label: 'Operativo', color: 'var(--state-success)', badge: 'success' as const },
    degraded: { label: 'Degradado', color: 'var(--state-warning)', badge: 'warning' as const },
    outage: { label: 'Interrupción', color: 'var(--state-danger)', badge: 'danger' as const },
};

const allOperational = SERVICES.every(s => s.status === 'operational');

export default function StatusPage() {
    const navigate = useNavigate();

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Estado del Sistema"
                    breadcrumbs={<><span>BETO OS</span><span>/</span><span>Más</span><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Estado</span></>}
                    metadata={[
                        <span key="1">Uptime · Servicios · Historial de incidencias</span>,
                        <span key="2">Actualizado: {new Date().toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</span>,
                    ]}
                    actions={<Button variant="secondary" size="sm" onClick={() => navigate('/mas')} icon={<ChevronLeft size={16} />}>Volver</Button>}
                />

                {/* Estado global */}
                <div style={{ paddingTop: 'var(--space-24)', borderTop: 'var(--border-default)' }}>
                    <Card style={{ background: allOperational ? 'var(--surface-success-soft)' : 'var(--surface-warning-soft)', borderColor: allOperational ? 'var(--border-color-success)' : 'var(--border-color-warning)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                            {allOperational
                                ? <CheckCircle size={22} style={{ color: 'var(--state-success)', flexShrink: 0 }} />
                                : <AlertCircle size={22} style={{ color: 'var(--state-warning)', flexShrink: 0 }} />}
                            <div>
                                <p style={{ fontSize: 'var(--text-body-size)', fontWeight: 900, color: allOperational ? 'var(--state-success)' : 'var(--state-warning)' }}>
                                    {allOperational ? 'Todos los sistemas operan con normalidad' : 'Algunos servicios presentan incidencias'}
                                </p>
                                <p style={{ fontSize: 'var(--text-caption-size)', color: allOperational ? 'var(--state-success)' : 'var(--state-warning)', opacity: 0.85, marginTop: 'var(--space-2)' }}>
                                    Uptime últimos 90 días: 99.94% · Build v1.0.0
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Métricas */}
                <div>
                    <p style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.18em', padding: '0 var(--space-4)', marginBottom: 'var(--space-12)' }}>
                        Métricas de disponibilidad
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-12)' }}>
                        {[
                            { label: 'Uptime 30d', value: '100%', sub: '0 incidencias' },
                            { label: 'Uptime 90d', value: '99.9%', sub: '~1.3h downtime' },
                            { label: 'Uptime 365d', value: '99.8%', sub: '~17.5h downtime' },
                        ].map(m => (
                            <Card key={m.label} noPadding>
                                <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                                    <p style={{ fontSize: 'var(--text-h3-size)', fontWeight: 900, color: 'var(--state-success)' }}>{m.value}</p>
                                    <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', marginTop: 'var(--space-2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</p>
                                    <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>{m.sub}</p>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Servicios */}
                <div>
                    <p style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.18em', padding: '0 var(--space-4)', marginBottom: 'var(--space-12)' }}>
                        Servicios
                    </p>
                    <Card noPadding style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {SERVICES.map((service, i) => {
                                const cfg = STATUS_CONFIG[service.status];
                                return (
                                    <div key={service.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', padding: 'var(--space-14) var(--space-16)', borderTop: i > 0 ? 'var(--border-default)' : 'none' }}>
                                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface-muted)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <service.icon size={18} />
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <p style={{ fontSize: 'var(--text-body-size)', fontWeight: 900, color: 'var(--text-primary)' }}>{service.name}</p>
                                            <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{service.description}</p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', flexShrink: 0 }}>
                                            {service.latency && (
                                                <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>{service.latency}</span>
                                            )}
                                            <Badge variant={cfg.badge}>{cfg.label}</Badge>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </div>

                {/* Historial */}
                <div>
                    <p style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.18em', padding: '0 var(--space-4)', marginBottom: 'var(--space-12)' }}>
                        Historial de incidencias
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
                        {INCIDENTS.map((incident, i) => (
                            <Card key={i} noPadding style={{ overflow: 'hidden' }}>
                                <div style={{ padding: 'var(--space-14) var(--space-16)' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-8)', marginBottom: 'var(--space-6)' }}>
                                        <p style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--text-primary)' }}>{incident.title}</p>
                                        <Badge variant={incident.resolved ? 'success' : 'warning'}>{incident.resolved ? 'RESUELTO' : 'ACTIVO'}</Badge>
                                    </div>
                                    <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-8)' }}>{incident.description}</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-16)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
                                            <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                                            <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>{incident.date}</span>
                                        </div>
                                        {incident.duration && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
                                                <Activity size={12} style={{ color: 'var(--text-muted)' }} />
                                                <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>Duración: {incident.duration}</span>
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