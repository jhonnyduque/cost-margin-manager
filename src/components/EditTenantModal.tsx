import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import {
    X,
    Save,
    Building2,
    AlertCircle,
    Loader2,
    Users
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { tokens } from '@/design/design-tokens';
import { useAuth } from '@/hooks/useAuth';

interface EditTenantModalProps {
    isOpen: boolean;
    company: any;
    onClose: () => void;
    onSuccess: () => void; // Renamed from onUpdate to match usage
}

const EditTenantModal: React.FC<EditTenantModalProps> = ({ isOpen, company, onClose, onSuccess }) => {
    if (!isOpen) return null;
    const { user } = useAuth();
    const [name, setName] = useState(company.name);
    const [slug, setSlug] = useState(company.slug);
    const [status, setStatus] = useState(company.subscription_status);
    const [tier, setTier] = useState(company.subscription_tier);
    const [seatLimit, setSeatLimit] = useState(company.seat_limit || 1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const { error: updateError } = await supabase
                .from('companies')
                .update({
                    name,
                    slug: slug.toLowerCase(),
                    subscription_status: status,
                    subscription_tier: tier,
                    seat_limit: seatLimit,
                    updated_at: new Date().toISOString()
                })
                .eq('id', company.id);

            if (updateError) throw updateError;

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error updating company:', err);
            setError(err.message || 'Error al actualizar la empresa.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{
                backgroundColor: 'rgba(15, 23, 42, 0.4)', // Slate-900 with opacity
                backdropFilter: 'blur(4px)'
            }}
        >
            <Card
                className="animate-in zoom-in-95 w-full max-w-xl overflow-hidden duration-200"
                style={{
                    boxShadow: tokens.shadow.elevated,
                    padding: 0 // Reset padding for custom header/body split
                }}
            >
                <header
                    style={{
                        padding: tokens.spacing.lg,
                        borderBottom: `1px solid ${tokens.colors.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'between',
                        backgroundColor: tokens.colors.bg
                    }}
                    className="flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <div
                            style={{
                                width: '40px',
                                height: '40px',
                                backgroundColor: tokens.colors.brand,
                                borderRadius: tokens.radius.md,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: tokens.colors.surface
                            }}
                        >
                            <Building2 size={20} />
                        </div>
                        <div>
                            <h2
                                style={{
                                    fontSize: tokens.typography.titleMd.fontSize,
                                    fontWeight: tokens.typography.titleMd.fontWeight,
                                    color: tokens.colors.text.primary
                                }}
                            >
                                Editar Tenant
                            </h2>
                            <p style={{ ...tokens.typography.caption, fontSize: '0.75rem' }}>
                                {company.name}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            color: tokens.colors.text.secondary,
                            padding: tokens.spacing.xs,
                            borderRadius: tokens.radius.full
                        }}
                        className="transition-colors hover:bg-gray-100"
                    >
                        <X size={20} />
                    </button>
                </header>

                <form onSubmit={handleSubmit} style={{ padding: tokens.spacing.lg }}>
                    {error && (
                        <div
                            style={{
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: `1px solid ${tokens.colors.error}`,
                                padding: tokens.spacing.md,
                                borderRadius: tokens.radius.md,
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing.sm,
                                marginBottom: tokens.spacing.lg
                            }}
                        >
                            <AlertCircle size={18} color={tokens.colors.error} />
                            <span style={{ fontSize: tokens.typography.caption.fontSize, fontWeight: 700, color: '#DC2626' }}>
                                {error}
                            </span>
                        </div>
                    )}

                    <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                        <Input
                            label="Nombre Comercial"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                        <Input
                            label="Slug / ID Único"
                            value={slug}
                            onChange={e => setSlug(e.target.value)}
                            required
                        />
                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-medium text-slate-500">Estado del Servicio</span>
                            {user?.is_super_admin ? (
                                <Select
                                    value={status}
                                    onChange={e => setStatus(e.target.value)}
                                >
                                    <option value="active">Active</option>
                                    <option value="trialing">Trialing</option>
                                    <option value="past_due">Past Due</option>
                                    <option value="canceled">Canceled</option>
                                    <option value="incomplete">Incomplete</option>
                                    <option value="incomplete_expired">Incomplete Expired</option>
                                    <option value="unpaid">Unpaid</option>
                                </Select>
                            ) : (
                                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                    {status === 'active' || status === 'trialing' ? (
                                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                    ) : (
                                        <div className="h-2 w-2 rounded-full bg-red-500" />
                                    )}
                                    <span className="capitalize">{status}</span>
                                    {company.current_period_end_at && (
                                        <span className="ml-auto text-xs text-slate-400">
                                            Vence: {new Date(company.current_period_end_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-medium text-slate-500">Nivel de Suscripción</span>
                            {user?.is_super_admin ? (
                                <Select
                                    value={tier || 'starter'}
                                    onChange={e => setTier(e.target.value)}
                                >
                                    <option value="demo">Demo</option>
                                    <option value="starter">Starter</option>
                                    <option value="growth">Growth</option>
                                    <option value="scale">Scale</option>
                                    <option value="enterprise">Enterprise</option>
                                </Select>
                            ) : (
                                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                    <span className="capitalize">{tier || 'Sin Plan'}</span>
                                    {company.stripe_price_id && (
                                        <div className="mt-1 text-[10px] text-slate-400 font-mono">
                                            ID: {company.stripe_price_id.slice(0, 16)}...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Seat Capacity Control (BETO OS Authority - still manual override allowed for now) */}
                        <div className="flex flex-col gap-2">
                            <Input
                                type="number"
                                label="Límite de Usuarios (Asientos)"
                                value={seatLimit}
                                onChange={e => setSeatLimit(parseInt(e.target.value) || 1)}
                                min={1}
                                required
                            />
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Users size={14} />
                                <span>Activos: <strong>{company.seat_count || 0}</strong> / {seatLimit}</span>
                            </div>
                        </div>
                    </div>

                    <div
                        className="flex justify-end gap-3 pt-6"
                        style={{ borderTop: `1px solid ${tokens.colors.border}` }}
                    >
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            isLoading={isSubmitting}
                            icon={<Save size={16} />}
                        >
                            Guardar Cambios
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default EditTenantModal;
