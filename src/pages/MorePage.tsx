import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
    Settings,
    HelpCircle,
    ChevronRight,
    Shield,
    Activity,
    Lock,
    Scale,
    ShieldCheck,
    Search,
    Hexagon,
    LucideIcon,
    Users,
    BarChart3,
    Boxes,
    ShoppingCart,
    Building2,
    Contact2,
    Truck,
    Bot,
    CreditCard,
} from 'lucide-react';
import { colors, typography } from '@/design/design-tokens';
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
    badgeVariant?: 'neutral' | 'info' | 'success' | 'warning' | 'error';
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

    const sections: MenuSection[] = [
        {
            title: 'Cuenta y acceso',
            items: [
                {
                    label: 'Equipo',
                    description: 'Gestión de usuarios y permisos',
                    icon: Users,
                    iconBg: colors.bgInfo,
                    iconColor: colors.info,
                    path: '/equipo'
                },
                {
                    label: 'Facturación',
                    description: 'Suscripción, planes y pagos',
                    icon: CreditCard,
                    iconBg: 'bg-indigo-50',
                    iconColor: 'text-indigo-600',
                    path: '/platform/billing'
                },
                {
                    label: 'Settings',
                    description: 'Preferencias y seguridad',
                    icon: Settings,
                    iconBg: colors.bgBrandSubtle,
                    iconColor: colors.brand,
                    path: '/settings'
                },
                ...(isSuperAdmin ? [{
                    label: 'Admin Panel',
                    description: 'Gobernanza de la plataforma',
                    icon: Shield,
                    iconBg: colors.bgInfo,
                    iconColor: colors.info,
                    path: '/control-center',
                    badge: 'ADMIN',
                    badgeVariant: 'neutral' as const
                } as MenuItem] : [])
            ]
        },
        {
            title: 'Operación extendida',
            items: [
                {
                    label: 'Stock',
                    description: 'Inventario de productos terminados',
                    icon: Boxes,
                    iconBg: 'bg-amber-50',
                    iconColor: 'text-amber-600',
                    path: '/stock'
                },
                {
                    label: 'Compras',
                    description: 'Órdenes y abastecimiento',
                    icon: ShoppingCart,
                    iconBg: 'bg-orange-50',
                    iconColor: 'text-orange-600',
                    path: '/compras'
                },
                {
                    label: 'Proveedores',
                    description: 'Gestión de proveedores y acuerdos',
                    icon: Building2,
                    iconBg: 'bg-slate-100',
                    iconColor: 'text-slate-600',
                    path: '/proveedores'
                },
                {
                    label: 'Clientes',
                    description: 'Base comercial y contactos',
                    icon: Contact2,
                    iconBg: 'bg-violet-50',
                    iconColor: 'text-violet-600',
                    path: '/clientes'
                },
                {
                    label: 'Despachos',
                    description: 'Entregas y salidas operativas',
                    icon: Truck,
                    iconBg: 'bg-cyan-50',
                    iconColor: 'text-cyan-600',
                    path: '/despachos'
                },
                {
                    label: 'AI Consultants',
                    description: 'Asistencia inteligente para decisiones',
                    icon: Bot,
                    iconBg: 'bg-fuchsia-50',
                    iconColor: 'text-fuchsia-600',
                    path: '/ai'
                }
            ]
        },
        {
            title: 'Herramientas',
            items: [
                {
                    label: 'Reportes',
                    description: 'Ventas, márgenes y exportaciones',
                    icon: BarChart3,
                    iconBg: 'bg-emerald-50',
                    iconColor: 'text-emerald-600',
                    path: '/reportes',
                    comingSoon: true
                },
                {
                    label: 'Analytics',
                    description: 'Métricas y análisis del negocio',
                    icon: Activity,
                    iconBg: 'bg-cyan-50',
                    iconColor: 'text-cyan-600',
                    path: '/analytics'
                }
            ]
        },
        {
            title: 'Legal y cumplimiento',
            items: [
                {
                    label: 'Derechos de Datos',
                    description: 'Privacidad y GDPR',
                    icon: Lock,
                    iconBg: colors.bgDanger,
                    iconColor: colors.danger,
                    path: '/legal/privacy'
                },
                {
                    label: 'Asuntos Legales',
                    description: 'Términos y responsabilidad',
                    icon: Scale,
                    iconBg: colors.surfaceMuted,
                    iconColor: colors.textSecondary,
                    path: '/legal/terms'
                },
                {
                    label: 'Cumplimiento',
                    description: 'Protocolos de integridad AI',
                    icon: ShieldCheck,
                    iconBg: colors.bgInfo,
                    iconColor: colors.info,
                    path: '/legal/compliance',
                    badge: 'VERIFIED',
                    badgeVariant: 'success'
                }
            ]
        },
        {
            title: 'Soporte y sistema',
            items: [
                {
                    label: 'Ayuda',
                    description: 'Documentación y soporte',
                    icon: HelpCircle,
                    iconBg: 'bg-sky-50',
                    iconColor: 'text-sky-600',
                    path: '/help'
                },
                {
                    label: 'Estado del sistema',
                    description: 'Uptime 99.9% · Build v1.0.0',
                    icon: Activity,
                    iconBg: colors.bgSuccess,
                    iconColor: colors.success,
                    path: '/status'
                }
            ]
        }
    ];

    const filteredSections = search.trim()
        ? sections
            .map(s => ({
                ...s,
                items: s.items.filter(
                    item =>
                        item.label.toLowerCase().includes(search.toLowerCase()) ||
                        item.description?.toLowerCase().includes(search.toLowerCase())
                )
            }))
            .filter(s => s.items.length > 0)
        : sections;

    const MenuItemRow = ({ item }: { item: MenuItem }) => (
        <button
            onClick={() => {
                if (item.comingSoon) return;
                if (item.onClick) item.onClick();
                else if (item.path) navigate(item.path);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors group
                ${item.comingSoon
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-slate-50 active:bg-slate-100'
                }`}
        >
            <div className={`
                flex size-9 items-center justify-center rounded-xl flex-shrink-0
                ${item.iconBg} ${item.iconColor}
                border border-white/50 shadow-sm
                ${!item.comingSoon ? 'transition-transform duration-150 group-hover:scale-105' : ''}
            `}>
                <item.icon size={16} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className={`${typography.text.body} font-bold ${colors.textPrimary} truncate`}>
                        {item.label}
                    </span>
                    {item.badge && (
                        <Badge variant={item.badgeVariant || 'neutral'}>{item.badge}</Badge>
                    )}
                    {item.comingSoon && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            Pronto
                        </span>
                    )}
                </div>
                {item.description && (
                    <span className={`${typography.text.secondary} ${colors.textSecondary} truncate block`}>
                        {item.description}
                    </span>
                )}
            </div>
            {!item.comingSoon && (
                <ChevronRight size={14} className={`${colors.textMuted} flex-shrink-0 transition-transform duration-150 group-hover:translate-x-0.5`} />
            )}
        </button>
    );

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Más"
                    breadcrumbs={
                        <>
                            <span>BETO OS</span>
                            <span>/</span>
                            <span className={colors.textPrimary}>Más</span>
                        </>
                    }
                    metadata={[
                        <span key="1">Perfil, módulos y configuración</span>
                    ]}
                />

                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100 mb-4">
                    <div className="flex items-center gap-2.5 px-3 py-2 bg-white rounded-xl border border-slate-100 shadow-sm flex-shrink-0">
                        <div className={`
                            flex size-8 items-center justify-center rounded-xl flex-shrink-0
                            ${colors.bgBrandSubtle} ${colors.brand}
                            font-black uppercase text-xs border border-indigo-100
                        `}>
                            {userInitials}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className={`${typography.text.secondary} font-bold ${colors.textPrimary} truncate max-w-[140px]`}>
                                    {userName}
                                </span>
                                {isSuperAdmin && <Badge variant="warning">SUPER ADMIN</Badge>}
                            </div>
                            <span className={`${typography.text.micro} ${colors.textMuted} truncate block`}>{userEmail}</span>
                        </div>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                            <div className="size-1.5 rounded-full bg-emerald-500" />
                            <span className={`${typography.text.micro} ${colors.textMuted} font-bold uppercase tracking-wider`}>Activo</span>
                        </div>
                    </div>

                    <div className="relative flex-1 min-w-[180px]">
                        <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${colors.textMuted}`} />
                        <input
                            type="text"
                            placeholder="Buscar módulo o configuración..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className={`w-full h-9 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl ${typography.text.body} transition-all focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none`}
                        />
                    </div>
                </div>

                {filteredSections.length === 0 ? (
                    <div className="text-center py-10">
                        <p className={`${typography.text.body} ${colors.textMuted}`}>Sin resultados para "{search}"</p>
                    </div>
                ) : (
                    <>
                        <div className="hidden lg:grid lg:grid-cols-2 gap-4">
                            {filteredSections.map((section) => (
                                <div key={section.title}>
                                    <p className={`${typography.text.caption} ${colors.textMuted} px-1 mb-2`}>
                                        {section.title}
                                    </p>
                                    <Card noPadding className="overflow-hidden">
                                        <div className="divide-y divide-slate-100">
                                            {section.items.map(item => (
                                                <MenuItemRow key={item.label} item={item} />
                                            ))}
                                        </div>
                                    </Card>
                                </div>
                            ))}
                        </div>

                        <div className="lg:hidden space-y-4 pb-20">
                            {filteredSections.map((section) => (
                                <div key={section.title}>
                                    <p className={`${typography.text.caption} ${colors.textMuted} px-1 mb-2`}>
                                        {section.title}
                                    </p>
                                    <Card noPadding className="overflow-hidden">
                                        <div className="divide-y divide-slate-100">
                                            {section.items.map(item => (
                                                <MenuItemRow key={item.label} item={item} />
                                            ))}
                                        </div>
                                    </Card>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Hexagon className="h-6 w-6 text-indigo-500 fill-indigo-500/10 flex-shrink-0" />
                        <div>
                            <p className={`${typography.text.body} font-black ${colors.textPrimary} leading-none`}>BETO OS</p>
                            <p className={`${typography.text.micro} ${colors.textMuted} leading-none mt-1`}>
                                Gestión inteligente para tu negocio
                            </p>
                        </div>
                    </div>
                    <span className={`${typography.text.micro} ${colors.textMuted} font-medium uppercase`}>
                        v1.0.0 · {new Date().getFullYear()}
                    </span>
                </div>
            </SectionBlock>
        </PageContainer>
    );
}
