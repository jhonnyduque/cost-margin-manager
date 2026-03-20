import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
    Settings, HelpCircle, ChevronRight, Shield, Activity,
    Lock, Scale, ShieldCheck, Search, Hexagon, LucideIcon,
    Users, BarChart3, Boxes, ShoppingCart, Building2, Contact2,
    Truck, Bot, CreditCard,
} from 'lucide-react';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface MenuItem {
    label: string;
    description?: string;
    icon: LucideIcon;
    iconBg: string;
    iconColor: string;
    path?: string;
    onClick?: () => void;
    badge?: string;
    badgeVariant?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
    comingSoon?: boolean;
}

interface MenuSection {
    title: string;
    items: MenuItem[];
}

const GENERIC_NAMES = ['user', 'usuario', 'invitado', 'guest', 'admin', 'test'];
const isGenericName = (name: string) => GENERIC_NAMES.includes(name.trim().toLowerCase());

export default function MorePage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');

    const email = user?.email || '';
    const fullName = user?.user_metadata?.full_name;
    const userName = (fullName && !isGenericName(fullName)) ? fullName : (email.split('@')[0] || 'Usuario');
    const userEmail = email;
    const userInitials = email
        ? email.split('@')[0].slice(0, 2).toUpperCase()
        : (fullName && !isGenericName(fullName) ? fullName.slice(0, 2).toUpperCase() : 'OS');
    const isSuperAdmin = user?.is_super_admin;

    const ic = {
        blue: { bg: 'var(--surface-primary-soft)', color: 'var(--state-primary)' },
        green: { bg: 'var(--surface-success-soft)', color: 'var(--state-success)' },
        amber: { bg: 'var(--surface-warning-soft)', color: 'var(--state-warning)' },
        red: { bg: 'var(--surface-danger-soft)', color: 'var(--state-danger)' },
        info: { bg: 'var(--surface-info-soft)', color: 'var(--state-info)' },
        slate: { bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
        orange: { bg: '#fff7ed', color: '#ea580c' },
        violet: { bg: '#f5f3ff', color: '#7c3aed' },
        cyan: { bg: '#ecfeff', color: '#0891b2' },
        sky: { bg: '#f0f9ff', color: '#0284c7' },
        fuchsia: { bg: '#fdf4ff', color: '#c026d3' },
        emerald: { bg: '#f0fdf4', color: '#059669' },
    };

    const sections: MenuSection[] = [
        {
            title: 'Cuenta y acceso',
            items: [
                { label: 'Equipo', description: 'Gestión de usuarios y permisos', icon: Users, iconBg: ic.info.bg, iconColor: ic.info.color, path: '/equipo' },
                { label: 'Facturación', description: 'Suscripción, planes y pagos', icon: CreditCard, iconBg: ic.blue.bg, iconColor: ic.blue.color, path: '/platform/billing' },
                { label: 'Settings', description: 'Preferencias y seguridad', icon: Settings, iconBg: ic.blue.bg, iconColor: ic.blue.color, path: '/settings' },
                ...(isSuperAdmin ? [{ label: 'Admin Panel', description: 'Gobernanza de la plataforma', icon: Shield, iconBg: ic.info.bg, iconColor: ic.info.color, path: '/control-center', badge: 'ADMIN', badgeVariant: 'neutral' as const } as MenuItem] : []),
            ],
        },
        {
            title: 'Operación extendida',
            items: [
                { label: 'Stock', description: 'Inventario de productos terminados', icon: Boxes, iconBg: ic.amber.bg, iconColor: ic.amber.color, path: '/stock' },
                { label: 'Compras', description: 'Órdenes y abastecimiento', icon: ShoppingCart, iconBg: ic.orange.bg, iconColor: ic.orange.color, path: '/compras' },
                { label: 'Proveedores', description: 'Gestión de proveedores y acuerdos', icon: Building2, iconBg: ic.slate.bg, iconColor: ic.slate.color, path: '/proveedores' },
                { label: 'Clientes', description: 'Base comercial y contactos', icon: Contact2, iconBg: ic.violet.bg, iconColor: ic.violet.color, path: '/clientes' },
                { label: 'Despachos', description: 'Entregas y salidas operativas', icon: Truck, iconBg: ic.cyan.bg, iconColor: ic.cyan.color, path: '/despachos' },
                { label: 'AI Consultants', description: 'Asistencia inteligente', icon: Bot, iconBg: ic.fuchsia.bg, iconColor: ic.fuchsia.color, path: '/ai' },
            ],
        },
        {
            title: 'Herramientas',
            items: [
                { label: 'Reportes', description: 'Ventas, márgenes y exportaciones', icon: BarChart3, iconBg: ic.emerald.bg, iconColor: ic.emerald.color, path: '/reportes' },
                { label: 'Analytics', description: 'Métricas y análisis del negocio', icon: Activity, iconBg: ic.cyan.bg, iconColor: ic.cyan.color, path: '/analytics' },
            ],
        },
        {
            title: 'Legal y cumplimiento',
            items: [
                { label: 'Derechos de Datos', description: 'Privacidad y GDPR', icon: Lock, iconBg: ic.red.bg, iconColor: ic.red.color, path: '/legal/privacy' },
                { label: 'Asuntos Legales', description: 'Términos y responsabilidad', icon: Scale, iconBg: ic.slate.bg, iconColor: ic.slate.color, path: '/legal/terms' },
                { label: 'Cumplimiento', description: 'Protocolos de integridad AI', icon: ShieldCheck, iconBg: ic.info.bg, iconColor: ic.info.color, path: '/legal/compliance', badge: 'VERIFIED', badgeVariant: 'success' },
            ],
        },
        {
            title: 'Soporte y sistema',
            items: [
                { label: 'Ayuda', description: 'Documentación y soporte', icon: HelpCircle, iconBg: ic.sky.bg, iconColor: ic.sky.color, path: '/help' },
                { label: 'Estado del sistema', description: 'Uptime 99.9% · Build v1.0.0', icon: Activity, iconBg: ic.green.bg, iconColor: ic.green.color, path: '/status' },
            ],
        },
    ];

    const filteredSections = search.trim()
        ? sections.map(s => ({ ...s, items: s.items.filter(i => i.label.toLowerCase().includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase())) })).filter(s => s.items.length > 0)
        : sections;

    const MenuItemRow = ({ item }: { item: MenuItem }) => (
        <button
            onClick={() => { if (item.comingSoon) return; if (item.onClick) item.onClick(); else if (item.path) navigate(item.path); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-12)', padding: 'var(--space-12) var(--space-16)', textAlign: 'left', background: 'transparent', border: 'none', cursor: item.comingSoon ? 'not-allowed' : 'pointer', opacity: item.comingSoon ? 0.4 : 1, transition: 'background var(--transition-fast)' }}
            onMouseEnter={e => { if (!item.comingSoon) e.currentTarget.style.background = 'var(--surface-page)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
            <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: 'var(--radius-lg)', background: item.iconBg, color: item.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(255,255,255,0.5)', boxShadow: 'var(--shadow-sm)' }}>
                <item.icon size={16} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                    <span style={{ fontSize: 'var(--text-body-size)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.label}
                    </span>
                    {item.badge && <Badge variant={item.badgeVariant || 'neutral'}>{item.badge}</Badge>}
                    {item.comingSoon && (
                        <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', background: 'var(--surface-muted)', padding: '2px var(--space-6)', borderRadius: 'var(--radius-xs)' }}>
                            Pronto
                        </span>
                    )}
                </div>
                {item.description && (
                    <span className="text-small text-muted" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.description}
                    </span>
                )}
            </div>
            {!item.comingSoon && <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
        </button>
    );

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Más"
                    breadcrumbs={<><span>BETO OS</span><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Más</span></>}
                    metadata={[<span key="1">Perfil, módulos y configuración</span>]}
                />

                {/* Toolbar */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-12)', paddingTop: 'var(--space-16)', borderTop: 'var(--border-default)', marginBottom: 'var(--space-16)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', padding: 'var(--space-8) var(--space-12)', background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', border: 'var(--border-default)', boxShadow: 'var(--shadow-sm)', flexShrink: 0 }}>
                        <div style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface-primary-soft)', color: 'var(--state-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', border: '1px solid rgba(37,99,235,0.15)', flexShrink: 0 }}>
                            {userInitials}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
                                <span style={{ fontSize: 'var(--text-small-size)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '9rem' }}>{userName}</span>
                                {isSuperAdmin && <Badge variant="warning">SUPER ADMIN</Badge>}
                            </div>
                            <span className="text-small text-muted" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginLeft: 'var(--space-8)', flexShrink: 0 }}>
                            <div style={{ width: '0.375rem', height: '0.375rem', borderRadius: '50%', background: 'var(--state-success)' }} />
                            <span className="text-small text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Activo</span>
                        </div>
                    </div>

                    <div style={{ position: 'relative', flex: 1, minWidth: '11rem' }}>
                        <Search size={14} style={{ position: 'absolute', left: 'var(--space-12)', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input type="text" placeholder="Buscar módulo o configuración..." value={search} onChange={e => setSearch(e.target.value)}
                            className="input" style={{ paddingLeft: 'var(--space-32)', height: '2.25rem' }} />
                    </div>
                </div>

                {filteredSections.length === 0 ? (
                    <div className="empty-state">
                        <p className="text-muted">Sin resultados para "{search}"</p>
                    </div>
                ) : (
                    /* CSS columns — flujo masonry, sin espacios en blanco */
                    <div style={{ columns: '2 18rem', gap: 'var(--space-16)' }}>
                        {filteredSections.map(section => (
                            <div key={section.title} style={{ breakInside: 'avoid', marginBottom: 'var(--space-16)' }}>
                                <p className="text-small text-muted" style={{ padding: '0 var(--space-4)', marginBottom: 'var(--space-8)' }}>{section.title}</p>
                                <Card style={{ padding: 0, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {section.items.map((item, i) => (
                                            <div key={item.label} style={{ borderTop: i > 0 ? 'var(--border-default)' : 'none' }}>
                                                <MenuItemRow item={item} />
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer */}
                <div style={{ marginTop: 'var(--space-24)', paddingTop: 'var(--space-16)', borderTop: 'var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)' }}>
                        <Hexagon style={{ width: '1.5rem', height: '1.5rem', color: 'var(--state-primary)', flexShrink: 0 }} />
                        <div>
                            <p style={{ fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1, fontSize: 'var(--text-body-size)' }}>BETO OS</p>
                            <p className="text-small text-muted" style={{ lineHeight: 1, marginTop: 'var(--space-4)' }}>Gestión inteligente para tu negocio</p>
                        </div>
                    </div>
                    <span className="text-small text-muted" style={{ fontWeight: 500, textTransform: 'uppercase' }}>v1.0.0 · {new Date().getFullYear()}</span>
                </div>
            </SectionBlock>
        </PageContainer>
    );
}