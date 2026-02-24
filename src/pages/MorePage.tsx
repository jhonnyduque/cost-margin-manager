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

export default function MorePage() {
    const { user, currentCompany, logout } = useAuth();
    const navigate = useNavigate();

    const userName = user?.user_metadata?.full_name || user?.email || 'Usuario';
    const userEmail = user?.email || '';
    const isSuperAdmin = user?.is_super_admin;

    const handleLogout = async () => {
        await logout();
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
        <div className="animate-in fade-in space-y-6 duration-500">
            {/* User card */}
            <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <div className="flex size-12 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-lg flex-shrink-0">
                    {userName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 truncate">{userName}</p>
                    <p className="text-xs text-slate-500 truncate">{userEmail}</p>
                    {isSuperAdmin && (
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 mt-1">
                            Super Admin
                        </span>
                    )}
                </div>
            </div>

            {/* Sections */}
            {sections.map((section) => (
                <div key={section.title}>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
                        {section.title}
                    </h2>
                    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden divide-y divide-slate-100">
                        {section.items.map((item) => (
                            <button
                                key={item.label}
                                onClick={() => {
                                    if (item.onClick) item.onClick();
                                    else if (item.path) navigate(item.path);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors"
                            >
                                <div className={`flex size-9 items-center justify-center rounded-xl ${item.iconBg} ${item.iconColor} flex-shrink-0`}>
                                    <item.icon size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                                        {item.badge && (
                                            <span className="inline-flex rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">
                                                {item.badge}
                                            </span>
                                        )}
                                    </div>
                                    {item.description && (
                                        <p className="text-xs text-slate-400">{item.description}</p>
                                    )}
                                </div>
                                <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                            </button>
                        ))}
                    </div>
                </div>
            ))}

            {/* Logout */}
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-red-50 active:bg-red-100 transition-colors"
                >
                    <div className="flex size-9 items-center justify-center rounded-xl bg-red-50 text-red-500 flex-shrink-0">
                        <LogOut size={18} />
                    </div>
                    <p className="text-sm font-semibold text-red-600">Cerrar Sesión</p>
                </button>
            </div>

            {/* Bottom spacing for safe area */}
            <div className="h-4" />
        </div>
    );
}