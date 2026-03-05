import React, { useState, useEffect } from 'react';
import { LimitIndicator } from '../components/LimitIndicator';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    CreditCard, User, Building2, Lock, Palette, Layers,
    Save, Eye, EyeOff, Smartphone, Globe, Bell, ChevronRight, Users
} from 'lucide-react';
import { colors, typography } from '@/design/design-tokens';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { Badge } from '@/components/ui/Badge';

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
        <PageContainer>
            <SectionBlock>
                <header>
                    <h1 className={`${typography.text.title} ${colors.textPrimary} tracking-tight`}>
                        Configuración del Sistema
                    </h1>
                    <p className={`${typography.text.body} ${colors.textSecondary} max-w-2xl`}>
                        {isSuperAdmin
                            ? 'Administración global de la plataforma y preferencias de tu cuenta maestra.'
                            : 'Personaliza tu experiencia, gestiona tu suscripción y asegura tu cuenta.'}
                    </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Panel Izquierdo: Cuenta y Seguridad */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* MI PERFIL */}
                        <Card>
                            <Card.Header
                                title="Información Personal"
                                description="Datos públicos y credenciales de acceso."
                                icon={<User className="text-indigo-600" size={20} />}
                            />
                            <Card.Content className="space-y-6 pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className={`${typography.text.caption} font-black ${colors.textSecondary} uppercase px-1`}>Nombre Completo</label>
                                        <Input
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="Ej. Juan Pérez"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className={`${typography.text.caption} font-black ${colors.textSecondary} uppercase px-1`}>Email (No Editable)</label>
                                        <Input
                                            value={user?.email || ''}
                                            disabled
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className={`${typography.text.caption} font-black ${colors.textSecondary} uppercase px-1`}>Nueva Contraseña</label>
                                    <div className="relative">
                                        <Input
                                            type={showPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Dejar vacío para mantener contraseña actual"
                                        />
                                        <button
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {profileMessage && (
                                    <div className={`p-4 rounded-xl font-bold text-sm ${profileMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                        {profileMessage.type === 'success' ? '✓ ' : '! '}{profileMessage.text}
                                    </div>
                                )}
                            </Card.Content>
                            <Card.Footer className="flex justify-end bg-slate-50/50">
                                <Button
                                    variant="primary"
                                    onClick={handleSaveProfile}
                                    isLoading={profileSaving}
                                    icon={<Save />}
                                >
                                    GUARDAR PERFIL
                                </Button>
                            </Card.Footer>
                        </Card>

                        {/* PLAN Y USO */}
                        {!isSuperAdmin && (
                            <Card>
                                <Card.Header
                                    title="Suscripción y Límites"
                                    description="Estado actual de tu plan y consumo de recursos."
                                    icon={<CreditCard className="text-indigo-600" size={20} />}
                                />
                                <Card.Content className="pt-4">
                                    <LimitIndicator />
                                </Card.Content>
                            </Card>
                        )}

                        {/* NOTIFICACIONES */}
                        <NotificationSettings />
                    </div>

                    {/* Panel Derecho: Otros Ajustes o Placeholders */}
                    <div className="space-y-6">
                        {/* SEGURIDAD Placeholder */}
                        <SectionPlaceholder
                            icon={<Lock size={20} className="text-indigo-600" />}
                            title="Seguridad Avanzada"
                            description="2FA y control de dispositivos."
                            items={[
                                { icon: <Smartphone size={16} />, label: 'Autenticación en 2 pasos' },
                                { icon: <Lock size={16} />, label: 'Historial de sesiones' },
                            ]}
                        />

                        {/* BRANDING (Super Admin) or COMPANY PROFILE */}
                        {isSuperAdmin ? (
                            <SectionPlaceholder
                                icon={<Palette size={20} className="text-indigo-600" />}
                                title="Identidad Visual"
                                description="Logo y colores globales."
                                items={[
                                    { icon: <Palette size={16} />, label: 'Paleta de colores' },
                                    { icon: <Layers size={16} />, label: 'Logo y Favicon' },
                                ]}
                            />
                        ) : isOwnerOrManager && (
                            <SectionPlaceholder
                                icon={<Building2 size={20} className="text-indigo-600" />}
                                title="Empresa"
                                description="Ajustes organizacionales."
                                items={[
                                    { icon: <Globe size={16} />, label: 'Zona horaria y Moneda' },
                                    { icon: <Building2 size={16} />, label: 'Logo de empresa' },
                                ]}
                            />
                        )}

                        {isSuperAdmin && (
                            <SectionPlaceholder
                                icon={<Layers size={20} className="text-indigo-600" />}
                                title="Configuración de Planes"
                                description="Estructura de precios y límites."
                                items={[
                                    { icon: <CreditCard size={16} />, label: 'Editar Catálogo de Planes' },
                                    { icon: <Users size={16} />, label: 'Control de Seats' },
                                ]}
                            />
                        )}
                    </div>
                </div>
            </SectionBlock>
        </PageContainer>
    );
}

/* ── Notification Settings Section ─────────────────────── */
function NotificationSettings() {
    const { user } = useAuth();
    const [preferences, setPreferences] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const eventLabels: Record<string, string> = {
        'LOW_STOCK': 'Stock Crítico',
        'COST_DEVIATION': 'Desviación de Costos',
        'USER_INVITED': 'Invitaciones de Equipo',
        'PAYMENT_FAILED': 'Errores de Cobro',
        'INVOICE_READY': 'Facturación Lista',
    };

    useEffect(() => {
        if (!user?.id) return;
        loadPreferences();
    }, [user?.id]);

    const loadPreferences = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('notification_preferences')
            .select('*')
            .eq('user_id', user?.id);

        if (!error && data) setPreferences(data);
        setLoading(false);
    };

    const togglePreference = async (eventKey: string, field: 'in_app_enabled' | 'email_enabled', currentVal: boolean) => {
        const { error } = await supabase
            .from('notification_preferences')
            .upsert({
                user_id: user?.id,
                event_key: eventKey,
                [field]: !currentVal
            }, { onConflict: 'user_id,event_key' });

        if (!error) {
            setPreferences(prev => {
                const existing = prev.find(p => p.event_key === eventKey);
                if (existing) return prev.map(p => p.event_key === eventKey ? { ...p, [field]: !currentVal } : p);
                return [...prev, { event_key: eventKey, [field]: !currentVal }];
            });
        }
    };

    if (loading) return <Card className="animate-pulse"><Card.Content><div className="h-32 bg-slate-50 rounded-xl" /></Card.Content></Card>;

    return (
        <Card>
            <Card.Header
                title="Canales de Notificación"
                description="Controla dónde quieres recibir las alertas críticas."
                icon={<Bell className="text-indigo-600" size={20} />}
            />
            <Card.Content className="space-y-2 pt-4">
                {Object.entries(eventLabels).map(([key, label]) => {
                    const pref = preferences.find(p => p.event_key === key) || { in_app_enabled: true, email_enabled: false };
                    return (
                        <div key={key} className={`flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl transition-all hover:bg-white hover:shadow-sm`}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                                    <Bell size={16} className="text-slate-400" />
                                </div>
                                <span className={`${typography.text.body} font-black text-slate-700`}>{label}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className={`${typography.text.caption} font-bold text-slate-400`}>PLATAFORMA</span>
                                    <button
                                        onClick={() => togglePreference(key, 'in_app_enabled', pref.in_app_enabled)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${pref.in_app_enabled ? 'bg-indigo-600' : 'bg-slate-200 shadow-inner'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pref.in_app_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                                    <span className={`${typography.text.caption} font-bold text-slate-400`}>EMAIL</span>
                                    <button
                                        onClick={() => togglePreference(key, 'email_enabled', pref.email_enabled)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${pref.email_enabled ? 'bg-indigo-600' : 'bg-slate-200 shadow-inner'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pref.email_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </Card.Content>
        </Card>
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
        <Card className="opacity-80 grayscale-[0.5] hover:grayscale-0 transition-all border-dashed">
            <Card.Header
                icon={icon}
                title={
                    <div className="flex items-center gap-2">
                        <span>{title}</span>
                        <Badge variant="neutral" className="text-[10px] py-0 h-4">PRÓXIMAMENTE</Badge>
                    </div>
                }
                description={description}
            />
            <Card.Content className="space-y-2 pt-4">
                {items.map((item, i) => (
                    <div
                        key={i}
                        className={`flex items-center gap-3 px-4 py-3 bg-slate-50/50 rounded-xl ${typography.text.caption} font-bold text-slate-400 border border-slate-100`}
                    >
                        {item.icon}
                        <span className="flex-1">{item.label}</span>
                        <ChevronRight size={14} className="opacity-30" />
                    </div>
                ))}
            </Card.Content>
        </Card>
    );
}
