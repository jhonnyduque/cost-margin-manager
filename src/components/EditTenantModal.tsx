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
import { subscriptionConfig } from '@/platform/subscription.config';

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
    const [customPriceUSD, setCustomPriceUSD] = useState<string>(
        company.custom_price_cents ? (company.custom_price_cents / 100).toString() : ''
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            // Convert USD to cents, or null if empty
            const customPriceCents = customPriceUSD ? Math.round(parseFloat(customPriceUSD) * 100) : null;

            const { error: updateError } = await supabase
                .from('companies')
                .update({
                    name,
                    slug: slug.toLowerCase(),
                    subscription_status: status,
                    subscription_tier: tier,
                    seat_limit: seatLimit,
                    custom_price_cents: customPriceCents,
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
                className={`animate-in zoom-in-95 w-full max-w-xl overflow-hidden duration-200 ${tokens.shadow.modal} p-0`}
            >
                <header
                    className="flex items-center justify-between p-6 border-b border-slate-200 bg-white"
                >
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-10 h-10 ${tokens.colors.bgBrand} rounded-lg flex items-center justify-center text-white`}
                        >
                            <Building2 size={20} />
                        </div>
                        <div>
                            <h2
                                className={`text-2xl font-bold ${tokens.colors.textPrimary}`}
                            >
                                Editar Tenant
                            </h2>
                            <p className={`text-sm mt-1 ${tokens.colors.textSecondary}`}>
                                {company.name}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className={`text-slate-500 p-2 rounded-full transition-colors hover:bg-slate-100`}
                    >
                        <X size={20} />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="p-6">
                    {error && (
                        <div
                            className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-center gap-3 mb-6"
                        >
                            <AlertCircle size={18} className="text-red-500" />
                            <span className={`text-sm font-bold text-red-600`}>
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
                        {/* Custom Price Support for Enterprise/Special Deals */}
                        {user?.is_super_admin && tier === 'enterprise' && (
                            <div className="flex flex-col gap-2">
                                <Input
                                    type="number"
                                    step="0.01"
                                    label="Precio Manual MRR (USD)"
                                    placeholder="Ej: 499.00"
                                    value={customPriceUSD}
                                    onChange={e => setCustomPriceUSD(e.target.value)}
                                />
                                <p className="text-xs text-slate-500">
                                    Si se define, este monto **sobrescribe** el precio del plan en las finanzas.
                                    Útil para Enterprise o acuerdos especiales. Dejar vacío para usar precio de plan.
                                </p>
                            </div>
                        )}
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
                                    {company.current_period_ends_at && (
                                        <span className="ml-auto text-xs text-slate-500">
                                            Vence: {new Date(company.current_period_ends_at).toLocaleDateString()}
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
                                    onChange={e => {
                                        const newTier = e.target.value as any;
                                        setTier(newTier);
                                        // Auto-update seat limit based on plan rules
                                        const planConfig = subscriptionConfig.plans[newTier as keyof typeof subscriptionConfig.plans];
                                        if (planConfig) {
                                            setSeatLimit(planConfig.seat_limit);
                                        }
                                        // Reset manual price if not enterprise
                                        if (newTier !== 'enterprise') {
                                            setCustomPriceUSD('');
                                        }
                                    }}
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
                                        <div className="mt-1 text-xs text-slate-500 font-mono">
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
                                disabled={!user?.is_super_admin || tier !== 'enterprise'}
                                required
                            />
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Users size={14} />
                                <span>Activos: <strong>{company.seat_count || 0}</strong> / {seatLimit}</span>
                            </div>
                        </div>
                    </div>

                    <div
                        className="flex justify-end gap-3 pt-6 border-t border-slate-200"
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
