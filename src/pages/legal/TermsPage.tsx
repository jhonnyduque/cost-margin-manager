import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Scale, FileText, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { colors, typography, spacing } from '@/design/design-tokens';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface TermSection {
    id: string;
    title: string;
    content: string[];
}

const TERMS: TermSection[] = [
    {
        id: '1',
        title: '1. Objeto y aceptación',
        content: [
            'Los presentes Términos y Condiciones regulan el acceso y uso de BETO OS, plataforma SaaS de gestión de costos, inventarios y operaciones empresariales, desarrollada y operada por BETO OS S.L. (en adelante, "el Prestador").',
            'El acceso a la plataforma implica la aceptación plena y sin reservas de estos términos. Si no estás de acuerdo con alguna disposición, debes abstenerte de usar el servicio.',
            'Estos términos se aplican a todos los usuarios, independientemente de su país de origen o residencia, con las particularidades legales que correspondan a cada jurisdicción.',
        ]
    },
    {
        id: '2',
        title: '2. Descripción del servicio',
        content: [
            'BETO OS es una plataforma SaaS (Software as a Service) que ofrece herramientas de gestión de inventario FIFO, costeo de productos, control de materias primas y análisis financiero para empresas.',
            'El servicio se presta bajo un modelo de suscripción con diferentes planes (Starter, Growth, Pro) que determinan los límites de usuarios, funcionalidades disponibles y capacidad de almacenamiento.',
            'El Prestador se reserva el derecho de modificar, ampliar o reducir las funcionalidades del servicio, notificando con al menos 30 días de antelación cualquier cambio sustancial.',
        ]
    },
    {
        id: '3',
        title: '3. Obligaciones del usuario',
        content: [
            'El usuario se compromete a usar la plataforma de forma lícita, respetando la legislación vigente y los derechos de terceros.',
            'Está prohibido el acceso no autorizado a cuentas de otros usuarios, la manipulación de datos ajenos, la ingeniería inversa del software, y cualquier uso que pueda dañar la integridad o disponibilidad del servicio.',
            'El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso y de notificar inmediatamente cualquier uso no autorizado de su cuenta.',
            'Los datos introducidos en la plataforma (productos, inventarios, precios, etc.) son responsabilidad exclusiva del usuario y deben ser verídicos.',
        ]
    },
    {
        id: '4',
        title: '4. Propiedad intelectual',
        content: [
            'Todo el software, diseño, código fuente, bases de datos, marcas y contenidos de BETO OS son propiedad exclusiva del Prestador o sus licenciantes, protegidos por la legislación de propiedad intelectual aplicable.',
            'El usuario recibe una licencia de uso limitada, no exclusiva, intransferible y revocable para acceder al servicio según el plan contratado.',
            'Los datos generados por el usuario dentro de la plataforma (inventarios, productos, movimientos) son propiedad del usuario. El Prestador no adquiere ningún derecho sobre dichos datos.',
        ]
    },
    {
        id: '5',
        title: '5. Limitación de responsabilidad',
        content: [
            'BETO OS se proporciona "tal cual" (as-is). El Prestador no garantiza que el servicio estará libre de interrupciones, errores o que cumplirá todos los requisitos del usuario.',
            'En ningún caso el Prestador será responsable por daños indirectos, pérdidas de beneficios, pérdida de datos o cualquier daño consecuente derivado del uso o imposibilidad de uso del servicio.',
            'La responsabilidad máxima del Prestador ante el usuario, por cualquier causa, no excederá el importe abonado por el usuario en los últimos 3 meses de servicio.',
            'El usuario es el único responsable de las decisiones empresariales tomadas basándose en los datos e informes generados por BETO OS.',
        ]
    },
    {
        id: '6',
        title: '6. Facturación y cancelación',
        content: [
            'El servicio se factura mensual o anualmente según el plan seleccionado. El pago se procesa automáticamente a través de Stripe, proveedor de pagos certificado PCI-DSS.',
            'El usuario puede cancelar su suscripción en cualquier momento desde el panel de Billing. La cancelación surte efecto al final del período facturado en curso, sin reembolso proporcional.',
            'En caso de impago, el Prestador se reserva el derecho de suspender el acceso al servicio tras un período de gracia de 7 días naturales.',
            'Los precios pueden modificarse con un preaviso de 30 días. El usuario que no acepte la modificación podrá cancelar sin penalización.',
        ]
    },
    {
        id: '7',
        title: '7. Legislación aplicable y jurisdicción',
        content: [
            'Estos términos se rigen por la legislación española, en particular la Ley 34/2002 de Servicios de la Sociedad de la Información (LSSI) y el Código Civil español.',
            'Para usuarios en Venezuela, se reconoce adicionalmente la aplicabilidad de la Ley de Comercio Electrónico venezolana en lo que corresponda.',
            'Para usuarios en Chile, se aplica complementariamente la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores.',
            'Cualquier disputa se somete a los Juzgados y Tribunales de la ciudad de Valencia, España, salvo que la legislación aplicable al consumidor establezca otra cosa.',
        ]
    },
];

export default function TermsPage() {
    const navigate = useNavigate();
    const [openSection, setOpenSection] = useState<string | null>('1');

    return (
        <PageContainer>
            <SectionBlock>

                <UniversalPageHeader
                    title="Asuntos Legales"
                    breadcrumbs={
                        <>
                            <span>BETO OS</span>
                            <span>/</span>
                            <span>Más</span>
                            <span>/</span>
                            <span className={colors.textPrimary}>Términos</span>
                        </>
                    }
                    metadata={[
                        <span key="1">Términos de servicio · Responsabilidad · Condiciones SaaS</span>,
                        <span key="2">Versión 2.0 · Enero 2026</span>
                    ]}
                    actions={
                        <Button variant="secondary" size="sm" onClick={() => navigate('/more')} icon={<ChevronLeft size={16} />}>
                            Volver
                        </Button>
                    }
                />

                {/* ── INTRO ─────────────────────────────────────────────── */}
                <div className="pt-6 border-t border-slate-100">
                    <Card className="bg-amber-50 border-amber-100">
                        <div className="flex gap-3">
                            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className={`${typography.body} font-semibold text-amber-900`}>
                                    Lee estos términos antes de usar la plataforma.
                                </p>
                                <p className={`${typography.caption} text-amber-700 mt-1 normal-case tracking-normal`}>
                                    El uso continuado de BETO OS implica la aceptación de estos términos.
                                    Última actualización: enero de 2026.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* ── RESUMEN RÁPIDO ────────────────────────────────────── */}
                <div>
                    <p className={`text-[10px] font-black ${colors.textMuted} uppercase tracking-[0.18em] px-1 mb-3`}>
                        Resumen ejecutivo
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                        {[
                            'Tus datos son tuyos — nunca los vendemos ni cedemos a terceros.',
                            'Puedes cancelar en cualquier momento sin penalización.',
                            'Somos responsables del servicio, tú de las decisiones de negocio.',
                            'Ley aplicable: española, con adaptaciones para Venezuela y Chile.',
                        ].map((point, i) => (
                            <div key={i} className="flex items-start gap-2.5 px-4 py-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                                <CheckCircle size={15} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                                <p className={`${typography.caption} text-emerald-800 normal-case tracking-normal`}>
                                    {point}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── TÉRMINOS COMPLETOS (acordeón) ─────────────────────── */}
                <div>
                    <p className={`text-[10px] font-black ${colors.textMuted} uppercase tracking-[0.18em] px-1 mb-3`}>
                        Términos completos
                    </p>
                    <Card noPadding className="overflow-hidden">
                        <div className="divide-y divide-slate-100">
                            {TERMS.map((section) => (
                                <div key={section.id}>
                                    <button
                                        onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
                                        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
                                    >
                                        <span className={`${typography.body} font-semibold ${colors.textPrimary}`}>
                                            {section.title}
                                        </span>
                                        {openSection === section.id
                                            ? <ChevronUp size={16} className={colors.textMuted} />
                                            : <ChevronDown size={16} className={colors.textMuted} />
                                        }
                                    </button>
                                    {openSection === section.id && (
                                        <div className="px-4 pb-4 space-y-2">
                                            {section.content.map((paragraph, i) => (
                                                <p key={i} className={`${typography.caption} ${colors.textSecondary} normal-case tracking-normal leading-relaxed`}>
                                                    {paragraph}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* ── CONTACTO LEGAL ────────────────────────────────────── */}
                <div>
                    <p className={`text-[10px] font-black ${colors.textMuted} uppercase tracking-[0.18em] px-1 mb-3`}>
                        Contacto legal
                    </p>
                    <Card noPadding>
                        <div className="px-4 py-4 flex items-start gap-3">
                            <Scale size={18} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className={`${typography.body} font-semibold ${colors.textPrimary}`}>
                                    Departamento Legal · BETO OS
                                </p>
                                <p className={`${typography.caption} ${colors.textSecondary} normal-case tracking-normal mt-0.5`}>
                                    Para consultas legales, notificaciones formales o ejercicio de derechos escribe a{' '}
                                    <a href="mailto:legal@betoos.com" className="text-indigo-600 font-semibold">
                                        legal@betoos.com
                                    </a>
                                </p>
                                <p className={`${typography.caption} ${colors.textMuted} normal-case tracking-normal mt-1`}>
                                    Tiempo de respuesta: 5–10 días hábiles
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

            </SectionBlock>
        </PageContainer>
    );
}