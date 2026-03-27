import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    ChevronLeft, MessageSquare, BookOpen,
    ChevronDown, ChevronUp, Mail, Clock, Package,
    Layers, Calculator, CreditCard, Users, Settings, Loader2,
} from 'lucide-react';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';

interface FaqItem { question: string; answer: string; category: string; }
interface DocLink { icon: React.ElementType; title: string; description: string; iconBg: string; iconColor: string; }

const CATEGORIES = ['Todos', 'Inventario', 'Productos', 'Facturación', 'Cuenta'];

const FAQ: FaqItem[] = [
    { category: 'Inventario', question: '¿Cómo funciona el costeo FIFO en BETO OS?', answer: 'FIFO (First In, First Out) significa que el primer lote de materia prima que entra es el primero que se consume al producir. BETO OS gestiona esto automáticamente: al registrar una producción, el sistema descuenta primero del lote más antiguo disponible. Esto refleja el costo real del inventario y evita que lotes viejos queden \"congelados\".' },
    { category: 'Inventario', question: '¿Qué es el stock de seguridad y cómo configurarlo?', answer: 'El stock de seguridad es el nivel mínimo de inventario que debe mantenerse para evitar paros de producción. En BETO OS, puedes configurarlo por materia prima desde la sección de Materias Primas. Cuando el stock cae por debajo de ese umbral, el sistema genera una alerta automática en el dashboard.' },
    { category: 'Inventario', question: '¿Puedo registrar una entrada de stock sin factura?', answer: 'Sí. Puedes registrar entradas de stock como \"ajuste de inventario\" sin necesidad de asociarlas a una factura de compra. Sin embargo, para un costeo FIFO preciso, recomendamos registrar siempre el precio de compra del lote para que el cálculo de costo de producción sea correcto.' },
    { category: 'Productos', question: '¿Cómo calcula BETO OS el margen de un producto?', answer: 'El margen se calcula como: (Precio de Venta - Costo Total) / Precio de Venta × 100. El costo total incluye materias primas (valoradas con FIFO), costos directos adicionales y el porcentaje de overhead configurado. El sistema compara automáticamente el margen real contra tu margen objetivo y alerta si hay desvíos.' },
    { category: 'Productos', question: '¿Qué significa \"drift de margen\" en el dashboard?', answer: 'El drift de margen indica que el margen real de un producto se ha alejado significativamente del margen objetivo. Esto puede deberse a una subida en el costo de materias primas, un precio de venta desactualizado, o cambios en la fórmula del producto. BETO OS te muestra el impacto financiero estimado mensual para que puedas priorizar correcciones.' },
    { category: 'Facturación', question: '¿Puedo cambiar de plan en cualquier momento?', answer: 'Sí. Puedes hacer upgrade o downgrade de plan desde la sección Billing. Los upgrades aplican inmediatamente con prorrateo del período en curso. Los downgrades aplican al inicio del siguiente ciclo de facturación. Si el nuevo plan tiene menos seats que usuarios activos, deberás eliminar usuarios antes de confirmar el downgrade.' },
    { category: 'Facturación', question: '¿Cómo obtengo una factura de mi suscripción?', answer: 'Las facturas se generan automáticamente con cada cobro y están disponibles en Billing → Historial de facturas. Puedes descargarlas en PDF. Si necesitas que la factura incluya datos fiscales específicos (NIF, razón social), actualízalos en Billing → Datos de facturación antes del próximo ciclo.' },
    { category: 'Cuenta', question: '¿Cómo invitar a un nuevo miembro del equipo?', answer: 'Ve a Equipo → Invitar Miembro. Introduce el email, nombre y rol (Operator, Manager, etc.). El invitado recibirá un email con instrucciones para crear su cuenta. El número máximo de usuarios depende de tu plan actual.' },
    { category: 'Cuenta', question: '¿Qué diferencia hay entre los roles de usuario?', answer: 'Owner/Admin: acceso total, puede invitar y eliminar usuarios, cambiar plan. Manager: puede crear y editar productos, registrar entradas de stock y ver dashboards. Operator: puede registrar producciones y movimientos de stock. Viewer: solo lectura.' },
];

const DOC_LINKS: DocLink[] = [
    { icon: Calculator, title: 'Costeo FIFO', description: 'Cómo funciona el motor de costos.', iconBg: 'var(--surface-success-soft)', iconColor: 'var(--state-success)' },
    { icon: Package, title: 'Productos', description: 'Crear productos y gestionar márgenes.', iconBg: 'var(--surface-primary-soft)', iconColor: 'var(--state-primary)' },
    { icon: Layers, title: 'Inventario', description: 'Entradas de stock, ajustes y lotes.', iconBg: 'var(--surface-warning-soft)', iconColor: 'var(--state-warning)' },
    { icon: CreditCard, title: 'Facturación', description: 'Planes, upgrades y facturas.', iconBg: '#eef2ff', iconColor: '#4338ca' },
    { icon: Users, title: 'Equipo', description: 'Roles, permisos e invitaciones.', iconBg: '#f5f3ff', iconColor: '#7c3aed' },
    { icon: Settings, title: 'Configuración', description: 'Multi-empresa y preferencias de cuenta.', iconBg: 'var(--surface-muted)', iconColor: 'var(--text-secondary)' },
];

export default function HelpPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, currentCompany } = useAuth();
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [activeCategory, setActiveCategory] = useState('Todos');
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactMessage, setContactMessage] = useState('');
    const [sent, setSent] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const filteredFaq = activeCategory === 'Todos' ? FAQ : FAQ.filter(f => f.category === activeCategory);

    const handleContact = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!user || !contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) return;

        setSending(true);
        setError(null);

        try {
            const { error: insertError } = await supabase.from('support_tickets').insert({
                user_id: user.id,
                company_id: currentCompany?.id || null,
                user_name: contactName.trim(),
                user_email: contactEmail.trim(),
                subject: 'Soporte General',
                message: contactMessage.trim(),
                priority: 'medium',
                metadata: {
                    page: location.pathname,
                    company_name: currentCompany?.name || null,
                    plan: currentCompany?.subscription_tier || null,
                    user_agent: navigator.userAgent,
                },
            });

            if (insertError) throw insertError;

            setSent(true);
            setContactName('');
            setContactEmail('');
            setContactMessage('');
        } catch (err: any) {
            console.error('Error creating support ticket:', err);
            setError('No pudimos enviar tu mensaje. Intenta de nuevo.');
        } finally {
            setSending(false);
        }
    };

    const inputCls = "input";

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Ayuda y Soporte"
                    breadcrumbs={<><span>BETO OS</span><span>/</span><span>Más</span><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Ayuda</span></>}
                    metadata={[<span key="1">Documentación · FAQ · Contacto</span>, <span key="2">Soporte disponible lun–vie 9h–18h (CET)</span>]}
                    actions={<Button variant="secondary" size="sm" onClick={() => navigate('/mas')} icon={<ChevronLeft size={16} />}>Volver</Button>}
                />

                {/* Documentación */}
                <div style={{ paddingTop: 'var(--space-24)', borderTop: 'var(--border-default)' }}>
                    <p style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.18em', padding: '0 var(--space-4)', marginBottom: 'var(--space-12)' }}>
                        Documentación
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-12)' }}>
                        {DOC_LINKS.map(doc => (
                            <button key={doc.title}
                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-12)', padding: 'var(--space-16)', background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', textAlign: 'left', transition: 'border-color var(--transition-fast), background var(--transition-fast)' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-color-primary)'; e.currentTarget.style.background = 'var(--surface-page)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color-default)'; e.currentTarget.style.background = 'var(--surface-card)'; }}>
                                <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: 'var(--radius-lg)', background: doc.iconBg, color: doc.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <doc.icon size={16} />
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{doc.title}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* FAQ */}
                <div>
                    <p style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.18em', padding: '0 var(--space-4)', marginBottom: 'var(--space-12)' }}>
                        Preguntas frecuentes
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap', marginBottom: 'var(--space-12)' }}>
                        {CATEGORIES.map(cat => (
                            <button key={cat} onClick={() => { setActiveCategory(cat); setOpenFaq(null); }}
                                style={{ padding: 'var(--space-4) var(--space-12)', borderRadius: 'var(--radius-full)', fontSize: 'var(--text-caption-size)', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'background var(--transition-fast), color var(--transition-fast)', background: activeCategory === cat ? 'var(--state-primary)' : 'var(--surface-muted)', color: activeCategory === cat ? 'var(--text-inverse)' : 'var(--text-secondary)' }}>
                                {cat}
                            </button>
                        ))}
                    </div>
                    <Card noPadding style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {filteredFaq.map((item, i) => (
                                <div key={i} style={{ borderTop: i > 0 ? 'var(--border-default)' : 'none' }}>
                                    <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                        style={{ width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: 'var(--space-14) var(--space-16)', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', gap: 'var(--space-12)', transition: 'background var(--transition-fast)' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-page)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        <div style={{ flex: 1 }}>
                                            <span style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>{item.question}</span>
                                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--state-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 'var(--space-2)', display: 'block' }}>{item.category}</span>
                                        </div>
                                        {openFaq === i
                                            ? <ChevronUp size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
                                            : <ChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />}
                                    </button>
                                    {openFaq === i && (
                                        <div style={{ padding: '0 var(--space-16) var(--space-16)' }}>
                                            <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.answer}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Contacto */}
                <div>
                    <p style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.18em', padding: '0 var(--space-4)', marginBottom: 'var(--space-12)' }}>
                        Contactar soporte
                    </p>
                    {sent ? (
                        <Card style={{ background: 'var(--surface-success-soft)', borderColor: 'var(--border-color-success)', textAlign: 'center', padding: 'var(--space-24)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-8)' }}>
                                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'rgba(22,163,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <MessageSquare size={18} style={{ color: 'var(--state-success)' }} />
                                </div>
                                <p style={{ fontWeight: 900, color: 'var(--state-success)', fontSize: 'var(--text-body-size)' }}>Mensaje enviado</p>
                                <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--state-success)', opacity: 0.8 }}>Te responderemos en 24–48 h hábiles.</p>
                                <button onClick={() => setSent(false)} style={{ marginTop: 'var(--space-8)', fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--state-success)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
                                    Enviar otro mensaje
                                </button>
                            </div>
                        </Card>
                    ) : (
                        <Card noPadding style={{ overflow: 'hidden' }}>
                            <div style={{ padding: 'var(--space-16)', display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
                                <input type="text" placeholder="Tu nombre" value={contactName} onChange={e => setContactName(e.target.value)} className={inputCls} />
                                <input type="email" placeholder="Tu email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={inputCls} />
                                <textarea placeholder="¿En qué podemos ayudarte?" value={contactMessage} onChange={e => setContactMessage(e.target.value)} rows={4}
                                    className="input textarea" />
                                <button onClick={handleContact} disabled={sending || !contactName || !contactEmail || !contactMessage}
                                    style={{ width: '100%', height: '2.75rem', background: 'var(--state-primary)', color: 'var(--text-inverse)', fontSize: 'var(--text-small-size)', fontWeight: 700, borderRadius: 'var(--radius-lg)', border: 'none', cursor: sending ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)', transition: 'background var(--transition-fast)', opacity: (sending || !contactName || !contactEmail || !contactMessage) ? 0.4 : 1 }}
                                    onMouseEnter={e => { if (!sending && contactName && contactEmail && contactMessage) e.currentTarget.style.background = 'var(--state-primary-hover)'; }}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--state-primary)')}>
                                    {sending ? <><Loader2 size={16} className="animate-spin" /> Enviando...</> : <><Mail size={16} /> Enviar mensaje</>}
                                </button>
                                {error && (
                                    <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--state-danger)', fontWeight: 600, textAlign: 'center' }}>{error}</p>
                                )}
                            </div>
                            <div style={{ padding: 'var(--space-12) var(--space-16)', background: 'var(--surface-page)', borderTop: 'var(--border-default)', display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                                <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                                <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>
                                    Tiempo de respuesta: 24–48 h hábiles · soporte@betoos.com
                                </p>
                            </div>
                        </Card>
                    )}
                </div>
            </SectionBlock>
        </PageContainer>
    );
}