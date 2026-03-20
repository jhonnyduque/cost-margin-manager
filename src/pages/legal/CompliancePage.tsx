import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ShieldCheck, Lock, Eye, FileCheck, AlertTriangle, CheckCircle, Cpu } from 'lucide-react';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface ComplianceItem { icon: React.ElementType; title: string; description: string; status: 'verified' | 'in_progress' | 'planned'; iconBg: string; iconColor: string; }

const COMPLIANCE_ITEMS: ComplianceItem[] = [
    { icon: Lock, title: 'Cifrado en tránsito y reposo', description: 'Todos los datos se cifran con TLS 1.3 en tránsito. Los datos en reposo se cifran con AES-256 a nivel de base de datos (Supabase).', status: 'verified', iconBg: 'var(--surface-success-soft)', iconColor: 'var(--state-success)' },
    { icon: Eye, title: 'Auditoría de accesos', description: 'Cada operación de lectura/escritura genera un registro de auditoría con usuario, timestamp y IP. Los logs se conservan 12 meses.', status: 'verified', iconBg: 'var(--surface-info-soft)', iconColor: 'var(--state-info)' },
    { icon: FileCheck, title: 'Control de versiones de datos', description: 'Las modificaciones a productos, precios y fórmulas quedan registradas con created_by y updated_by. Se puede reconstruir el historial completo.', status: 'verified', iconBg: 'var(--surface-primary-soft)', iconColor: 'var(--state-primary)' },
    { icon: ShieldCheck, title: 'Aislamiento multi-tenant', description: 'Cada empresa opera en un entorno completamente aislado a nivel de base de datos. Es imposible que datos de una empresa sean visibles por otra.', status: 'verified', iconBg: '#f5f3ff', iconColor: '#7c3aed' },
    { icon: Cpu, title: 'Integridad de IA (AI Safety)', description: 'Las funcionalidades de análisis y sugerencias automáticas no toman decisiones autónomas. Toda acción requiere confirmación explícita del usuario.', status: 'verified', iconBg: 'var(--surface-warning-soft)', iconColor: 'var(--state-warning)' },
    { icon: AlertTriangle, title: 'Plan de contingencia (DR)', description: 'Backups automáticos diarios con retención de 30 días. RTO: 4h. RPO: 24h.', status: 'verified', iconBg: 'var(--surface-danger-soft)', iconColor: 'var(--state-danger)' },
];

const STATUS_CONFIG = {
    verified: { label: 'VERIFICADO', badge: 'success' as const },
    in_progress: { label: 'EN PROCESO', badge: 'warning' as const },
    planned: { label: 'PLANIFICADO', badge: 'neutral' as const },
};

const AI_PRINCIPLES = [
    { title: 'Transparencia', description: 'Cuando BETO OS utiliza modelos de IA para generar sugerencias o proyecciones, lo indica explícitamente en la interfaz.' },
    { title: 'Supervisión humana', description: 'Ninguna acción de IA opera de forma autónoma. El usuario siempre revisa y confirma antes de que cualquier cambio tenga efecto.' },
    { title: 'Explicabilidad', description: 'Los motores de análisis muestran el razonamiento detrás de cada alerta o recomendación.' },
    { title: 'Sin sesgos comerciales', description: 'Las sugerencias de precio o margen se basan únicamente en los datos del usuario. No existe ningún incentivo externo que influya en las recomendaciones.' },
];

const sectionLabel: React.CSSProperties = { fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.18em', padding: '0 var(--space-4)', marginBottom: 'var(--space-12)' };

export default function CompliancePage() {
    const navigate = useNavigate();

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Cumplimiento"
                    breadcrumbs={<><span>BETO OS</span><span>/</span><span>Más</span><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Cumplimiento</span></>}
                    metadata={[<span key="1">Protocolos de integridad · Seguridad · AI Safety</span>, <span key="2">Verificado · Enero 2026</span>]}
                    actions={<Button variant="secondary" size="sm" onClick={() => navigate('/mas')} icon={<ChevronLeft size={16} />}>Volver</Button>}
                />

                <div style={{ paddingTop: 'var(--space-24)', borderTop: 'var(--border-default)' }}>
                    <Card style={{ background: 'var(--surface-primary-soft)', borderColor: 'var(--border-color-primary)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-12)' }}>
                            <ShieldCheck size={20} style={{ color: 'var(--state-primary)', flexShrink: 0, marginTop: 2 }} />
                            <div>
                                <p style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--text-primary)' }}>BETO OS opera bajo protocolos estrictos de seguridad e integridad.</p>
                                <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 'var(--space-4)', lineHeight: 1.6 }}>Esta página detalla los controles técnicos, de datos y de IA implementados para garantizar la confiabilidad y seguridad de la plataforma.</p>
                            </div>
                        </div>
                    </Card>
                </div>

                <div>
                    <p style={sectionLabel}>Controles implementados</p>
                    <Card noPadding style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {COMPLIANCE_ITEMS.map((item, i) => {
                                const cfg = STATUS_CONFIG[item.status];
                                return (
                                    <div key={item.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-12)', padding: 'var(--space-16)', borderTop: i > 0 ? 'var(--border-default)' : 'none' }}>
                                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-lg)', background: item.iconBg, color: item.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <item.icon size={18} />
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                                                <p style={{ fontSize: 'var(--text-body-size)', fontWeight: 900, color: 'var(--text-primary)' }}>{item.title}</p>
                                                <Badge variant={cfg.badge}>{cfg.label}</Badge>
                                            </div>
                                            <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.description}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </div>

                <div>
                    <p style={sectionLabel}>Principios de integridad AI</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
                        {AI_PRINCIPLES.map((principle, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-12)', padding: 'var(--space-14) var(--space-16)', background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                                <CheckCircle size={16} style={{ color: 'var(--state-primary)', flexShrink: 0, marginTop: 2 }} />
                                <div>
                                    <p style={{ fontSize: 'var(--text-small-size)', fontWeight: 600, color: 'var(--text-primary)' }}>{principle.title}</p>
                                    <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 'var(--space-2)' }}>{principle.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <p style={sectionLabel}>Proveedores certificados</p>
                    <Card noPadding style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {[
                                { name: 'Supabase', role: 'Base de datos y autenticación', certs: 'SOC 2 Type II · ISO 27001' },
                                { name: 'Stripe', role: 'Procesamiento de pagos', certs: 'PCI-DSS Level 1 · SOC 1 & 2' },
                                { name: 'Vercel / Cloudflare', role: 'Hosting y CDN', certs: 'ISO 27001 · SOC 2' },
                            ].map((provider, i) => (
                                <div key={provider.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-14) var(--space-16)', borderTop: i > 0 ? 'var(--border-default)' : 'none' }}>
                                    <div>
                                        <p style={{ fontSize: 'var(--text-body-size)', fontWeight: 900, color: 'var(--text-primary)' }}>{provider.name}</p>
                                        <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>{provider.role}</p>
                                    </div>
                                    <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--state-primary)', textAlign: 'right', maxWidth: '9rem' }}>{provider.certs}</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </SectionBlock>
        </PageContainer>
    );
}