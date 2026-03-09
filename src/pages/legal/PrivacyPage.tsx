import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Lock, Globe, FileText, Eye, Edit, Trash2, Download, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface CountrySection {
    country: string;
    flag: string;
    law: string;
    authority: string;
    authorityUrl: string;
    rights: string[];
    notes: string;
    badge: 'success' | 'info' | 'warning';
}

interface AccordionItem {
    title: string;
    content: string;
}

const COUNTRIES: CountrySection[] = [
    {
        country: 'España',
        flag: '🇪🇸',
        law: 'Reglamento General de Protección de Datos (RGPD) + LOPDGDD',
        authority: 'Agencia Española de Protección de Datos (AEPD)',
        authorityUrl: 'https://www.aepd.es',
        badge: 'success',
        rights: [
            'Acceso — Solicitar qué datos personales tenemos sobre ti.',
            'Rectificación — Corregir datos inexactos o incompletos.',
            'Supresión ("derecho al olvido") — Eliminar tus datos cuando ya no sean necesarios.',
            'Portabilidad — Recibir tus datos en formato estructurado y legible.',
            'Limitación — Restringir el tratamiento de tus datos en ciertas circunstancias.',
            'Oposición — Oponerte al tratamiento basado en interés legítimo.',
        ],
        notes: 'El plazo de respuesta es de 1 mes ampliable a 3 meses en casos complejos. Puedes presentar reclamación ante la AEPD si consideras que tus derechos han sido vulnerados.',
    },
    {
        country: 'Venezuela',
        flag: '🇻🇪',
        law: 'Ley Orgánica de Protección de Datos Personales (LOPD) — G.O. N° 6.684 Extraordinario, 2022',
        authority: 'Superintendencia de Protección de Datos Personales (SUNDAPRO)',
        authorityUrl: 'https://www.sundapro.gob.ve',
        badge: 'info',
        rights: [
            'Acceso — Conocer los datos personales que son objeto de tratamiento.',
            'Rectificación — Actualizar o corregir datos erróneos.',
            'Cancelación — Solicitar la eliminación de datos que ya no corresponda tratar.',
            'Oposición — Oponerte al tratamiento de tus datos en los supuestos previstos por la ley.',
            'Información — Ser informado de forma clara sobre el uso de tus datos.',
        ],
        notes: 'La LOPD venezolana está alineada con estándares internacionales. El responsable del tratamiento tiene 15 días hábiles para responder a solicitudes de derechos.',
    },
    {
        country: 'Chile',
        flag: '🇨🇱',
        law: 'Ley N° 19.628 sobre Protección de la Vida Privada (en proceso de reforma — Ley N° 21.719)',
        authority: 'Agencia de Protección de Datos Personales (en constitución)',
        authorityUrl: 'https://www.agenciadatos.gob.cl',
        badge: 'warning',
        rights: [
            'Acceso — Exigir información sobre los datos personales almacenados.',
            'Modificación — Rectificar datos erróneos, inexactos o desactualizados.',
            'Eliminación — Cancelar datos cuando haya concluido la finalidad del tratamiento.',
            'Bloqueo — Suspender temporalmente el tratamiento en casos de impugnación.',
            'Portabilidad — Derecho incorporado con la Ley 21.719 (vigencia progresiva).',
        ],
        notes: 'Chile está en transición hacia el nuevo marco de la Ley 21.719, que moderniza la protección de datos y crea la Agencia reguladora. Los derechos vigentes bajo Ley 19.628 son exigibles desde ya.',
    },
];

const USER_RIGHTS = [
    { icon: Eye, label: 'Ver mis datos', description: 'Accede a todos los datos personales que BETO OS almacena sobre ti.' },
    { icon: Edit, label: 'Corregir datos', description: 'Solicita la rectificación de información incorrecta o desactualizada.' },
    { icon: Trash2, label: 'Eliminar mi cuenta', description: 'Ejerce el derecho de supresión y elimina permanentemente tu cuenta y datos.' },
    { icon: Download, label: 'Exportar mis datos', description: 'Descarga una copia de tus datos en formato JSON o CSV.' },
];

const FAQ: AccordionItem[] = [
    {
        title: '¿Qué datos recopila BETO OS?',
        content: 'BETO OS recopila datos de identificación (nombre, email), datos de uso de la plataforma (productos, inventarios, movimientos de stock), y datos de facturación necesarios para la prestación del servicio. No recopilamos datos sensibles ni vendemos información a terceros.',
    },
    {
        title: '¿Por cuánto tiempo conservamos tus datos?',
        content: 'Los datos se conservan mientras la cuenta esté activa y por un período adicional de 5 años por obligaciones fiscales y legales. Tras la eliminación de la cuenta, los datos son anonimizados o destruidos de forma segura en un plazo máximo de 30 días.',
    },
    {
        title: '¿Compartimos tus datos con terceros?',
        content: 'Solo compartimos datos con proveedores de servicios esenciales (Supabase para base de datos, Stripe para pagos) bajo contratos de encargado del tratamiento. Nunca vendemos ni cedemos datos a terceros para fines publicitarios.',
    },
    {
        title: '¿Cómo ejercer mis derechos?',
        content: 'Puedes ejercer tus derechos enviando un email a privacidad@betoos.com con tu nombre, email de cuenta y descripción de la solicitud. Responderemos en los plazos legales aplicables según tu país de residencia.',
    },
];

export default function PrivacyPage() {
    const navigate = useNavigate();
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    return (
        <PageContainer>
            <SectionBlock>

                <UniversalPageHeader
                    title="Derechos de Datos"
                    breadcrumbs={
                        <>
                            <span>BETO OS</span>
                            <span>/</span>
                            <span>Más</span>
                            <span>/</span>
                            <span className={colors.textPrimary}>Privacidad</span>
                        </>
                    }
                    metadata={[
                        <span key="1">Protección de datos · RGPD · LOPD · Ley 19.628</span>,
                        <span key="2">Última revisión: Enero 2026</span>
                    ]}
                    actions={
                        <Button variant="secondary" size="sm" onClick={() => navigate('/mas')} icon={<ChevronLeft size={16} />}>
                            Volver
                        </Button>
                    }
                />

                {/* ── INTRO ─────────────────────────────────────────────── */}
                <div className="pt-6 border-t border-slate-100">
                    <Card className={`bg-indigo-50 border-indigo-100`}>
                        <div className="flex gap-3">
                            <Lock size={20} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className={`${typography.body} font-semibold text-indigo-900`}>
                                    Tu privacidad es un derecho, no una opción.
                                </p>
                                <p className={`${typography.caption} text-indigo-700 mt-1 normal-case tracking-normal`}>
                                    BETO OS opera bajo los marcos legales de protección de datos de España, Venezuela y Chile.
                                    Esta página resume tus derechos y cómo ejercerlos en cada jurisdicción.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* ── TUS DERECHOS EN BETO OS ───────────────────────────── */}
                <div>
                    <p className={`text-[10px] font-black ${colors.textMuted} uppercase tracking-[0.18em] px-1 mb-3`}>
                        Acciones disponibles
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        {USER_RIGHTS.map((right) => (
                            <Card key={right.label} noPadding>
                                <div className="flex flex-col gap-2 p-4">
                                    <div className={`flex size-9 items-center justify-center rounded-xl ${colors.bgBrandSubtle} ${colors.brand}`}>
                                        <right.icon size={16} />
                                    </div>
                                    <p className={`${typography.body} font-black ${colors.textPrimary} text-sm`}>
                                        {right.label}
                                    </p>
                                    <p className={`${typography.caption} ${colors.textSecondary} normal-case tracking-normal leading-relaxed`}>
                                        {right.description}
                                    </p>
                                </div>
                            </Card>
                        ))}
                    </div>
                    <p className={`${typography.caption} ${colors.textMuted} normal-case tracking-normal mt-3 px-1`}>
                        Para ejercer cualquier derecho, escribe a{' '}
                        <a href="mailto:privacidad@betoos.com" className="text-indigo-600 font-semibold">
                            privacidad@betoos.com
                        </a>
                    </p>
                </div>

                {/* ── POR PAÍS ──────────────────────────────────────────── */}
                <div>
                    <p className={`text-[10px] font-black ${colors.textMuted} uppercase tracking-[0.18em] px-1 mb-3`}>
                        Marco legal por país
                    </p>
                    <div className="space-y-4">
                        {COUNTRIES.map((c) => (
                            <Card key={c.country} noPadding className="overflow-hidden">
                                {/* Header país */}
                                <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-100`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{c.flag}</span>
                                        <div>
                                            <p className={`${typography.body} font-black ${colors.textPrimary}`}>
                                                {c.country}
                                            </p>
                                            <p className={`${typography.caption} ${colors.textMuted} normal-case tracking-normal`}>
                                                {c.law}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant={c.badge}>
                                        {c.badge === 'success' ? 'VIGENTE' : c.badge === 'info' ? 'VIGENTE' : 'EN REFORMA'}
                                    </Badge>
                                </div>

                                {/* Derechos */}
                                <div className="px-4 py-3">
                                    <p className={`${typography.uiLabel} ${colors.textMuted} mb-2`}>Tus derechos</p>
                                    <ul className="space-y-1.5">
                                        {c.rights.map((right, i) => (
                                            <li key={i} className="flex gap-2">
                                                <span className="text-indigo-400 font-black text-xs mt-0.5 flex-shrink-0">→</span>
                                                <p className={`${typography.caption} ${colors.textSecondary} normal-case tracking-normal`}>
                                                    {right}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Nota + autoridad */}
                                <div className={`px-4 py-3 bg-slate-50 border-t border-slate-100`}>
                                    <div className="flex gap-2 mb-2">
                                        <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                        <p className={`${typography.caption} text-slate-600 normal-case tracking-normal`}>
                                            {c.notes}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Globe size={12} className={colors.textMuted} />
                                        <a
                                            href={c.authorityUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`${typography.caption} text-indigo-600 normal-case tracking-normal hover:underline`}
                                        >
                                            {c.authority}
                                        </a>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* ── FAQ ───────────────────────────────────────────────── */}
                <div>
                    <p className={`text-[10px] font-black ${colors.textMuted} uppercase tracking-[0.18em] px-1 mb-3`}>
                        Preguntas frecuentes
                    </p>
                    <Card noPadding className="overflow-hidden">
                        <div className="divide-y divide-slate-100">
                            {FAQ.map((item, i) => (
                                <div key={i}>
                                    <button
                                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
                                    >
                                        <span className={`${typography.body} font-semibold ${colors.textPrimary}`}>
                                            {item.title}
                                        </span>
                                        {openFaq === i
                                            ? <ChevronUp size={16} className={colors.textMuted} />
                                            : <ChevronDown size={16} className={colors.textMuted} />
                                        }
                                    </button>
                                    {openFaq === i && (
                                        <div className="px-4 pb-4">
                                            <p className={`${typography.caption} ${colors.textSecondary} normal-case tracking-normal leading-relaxed`}>
                                                {item.content}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

            </SectionBlock>
        </PageContainer>
    );
}