import React, { useState, useEffect } from 'react';
import { LimitIndicator } from '../components/LimitIndicator';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    CreditCard, User, Building2, Lock, Palette, Layers,
    Save, Eye, EyeOff, Smartphone, Globe, Bell, ChevronRight, Users,
} from 'lucide-react';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { Badge } from '@/components/ui/Badge';

export default function Settings() {
    const { user, currentCompany, userRole } = useAuth();
    const isSuperAdmin = user != null && !currentCompany;
    const isOwnerOrManager = userRole === 'owner' || userRole === 'manager';

    const [fullName, setFullName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (!user?.id) return;
        supabase.from('users').select('full_name').eq('id', user.id).single().then(({ data }) => { if (data?.full_name) setFullName(data.full_name); });
    }, [user?.id]);

    const handleSaveProfile = async () => {
        setProfileSaving(true); setProfileMessage(null);
        try {
            const updates: any = { data: { full_name: fullName } };
            if (newPassword) updates.password = newPassword;
            const { error } = await supabase.auth.updateUser(updates);
            if (error) throw error;
            if (user?.id) await supabase.from('users').update({ full_name: fullName }).eq('id', user.id);
            setNewPassword(''); setProfileMessage({ type: 'success', text: 'Perfil actualizado con éxito.' });
        } catch (err: any) { setProfileMessage({ type: 'error', text: err.message || 'Error al actualizar perfil.' }); }
        finally { setProfileSaving(false); }
    };

    return (
        <PageContainer>
            <SectionBlock>
                <header style={{ marginBottom: 'var(--space-32)' }}>
                    <h1 style={{ fontSize: 'var(--text-h1-size)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Configuración del Sistema</h1>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '42rem', marginTop: 'var(--space-8)' }}>
                        {isSuperAdmin ? 'Administración global de la plataforma y preferencias de tu cuenta maestra.' : 'Personaliza tu experiencia, gestiona tu suscripción y asegura tu cuenta.'}
                    </p>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-32)', alignItems: 'flex-start' }}>
                    {/* Left */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
                        {/* Perfil */}
                        <Card>
                            <Card.Header title="Información Personal" description="Datos públicos y credenciales de acceso." icon={<User style={{ color: 'var(--text-muted)' }} size={20} />} />
                            <Card.Content style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)', paddingTop: 'var(--space-16)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-16)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                                        <label style={{ fontSize: 'var(--text-caption-size)', fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase', padding: '0 var(--space-4)' }}>Nombre Completo</label>
                                        <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ej. Juan Pérez" />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                                        <label style={{ fontSize: 'var(--text-caption-size)', fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase', padding: '0 var(--space-4)' }}>Email (No Editable)</label>
                                        <Input value={user?.email || ''} disabled />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                                    <label style={{ fontSize: 'var(--text-caption-size)', fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase', padding: '0 var(--space-4)' }}>Nueva Contraseña</label>
                                    <div style={{ position: 'relative' }}>
                                        <Input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Dejar vacío para mantener contraseña actual" />
                                        <button onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 'var(--space-12)', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                                {profileMessage && (
                                    <div style={{ padding: 'var(--space-16)', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: 'var(--text-small-size)', background: 'var(--surface-page)', color: profileMessage.type === 'success' ? 'var(--text-secondary)' : 'var(--state-danger)', border: 'var(--border-default)' }}>
                                        {profileMessage.type === 'success' ? '✓ ' : '! '}{profileMessage.text}
                                    </div>
                                )}
                            </Card.Content>
                            <Card.Footer style={{ display: 'flex', justifyContent: 'flex-end', background: 'var(--surface-page)' }}>
                                <Button variant="primary" onClick={handleSaveProfile} isLoading={profileSaving} icon={<Save />}>GUARDAR PERFIL</Button>
                            </Card.Footer>
                        </Card>

                        {/* Plan */}
                        {!isSuperAdmin && (
                            <Card>
                                <Card.Header title="Suscripción y Límites" description="Estado actual de tu plan y consumo de recursos." icon={<CreditCard style={{ color: 'var(--text-muted)' }} size={20} />} />
                                <Card.Content style={{ paddingTop: 'var(--space-16)' }}><LimitIndicator /></Card.Content>
                            </Card>
                        )}

                        <NotificationSettings />
                    </div>

                    {/* Right */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
                        <SectionPlaceholder icon={<Lock size={20} style={{ color: 'var(--text-muted)' }} />} title="Seguridad Avanzada" description="2FA y control de dispositivos." items={[{ icon: <Smartphone size={16} />, label: 'Autenticación en 2 pasos' }, { icon: <Lock size={16} />, label: 'Historial de sesiones' }]} />
                        {isSuperAdmin ? (
                            <SectionPlaceholder icon={<Palette size={20} style={{ color: 'var(--text-muted)' }} />} title="Identidad Visual" description="Logo y colores globales." items={[{ icon: <Palette size={16} />, label: 'Paleta de colores' }, { icon: <Layers size={16} />, label: 'Logo y Favicon' }]} />
                        ) : isOwnerOrManager && (
                            <SectionPlaceholder icon={<Building2 size={20} style={{ color: 'var(--text-muted)' }} />} title="Empresa" description="Ajustes organizacionales." items={[{ icon: <Globe size={16} />, label: 'Zona horaria y Moneda' }, { icon: <Building2 size={16} />, label: 'Logo de empresa' }]} />
                        )}
                        {isSuperAdmin && (
                            <SectionPlaceholder icon={<Layers size={20} style={{ color: 'var(--text-muted)' }} />} title="Configuración de Planes" description="Estructura de precios y límites." items={[{ icon: <CreditCard size={16} />, label: 'Editar Catálogo de Planes' }, { icon: <Users size={16} />, label: 'Control de Seats' }]} />
                        )}
                    </div>
                </div>
            </SectionBlock>
        </PageContainer>
    );
}

/* ── Notification Settings ─────────────────────────────── */
function NotificationSettings() {
    const { user } = useAuth();
    const [preferences, setPreferences] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const eventLabels: Record<string, string> = {
        'LOW_STOCK': 'Stock Crítico', 'COST_DEVIATION': 'Desviación de Costos',
        'USER_INVITED': 'Invitaciones de Equipo', 'PAYMENT_FAILED': 'Errores de Cobro',
        'INVOICE_READY': 'Facturación Lista',
    };

    useEffect(() => { if (user?.id) loadPreferences(); }, [user?.id]);

    const loadPreferences = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('notification_preferences').select('*').eq('user_id', user?.id);
        if (!error && data) setPreferences(data);
        setLoading(false);
    };

    const togglePreference = async (eventKey: string, field: 'in_app_enabled' | 'email_enabled', currentVal: boolean) => {
        const { error } = await supabase.from('notification_preferences').upsert({ user_id: user?.id, event_key: eventKey, [field]: !currentVal }, { onConflict: 'user_id,event_key' });
        if (!error) setPreferences(prev => {
            const existing = prev.find(p => p.event_key === eventKey);
            if (existing) return prev.map(p => p.event_key === eventKey ? { ...p, [field]: !currentVal } : p);
            return [...prev, { event_key: eventKey, [field]: !currentVal }];
        });
    };

    if (loading) return <Card><Card.Content><div style={{ height: '8rem', background: 'var(--surface-page)', borderRadius: 'var(--radius-lg)' }} /></Card.Content></Card>;

    return (
        <Card>
            <Card.Header title="Canales de Notificación" description="Controla dónde quieres recibir las alertas críticas." icon={<Bell style={{ color: 'var(--text-muted)' }} size={20} />} />
            <Card.Content style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', paddingTop: 'var(--space-16)' }}>
                {Object.entries(eventLabels).map(([key, label]) => {
                    const pref = preferences.find(p => p.event_key === key) || { in_app_enabled: true, email_enabled: false };
                    return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-16)', background: 'var(--surface-page)', border: 'var(--border-default)', borderRadius: 'var(--radius-xl)', transition: 'background var(--transition-fast), box-shadow var(--transition-fast)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-card)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-page)'; e.currentTarget.style.boxShadow = 'none'; }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                                <div style={{ padding: 'var(--space-8)', background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: 'var(--border-default)' }}>
                                    <Bell size={16} style={{ color: 'var(--text-muted)' }} />
                                </div>
                                <span style={{ fontWeight: 900, color: 'var(--text-secondary)', fontSize: 'var(--text-body-size)' }}>{label}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-16)' }}>
                                {[
                                    { label: 'PLATAFORMA', field: 'in_app_enabled' as const, val: pref.in_app_enabled },
                                    { label: 'EMAIL', field: 'email_enabled' as const, val: pref.email_enabled, border: true },
                                ].map(t => (
                                    <div key={t.field} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', borderLeft: t.border ? 'var(--border-default)' : 'none', paddingLeft: t.border ? 'var(--space-16)' : 0 }}>
                                        <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--text-muted)' }}>{t.label}</span>
                                        <button onClick={() => togglePreference(key, t.field, t.val)}
                                            style={{ position: 'relative', display: 'inline-flex', height: '1.5rem', width: '2.75rem', alignItems: 'center', borderRadius: '999px', transition: 'background var(--transition-fast)', background: t.val ? 'var(--state-primary)' : 'var(--surface-muted)', border: 'none', cursor: 'pointer' }}>
                                            <span style={{ display: 'inline-block', width: '1rem', height: '1rem', borderRadius: '50%', background: 'var(--surface-card)', transition: 'transform var(--transition-fast)', transform: t.val ? 'translateX(1.5rem)' : 'translateX(0.25rem)' }} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </Card.Content>
        </Card>
    );
}

/* ── Section Placeholder ─────────────────────────────────── */
function SectionPlaceholder({ icon, title, description, items }: { icon: React.ReactNode; title: string; description: string; items: { icon: React.ReactNode; label: string }[] }) {
    return (
        <Card style={{ opacity: 0.8, border: '1px dashed var(--border-color-default)', transition: 'filter var(--transition-base)' }}
            onMouseEnter={(e: any) => (e.currentTarget.style.filter = 'none')}
            onMouseLeave={(e: any) => (e.currentTarget.style.filter = 'grayscale(0.5)')}>
            <Card.Header icon={icon} title={<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}><span>{title}</span><Badge variant="neutral" style={{ fontSize: '10px', height: '1rem', padding: '0 var(--space-6)' }}>PRÓXIMAMENTE</Badge></div>} description={description} />
            <Card.Content style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', paddingTop: 'var(--space-16)' }}>
                {items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', padding: 'var(--space-12) var(--space-16)', background: 'var(--surface-page)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--text-muted)', border: 'var(--border-default)' }}>
                        {item.icon}
                        <span style={{ flex: 1 }}>{item.label}</span>
                        <ChevronRight size={14} style={{ opacity: 0.3 }} />
                    </div>
                ))}
            </Card.Content>
        </Card>
    );
}