
import React, { useState } from 'react';
import { LimitIndicator } from '../components/LimitIndicator';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import {
    ShieldCheck, CreditCard, User, Building2, Lock, Palette, Layers,
    ChevronRight, Save, Eye, EyeOff, Smartphone, Globe, Bell
} from 'lucide-react';

export default function Settings() {
    const { user, session, currentCompany, userRole } = useAuth();
    const isSuperAdmin = user != null && !currentCompany;
    const isOwnerOrManager = userRole === 'owner' || userRole === 'manager';

    // Profile form state
    const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSaveProfile = async () => {
        setProfileSaving(true);
        setProfileMessage(null);
        try {
            const updates: any = { data: { full_name: fullName } };
            if (newPassword) updates.password = newPassword;

            const { error } = await supabase.auth.updateUser(updates);
            if (error) throw error;

            // Also update public.users table
            if (user?.id) {
                await supabase.from('users').update({ full_name: fullName }).eq('id', user.id);
            }

            setNewPassword('');
            setProfileMessage({ type: 'success', text: 'Perfil actualizado con éxito.' });
        } catch (err: any) {
            setProfileMessage({ type: 'error', text: err.message || 'Error al actualizar perfil.' });
        } finally {
            setProfileSaving(false);
        }
    };

    return (
        <div className="animate-in fade-in mx-auto max-w-4xl space-y-10 duration-700">
            {/* Header */}
            <header>
                <div className="mb-2 flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                        <ShieldCheck size={24} />
                    </div>
                    <span className="text-sm font-black uppercase tracking-widest text-indigo-600">Configuración</span>
                </div>
                <h1 className="text-4xl font-black tracking-tight text-slate-900">Ajustes del Sistema</h1>
                <p className="mt-2 font-medium text-slate-500">
                    {isSuperAdmin
                        ? 'Configuración de la plataforma y tu cuenta de administrador.'
                        : 'Gestiona tu plan, suscripción y preferencias de la plataforma.'}
                </p>
            </header>

            <main className="space-y-8">

                {/* ═══════════════════════════════════════════════════════ */}
                {/* 1. MI PERFIL — editable */}
                {/* ═══════════════════════════════════════════════════════ */}
                <Section
                    icon={<User size={24} />}
                    title="Mi Perfil"
                    description="Información personal y credenciales de acceso."
                >
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre Completo</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Tu nombre"
                                className="w-full rounded-2xl border-none bg-gray-50 px-5 py-3 text-sm text-gray-900 transition-all focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Correo Electrónico</label>
                            <input
                                type="email"
                                value={user?.email || ''}
                                disabled
                                className="w-full rounded-2xl border-none bg-gray-100 px-5 py-3 text-sm text-gray-500 cursor-not-allowed"
                            />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Nueva Contraseña</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Dejar vacío para mantener la actual"
                                    className="w-full rounded-2xl border-none bg-gray-50 px-5 py-3 pr-12 text-sm text-gray-900 transition-all focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {profileMessage && (
                        <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${profileMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {profileMessage.type === 'success' ? '✓' : '!'} {profileMessage.text}
                        </div>
                    )}

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={handleSaveProfile}
                            disabled={profileSaving}
                            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
                        >
                            <Save size={16} />
                            {profileSaving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </Section>

                {/* ═══════════════════════════════════════════════════════ */}
                {/* 2. PLAN Y USO — solo para usuarios de empresa */}
                {/* ═══════════════════════════════════════════════════════ */}
                {!isSuperAdmin && (
                    <Section
                        icon={<CreditCard size={24} />}
                        title="Plan y Uso"
                        description="Información sobre tu suscripción actual y límites de consumo."
                    >
                        <div className="max-w-md">
                            <LimitIndicator />
                        </div>
                    </Section>
                )}

                {/* ═══════════════════════════════════════════════════════ */}
                {/* 3. PERFIL DE EMPRESA — solo Owner/Manager */}
                {/* ═══════════════════════════════════════════════════════ */}
                {!isSuperAdmin && isOwnerOrManager && (
                    <Section
                        icon={<Building2 size={24} />}
                        title="Perfil de Empresa"
                        description="Configuración de tu organización."
                        comingSoon
                    >
                        <PlaceholderList items={[
                            { icon: <Building2 size={16} />, label: 'Nombre y logo de la empresa' },
                            { icon: <Globe size={16} />, label: 'Timezone y moneda predeterminada' },
                            { icon: <Layers size={16} />, label: 'Slug y dominio personalizado' },
                        ]} />
                    </Section>
                )}

                {/* ═══════════════════════════════════════════════════════ */}
                {/* 4. SEGURIDAD — todos */}
                {/* ═══════════════════════════════════════════════════════ */}
                <Section
                    icon={<Lock size={24} />}
                    title="Seguridad"
                    description="Protege tu cuenta con autenticación reforzada."
                    comingSoon
                >
                    <PlaceholderList items={[
                        { icon: <Smartphone size={16} />, label: 'Autenticación de dos factores (2FA)' },
                        { icon: <Lock size={16} />, label: 'Sesiones activas y dispositivos' },
                        { icon: <ShieldCheck size={16} />, label: 'Registro de actividad de seguridad' },
                    ]} />
                </Section>

                {/* ═══════════════════════════════════════════════════════ */}
                {/* 5. NOTIFICACIONES — todos */}
                {/* ═══════════════════════════════════════════════════════ */}
                <Section
                    icon={<Bell size={24} />}
                    title="Notificaciones"
                    description="Configura cómo y cuándo recibes alertas."
                    comingSoon
                >
                    <PlaceholderList items={[
                        { icon: <Bell size={16} />, label: 'Alertas de uso del plan (80%, 100%)' },
                        { icon: <CreditCard size={16} />, label: 'Notificaciones de facturación' },
                        { icon: <User size={16} />, label: 'Actividad del equipo' },
                    ]} />
                </Section>

                {/* ═══════════════════════════════════════════════════════ */}
                {/* 6. SUPER ADMIN: BRANDING — solo Super Admin */}
                {/* ═══════════════════════════════════════════════════════ */}
                {isSuperAdmin && (
                    <Section
                        icon={<Palette size={24} />}
                        title="Branding de la Plataforma"
                        description="Personaliza la apariencia de tu plataforma SaaS."
                        comingSoon
                    >
                        <PlaceholderList items={[
                            { icon: <Palette size={16} />, label: 'Logo y favicon de la plataforma' },
                            { icon: <Globe size={16} />, label: 'Nombre del producto y dominio' },
                            { icon: <Layers size={16} />, label: 'Paleta de colores y tema' },
                        ]} />
                    </Section>
                )}

                {/* ═══════════════════════════════════════════════════════ */}
                {/* 7. SUPER ADMIN: GESTIÓN DE PLANES — solo Super Admin */}
                {/* ═══════════════════════════════════════════════════════ */}
                {isSuperAdmin && (
                    <Section
                        icon={<Layers size={24} />}
                        title="Gestión de Planes"
                        description="Configura los planes de suscripción disponibles."
                        comingSoon
                    >
                        <PlaceholderList items={[
                            { icon: <CreditCard size={16} />, label: 'Editar límites por plan (usuarios, productos, storage)' },
                            { icon: <Layers size={16} />, label: 'Precios mensuales y anuales' },
                            { icon: <ShieldCheck size={16} />, label: 'Permisos y capabilities por tier' },
                        ]} />
                    </Section>
                )}
            </main>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* SUBCOMPONENTS                                                          */
/* ═══════════════════════════════════════════════════════════════════════ */

function Section({
    icon,
    title,
    description,
    comingSoon,
    children
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    comingSoon?: boolean;
    children: React.ReactNode;
}) {
    return (
        <section className="relative overflow-hidden rounded-[2rem] border border-gray-100 bg-white p-8 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.05)] md:p-10 transition-shadow hover:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.08)]">
            <div className="absolute right-0 top-0 size-28 rounded-bl-full bg-indigo-50/40"></div>

            <div className="mb-6 flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                    {icon}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-black tracking-tight text-slate-900">{title}</h2>
                        {comingSoon && (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-600 ring-1 ring-amber-200">
                                Próximamente
                            </span>
                        )}
                    </div>
                    <p className="text-sm font-medium text-slate-500">{description}</p>
                </div>
            </div>

            <div className={comingSoon ? 'opacity-60' : ''}>
                {children}
            </div>
        </section>
    );
}

function PlaceholderList({ items }: { items: { icon: React.ReactNode; label: string }[] }) {
    return (
        <div className="space-y-3">
            {items.map((item, i) => (
                <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500 transition-colors"
                >
                    <span className="text-gray-400">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight size={14} className="text-gray-300" />
                </div>
            ))}
        </div>
    );
}
