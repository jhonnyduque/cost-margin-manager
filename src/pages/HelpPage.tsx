import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronLeft, HelpCircle, MessageSquare, BookOpen,
    ChevronDown, ChevronUp, Mail, Clock, Package,
    Layers, Calculator, CreditCard, Users, Settings
} from 'lucide-react';
import { colors, typography, spacing } from '@/design/design-tokens';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface FaqItem {
    question: string;
    answer: string;
    category: string;
}

interface DocLink {
    icon: React.ElementType;
    title: string;
    description: string;
    iconBg: string;
    iconColor: string;
}

const CATEGORIES = ['Todos', 'Inventario', 'Productos', 'Facturación', 'Cuenta'];

const FAQ: FaqItem[] = [
    {
        category: 'Inventario',
        question: '¿Cómo funciona el costeo FIFO en BETO OS?',
        answer: 'FIFO (First In, First Out) significa que el primer lote de materia prima que entra es el primero que se consume al producir. BETO OS gestiona esto automáticamente: al registrar una producción, el sistema descuenta primero del lote más antiguo disponible. Esto refleja el costo real del inventario y evita que lotes viejos queden "congelados".',
    },
    {
        category: 'Inventario',
        question: '¿Qué es el stock de seguridad y cómo configurarlo?',
        answer: 'El stock de seguridad es el nivel mínimo de inventario que debe mantenerse para evitar paros de producción. En BETO OS, puedes configurarlo por materia prima desde la sección de Materias Primas. Cuando el stock cae por debajo de ese umbral, el sistema genera una alerta automática en el dashboard.',
    },
    {
        category: 'Inventario',
        question: '¿Puedo registrar una entrada de stock sin factura?',
        answer: 'Sí. Puedes registrar entradas de stock como "ajuste de inventario" sin necesidad de asociarlas a una factura de compra. Sin embargo, para un costeo FIFO preciso, recomendamos registrar siempre el precio de compra del lote para que el cálculo de costo de producción sea correcto.',
    },
    {
        category: 'Productos',
        question: '¿Cómo calcula BETO OS el margen de un producto?',
        answer: 'El margen se calcula como: (Precio de Venta - Costo Total) / Precio de Venta × 100. El costo total incluye materias primas (valoradas con FIFO), costos directos adicionales y el porcentaje de overhead configurado. El sistema compara automáticamente el margen real contra tu margen objetivo (target_margin) y alerta si hay desvíos.',
    },
    {
        category: 'Productos',
        question: '¿Qué significa "drift de margen" en el dashboard?',
        answer: 'El drift de margen indica que el margen real de un producto se ha alejado significativamente del margen objetivo. Esto puede deberse a una subida en el costo de materias primas, un precio de venta desactualizado, o cambios en la fórmula del producto. BETO OS te muestra el impacto financiero estimado mensual para que puedas priorizar correcciones.',
    },
    {
        category: 'Facturación',
        question: '¿Puedo cambiar de plan en cualquier momento?',
        answer: 'Sí. Puedes hacer upgrade o downgrade de plan desde la sección Billing. Los upgrades aplican inmediatamente con prorrateo del período en curso. Los downgrades aplican al inicio del siguiente ciclo de facturación. Si el nuevo plan tiene menos seats que usuarios activos, deberás eliminar usuarios antes de confirmar el downgrade.',
    },
    {
        category: 'Facturación',
        question: '¿Cómo obtengo una factura de mi suscripción?',
        answer: 'Las facturas se generan automáticamente con cada cobro y están disponibles en Billing → Historial de facturas. Puedes descargarlas en PDF. Si necesitas que la factura incluya datos fiscales específicos (NIF, razón social), actualízalos en Billing → Datos de facturación antes del próximo ciclo.',
    },
    {
        category: 'Cuenta',
        question: '¿Cómo invitar a un nuevo miembro del equipo?',
        answer: 'Ve a Equipo → Invitar Miembro. Introduce el email, nombre y rol (Operator, Manager, etc.). El invitado recibirá un email con instrucciones para crear su cuenta. El número máximo de usuarios depende de tu plan actual. Si has alcanzado el límite, deberás hacer upgrade o eliminar un usuario existente.',
    },
    {
        category: 'Cuenta',
        question: '¿Qué diferencia hay entre los roles de usuario?',
        answer: 'Owner/Admin: acceso total, puede invitar y eliminar usuarios, cambiar plan, ver toda la información financiera. Manager: puede crear y editar productos, registrar entradas de stock y ver dashboards. Operator: puede registrar producciones y movimientos de stock, pero no puede editar configuración ni ver datos financieros sensibles. Viewer: solo lectura.',
    },
];

const DOC_LINKS: DocLink[] = [
    {
        icon: Calculator,
        title: 'Costeo FIFO',
        description: 'Cómo funciona el motor de costos y cómo interpretar los resultados.',
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-700',
    },
    {
        icon: Package,
        title: 'Productos',
        description: 'Crear productos, configurar fórmulas y gestionar márgenes.',
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-700',
    },
    {
        icon: Layers,
        title: 'Inventario',
        description: 'Entradas de stock, ajustes, alertas y seguimiento de lotes.',
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-700',
    },
    {
        icon: CreditCard,
        title: 'Facturación',
        description: 'Planes disponibles, upgrades, facturas y datos de pago.',
        iconBg: 'bg-indigo-50',
        iconColor: 'text-indigo-700',
    },
    {
        icon: Users,
        title: 'Equipo',
        description: 'Roles, permisos e invitación de miembros.',
        iconBg: 'bg-violet-50',
        iconColor: 'text-violet-700',
    },
    {
        icon: Settings,
        title: 'Configuración',
        description: 'Multi-empresa, integraciones y preferencias de cuenta.',
        iconBg: 'bg-slate-100',
        iconColor: 'text-slate-600',
    },
];

export default function HelpPage() {
    const navigate = useNavigate();
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [activeCategory, setActiveCategory] = useState('Todos');
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactMessage, setContactMessage] = useState('');
    const [sent, setSent] = useState(false);

    const filteredFaq = activeCategory === 'Todos'
        ? FAQ
        : FAQ.filter(f => f.category === activeCategory);

    const handleContact = (e: React.MouseEvent) => {
        e.preventDefault();
        // TODO: conectar con endpoint de soporte
        setSent(true);
        setContactName('');
        setContactEmail('');
        setContactMessage('');
    };

    return (
        <PageContainer>
            <SectionBlock>

                <UniversalPageHeader
                    title="Ayuda y Soporte"
                    breadcrumbs={
                        <>
                            <span>BETO OS</span>
                            <span>/</span>
                            <span>Más</span>
                            <span>/</span>
                            <span className={colors.textPrimary}>Ayuda</span>
                        </>
                    }
                    metadata={[
                        <span key="1">Documentación · FAQ · Contacto</span>,
                        <span key="2">Soporte disponible lun–vie 9h–18h (CET)</span>
                    ]}
                    actions={
                        <Button variant="secondary" size="sm" onClick={() => navigate('/mas')} icon={<ChevronLeft size={16} />}>
                            Volver
                        </Button>
                    }
                />

                {/* ── DOCUMENTACIÓN ─────────────────────────────────────── */}
                <div className="pt-6 border-t border-slate-100">
                    <p className={`text-[10px] font-black ${colors.textMuted} uppercase tracking-[0.18em] px-1 mb-3`}>
                        Documentación
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        {DOC_LINKS.map((doc) => (
                            <button
                                key={doc.title}
                                className="flex flex-col items-start gap-3 px-4 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left group"
                            >
                                {/* Icono arriba */}
                                <div className={`flex size-9 items-center justify-center rounded-xl ${doc.iconBg} ${doc.iconColor}`}>
                                    <doc.icon size={16} />
                                </div>
                                {/* Texto abajo */}
                                <span className={`text-[12px] font-bold ${colors.textPrimary} leading-snug`}>
                                    {doc.title}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── FAQ ───────────────────────────────────────────────── */}
                <div>
                    <p className={`text-[10px] font-black ${colors.textMuted} uppercase tracking-[0.18em] px-1 mb-3`}>
                        Preguntas frecuentes
                    </p>

                    {/* Filtros de categoría */}
                    <div className="flex gap-2 flex-wrap mb-3">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => { setActiveCategory(cat); setOpenFaq(null); }}
                                className={`
                                    px-3 py-1 rounded-full text-xs font-bold transition-colors
                                    ${activeCategory === cat
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }
                                `}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <Card noPadding className="overflow-hidden">
                        <div className="divide-y divide-slate-100">
                            {filteredFaq.map((item, i) => (
                                <div key={i}>
                                    <button
                                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                        className="w-full flex items-start justify-between px-4 py-3.5 text-left hover:bg-slate-50 transition-colors gap-3"
                                    >
                                        <div className="flex-1">
                                            <span className={`${typography.body} font-semibold ${colors.textPrimary} block`}>
                                                {item.question}
                                            </span>
                                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mt-0.5 block">
                                                {item.category}
                                            </span>
                                        </div>
                                        {openFaq === i
                                            ? <ChevronUp size={16} className={`${colors.textMuted} flex-shrink-0 mt-1`} />
                                            : <ChevronDown size={16} className={`${colors.textMuted} flex-shrink-0 mt-1`} />
                                        }
                                    </button>
                                    {openFaq === i && (
                                        <div className="px-4 pb-4">
                                            <p className={`${typography.caption} ${colors.textSecondary} normal-case tracking-normal leading-relaxed`}>
                                                {item.answer}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* ── CONTACTO ──────────────────────────────────────────── */}
                <div>
                    <p className={`text-[10px] font-black ${colors.textMuted} uppercase tracking-[0.18em] px-1 mb-3`}>
                        Contactar soporte
                    </p>

                    {sent ? (
                        <Card className="bg-emerald-50 border-emerald-100 text-center py-6">
                            <div className="flex flex-col items-center gap-2">
                                <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <MessageSquare size={18} className="text-emerald-600" />
                                </div>
                                <p className={`${typography.body} font-black text-emerald-900`}>
                                    Mensaje enviado
                                </p>
                                <p className={`${typography.caption} text-emerald-700 normal-case tracking-normal`}>
                                    Te responderemos en 24–48 h hábiles.
                                </p>
                                <button
                                    onClick={() => setSent(false)}
                                    className="mt-2 text-xs font-bold text-emerald-600 underline"
                                >
                                    Enviar otro mensaje
                                </button>
                            </div>
                        </Card>
                    ) : (
                        <Card noPadding className="overflow-hidden">
                            <div className="px-4 py-4 space-y-3">
                                <input
                                    type="text"
                                    placeholder="Tu nombre"
                                    value={contactName}
                                    onChange={e => setContactName(e.target.value)}
                                    className={`w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl ${typography.body} transition-all focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none`}
                                />
                                <input
                                    type="email"
                                    placeholder="Tu email"
                                    value={contactEmail}
                                    onChange={e => setContactEmail(e.target.value)}
                                    className={`w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl ${typography.body} transition-all focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none`}
                                />
                                <textarea
                                    placeholder="¿En qué podemos ayudarte?"
                                    value={contactMessage}
                                    onChange={e => setContactMessage(e.target.value)}
                                    rows={4}
                                    className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl ${typography.body} transition-all focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none resize-none`}
                                />
                                <button
                                    onClick={handleContact}
                                    disabled={!contactName || !contactEmail || !contactMessage}
                                    className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    <Mail size={16} />
                                    Enviar mensaje
                                </button>
                            </div>

                            {/* Info respuesta */}
                            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                                <Clock size={14} className={colors.textMuted} />
                                <p className={`${typography.caption} ${colors.textMuted} normal-case tracking-normal`}>
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