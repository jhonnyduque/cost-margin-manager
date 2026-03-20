import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Lock, Globe, Eye, Edit, Trash2, Download, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface CountrySection { country: string; flag: string; law: string; authority: string; authorityUrl: string; rights: string[]; notes: string; badge: 'success' | 'info' | 'warning'; }
interface AccordionItem { title: string; content: string; }

const COUNTRIES: CountrySection[] = [
    { country: 'España', flag: '🇪🇸', law: 'Reglamento General de Protección de Datos (RGPD) + LOPDGDD', authority: 'Agencia Española de Protección de Datos (AEPD)', authorityUrl: 'https://www.aepd.es', badge: 'success', rights: ['Acceso — Solicitar qué datos personales tenemos sobre ti.', 'Rectificación — Corregir datos inexactos o incompletos.', 'Supresión ("derecho al olvido") — Eliminar tus datos cuando ya no sean necesarios.', 'Portabilidad — Recibir tus datos en formato estructurado y legible.', 'Limitación — Restringir el tratamiento de tus datos en ciertas circunstancias.', 'Oposición — Oponerte al tratamiento basado en interés legítimo.'], notes: 'El plazo de respuesta es de 1 mes ampliable a 3 meses en casos complejos. Puedes presentar reclamación ante la AEPD si consideras que tus derechos han sido vulnerados.' },
    { country: 'Venezuela', flag: '🇻🇪', law: 'Ley Orgánica de Protección de Datos Personales (LOPD) — G.O. N° 6.684 Extraordinario, 2022', authority: 'Superintendencia de Protección de Datos Personales (SUNDAPRO)', authorityUrl: 'https://www.sundapro.gob.ve', badge: 'info', rights: ['Acceso — Conocer los datos personales que son objeto de tratamiento.', 'Rectificación — Actualizar o corregir datos erróneos.', 'Cancelación — Solicitar la eliminación de datos que ya no corresponda tratar.', 'Oposición — Oponerte al tratamiento de tus datos en los supuestos previstos por la ley.', 'Información — Ser informado de forma clara sobre el uso de tus datos.'], notes: 'La LOPD venezolana está alineada con estándares internacionales. El responsable del tratamiento tiene 15 días hábiles para responder a solicitudes de derechos.' },
    { country: 'Chile', flag: '🇨🇱', law: 'Ley N° 19.628 sobre Protección de la Vida Privada (en proceso de reforma — Ley N° 21.719)', authority: 'Agencia de Protección de Datos Personales (en constitución)', authorityUrl: 'https://www.agenciadatos.gob.cl', badge: 'warning', rights: ['Acceso — Exigir información sobre los datos personales almacenados.', 'Modificación — Rectificar datos erróneos, inexactos o desactualizados.', 'Eliminación — Cancelar datos cuando haya concluido la finalidad del tratamiento.', 'Bloqueo — Suspender temporalmente el tratamiento en casos de impugnación.', 'Portabilidad — Derecho incorporado con la Ley 21.719 (vigencia progresiva).'], notes: 'Chile está en transición hacia el nuevo marco de la Ley 21.719, que moderniza la protección de datos y crea la Agencia reguladora. Los derechos vigentes bajo Ley 19.628 son exigibles desde ya.' },
];

const USER_RIGHTS = [
    { icon: Eye, label: 'Ver mis datos', description: 'Accede a todos los datos personales que BETO OS almacena sobre ti.' },
    { icon: Edit, label: 'Corregir datos', description: 'Solicita la rectificación de información incorrecta o desactualizada.' },
    { icon: Trash2, label: 'Eliminar mi cuenta', description: 'Ejerce el derecho de supresión y elimina permanentemente tu cuenta y datos.' },
    { icon: Download, label: 'Exportar mis datos', description: 'Descarga una copia de tus datos en formato JSON o CSV.' },
];

const FAQ: AccordionItem[] = [
    { title: '¿Qué datos recopila BETO OS?', content: 'BETO OS recopila datos de identificación (nombre, email), datos de uso de la plataforma (productos, inventarios, movimientos de stock), y datos de facturación necesarios para la prestación del servicio. No recopilamos datos sensibles ni vendemos información a terceros.' },
    { title: '¿Por cuánto tiempo conservamos tus datos?', content: 'Los datos se conservan mientras la cuenta esté activa y por un período adicional de 5 años por obligaciones fiscales y legales. Tras la eliminación de la cuenta, los datos son anonimizados o destruidos de forma segura en un plazo máximo de 30 días.' },
    { title: '¿Compartimos tus datos con terceros?', content: 'Solo compartimos datos con proveedores de servicios esenciales (Supabase para base de datos, Stripe para pagos) bajo contratos de encargado del tratamiento. Nunca vendemos ni cedemos datos a terceros para fines publicitarios.' },
    { title: '¿Cómo ejercer mis derechos?', content: 'Puedes ejercer tus derechos enviando un email a privacidad@betoos.com con tu nombre, email de cuenta y descripción de la solicitud. Responderemos en los plazos legales aplicables según tu país de residencia.' },
];

const sectionLabel: React.CSSProperties = { fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.18em', padding: '0 var(--space-4)', marginBottom: 'var(--space-12)' };

export default function PrivacyPage() {
    const navigate = useNavigate();
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Derechos de Datos"
                    breadcrumbs={<><span>BETO OS</span><span>/</span><span>Más</span><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Privacidad</span></>}
                    metadata={[<span key="1">Protección de datos · RGPD · LOPD · Ley 19.628</span>, <span key="2">Última revisión: Enero 2026</span>]}
                    actions={<Button variant="secondary" size="sm" onClick={() => navigate('/mas')} icon={<ChevronLeft size={16} />}>Volver</Button>}
                />

                <div style={{ paddingTop: 'var(--space-24)', borderTop: 'var(--border-default)' }}>
                    <Card style={{ background: 'var(--surface-primary-soft)', borderColor: 'var(--border-color-primary)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-12)' }}>
                            <Lock size={20} style={{ color: 'var(--state-primary)', flexShrink: 0, marginTop: 2 }} />
                            <div>
                                <p style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--text-primary)' }}>Tu privacidad es un derecho, no una opción.</p>
                                <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 'var(--space-4)', lineHeight: 1.6 }}>
                                    BETO OS opera bajo los marcos legales de protección de datos de España, Venezuela y Chile. Esta página resume tus derechos y cómo ejercerlos en cada jurisdicción.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

                <div>
                    <p style={sectionLabel}>Acciones disponibles</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-12)' }}>
                        {USER_RIGHTS.map(right => (
                            <Card key={right.label} noPadding>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', padding: 'var(--space-16)' }}>
                                    <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface-primary-soft)', color: 'var(--state-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <right.icon size={16} />
                                    </div>
                                    <p style={{ fontSize: 'var(--text-small-size)', fontWeight: 900, color: 'var(--text-primary)' }}>{right.label}</p>
                                    <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{right.description}</p>
                                </div>
                            </Card>
                        ))}
                    </div>
                    <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', marginTop: 'var(--space-12)', padding: '0 var(--space-4)' }}>
                        Para ejercer cualquier derecho, escribe a{' '}
                        <a href="mailto:privacidad@betoos.com" style={{ color: 'var(--state-primary)', fontWeight: 600 }}>privacidad@betoos.com</a>
                    </p>
                </div>

                <div>
                    <p style={sectionLabel}>Marco legal por país</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                        {COUNTRIES.map(c => (
                            <Card key={c.country} noPadding style={{ overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-12) var(--space-16)', borderBottom: 'var(--border-default)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                                        <span style={{ fontSize: '1.25rem' }}>{c.flag}</span>
                                        <div>
                                            <p style={{ fontSize: 'var(--text-body-size)', fontWeight: 900, color: 'var(--text-primary)' }}>{c.country}</p>
                                            <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>{c.law}</p>
                                        </div>
                                    </div>
                                    <Badge variant={c.badge}>{c.badge === 'warning' ? 'EN REFORMA' : 'VIGENTE'}</Badge>
                                </div>
                                <div style={{ padding: 'var(--space-12) var(--space-16)' }}>
                                    <p style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 'var(--space-8)' }}>Tus derechos</p>
                                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                                        {c.rights.map((right, i) => (
                                            <li key={i} style={{ display: 'flex', gap: 'var(--space-8)' }}>
                                                <span style={{ color: 'var(--state-primary)', fontWeight: 900, fontSize: 'var(--text-caption-size)', marginTop: 2, flexShrink: 0 }}>→</span>
                                                <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{right}</p>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div style={{ padding: 'var(--space-12) var(--space-16)', background: 'var(--surface-page)', borderTop: 'var(--border-default)' }}>
                                    <div style={{ display: 'flex', gap: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
                                        <AlertCircle size={14} style={{ color: 'var(--state-warning)', flexShrink: 0, marginTop: 2 }} />
                                        <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{c.notes}</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
                                        <Globe size={12} style={{ color: 'var(--text-muted)' }} />
                                        <a href={c.authorityUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--text-caption-size)', color: 'var(--state-primary)' }}>{c.authority}</a>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                <div>
                    <p style={sectionLabel}>Preguntas frecuentes</p>
                    <Card noPadding style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {FAQ.map((item, i) => (
                                <div key={i} style={{ borderTop: i > 0 ? 'var(--border-default)' : 'none' }}>
                                    <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-14) var(--space-16)', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background var(--transition-fast)' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-page)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        <span style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</span>
                                        {openFaq === i ? <ChevronUp size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                                    </button>
                                    {openFaq === i && (
                                        <div style={{ padding: '0 var(--space-16) var(--space-16)' }}>
                                            <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.content}</p>
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