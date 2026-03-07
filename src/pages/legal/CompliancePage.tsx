import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ShieldCheck, Lock, Eye, FileCheck, AlertTriangle, CheckCircle, Cpu } from 'lucide-react';
import { colors, typography } from '@/design/design-tokens';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface ComplianceItem {
    icon: React.ElementType;
    title: string;
    description: string;
    status: 'verified' | 'in_progress' | 'planned';
    iconBg: string;
    iconColor: string;
}

const COMPLIANCE_ITEMS: ComplianceItem[] = [
    {
        icon: Lock,
        title: 'Cifrado en tránsito y reposo',
        description: 'Todos los datos se cifran con TLS 1.3 en tránsito. Los datos en reposo se cifran con AES-256 a nivel de base de datos (Supabase).',
        status: 'verified',
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-700',
    },
    {
        icon: Eye,
        title: 'Auditoría de accesos',
        description: 'Cada operación de lectura/escritura genera un registro de auditoría con usuario, timestamp y IP. Los logs se conservan 12 meses.',
        status: 'verified',
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-700',
    },
    {
        icon: FileCheck,
        title: 'Control de versiones de datos',
        description: 'Las modificaciones a productos, precios y fórmulas quedan registradas con created_by y updated_by. Se puede reconstruir el historial completo.',
        status: 'verified',
        iconBg: 'bg-indigo-50',
        iconColor: 'text-indigo-700',
    },
    {
        icon: ShieldCheck,
        title: 'Aislamiento multi-tenant',
        description: 'Cada empresa opera en un entorno completamente aislado a nivel de base de datos. Es imposible que datos de una empresa sean visibles por otra.',
        status: 'verified',
        iconBg: 'bg-violet-50',
        iconColor: 'text-violet-700',
    },
    {
        icon: Cpu,
        title: 'Integridad de IA (AI Safety)',
        description: 'Las funcionalidades de análisis y sugerencias automáticas no toman decisiones autónomas. Toda acción requiere confirmación explícita del usuario.',
        status: 'verified',
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-700',
    },
    {
        icon: AlertTriangle,
        title: 'Plan de contingencia (DR)',
        description: 'Backups automáticos diarios con retención de 30 días. RTO (Recovery Time Objective): 4h. RPO (Recovery Point Objective): 24h.',
        status: 'verified',
        iconBg: 'bg-red-50',
        iconColor: 'text-red-600',
    },
];

const STATUS_CONFIG = {
    verified: { label: 'VERIFICADO', badge: 'success' as const },
    in_progress: { label: 'EN PROCESO', badge: 'warning' as const },
    planned: { label: 'PLANIFICADO', badge: 'neutral' as const },
};

const AI_PRINCIPLES = [
    {
        title: 'Transparencia',
        description: 'Cuando BETO OS utiliza modelos de IA para generar sugerencias o proyecciones, lo indica explícitamente en la interfaz.',
    },
    {
        title: 'Supervisión humana',
        description: 'Ninguna acción de IA opera de forma autónoma. El usuario siempre revisa y confirma antes de que cualquier cambio tenga efecto.',
    },
    {
        title: 'Explicabilidad',
        description: 'Los motores de análisis (businessHealthEngine, decisionEngine) muestran el razonamiento detrás de cada alerta o recomendación.',
    },
    {
        title: 'Sin sesgos comerciales',
        description: 'Las sugerencias de precio o margen se basan únicamente en los datos del usuario. No existe ningún incentivo externo que influya en las recomendaciones.',
    },
];

export default function CompliancePage() {
    const navigate = useNavigate();

    return (
        <PageContainer>
            <SectionBlock>

                <UniversalPageHeader
                    title="Cumplimiento"
                    breadcrumbs={
                        <>
                            <span>BETO OS</span>
                            <span>/</span>
                            <span>Más</span>
                            <span>/</span>
                            <span className={colors.textPrimary}>Cumplimiento</span>
                        </>
                    }
                    metadata={[
                        <span key="1">Protocolos de integridad · Seguridad · AI Safety</span>,
                        <span key="2">Verificado · Enero 2026</span>
                    ]}
                    actions={
                        <Button variant="secondary" size="sm" onClick={() => navigate('/more')} icon={<ChevronLeft size={16} />}>
                            Volver
                        </Button>
                    }
                />

                {/* ── INTRO ─────────────────────────────────────────────── */}
                <div className="pt-6 border-t border-slate-100">
                    <Card className="bg-indigo-50 border-indigo-100">
                        <div className="flex gap-3">
                            <ShieldCheck size={20} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className={`${typography.body} font-semibold text-indigo-900`}>
                                    BETO OS opera bajo protocolos estrictos de seguridad e integridad.
                                </p>
                                <p className={`${typography.caption} text-indigo-700 mt-1 normal-case tracking-normal`}>
                                    Esta página detalla los controles técnicos, de datos y de IA implementados para garantizar
                                    la confiabilidad y seguridad de la plataforma.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* ── CONTROLES DE CUMPLIMIENTO ─────────────────────────── */}
                <div>
                    <p className={`text-[10px] font-black ${colors.textMuted} uppercase tracking-[0.18em] px-1 mb-3`}>
                        Controles implementados
                    </p>
                    <Card noPadding className="overflow-hidden">
                        <div className="divide-y divide-slate-100">
                            {COMPLIANCE_ITEMS.map((item) => {
                                const cfg = STATUS_CONFIG[item.status];
                                return (
                                    <div key={item.title} className="flex items-start gap-3 px-4 py-4">
                                        <div className={`flex size-10 items-center justify-center rounded-xl flex-shrink-0 ${item.iconBg} ${item.iconColor}`}>
                                            <item.icon size={18} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <p className={`${typography.body} font-black ${colors.textPrimary}`}>
                                                    {item.title}
                                                </p>
                                                <Badge variant={cfg.badge}>{cfg.label}</Badge>
                                            </div>
                                            <p className={`${typography.caption} ${colors.textSecondary} normal-case tracking-normal leading-relaxed`}>
                                                {item.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </div>

                {/* ── PRINCIPIOS DE IA ──────────────────────────────────── */}
                <div>
                    <p className={`text-[10px] font-black ${colors.textMuted} uppercase tracking-[0.18em] px-1 mb-3`}>
                        Principios de integridad AI
                    </p>
                    <div className="space-y-2">
                        {AI_PRINCIPLES.map((principle, i) => (
                            <div key={i} className="flex items-start gap-3 px-4 py-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                <CheckCircle size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className={`${typography.body} font-semibold ${colors.textPrimary} text-sm`}>
                                        {principle.title}
                                    </p>
                                    <p className={`${typography.caption} ${colors.textSecondary} normal-case tracking-normal leading-relaxed mt-0.5`}>
                                        {principle.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── CERTIFICACIONES ───────────────────────────────────── */}
                <div>
                    <p className={`text-[10px] font-black ${colors.textMuted} uppercase tracking-[0.18em] px-1 mb-3`}>
                        Proveedores certificados
                    </p>
                    <Card noPadding className="overflow-hidden">
                        <div className="divide-y divide-slate-100">
                            {[
                                { name: 'Supabase', role: 'Base de datos y autenticación', certs: 'SOC 2 Type II · ISO 27001' },
                                { name: 'Stripe', role: 'Procesamiento de pagos', certs: 'PCI-DSS Level 1 · SOC 1 & 2' },
                                { name: 'Vercel / Cloudflare', role: 'Hosting y CDN', certs: 'ISO 27001 · SOC 2' },
                            ].map((provider) => (
                                <div key={provider.name} className="flex items-center justify-between px-4 py-3.5">
                                    <div>
                                        <p className={`${typography.body} font-black ${colors.textPrimary}`}>
                                            {provider.name}
                                        </p>
                                        <p className={`${typography.caption} ${colors.textSecondary} normal-case tracking-normal`}>
                                            {provider.role}
                                        </p>
                                    </div>
                                    <p className={`${typography.caption} text-indigo-600 normal-case tracking-normal text-right max-w-[140px]`}>
                                        {provider.certs}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

            </SectionBlock>
        </PageContainer>
    );
}