
import React, { useState, useEffect } from 'react';
import { LimitIndicator } from '../components/LimitIndicator';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { Card } from '../components/ui/Card';
import {
    CreditCard, User, Building2, Lock, Palette, Layers,
    Save, Eye, EyeOff, Smartphone, Globe, Bell, ChevronRight
} from 'lucide-react';

export default function Settings() {
    const { user, currentCompany, userRole } = useAuth();
    const isSuperAdmin = user != null && !currentCompany;
    const isOwnerOrManager = userRole === 'owner' || userRole === 'manager';

    // Profile form state
    const [fullName, setFullName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Cargar nombre real desde public.users (no de user_metadata)
    useEffect(() => {
        if (!user?.id) return;
        supabase.from('users').select('full_name').eq('id', user.id).single()
            .then(({ data }) => {
                if (data?.full_name) setFullName(data.full_name);
            });
    }, [user?.id]);

    const handleSaveProfile = async () => {
        setProfileSaving(true);
        setProfileMessage(null);
        try {
            const updates: any = { data: { full_name: fullName } };
            if (newPassword) updates.password = newPassword;

            const { error } = await supabase.auth.updateUser(updates);
            if (error) throw error;

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
        <div className="animate-in fade-in space-y-5 lg:space-y-6 duration-700">
            {/* Header — same as Environments/Billing/Team */}
            <header>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
                    Configuración
                </h1>
                <p className="mt-1 text-sm lg:text-base font-medium text-slate-500">
                    {isSuperAdmin
                        ? 'Configuración de la plataforma y tu cuenta de administrador.'
                        : 'Gestiona tu perfil, plan y preferencias de la plataforma.'}
                </p>
            </header>

            {/* ── 1. MI PERFIL ─────────────────────────────── */}
            <Card className="p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 flex-shrink-0">
                        <User size={20} className="text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-gray-900">Mi Perfil</h2>
                        <p className="text-sm text-gray-500">Información personal y credenciales de acceso.</p>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1">Nombre Completo</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Tu nombre"
                            className="w-full rounded-xl bg-white px-4 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1">Correo Electrónico</label>
                        <input
                            type="email"
                            value={user?.email || ''}
                            disabled
                            className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm text-gray-400 ring-1 ring-slate-200 cursor-not-allowed"
                        />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1">Nueva Contraseña</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Dejar vacío para mantener la actual"
                                className="w-full rounded-xl bg-white px-4 py-2.5 pr-12 text-sm text-slate-700 ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
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

                <div className="mt-5 flex justify-end">
                    <button
                        onClick={handleSaveProfile}
                        disabled={profileSaving}
                        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                        <Save size={16} />
                        {profileSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </Card>

            {/* ── 2. PLAN Y USO — solo empresa ────────────── */}
            {!isSuperAdmin && (
                <Card className="p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 flex-shrink-0">
                            <CreditCard size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-gray-900">Plan y Uso</h2>
                            <p className="text-sm text-gray-500">Información sobre tu suscripción actual y límites de consumo.</p>
                        </div>
                    </div>
                    <div className="max-w-md">
                        <LimitIndicator />
                    </div>
                </Card>
            )}

            {/* ── 3. PERFIL DE EMPRESA — Owner/Manager ────── */}
            {!isSuperAdmin && isOwnerOrManager && (
                <SectionPlaceholder
                    icon={<Building2 size={20} className="text-indigo-600" />}
                    title="Perfil de Empresa"
                    description="Configuración de tu organización."
                    items={[
                        { icon: <Building2 size={16} />, label: 'Nombre y logo de la empresa' },
                        { icon: <Globe size={16} />, label: 'Timezone y moneda predeterminada' },
                        { icon: <Layers size={16} />, label: 'Slug y dominio personalizado' },
                    ]}
                />
            )}

            {/* ── 4. SEGURIDAD — todos ────────────────────── */}
            <SectionPlaceholder
                icon={<Lock size={20} className="text-indigo-600" />}
                title="Seguridad"
                description="Protege tu cuenta con autenticación reforzada."
                items={[
                    { icon: <Smartphone size={16} />, label: 'Autenticación de dos factores (2FA)' },
                    { icon: <Lock size={16} />, label: 'Sesiones activas y dispositivos' },
                ]}
            />

            {/* ── 5. NOTIFICACIONES — todos ───────────────── */}
            <SectionPlaceholder
                icon={<Bell size={20} className="text-indigo-600" />}
                title="Notificaciones"
                description="Configura cómo y cuándo recibes alertas."
                items={[
                    { icon: <Bell size={16} />, label: 'Alertas de uso del plan (80%, 100%)' },
                    { icon: <CreditCard size={16} />, label: 'Notificaciones de facturación' },
                    { icon: <User size={16} />, label: 'Actividad del equipo' },
                ]}
            />

            {/* ── 6. BRANDING — Super Admin ───────────────── */}
            {isSuperAdmin && (
                <SectionPlaceholder
                    icon={<Palette size={20} className="text-indigo-600" />}
                    title="Branding de la Plataforma"
                    description="Personaliza la apariencia de tu plataforma SaaS."
                    items={[
                        { icon: <Palette size={16} />, label: 'Logo y favicon de la plataforma' },
                        { icon: <Globe size={16} />, label: 'Nombre del producto y dominio' },
                        { icon: <Layers size={16} />, label: 'Paleta de colores y tema' },
                    ]}
                />
            )}

            {/* ── 7. GESTIÓN DE PLANES — Super Admin ──────── */}
            {isSuperAdmin && (
                <SectionPlaceholder
                    icon={<Layers size={20} className="text-indigo-600" />}
                    title="Gestión de Planes"
                    description="Configura los planes de suscripción disponibles."
                    items={[
                        { icon: <CreditCard size={16} />, label: 'Editar límites por plan (usuarios, productos, storage)' },
                        { icon: <Layers size={16} />, label: 'Precios mensuales y anuales' },
                    ]}
                />
            )}
        </div>
    );
}

/* ── Placeholder Section ──────────────────────────────── */
function SectionPlaceholder({
    icon,
    title,
    description,
    items,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    items: { icon: React.ReactNode; label: string }[];
}) {
    return (
        <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 flex-shrink-0">
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-gray-900">{title}</h2>
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 ring-1 ring-amber-200">
                            Próximamente
                        </span>
                    </div>
                    <p className="text-sm text-gray-500">{description}</p>
                </div>
            </div>
            <div className="space-y-2 opacity-60">
                {items.map((item, i) => (
                    <div
                        key={i}
                        className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500"
                    >
                        <span className="text-gray-400">{item.icon}</span>
                        <span className="flex-1">{item.label}</span>
                        <ChevronRight size={14} className="text-gray-300" />
                    </div>
                ))}
            </div>
        </Card>
    );
}
