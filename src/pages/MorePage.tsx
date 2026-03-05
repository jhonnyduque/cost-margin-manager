import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
    Calculator,
    Package,
    Layers,
    Settings,
    User,
    LogOut,
    HelpCircle,
    Info,
    ChevronRight,
    Shield,
    LucideIcon
} from 'lucide-react';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';

interface MenuItem {
    label: string;
    description?: string;
    icon: LucideIcon;
    iconBg: string;
    iconColor: string;
    path?: string;
    onClick?: () => void;
    badge?: string;
}

interface MenuSection {
    title: string;
    items: MenuItem[];
}

import { supabase } from '@/services/supabase';

export default function MorePage() {
    const { user, currentCompany } = useAuth();
    const navigate = useNavigate();

    const userName = user?.user_metadata?.full_name || user?.email || 'Usuario';
    const userEmail = user?.email || '';
    const isSuperAdmin = user?.is_super_admin;

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    // Build sections based on role
    const sections: MenuSection[] = [];

    // Section: Account
    sections.push({
        title: 'Cuenta',
        items: [
            {
                label: 'Settings',
                description: 'Configuración de la plataforma',
                icon: Settings,
                iconBg: 'bg-slate-100',
                iconColor: 'text-slate-600',
                path: '/settings'
            },
            ...(isSuperAdmin ? [{
                label: 'Admin Panel',
                description: 'Control de la plataforma',
                icon: Shield,
                iconBg: 'bg-indigo-50',
                iconColor: 'text-indigo-600',
                path: '/control-center',
                badge: 'Admin'
            } as MenuItem] : [])
        ]
    });

    // Section: Platform modules (not in bottom nav)
    const platformItems: MenuItem[] = [
        {
            label: 'Cost Manager',
            description: 'Dashboard de costos y análisis',
            icon: Calculator,
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            path: '/dashboard'
        },
        {
            label: 'Productos',
            description: 'Gestión de productos y precios',
            icon: Package,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            path: '/productos'
        },
        {
            label: 'Materias Primas',
            description: 'Inventario y lotes de materiales',
            icon: Layers,
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            path: '/materias-primas'
        }
    ];

    sections.push({
        title: 'Módulos',
        items: platformItems
    });

    // Section: Support
    sections.push({
        title: 'Soporte',
        items: [
            {
                label: 'Ayuda',
                description: 'Centro de ayuda y documentación',
                icon: HelpCircle,
                iconBg: 'bg-sky-50',
                iconColor: 'text-sky-600',
                path: '/help'
            },
            {
                label: 'Sobre BETO OS',
                description: `v1.0.0 · ${currentCompany?.name || 'Platform'}`,
                icon: Info,
                iconBg: 'bg-violet-50',
                iconColor: 'text-violet-600',
                path: '/about'
            }
        ]
    });

    return (
        <div className={`animate-in fade-in space-y-6 duration-500 pb-12 ${colors.bgMain}`}>
            {/* User card */}
            <div className={`flex items-center gap-3 ${radius.xl} ${colors.bgSurface} ${spacing.pMd} ${shadows.sm} border ${colors.borderStandard}`}>
                <div className={`flex size-12 items-center justify-center ${radius.pill} bg-indigo-600 text-white font-bold text-lg flex-shrink-0`}>
                    {userName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                    <p className={`${typography.body} font-bold ${colors.textPrimary} truncate`}>{userName}</p>
                    <p className={`${typography.caption} ${colors.textSecondary} truncate`}>{userEmail}</p>
                    {isSuperAdmin && (
                        <span className={`inline-flex items-center ${radius.pill} ${colors.bgMain} px-2 py-0.5 ${typography.caption} font-bold text-indigo-700 mt-1 border ${colors.borderStandard}`}>
                            Super Admin
                        </span>
                    )}
                </div>
            </div>

            {/* Sections */}
            {sections.map((section) => (
                <div key={section.title} className="space-y-2">
                    <h2 className={`${typography.uiLabel} ${colors.textSecondary} px-1`}>
                        {section.title}
                    </h2>
                    <div className={`${radius.xl} ${colors.bgSurface} ${shadows.sm} border ${colors.borderStandard} overflow-hidden divide-y ${colors.borderSubtle}`}>
                        {section.items.map((item) => (
                            <button
                                key={item.label}
                                onClick={() => {
                                    if (item.onClick) item.onClick();
                                    else if (item.path) navigate(item.path);
                                }}
                                className={`w-full flex items-center gap-3 ${spacing.pxMd} py-3.5 text-left hover:${colors.bgMain} active:opacity-80 transition-colors`}
                            >
                                <div className={`flex size-9 items-center justify-center ${radius.lg} ${item.iconBg} ${item.iconColor} flex-shrink-0`}>
                                    <item.icon size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className={`${typography.body} font-semibold ${colors.textPrimary}`}>{item.label}</p>
                                        {item.badge && (
                                            <span className={`inline-flex ${radius.pill} bg-indigo-50 px-1.5 py-0.5 ${typography.caption} font-bold text-indigo-600`}>
                                                {item.badge}
                                            </span>
                                        )}
                                    </div>
                                    {item.description && (
                                        <p className={`${typography.caption} ${colors.textSecondary}`}>{item.description}</p>
                                    )}
                                </div>
                                <ChevronRight size={16} className={`${colors.textMuted} flex-shrink-0`} />
                            </button>
                        ))}
                    </div>
                </div>
            ))}

            {/* Logout */}
            <div className={`${radius.xl} ${colors.bgSurface} ${shadows.sm} border ${colors.borderStandard} overflow-hidden`}>
                <button
                    onClick={handleLogout}
                    className={`w-full flex items-center gap-3 ${spacing.pxMd} py-3.5 text-left hover:${colors.bgDanger} hover:${colors.statusDanger} active:opacity-80 transition-colors group`}
                >
                    <div className={`flex size-9 items-center justify-center ${radius.lg} ${colors.bgDanger} ${colors.statusDanger} flex-shrink-0 group-hover:bg-white`}>
                        <LogOut size={18} />
                    </div>
                    <p className={`${typography.body} font-semibold ${colors.statusDanger} group-hover:text-red-700`}>Cerrar Sesión</p>
                </button>
            </div>

            {/* Bottom spacing for safe area */}
            <div className="h-4" />
        </div>
    );
}