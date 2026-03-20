import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Scale, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface TermSection { id: string; title: string; content: string[]; }

const TERMS: TermSection[] = [
    { id: '1', title: '1. Objeto y aceptación', content: ['Los presentes Términos y Condiciones regulan el acceso y uso de BETO OS, plataforma SaaS de gestión de costos, inventarios y operaciones empresariales, desarrollada y operada por BETO OS S.L.', 'El acceso a la plataforma implica la aceptación plena y sin reservas de estos términos. Si no estás de acuerdo con alguna disposición, debes abstenerte de usar el servicio.', 'Estos términos se aplican a todos los usuarios, independientemente de su país de origen o residencia.'] },
    { id: '2', title: '2. Descripción del servicio', content: ['BETO OS es una plataforma SaaS que ofrece herramientas de gestión de inventario FIFO, costeo de productos, control de materias primas y análisis financiero para empresas.', 'El servicio se presta bajo un modelo de suscripción con diferentes planes que determinan los límites de usuarios, funcionalidades disponibles y capacidad de almacenamiento.', 'El Prestador se reserva el derecho de modificar las funcionalidades del servicio, notificando con al menos 30 días de antelación cualquier cambio sustancial.'] },
    { id: '3', title: '3. Obligaciones del usuario', content: ['El usuario se compromete a usar la plataforma de forma lícita, respetando la legislación vigente y los derechos de terceros.', 'Está prohibido el acceso no autorizado a cuentas de otros usuarios, la manipulación de datos ajenos, la ingeniería inversa del software.', 'El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso y de notificar inmediatamente cualquier uso no autorizado de su cuenta.', 'Los datos introducidos en la plataforma son responsabilidad exclusiva del usuario y deben ser verídicos.'] },
    { id: '4', title: '4. Propiedad intelectual', content: ['Todo el software, diseño, código fuente, bases de datos, marcas y contenidos de BETO OS son propiedad exclusiva del Prestador o sus licenciantes.', 'El usuario recibe una licencia de uso limitada, no exclusiva, intransferible y revocable para acceder al servicio según el plan contratado.', 'Los datos generados por el usuario dentro de la plataforma son propiedad del usuario. El Prestador no adquiere ningún derecho sobre dichos datos.'] },
    { id: '5', title: '5. Limitación de responsabilidad', content: ['BETO OS se proporciona "tal cual" (as-is). El Prestador no garantiza que el servicio estará libre de interrupciones o errores.', 'En ningún caso el Prestador será responsable por daños indirectos, pérdidas de beneficios o pérdida de datos derivados del uso del servicio.', 'La responsabilidad máxima del Prestador no excederá el importe abonado por el usuario en los últimos 3 meses de servicio.', 'El usuario es el único responsable de las decisiones empresariales tomadas basándose en los datos generados por BETO OS.'] },
    { id: '6', title: '6. Facturación y cancelación', content: ['El servicio se factura mensual o anualmente según el plan seleccionado, procesado automáticamente a través de Stripe (PCI-DSS).', 'El usuario puede cancelar su suscripción en cualquier momento desde el panel de Billing. La cancelación surte efecto al final del período facturado en curso.', 'En caso de impago, el Prestador se reserva el derecho de suspender el acceso al servicio tras un período de gracia de 7 días naturales.', 'Los precios pueden modificarse con un preaviso de 30 días. El usuario que no acepte la modificación podrá cancelar sin penalización.'] },
    { id: '7', title: '7. Legislación aplicable y jurisdicción', content: ['Estos términos se rigen por la legislación española, en particular la Ley 34/2002 de Servicios de la Sociedad de la Información (LSSI).', 'Para usuarios en Venezuela, se reconoce adicionalmente la aplicabilidad de la Ley de Comercio Electrónico venezolana.', 'Para usuarios en Chile, se aplica complementariamente la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores.', 'Cualquier disputa se somete a los Juzgados y Tribunales de Valencia, España, salvo que la legislación aplicable al consumidor establezca otra cosa.'] },
];

const sectionLabel: React.CSSProperties = { fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.18em', padding: '0 var(--space-4)', marginBottom: 'var(--space-12)' };

export default function TermsPage() {
    const navigate = useNavigate();
    const [openSection, setOpenSection] = useState<string | null>('1');

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Asuntos Legales"
                    breadcrumbs={<><span>BETO OS</span><span>/</span><span>Más</span><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Términos</span></>}
                    metadata={[<span key="1">Términos de servicio · Responsabilidad · Condiciones SaaS</span>, <span key="2">Versión 2.0 · Enero 2026</span>]}
                    actions={<Button variant="secondary" size="sm" onClick={() => navigate('/mas')} icon={<ChevronLeft size={16} />}>Volver</Button>}
                />

                <div style={{ paddingTop: 'var(--space-24)', borderTop: 'var(--border-default)' }}>
                    <Card style={{ background: 'var(--surface-warning-soft)', borderColor: 'var(--border-color-warning)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-12)' }}>
                            <AlertTriangle size={20} style={{ color: 'var(--state-warning)', flexShrink: 0, marginTop: 2 }} />
                            <div>
                                <p style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--text-primary)' }}>Lee estos términos antes de usar la plataforma.</p>
                                <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 'var(--space-4)', lineHeight: 1.6 }}>El uso continuado de BETO OS implica la aceptación de estos términos. Última actualización: enero de 2026.</p>
                            </div>
                        </div>
                    </Card>
                </div>

                <div>
                    <p style={sectionLabel}>Resumen ejecutivo</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
                        {['Tus datos son tuyos — nunca los vendemos ni cedemos a terceros.', 'Puedes cancelar en cualquier momento sin penalización.', 'Somos responsables del servicio, tú de las decisiones de negocio.', 'Ley aplicable: española, con adaptaciones para Venezuela y Chile.'].map((point, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-10)', padding: 'var(--space-10) var(--space-16)', background: 'var(--surface-success-soft)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color-success)' }}>
                                <CheckCircle size={15} style={{ color: 'var(--state-success)', flexShrink: 0, marginTop: 2 }} />
                                <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{point}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <p style={sectionLabel}>Términos completos</p>
                    <Card noPadding style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {TERMS.map((section, i) => (
                                <div key={section.id} style={{ borderTop: i > 0 ? 'var(--border-default)' : 'none' }}>
                                    <button onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-14) var(--space-16)', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background var(--transition-fast)' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-page)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        <span style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--text-primary)' }}>{section.title}</span>
                                        {openSection === section.id ? <ChevronUp size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                                    </button>
                                    {openSection === section.id && (
                                        <div style={{ padding: '0 var(--space-16) var(--space-16)', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
                                            {section.content.map((p, j) => <p key={j} style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{p}</p>)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                <div>
                    <p style={sectionLabel}>Contacto legal</p>
                    <Card noPadding>
                        <div style={{ padding: 'var(--space-16)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-12)' }}>
                            <Scale size={18} style={{ color: 'var(--state-primary)', flexShrink: 0, marginTop: 2 }} />
                            <div>
                                <p style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--text-primary)' }}>Departamento Legal · BETO OS</p>
                                <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
                                    Para consultas legales escribe a <a href="mailto:legal@betoos.com" style={{ color: 'var(--state-primary)', fontWeight: 600 }}>legal@betoos.com</a>
                                </p>
                                <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', marginTop: 'var(--space-4)' }}>Tiempo de respuesta: 5–10 días hábiles</p>
                            </div>
                        </div>
                    </Card>
                </div>
            </SectionBlock>
        </PageContainer>
    );
}